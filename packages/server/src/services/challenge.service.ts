/**
 * Service Challenge — systeme de defis pour le stream.
 *
 * Deux types de defis :
 *   - counter : un compteur a atteindre (ex: 20 squatts). Le target s'accumule
 *     via les lancers de des, l'admin incremente le current quand c'est fait.
 *   - timer : un decompte en secondes (ex: 2 min voix de Stitch). Le target
 *     s'accumule via les D4, l'admin demarre/arrete le decompte.
 *
 * Principe cumulatif : si un defi "squatts" existe deja, les nouveaux lancers
 * ajoutent au target existant (5/20 → 5/28). Un seul compteur par nom par stream.
 *
 * Le timer decompte cote client (overlay React) pour la fluidite. Le serveur
 * garde l'etat de reference et sync via WS.
 */

import { prisma } from "../db/client";
import { broadcast } from "../ws/broadcaster";
import { getCurrentStreamId, sendChatMessage } from "./streamerbot.service";
import type { ChallengePayload, ChallengeType, ChallengeCreditsEntry } from "@castellan/shared";

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/** Transforme un record Prisma en payload WS */
function toPayload(c: {
  id: string;
  type: string;
  name: string;
  label: string;
  icon: string | null;
  current: number;
  target: number;
  isActive: boolean;
  isRunning: boolean;
  startedAt: Date | null;
}): ChallengePayload {
  return {
    id: c.id,
    type: c.type as ChallengeType,
    name: c.name,
    label: c.label,
    icon: c.icon,
    current: c.current,
    target: c.target,
    isActive: c.isActive,
    isRunning: c.isRunning,
    startedAt: c.startedAt?.toISOString() ?? null,
  };
}

// ═══════════════════════════════════════════════════════════════
// CREATE / ADD — Creer ou ajouter a un defi existant
// ═══════════════════════════════════════════════════════════════

interface AddChallengeParams {
  name: string;
  label: string;
  type: ChallengeType;
  amount: number;    // counter: nombre a ajouter au target | timer: secondes a ajouter
  icon?: string;
}

/**
 * Cree un nouveau defi ou ajoute au target d'un defi existant (cumulatif).
 * Retourne le defi mis a jour.
 *
 * Pour les timers en cours (isRunning), on ne peut pas juste faire
 * current += amount en BDD car le client calcule remaining = current - elapsed.
 * Il faut d'abord "snapshotter" le remaining reel, puis ajouter amount.
 */
export async function addChallenge(params: AddChallengeParams): Promise<ChallengePayload | null> {
  const streamId = getCurrentStreamId();
  if (!streamId) {
    console.warn("[Challenge] Pas de stream en cours, impossible de creer un defi");
    return null;
  }

  const { name, label, type, amount, icon } = params;
  const isTimer = type === "timer";

  // Verifier si un defi existant est en cours (pour les timers running)
  const existing = await prisma.challenge.findUnique({
    where: { streamId_name: { streamId, name } },
  });

  // Timer en cours → snapshot remaining + ajout, reset startedAt
  if (existing && isTimer && existing.isRunning && existing.startedAt) {
    const elapsed = Math.floor((Date.now() - existing.startedAt.getTime()) / 1000);
    const remaining = Math.max(0, existing.current - elapsed);
    const newCurrent = remaining + amount;

    const challenge = await prisma.challenge.update({
      where: { id: existing.id },
      data: {
        target: existing.target + amount,
        current: newCurrent,
        startedAt: new Date(), // reset pour que le client recalcule depuis maintenant
        isActive: true,
        completedAt: null,
      },
    });

    console.log(`[Challenge] ${label} : +${amount}s au timer running (remaining: ${remaining} → ${newCurrent}, total target: ${challenge.target})`);

    const payload = toPayload(challenge);
    broadcast({ type: "challenge:update", payload });
    return payload;
  }

  // Cas standard : upsert (creation ou ajout cumulatif hors timer running)
  const challenge = await prisma.challenge.upsert({
    where: { streamId_name: { streamId, name } },
    create: {
      streamId,
      type,
      name,
      label,
      icon: icon ?? null,
      target: amount,
      current: isTimer ? amount : 0, // timer: current = temps restant initial
      isActive: true,
      isRunning: false,
    },
    update: {
      target: { increment: amount },
      // Pour les timers (pas en cours), ajouter du temps au current aussi
      ...(isTimer ? { current: { increment: amount } } : {}),
      // Reactiver si le defi etait complete
      isActive: true,
      completedAt: null,
    },
  });

  console.log(`[Challenge] ${label} : +${amount} au target (total: ${challenge.target})`);

  const payload = toPayload(challenge);
  broadcast({ type: "challenge:update", payload });
  return payload;
}

