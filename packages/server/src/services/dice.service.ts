/**
 * Service Dice — systeme de des pour le stream.
 *
 * Commandes :
 *   - !d6  → consomme une capacite follow, lance un d6 squatt
 *   - !d12 → consomme une capacite sub/raid, lance un d12 squatt
 *   - !d20 → lance un d20 roue (auto-select meilleur tier dispo)
 *
 * Tiers de des :
 *   - follow  : gagne via carte de fidelite (10 tampons). d6 squatt / d20 follow-roue
 *   - sub     : gagne a chaque sub/resub. d12 squatt / d20 sub-roue
 *   - raid    : gagne a chaque raid. d12 squatt / d20 sub-roue
 *
 * Regles :
 *   - Une capacite = un usage unique (soit squatt via !d6/!d12, soit roue via !d20)
 *   - !d6 force le tier follow, !d12 force le tier sub/raid
 *   - !d20 utilise le meilleur tier disponible (sub/raid > follow)
 *   - Pour squatt : follow = d6, sub/raid = d12
 *   - Pour roue : toujours d20. Si resultat = 20 → roue de gains
 *   - Roue follow = gains modestes, roue sub = gains plus genereux
 */

import { prisma } from "../db/client";
import { broadcast } from "../ws/broadcaster";
import type { DiceTier, DieType } from "@castellan/shared";

/** Username du broadcaster — fallback quand getBroadcasterId() est null (stream pas demarre) */
const BROADCASTER_USERNAME = "kavalierogamedev";

