/**
 * Service Badge — gere la persistence des badges et les notifications.
 *
 * Les definitions de badges restent dans viewer.service.ts (computeBadges).
 * Ce service compare les badges calcules avec ceux stockes en BDD,
 * persiste les nouveaux, et envoie les notifications (WS + chat).
 */

import { prisma } from "../db/client";
import type { ViewerBadge as ViewerBadgeType, WSEvent } from "@castellan/shared";
import { broadcast } from "../ws/broadcaster";

// ═══════════════════════════════════════════════════════════════
// CHECK & AWARD BADGES
// ═══════════════════════════════════════════════════════════════

/**
 * Compare les badges actuellement merites par le viewer avec ceux stockes en BDD.
 * Persiste les nouveaux badges et retourne la liste des badges fraichement gagnes.
 *
 * @param viewerId - ID BDD du viewer
 * @param currentBadges - Badges calcules par computeBadges() dans viewer.service
 * @param displayName - Nom d'affichage du viewer (pour les notifications)
 * @returns Liste des badges nouvellement gagnes (vide si aucun nouveau)
 */
export async function checkAndAwardBadges(
  viewerId: string,
  currentBadges: ViewerBadgeType[],
  displayName: string
): Promise<ViewerBadgeType[]> {
  // Recuperer les badges deja gagnes
  const existingBadges = await prisma.viewerBadge.findMany({
    where: { viewerId },
    select: { badgeId: true },
  });
  const existingIds = new Set(existingBadges.map((b) => b.badgeId));

  // Trouver les nouveaux badges
  const newBadges = currentBadges.filter((b) => !existingIds.has(b.id));

  if (newBadges.length === 0) return [];

  // Persister les nouveaux badges
  const now = new Date();
  await prisma.viewerBadge.createMany({
    data: newBadges.map((b) => ({
      viewerId,
      badgeId: b.id,
      earnedAt: now,
      notified: true,
    })),
    skipDuplicates: true,
  });

  // Notification pour chaque nouveau badge
  for (const badge of newBadges) {
    console.log(
      `[Badge] ${displayName} a gagne: ${badge.icon} ${badge.name}`
    );

    // Broadcast WS pour les overlays
    broadcast({
      type: "badge:earned",
      payload: {
        viewer: { displayName },
        badge: {
          id: badge.id,
          name: badge.name,
          icon: badge.icon,
          description: badge.description,
        },
      },
    });
  }

  return newBadges.map((b) => ({
    ...b,
    earnedAt: now.toISOString(),
  }));
}

// ═══════════════════════════════════════════════════════════════
// STAMP (TAMPON) SYSTEM
// ═══════════════════════════════════════════════════════════════

const MAX_STAMPS = 10;

/**
 * Incremente le tampon du viewer si c'est la premiere fois qu'il parle
 * dans ce stream. Retourne le nouveau stampCount et si le cap est atteint.
 *
 * @param viewerId - ID BDD du viewer
 * @param streamId - ID du stream en cours
 * @returns { stampCount, maxReached } ou null si pas de changement
 */
export async function incrementStamp(
  viewerId: string,
  streamId: string
): Promise<{ stampCount: number; maxReached: boolean } | null> {
  const viewer = await prisma.viewer.findUnique({
    where: { id: viewerId },
    select: {
      stampCount: true,
      stampLastStreamId: true,
      displayName: true,
      isFollower: true,
    },
  });

  if (!viewer) return null;

  // Seuls les followers ont droit a la carte de fidelite
  if (!viewer.isFollower) return null;

  // Deja tamponné pour ce stream
  if (viewer.stampLastStreamId === streamId) return null;

  const newCount = Math.min(viewer.stampCount + 1, MAX_STAMPS);

  await prisma.viewer.update({
    where: { id: viewerId },
    data: {
      stampCount: newCount,
      stampLastStreamId: streamId,
    },
  });

  // Broadcast chaque increment pour l'overlay carte de fidelite
  broadcast({
    type: "stamp:incremented",
    payload: {
      viewer: { displayName: viewer.displayName },
      stampCount: newCount,
      stampTotal: MAX_STAMPS,
    },
  });

  const maxReached = newCount >= MAX_STAMPS;

  if (maxReached) {
    console.log(
      `[Tampon] ${viewer.displayName} a atteint ${MAX_STAMPS} tampons ! Capacite de de follow gagnee.`
    );

    // Broadcast pour l'overlay
    broadcast({
      type: "stamp:max_reached",
      payload: {
        viewer: { displayName: viewer.displayName },
        stampCount: newCount,
      },
    });

    // Donner une capacite de de follow + reset les tampons
    const { grantDiceCapacity } = await import("./dice.service");
    await grantDiceCapacity(viewerId, "follow", "loyalty_card", viewer.displayName);

    // Reset les tampons pour recommencer un nouveau cycle
    await prisma.viewer.update({
      where: { id: viewerId },
      data: { stampCount: 0, stampLastStreamId: null },
    });
  }

  return { stampCount: newCount, maxReached };
}

/**
 * Reset les tampons du viewer a 0 (apres avoir utilise sa relance de de).
 */
export async function resetStamps(viewerId: string): Promise<void> {
  await prisma.viewer.update({
    where: { id: viewerId },
    data: { stampCount: 0, stampLastStreamId: null },
  });
}

// ═══════════════════════════════════════════════════════════════
// TRIGGER BADGE CHECK — Fire-and-forget apres chaque event
// ═══════════════════════════════════════════════════════════════

/**
 * Verifie si un viewer a gagne de nouveaux badges suite a un event.
 * Fait le calcul complet des metriques puis compare avec les badges persistes.
 * A appeler en fire-and-forget apres chaque event qui modifie les stats.
 */
export async function triggerBadgeCheck(
  viewerId: string,
  displayName: string
): Promise<void> {
  try {
    // Import dynamique pour eviter la dependance circulaire au chargement
    const { computeViewerMetrics, computeBadges } = await import("./viewer.service");

    const viewer = await prisma.viewer.findUnique({
      where: { id: viewerId },
    });
    if (!viewer) return;

    const totalStreams = await prisma.viewerSession.count({
      where: { viewerId },
    });

    const metrics = await computeViewerMetrics(viewerId);

    const badgeContext = {
      totalMessages: viewer.totalMessages,
      totalWatchTime: viewer.totalWatchTime,
      totalBitsDonated: viewer.totalBitsDonated,
      totalChannelPointsUsed: viewer.totalChannelPointsUsed,
      isFollower: viewer.isFollower,
      isSubscriber: viewer.isSubscriber,
      isStreamer: (viewer as any).isStreamer ?? false,
      totalStreams,
      firstSeenAt: viewer.firstSeenAt,
      ...metrics,
    };

    const currentBadges = computeBadges(badgeContext);
    await checkAndAwardBadges(viewerId, currentBadges, displayName);
  } catch (err) {
    console.error(`[Badge] Erreur check pour ${displayName}:`, err);
  }
}

/**
 * Recupere les badges gagnes par un viewer depuis la BDD (avec earnedAt).
 */
export async function getEarnedBadges(
  viewerId: string
): Promise<{ badgeId: string; earnedAt: Date }[]> {
  return prisma.viewerBadge.findMany({
    where: { viewerId },
    select: { badgeId: true, earnedAt: true },
    orderBy: { earnedAt: "asc" },
  });
}