// ═══════════════════════════════════════════════════════════════
// UPDATE — Incrementer / Decrementer le current (admin)
// ═══════════════════════════════════════════════════════════════

/**
 * Incremente le current d'un counter (ex: +1 squatt realise).
 * Si current >= target, marque comme complete.
 */
export async function incrementChallenge(
  challengeId: string,
  amount: number
): Promise<ChallengePayload | null> {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge || !challenge.isActive) return null;

  const newCurrent = Math.min(challenge.current + amount, challenge.target);
  const isComplete = newCurrent >= challenge.target;

  const updated = await prisma.challenge.update({
    where: { id: challengeId },
    data: {
      current: newCurrent,
      ...(isComplete
        ? { isActive: false, isRunning: false, completedAt: new Date() }
        : {}),
    },
  });

  const payload = toPayload(updated);

  if (isComplete) {
    console.log(`[Challenge] ${challenge.label} COMPLETE ! (${newCurrent}/${challenge.target})`);
    broadcast({
      type: "challenge:completed",
      payload: {
        id: updated.id,
        name: updated.name,
        label: updated.label,
        type: updated.type as ChallengeType,
        finalValue: updated.target,
      },
    });
    // L'Intendant félicite dans le chat
    sendChatMessage(`✅ Défi ${challenge.label} complété ! ${challenge.target} ${challenge.label.toLowerCase()} réalisés ! GG Kavaliero 🎉`).catch(() => {});
  } else {
    console.log(`[Challenge] ${challenge.label} : ${newCurrent}/${challenge.target}`);
  }

  broadcast({ type: "challenge:update", payload });
  return payload;
}

// ═══════════════════════════════════════════════════════════════
// TIMER — Start / Stop / Tick
// ═══════════════════════════════════════════════════════════════

/**
 * Demarre le decompte d'un timer. Le client decompte localement,
 * le serveur garde l'etat de reference.
 */
export async function startTimer(challengeId: string): Promise<ChallengePayload | null> {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge || !challenge.isActive || challenge.type !== "timer") return null;

  // Calculer le current (temps restant) en tenant compte du temps deja ecoule
  // Si le timer a deja ete demarre puis arrete, current reflete le restant
  const updated = await prisma.challenge.update({
    where: { id: challengeId },
    data: {
      isRunning: true,
      startedAt: new Date(),
    },
  });

  console.log(`[Challenge] Timer ${challenge.label} DEMARRE (${challenge.current}s restantes)`);

  const payload = toPayload(updated);
  broadcast({ type: "challenge:update", payload });
  return payload;
}

/**
 * Arrete le decompte d'un timer (pause).
 * Sauvegarde le temps restant calcule.
 */
export async function stopTimer(challengeId: string): Promise<ChallengePayload | null> {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge || !challenge.isRunning || challenge.type !== "timer") return null;

  // Calculer le temps ecoule depuis le start
  const elapsed = challenge.startedAt
    ? Math.floor((Date.now() - challenge.startedAt.getTime()) / 1000)
    : 0;

  const remaining = Math.max(0, challenge.current - elapsed);

  const updated = await prisma.challenge.update({
    where: { id: challengeId },
    data: {
      isRunning: false,
      current: remaining,
      startedAt: null,
    },
  });

  console.log(`[Challenge] Timer ${challenge.label} ARRETE (${remaining}s restantes)`);

  const payload = toPayload(updated);
  broadcast({ type: "challenge:update", payload });
  return payload;
}

/**
 * Complete un timer manuellement (ou appele par le tick quand il arrive a 0).
 */
export async function completeTimer(challengeId: string): Promise<void> {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge || !challenge.isActive) return;

  await prisma.challenge.update({
    where: { id: challengeId },
    data: {
      isActive: false,
      isRunning: false,
      current: 0,
      completedAt: new Date(),
      startedAt: null,
    },
  });

  console.log(`[Challenge] Timer ${challenge.label} TERMINE !`);

  broadcast({
    type: "challenge:completed",
    payload: {
      id: challenge.id,
      name: challenge.name,
      label: challenge.label,
      type: challenge.type as ChallengeType,
      finalValue: challenge.target,
    },
  });

  // L'Intendant annonce la fin du timer
  const totalMin = Math.ceil(challenge.target / 60);
  sendChatMessage(`⏰ Temps écoulé ! ${challenge.label} terminé après ${totalMin} min. Kavaliero est libéré ! 🏰`).catch(() => {});

  broadcast({
    type: "challenge:update",
    payload: toPayload({
      ...challenge,
      isActive: false,
      isRunning: false,
      current: 0,
      completedAt: new Date(),
      startedAt: null,
    }),
  });
}

