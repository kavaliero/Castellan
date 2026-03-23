/**
 * Service Dice — systeme de des pour le stream.
 *
 * Tiers de des :
 *   - follow  : gagne via carte de fidelite (10 tampons). d6 squatt / d20 follow-roue
 *   - sub     : gagne a chaque sub/resub. d12 squatt / d20 sub-roue
 *   - raid    : gagne a chaque raid. d12 squatt / d20 sub-roue
 *
 * Regles :
 *   - Une capacite = un usage unique (soit squatt, soit roue, pas les deux)
 *   - Le viewer choisit via !de squatt ou !de roue
 *   - On utilise le de du meilleur tier disponible (sub/raid > follow)
 *   - Pour squatt : follow = d6, sub/raid = d12
 *   - Pour roue : toujours d20. Si resultat = 20 → roue de gains
 *   - Roue follow = gains modestes, roue sub = gains plus genereux
 */

import { prisma } from "../db/client";
import { broadcast } from "../ws/broadcaster";
import type { DiceTier, DieType } from "@castellan/shared";

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

// ═══════════════════════════════════════════════════════════════
// EARN — Gagner une capacite de de
// ═══════════════════════════════════════════════════════════════

/**
 * Donne une capacite de de a un viewer.
 * Appelee par : badge.service (carte fidelite), streamerbot.service (sub, raid)
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
}

// ═══════════════════════════════════════════════════════════════
// ROLL — Lancer un de
// ═══════════════════════════════════════════════════════════════

interface RollResult {
  success: boolean;
  error?: string;
  tier?: DiceTier;
  dieType?: DieType;
  faces?: number;
  result?: number;
  isNat20?: boolean;
}

/**
 * Tente de lancer un de pour un viewer.
 * Verifie les conditions (follower, capacite disponible) puis consomme la capacite.
 */
export async function rollDice(
  viewerId: string,
  dieType: DieType
): Promise<RollResult> {
  // Recuperer le viewer
  const viewer = await prisma.viewer.findUnique({
    where: { id: viewerId },
    select: { displayName: true, isFollower: true, isSubscriber: true },
  });

  if (!viewer) {
    return { success: false, error: "viewer_not_found" };
  }

  // Doit etre follower minimum
  if (!viewer.isFollower) {
    broadcast({
      type: "dice:error",
      payload: {
        viewer: { displayName: viewer.displayName },
        error: "not_follower",
      },
    });
    return { success: false, error: "not_follower" };
  }

  // Trouver les capacites disponibles (non utilisees), triees par priorite
  const available = await prisma.diceCapacity.findMany({
    where: { viewerId, usedAt: null },
    orderBy: { createdAt: "asc" },
  });

  if (available.length === 0) {
    broadcast({
      type: "dice:error",
      payload: {
        viewer: { displayName: viewer.displayName },
        error: "no_capacity",
      },
    });
    return { success: false, error: "no_capacity" };
  }

  // Choisir la meilleure capacite disponible (tier le plus haut)
  const best = available.reduce((a, b) =>
    TIER_PRIORITY[b.tier as DiceTier] > TIER_PRIORITY[a.tier as DiceTier]
      ? b
      : a
  );

  const tier = best.tier as DiceTier;

  // Determiner le nombre de faces
  const faces = dieType === "squatt" ? SQUATT_FACES[tier] : WHEEL_FACES;

  // Lancer le de !
  const result = Math.floor(Math.random() * faces) + 1;
  const isNat20 = dieType === "wheel" && result === 20;

  // Consommer la capacite
  await prisma.diceCapacity.update({
    where: { id: best.id },
    data: {
      dieType,
      result,
      usedAt: new Date(),
    },
  });

  console.log(
    `[Dice] ${viewer.displayName} lance un d${faces} (${dieType}, tier: ${tier}) → ${result}${isNat20 ? " NAT 20 !" : ""}`
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
      // Contexte du défi pour l'overlay (titre + type + label)
      challengeTitle: dieType === "squatt" ? "Combien de squatts ?" : undefined,
      challengeType: dieType === "squatt" ? "counter" as const : undefined,
      challengeLabel: dieType === "squatt" ? "Squatts" : undefined,
    },
    // Squatt rolls → créer/update le défi squatts après le reveal
    ...(dieType === "squatt" ? {
      challenge: {
        name: "squatts",
        label: "Squatts",
        type: "counter" as const,
        amount: result,
        icon: "💪",
      },
    } : {}),
  });

  return { success: true, tier, dieType, faces, result, isNat20 };
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