/** Verifie si un viewerId est le broadcaster (import lazy pour eviter circular dep) */
async function isBroadcaster(viewerId: string): Promise<boolean> {
  const viewer = await prisma.viewer.findUnique({
    where: { id: viewerId },
    select: { twitchId: true, username: true },
  });
  if (!viewer) return false;

  // Fallback sur le username si le broadcaster ID n'est pas encore connu
  const { getBroadcasterId } = await import("./streamerbot.service");
  const broadcasterId = getBroadcasterId();
  if (broadcasterId) return viewer.twitchId === broadcasterId;
  return viewer.username.toLowerCase() === BROADCASTER_USERNAME;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════

/** Nombre de faces pour le de de squatt selon le tier */
const SQUATT_FACES: Record<DiceTier, number> = {
  follow: 6,
  sub: 12,
  raid: 12,
};

/** Nombre de faces pour le de de roue (toujours d20) */
const WHEEL_FACES = 20;

/** Priorite des tiers (plus haut = meilleur) */
const TIER_PRIORITY: Record<DiceTier, number> = {
  follow: 1,
  sub: 2,
  raid: 2, // meme niveau que sub
};

/** Tiers consideres "haut" (sub/raid) */
const HIGH_TIERS: DiceTier[] = ["sub", "raid"];

/** Tiers consideres "bas" (follow) */
const LOW_TIERS: DiceTier[] = ["follow"];

// ═══════════════════════════════════════════════════════════════
// EARN — Gagner une capacite de de
// ═══════════════════════════════════════════════════════════════

/**
 * Donne une capacite de de a un viewer.
 * Appelee par : badge.service (carte fidelite), streamerbot.service (sub, raid)
 * Envoie un message chat pour informer le viewer + resume du stock.
 */
export async function grantDiceCapacity(
  viewerId: string,
  tier: DiceTier,
  source: "loyalty_card" | "subscription" | "raid",
  displayName: string
): Promise<void> {
  await prisma.diceCapacity.create({
    data: { viewerId, tier, source },
  });

  console.log(
    `[Dice] ${displayName} a gagne une capacite de de (tier: ${tier}, source: ${source})`
  );

  broadcast({
    type: "dice:earned",
    payload: {
      viewer: { displayName },
      tier,
      source,
    },
  });

  // Compter le stock apres le grant
  const remaining = await countRemainingDice(viewerId);

  // Construire le message chat d'annonce
  // Une capacite = un seul usage : soit squatt (d6 ou d12) soit roue (d20)
  const squattDie = tier === "follow" ? "!d6" : "!d12";

  let reason: string;
  switch (source) {
    case "loyalty_card":
      reason = "Carte de fidélité remplie";
      break;
    case "subscription":
      reason = "Merci pour le sub";
      break;
    case "raid":
      reason = "Merci pour le raid";
      break;
  }

  // Résumé du stock (d6 = follow, d12 = sub/raid, total pour d20)
  const stockParts: string[] = [];
  if (remaining.d6 > 0) stockParts.push(`${remaining.d6} d6`);
  if (remaining.d12 > 0) stockParts.push(`${remaining.d12} d12`);
  const totalDice = remaining.d6 + remaining.d12;
  stockParts.push(`${totalDice} d20`);
  const stockText = stockParts.join(", ");

  const msg = `🎲 @${displayName} ${reason} ! Tu gagnes un lancer de dé : ${squattDie} (squatts) ou !d20 (récompense/malus) `
    + `| Stock : ${stockText}`;

  // Import dynamique pour eviter la circular dependency avec streamerbot.service
  import("./streamerbot.service").then(({ sendChatMessage }) => {
    sendChatMessage(msg).catch((err: unknown) =>
      console.error("[Dice] Erreur message chat grant:", err)
    );
  });
}

// ═══════════════════════════════════════════════════════════════
// ROLL — Lancer un de
// ═══════════════════════════════════════════════════════════════

export interface RollResult {
  success: boolean;
  error?: string;
  /** Message d'erreur a envoyer dans le chat (si error) */
  chatError?: string;
  tier?: DiceTier;
  dieType?: DieType;
  faces?: number;
  result?: number;
  isNat20?: boolean;
  /** Des restants apres ce roll (par categorie) */
  remaining?: { d6: number; d12: number; d20: number };
}

/**
 * Compte les des disponibles par categorie pour un viewer.
 * d6 = capacites follow, d12 = capacites sub/raid, d20 = total (tous tiers)
 */
async function countRemainingDice(viewerId: string): Promise<{ d6: number; d12: number; d20: number }> {
  const available = await prisma.diceCapacity.findMany({
    where: { viewerId, usedAt: null },
    select: { tier: true },
  });

  let d6 = 0;
  let d12 = 0;
  for (const c of available) {
    if (c.tier === "follow") d6++;
    else d12++; // sub ou raid
  }

  // d20 = total des capacites (chaque capacite peut etre utilisee soit en squatt soit en roue)
  return { d6, d12, d20: d6 + d12 };
}

/**
 * Tente de lancer un d6 squatt (consomme une capacite follow).
 */
export async function rollD6(viewerId: string): Promise<RollResult> {
  return rollDiceWithFilter(viewerId, "squatt", LOW_TIERS, 6);
}

/**
 * Tente de lancer un d12 squatt (consomme une capacite sub/raid).
 */
export async function rollD12(viewerId: string): Promise<RollResult> {
  return rollDiceWithFilter(viewerId, "squatt", HIGH_TIERS, 12);
}

/**
 * Tente de lancer un d20 roue (auto-select meilleur tier).
 */
export async function rollD20(viewerId: string): Promise<RollResult> {
  return rollDiceWithFilter(viewerId, "wheel", null, 20);
}

/**
 * Logique commune : filtre par tier, consomme, lance, enqueue.
 * @param allowedTiers null = tous les tiers (auto-select meilleur)
 * @param expectedFaces pour le log et la validation
 */
async function rollDiceWithFilter(
  viewerId: string,
  dieType: DieType,
  allowedTiers: DiceTier[] | null,
  expectedFaces: number
): Promise<RollResult> {
  // Recuperer le viewer
  const viewer = await prisma.viewer.findUnique({
    where: { id: viewerId },
    select: { displayName: true, isFollower: true, isSubscriber: true },
  });

  if (!viewer) {
    return { success: false, error: "viewer_not_found" };
  }

  // Le broadcaster peut lancer tous les des sans restriction (mode test)
  const broadcasterMode = await isBroadcaster(viewerId);

  // Doit etre follower minimum (sauf broadcaster)
  if (!broadcasterMode && !viewer.isFollower) {
    const chatError = `❌ @${viewer.displayName}, tu dois être follower pour lancer un dé !`;
    broadcast({
      type: "dice:error",
      payload: {
        viewer: { displayName: viewer.displayName },
        error: "not_follower",
      },
    });
    return { success: false, error: "not_follower", chatError };
  }

  // --- Mode broadcaster : lance directement sans consommer de capacite ---
  if (broadcasterMode) {
    const tier: DiceTier = allowedTiers ? allowedTiers[0] : "follow";
    const faces = dieType === "squatt" ? SQUATT_FACES[tier] : WHEEL_FACES;
    const result = Math.floor(Math.random() * faces) + 1;
    const isNat20 = dieType === "wheel" && result === 20;
    const remaining = { d6: 999, d12: 999, d20: 999 };

    console.log(
      `[Dice] 🎙️ BROADCASTER ${viewer.displayName} lance un d${faces} (${dieType}) → ${result}${isNat20 ? " NAT 20 !" : ""} [mode test]`
    );

    const { enqueueDiceRoll } = await import("./dice-queue.service");
    enqueueDiceRoll({
      broadcastPayload: {
        viewer: { displayName: viewer.displayName },
        tier,
        dieType,
        faces,
        result,
        isNat20,
        challengeTitle: dieType === "squatt" ? "Combien de squatts ?" : undefined,
        challengeType: dieType === "squatt" ? "counter" as const : undefined,
        challengeLabel: dieType === "squatt" ? "Squatts" : undefined,
      },
      ...(dieType === "squatt" ? {
        challenge: {
          name: "squatts",
          label: "Squatts",
          type: "counter" as const,
          amount: result,
          icon: "💪",
        },
      } : {}),
      remaining,
    });

    return { success: true, tier, dieType, faces, result, isNat20, remaining };
  }

  // --- Mode viewer normal : verifie les capacites ---

  // Trouver les capacites disponibles (non utilisees)
  const allAvailable = await prisma.diceCapacity.findMany({
    where: { viewerId, usedAt: null },
    orderBy: { createdAt: "asc" },
  });

  // Filtrer par tiers autorises si specifie
  const filtered = allowedTiers
    ? allAvailable.filter((c) => (allowedTiers as string[]).includes(c.tier))
    : allAvailable;

  if (filtered.length === 0) {
    // Construire un message d'erreur utile avec les alternatives
    const remaining = await countRemainingDice(viewerId);
    let chatError: string;

    if (allAvailable.length === 0) {
      chatError = `❌ @${viewer.displayName}, tu n'as aucun dé disponible !`;
    } else if (expectedFaces === 6) {
      chatError = remaining.d12 > 0
        ? `❌ @${viewer.displayName}, tu n'as pas de d6 ! Mais tu as ${remaining.d12} d12 disponible${remaining.d12 > 1 ? "s" : ""} (!d12)`
        : `❌ @${viewer.displayName}, tu n'as pas de d6 disponible !`;
    } else if (expectedFaces === 12) {
      chatError = remaining.d6 > 0
        ? `❌ @${viewer.displayName}, tu n'as pas de d12 ! Mais tu as ${remaining.d6} d6 disponible${remaining.d6 > 1 ? "s" : ""} (!d6)`
        : `❌ @${viewer.displayName}, tu n'as pas de d12 disponible !`;
    } else {
      chatError = `❌ @${viewer.displayName}, tu n'as aucun dé disponible pour la roue !`;
    }

    broadcast({
      type: "dice:error",
      payload: {
        viewer: { displayName: viewer.displayName },
        error: "no_capacity",
      },
    });
    return { success: false, error: "no_capacity", chatError };
  }

  // Pour d20 (wheel), choisir la meilleure capacite (tier le plus haut)
  // Pour d6/d12, on prend simplement la plus ancienne (FIFO)
  const chosen = allowedTiers === null
    ? filtered.reduce((a, b) =>
        TIER_PRIORITY[b.tier as DiceTier] > TIER_PRIORITY[a.tier as DiceTier] ? b : a
      )
    : filtered[0];

  const tier = chosen.tier as DiceTier;

  // Determiner le nombre de faces
  const faces = dieType === "squatt" ? SQUATT_FACES[tier] : WHEEL_FACES;

  // Lancer le de !
  const result = Math.floor(Math.random() * faces) + 1;
  const isNat20 = dieType === "wheel" && result === 20;

  // Consommer la capacite
  await prisma.diceCapacity.update({
    where: { id: chosen.id },
    data: {
      dieType,
      result,
      usedAt: new Date(),
    },
  });

  // Compter les des restants APRES consommation
  const remaining = await countRemainingDice(viewerId);

  console.log(
    `[Dice] ${viewer.displayName} lance un d${faces} (${dieType}, tier: ${tier}) → ${result}${isNat20 ? " NAT 20 !" : ""} | Restant: d6=${remaining.d6} d12=${remaining.d12}`
  );

  // Enqueue dans la dice queue : broadcast + challenge update au bon timing
  const { enqueueDiceRoll } = await import("./dice-queue.service");
  enqueueDiceRoll({
    broadcastPayload: {
      viewer: { displayName: viewer.displayName },
      tier,
      dieType,
      faces,
      result,
      isNat20,
      // Contexte du defi pour l'overlay (titre + type + label)
      challengeTitle: dieType === "squatt" ? "Combien de squatts ?" : undefined,
      challengeType: dieType === "squatt" ? "counter" as const : undefined,
      challengeLabel: dieType === "squatt" ? "Squatts" : undefined,
    },
    // Squatt rolls → creer/update le defi squatts apres le reveal
    ...(dieType === "squatt" ? {
      challenge: {
        name: "squatts",
        label: "Squatts",
        type: "counter" as const,
        amount: result,
        icon: "💪",
      },
    } : {}),
    // Remaining dice pour le message chat
    remaining,
  });

  return { success: true, tier, dieType, faces, result, isNat20, remaining };
}

// ═══════════════════════════════════════════════════════════════
// LEGACY — Ancien rollDice pour compatibilite
// ═══════════════════════════════════════════════════════════════

/**
 * Ancien point d'entree. Redirige vers les nouvelles fonctions.
 * @deprecated Utiliser rollD6(), rollD12() ou rollD20()
 */
export async function rollDice(
  viewerId: string,
  dieType: DieType
): Promise<RollResult> {
  if (dieType === "wheel") return rollD20(viewerId);
  // Squatt : auto-select meilleur tier (ancien comportement)
  return rollDiceWithFilter(viewerId, "squatt", null, 0);
}

// ═══════════════════════════════════════════════════════════════
// QUERY — Consulter les capacites
// ═══════════════════════════════════════════════════════════════

/**
 * Compte les capacites de de disponibles pour un viewer.
 */
export async function getAvailableDice(
  viewerId: string
): Promise<{ tier: string; count: number }[]> {
  const capacities = await prisma.diceCapacity.findMany({
    where: { viewerId, usedAt: null },
  });

  const byTier = new Map<string, number>();
  for (const c of capacities) {
    byTier.set(c.tier, (byTier.get(c.tier) ?? 0) + 1);
  }

  return Array.from(byTier.entries()).map(([tier, count]) => ({ tier, count }));
}

/**
 * Historique des lancers de de d'un viewer.
 */
export async function getDiceHistory(
  viewerId: string,
  limit = 20
): Promise<{ tier: string; dieType: string; result: number; usedAt: Date }[]> {
  const rolls = await prisma.diceCapacity.findMany({
    where: { viewerId, usedAt: { not: null } },
    orderBy: { usedAt: "desc" },
    take: limit,
    select: { tier: true, dieType: true, result: true, usedAt: true },
  });

  return rolls.map((r) => ({
    tier: r.tier,
    dieType: r.dieType!,
    result: r.result!,
    usedAt: r.usedAt!,
  }));
}