// ═══════════════════════════════════════════════════════════════
// TIMER TICK — Verifie les timers en cours et complete ceux a 0
// ═══════════════════════════════════════════════════════════════

let tickInterval: ReturnType<typeof setInterval> | null = null;
let tickErrorCount = 0;

/**
 * Demarre le tick toutes les secondes pour verifier les timers.
 * Le tick calcule le temps restant et complete les timers arrives a 0.
 * Si la table n'existe pas encore (migration non appliquee), on log une seule fois
 * et on attend silencieusement.
 */
export function startTimerTick(): void {
  if (tickInterval) return; // deja actif

  tickInterval = setInterval(async () => {
    try {
      const runningTimers = await prisma.challenge.findMany({
        where: { type: "timer", isRunning: true, isActive: true },
      });

      tickErrorCount = 0; // Reset si succes

      for (const timer of runningTimers) {
        if (!timer.startedAt) continue;

        const elapsed = Math.floor((Date.now() - timer.startedAt.getTime()) / 1000);
        const remaining = Math.max(0, timer.current - elapsed);

        if (remaining <= 0) {
          await completeTimer(timer.id);
        }
      }
    } catch (err: unknown) {
      tickErrorCount++;
      // Log une seule fois pour ne pas spammer (table manquante = migration non faite)
      if (tickErrorCount === 1) {
        const isPrismaError = err instanceof Error && "code" in err && (err as { code: string }).code === "P2021";
        if (isPrismaError) {
          console.warn("[Challenge] Table Challenge introuvable — lancer `pnpm prisma migrate dev` pour creer la table");
        } else {
          console.error("[Challenge] Erreur tick timer:", err);
        }
      }
    }
  }, 1000);

  console.log("[Challenge] Timer tick demarre");
}

export function stopTimerTick(): void {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
    console.log("[Challenge] Timer tick arrete");
  }
}

// ═══════════════════════════════════════════════════════════════
// QUERY — Lister les defis actifs
// ═══════════════════════════════════════════════════════════════

/**
 * Retourne tous les defis actifs du stream en cours.
 *
 * IMPORTANT : On envoie les valeurs brutes de la BDD (current + startedAt).
 * C'est l'overlay (client) qui calcule le remaining via :
 *   remaining = current - elapsed_since_startedAt
 *
 * Si on recalculait ici, l'overlay ferait une double soustraction
 * (server soustrait elapsed, puis client soustrait encore elapsed).
 */
export async function getActiveChallenges(): Promise<ChallengePayload[]> {
  const streamId = getCurrentStreamId();
  if (!streamId) return [];

  const challenges = await prisma.challenge.findMany({
    where: { streamId, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  return challenges.map((c) => toPayload(c));
}

/**
 * Retourne TOUS les defis du stream (actifs + completes), pour l'admin.
 */
export async function getAllChallenges(): Promise<ChallengePayload[]> {
  const streamId = getCurrentStreamId();
  if (!streamId) return [];

  const challenges = await prisma.challenge.findMany({
    where: { streamId },
    orderBy: { createdAt: "asc" },
  });

  return challenges.map((c) => {
    const payload = toPayload(c);
    if (c.type === "timer" && c.isRunning && c.startedAt) {
      const elapsed = Math.floor((Date.now() - c.startedAt.getTime()) / 1000);
      payload.current = Math.max(0, c.current - elapsed);
    }
    return payload;
  });
}

// ═══════════════════════════════════════════════════════════════
// CREDITS — Stats pour les credits de fin de stream
// ═══════════════════════════════════════════════════════════════

/**
 * Agrege les defis completes pour les credits de fin.
 * Retourne les totaux par type de defi.
 */
export async function getChallengeCredits(streamId: string): Promise<ChallengeCreditsEntry[]> {
  const challenges = await prisma.challenge.findMany({
    where: { streamId, completedAt: { not: null } },
  });

  return challenges.map((c) => ({
    name: c.name,
    label: c.label,
    icon: c.icon,
    type: c.type as ChallengeType,
    totalValue: c.target,
  }));
}

// ═══════════════════════════════════════════════════════════════
// ADMIN — Actions manuelles
// ═══════════════════════════════════════════════════════════════

/**
 * Supprime un defi (admin). Broadcast la mise a jour.
 */
export async function removeChallenge(challengeId: string): Promise<boolean> {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) return false;

  await prisma.challenge.delete({ where: { id: challengeId } });

  console.log(`[Challenge] ${challenge.label} supprime`);

  // Broadcast la liste mise a jour
  const challenges = await getActiveChallenges();
  broadcast({ type: "challenge:list", payload: { challenges } });

  return true;
}
