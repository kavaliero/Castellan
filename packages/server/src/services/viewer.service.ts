import { prisma } from "../db/client";
import type {
  ViewerInfo,
  ViewerDetailed,
  ViewerBadge,
  ViewerTimelineEvent,
  ViewerListResponse,
  LiveStreamStats,
} from "@castellan/shared";
import { enrichViewer, isTwitchConfigured } from "./twitch.service";

/**
 * Service Viewer — gere la logique metier autour des viewers.
 *
 * Pourquoi un "service" separe des routes ?
 * Parce que la meme logique (trouver ou creer un viewer) sera utilisee
 * par plusieurs routes et handlers. Le service centralise la logique.
 *
 * C'est le pattern "Service Layer" :
 * - Routes → recoivent les requetes HTTP, valident, repondent
 * - Services → contiennent la logique metier
 * - Prisma → accede a la BDD
 */

// ═══════════════════════════════════════════════════════════════
// UPSERT (existant)
// ═══════════════════════════════════════════════════════════════

/**
 * Trouve un viewer par son twitchId, ou le cree s'il n'existe pas.
 */
export async function findOrCreateViewer(viewerInfo: ViewerInfo) {
  const viewer = await prisma.viewer.upsert({
    where: { twitchId: viewerInfo.twitchId },
    update: {
      displayName: viewerInfo.displayName,
      username: viewerInfo.username,
    },
    create: {
      twitchId: viewerInfo.twitchId,
      username: viewerInfo.username,
      displayName: viewerInfo.displayName,
    },
  });

  // Enrichissement Twitch API en fire-and-forget (ne bloque pas le flow)
  // Se declenche si jamais enrichi ou si cache expire (>24h)
  if (isTwitchConfigured()) {
    const enrichedAt = (viewer as any).twitchEnrichedAt;
    const isStale = !enrichedAt || Date.now() - new Date(enrichedAt).getTime() > 24 * 60 * 60 * 1000;
    if (isStale) {
      enrichViewer(viewer.id).catch((err) =>
        console.error(`[Twitch] Enrichissement lazy echoue pour ${viewer.username}:`, err)
      );
    }
  }

  return viewer;
}

/**
 * Trouve ou cree une session viewer pour le stream en cours.
 */
export async function findOrCreateSession(viewerId: string, streamId: string) {
  const session = await prisma.viewerSession.upsert({
    where: {
      viewerId_streamId: { viewerId, streamId },
    },
    update: {
      lastActiveAt: new Date(),
      isActive: true,
    },
    create: {
      viewerId,
      streamId,
    },
  });

  return session;
}

// ═══════════════════════════════════════════════════════════════
// BADGES RP — Calcules dynamiquement a partir des stats
// ═══════════════════════════════════════════════════════════════

/**
 * Definition des badges : seuil + metadata.
 * Chaque badge est gagne automatiquement quand le viewer atteint le seuil.
 * Pas stocke en BDD — calcule a la volee (simple, pas de migration).
 */
interface BadgeCheckContext {
  totalMessages: number;
  totalWatchTime: number;
  totalBitsDonated: number;
  totalChannelPointsUsed: number;
  isFollower: boolean;
  isSubscriber: boolean;
  isStreamer: boolean;
  totalStreams: number;
  firstSeenAt: Date;
  // Metriques computees
  firstWordCount: number;
  subCount: number;
  raidCount: number;
  giftSubCount: number;
  lurkCount: number;
  diceRollCount: number;
  bestDiceRoll?: { faces: number; result: number } | null;
  worstDiceRoll?: { faces: number; result: number } | null;
}

interface BadgeDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  check: (viewer: BadgeCheckContext) => boolean;
}

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // Messages
  {
    id: "first-words",
    name: "Premiers Mots",
    icon: "💬",
    description: "A envoye son premier message",
    check: (v) => v.totalMessages >= 1,
  },
  {
    id: "bavard",
    name: "Bavard du Village",
    icon: "🗣️",
    description: "Plus de 100 messages envoyes",
    check: (v) => v.totalMessages >= 100,
  },
  {
    id: "knight-of-chat",
    name: "Chevalier du Chat",
    icon: "⚔️",
    description: "Plus de 1000 messages envoyes",
    check: (v) => v.totalMessages >= 1000,
  },
  {
    id: "herald",
    name: "Heraut Royal",
    icon: "📯",
    description: "Plus de 5000 messages envoyes",
    check: (v) => v.totalMessages >= 5000,
  },
  // Watch time
  {
    id: "curious-peasant",
    name: "Paysan Curieux",
    icon: "👀",
    description: "Plus d'1 heure de watch time",
    check: (v) => v.totalWatchTime >= 60,
  },
  {
    id: "faithful-squire",
    name: "Ecuyer Fidele",
    icon: "🛡️",
    description: "Plus de 10 heures de watch time",
    check: (v) => v.totalWatchTime >= 600,
  },
  {
    id: "castle-guardian",
    name: "Gardien du Chateau",
    icon: "🏰",
    description: "Plus de 50 heures de watch time",
    check: (v) => v.totalWatchTime >= 3000,
  },
  {
    id: "eternal-sentinel",
    name: "Sentinelle Eternelle",
    icon: "👁️",
    description: "Plus de 100 heures de watch time",
    check: (v) => v.totalWatchTime >= 6000,
  },
  // Bits
  {
    id: "coin-tosser",
    name: "Lanceur de Pieces",
    icon: "🪙",
    description: "A donne au moins 1 bit",
    check: (v) => v.totalBitsDonated >= 1,
  },
  {
    id: "gold-hoarder",
    name: "Tresorier du Royaume",
    icon: "💰",
    description: "Plus de 1000 bits donnes",
    check: (v) => v.totalBitsDonated >= 1000,
  },
  {
    id: "dragon-treasure",
    name: "Tresor du Dragon",
    icon: "🐉",
    description: "Plus de 10000 bits donnes",
    check: (v) => v.totalBitsDonated >= 10000,
  },
  // Channel points
  {
    id: "point-spender",
    name: "Depensier",
    icon: "✨",
    description: "A utilise des channel points",
    check: (v) => v.totalChannelPointsUsed >= 1,
  },
  {
    id: "reward-collector",
    name: "Collecteur de Recompenses",
    icon: "🎯",
    description: "Plus de 10000 channel points depenses",
    check: (v) => v.totalChannelPointsUsed >= 10000,
  },
  // Status
  {
    id: "follower",
    name: "Suivant du Roi",
    icon: "❤️",
    description: "Follow la chaine",
    check: (v) => v.isFollower,
  },
  {
    id: "subscriber",
    name: "Noble du Royaume",
    icon: "⭐",
    description: "Abonne a la chaine",
    check: (v) => v.isSubscriber,
  },
  // Fidelite (nombre de streams)
  {
    id: "regular",
    name: "Habitue de la Taverne",
    icon: "🍺",
    description: "Present sur 5 streams differents",
    check: (v) => v.totalStreams >= 5,
  },
  {
    id: "veteran",
    name: "Veteran de Guerre",
    icon: "🎖️",
    description: "Present sur 25 streams differents",
    check: (v) => v.totalStreams >= 25,
  },
  {
    id: "legend",
    name: "Legende Vivante",
    icon: "👑",
    description: "Present sur 100 streams differents",
    check: (v) => v.totalStreams >= 100,
  },
  // Anciennete
  {
    id: "old-timer",
    name: "Ancien du Village",
    icon: "🧙",
    description: "Vu pour la premiere fois il y a plus de 6 mois",
    check: (v) => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      return v.firstSeenAt <= sixMonthsAgo;
    },
  },
  // Des (Chanceux / Maudit)
  {
    id: "lucky",
    name: "Chanceux",
    icon: "🍀",
    description: "A fait un 20 naturel au d20",
    check: (v) => v.bestDiceRoll?.faces === 20 && v.bestDiceRoll?.result === 20,
  },
  {
    id: "cursed",
    name: "Maudit",
    icon: "💀",
    description: "A fait un 1 au d20",
    check: (v) => v.worstDiceRoll?.faces === 20 && v.worstDiceRoll?.result === 1,
  },
  {
    id: "dice-addict",
    name: "Accro aux Des",
    icon: "🎲",
    description: "Plus de 20 lances de des",
    check: (v) => v.diceRollCount >= 20,
  },
  // Raids
  {
    id: "raider",
    name: "Raideur",
    icon: "⚔️",
    description: "A raid la chaine au moins une fois",
    check: (v) => v.raidCount >= 1,
  },
  {
    id: "warlord",
    name: "Seigneur de Guerre",
    icon: "🏴",
    description: "A raid la chaine 5 fois ou plus",
    check: (v) => v.raidCount >= 5,
  },
  // First word
  {
    id: "early-bird",
    name: "Leve-tot",
    icon: "🐓",
    description: "A ete le premier a parler sur au moins 1 stream",
    check: (v) => v.firstWordCount >= 1,
  },
  {
    id: "first-champion",
    name: "Champion du FIRST",
    icon: "🏅",
    description: "A ete le premier a parler sur 3 streams ou plus",
    check: (v) => v.firstWordCount >= 3,
  },
  {
    id: "first-legend",
    name: "Legende du FIRST",
    icon: "🥇",
    description: "A ete le premier a parler sur 10 streams ou plus",
    check: (v) => v.firstWordCount >= 10,
  },
  // Gift subs
  {
    id: "generous",
    name: "Genereux",
    icon: "🎁",
    description: "A offert au moins un sub a quelqu'un",
    check: (v) => v.giftSubCount >= 1,
  },
  {
    id: "patron",
    name: "Mecene du Royaume",
    icon: "👑",
    description: "A offert 10 subs ou plus",
    check: (v) => v.giftSubCount >= 10,
  },
  // Lurkers
  {
    id: "shadow",
    name: "Ombre Silencieuse",
    icon: "🌑",
    description: "A lurk sur 3 streams ou plus sans parler",
    check: (v) => v.lurkCount >= 3,
  },
  // Streamer
  {
    id: "fellow-streamer",
    name: "Confrere Streamer",
    icon: "📺",
    description: "Est lui-meme streamer sur Twitch",
    check: (v) => v.isStreamer,
  },
  // Sub fidelite
  {
    id: "loyal-sub",
    name: "Abonne Loyal",
    icon: "💎",
    description: "S'est abonne 6 fois ou plus",
    check: (v) => v.subCount >= 6,
  },
];

export { BADGE_DEFINITIONS };

export function computeBadges(viewer: BadgeCheckContext): ViewerBadge[] {
  return BADGE_DEFINITIONS
    .filter((def) => def.check(viewer))
    .map((def) => ({
      id: def.id,
      name: def.name,
      icon: def.icon,
      description: def.description,
    }));
}

/**
 * Enrichit les badges calcules avec la date de gain stockee en BDD.
 */
function enrichBadgesWithEarnedAt(
  badges: ViewerBadge[],
  earnedBadges: { badgeId: string; earnedAt: Date }[]
): ViewerBadge[] {
  const earnedMap = new Map(earnedBadges.map((b) => [b.badgeId, b.earnedAt]));
  return badges.map((b) => ({
    ...b,
    earnedAt: earnedMap.get(b.id)?.toISOString() ?? undefined,
  }));
}

// ═══════════════════════════════════════════════════════════════
// QUERY FUNCTIONS — pour le dashboard admin
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// COMPUTED METRICS — Calcule les metriques d'un viewer depuis StreamEvent
// ═══════════════════════════════════════════════════════════════

interface ComputedMetrics {
  firstWordCount: number;
  subCount: number;
  raidCount: number;
  giftSubCount: number;
  lurkCount: number;
  diceRollCount: number;
  bestDiceRoll: { faces: number; result: number } | null;
  worstDiceRoll: { faces: number; result: number } | null;
}

/**
 * Calcule toutes les metriques d'un viewer a partir de ses events et sessions.
 */
export async function computeViewerMetrics(viewerId: string): Promise<ComputedMetrics> {
  // Toutes les queries en parallele
  const [
    firstWordCount,
    subCount,
    raidCount,
    giftSubCount,
    lurkSessions,
    diceEvents,
  ] = await Promise.all([
    prisma.streamEvent.count({ where: { viewerId, type: "first_word" } }),
    prisma.streamEvent.count({ where: { viewerId, type: "sub" } }),
    prisma.streamEvent.count({ where: { viewerId, type: "raid" } }),
    prisma.streamEvent.count({ where: { viewerId, type: "gift_sub" } }),
    prisma.viewerSession.count({ where: { viewerId, messageCount: 0 } }),
    prisma.streamEvent.findMany({
      where: { viewerId, type: "dice" },
      select: { data: true },
    }),
  ]);

  // Analyser les lances de des pour trouver le meilleur et le pire
  let bestDiceRoll: { faces: number; result: number } | null = null;
  let worstDiceRoll: { faces: number; result: number } | null = null;

  for (const event of diceEvents) {
    if (!event.data) continue;
    const d = JSON.parse(event.data) as { faces?: number; result?: number };
    if (!d.faces || d.result === undefined) continue;

    // Meilleur : le plus haut ratio result/faces
    if (!bestDiceRoll || (d.result / d.faces) > (bestDiceRoll.result / bestDiceRoll.faces)) {
      bestDiceRoll = { faces: d.faces, result: d.result };
    }
    // Pire : le plus bas ratio
    if (!worstDiceRoll || (d.result / d.faces) < (worstDiceRoll.result / worstDiceRoll.faces)) {
      worstDiceRoll = { faces: d.faces, result: d.result };
    }
  }

  return {
    firstWordCount,
    subCount,
    raidCount,
    giftSubCount,
    lurkCount: lurkSessions,
    diceRollCount: diceEvents.length,
    bestDiceRoll,
    worstDiceRoll,
  };
}

type SortField = "displayName" | "totalMessages" | "totalWatchTime" | "totalBitsDonated" | "totalChannelPointsUsed" | "firstSeenAt" | "totalStreams";
type SortOrder = "asc" | "desc";

/**
 * Liste paginee des viewers avec tri et filtres.
 */
export async function listViewers(options: {
  page?: number;
  pageSize?: number;
  sortBy?: SortField;
  sortOrder?: SortOrder;
  search?: string;
  filterFollower?: boolean;
  filterSubscriber?: boolean;
  currentStreamId?: string | null;
}): Promise<ViewerListResponse> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 25));
  const sortBy = options.sortBy ?? "totalMessages";
  const sortOrder = options.sortOrder ?? "desc";

  // Construire le filtre Prisma
  const where: any = {};
  if (options.search) {
    where.OR = [
      { displayName: { contains: options.search } },
      { username: { contains: options.search } },
    ];
  }
  if (options.filterFollower !== undefined) {
    where.isFollower = options.filterFollower;
  }
  if (options.filterSubscriber !== undefined) {
    where.isSubscriber = options.filterSubscriber;
  }

  // Le tri par totalStreams est special (champ calcule)
  const orderBy = sortBy === "totalStreams"
    ? { firstSeenAt: sortOrder } // Fallback — on trie par anciennete
    : { [sortBy]: sortOrder };

  const [viewers, total] = await Promise.all([
    prisma.viewer.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        sessions: {
          select: {
            streamId: true,
            isActive: true,
            lastActiveAt: true,
          },
        },
        earnedBadges: {
          select: { badgeId: true, earnedAt: true },
        },
      },
    }),
    prisma.viewer.count({ where }),
  ]);

  // Calculer les metriques pour tous les viewers en parallele
  const metricsArray = await Promise.all(
    viewers.map((v) => computeViewerMetrics(v.id))
  );

  const detailedViewers: ViewerDetailed[] = viewers.map((v, i) => {
    const metrics = metricsArray[i];
    const totalStreams = new Set(v.sessions.map((s) => s.streamId)).size;
    const lastSession = v.sessions.sort(
      (a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime()
    )[0];
    const currentSessionActive = options.currentStreamId
      ? v.sessions.some((s) => s.streamId === options.currentStreamId && s.isActive)
      : false;

    const badgeContext: BadgeCheckContext = {
      ...v,
      isStreamer: (v as any).isStreamer ?? false,
      totalStreams,
      firstSeenAt: v.firstSeenAt,
      ...metrics,
    };

    return {
      id: v.id,
      twitchId: v.twitchId,
      username: v.username,
      displayName: v.displayName,
      totalMessages: v.totalMessages,
      totalWatchTime: v.totalWatchTime,
      totalBitsDonated: v.totalBitsDonated,
      totalChannelPointsUsed: v.totalChannelPointsUsed,
      isFollower: v.isFollower,
      isSubscriber: v.isSubscriber,
      isStreamer: (v as any).isStreamer ?? false,
      broadcasterType: (v as any).broadcasterType ?? null,
      twitchFollowerCount: (v as any).twitchFollowerCount ?? null,
      twitchProfileImageUrl: (v as any).twitchProfileImageUrl ?? null,
      firstSeenAt: v.firstSeenAt.toISOString(),
      totalStreams,
      lastSeenAt: lastSession?.lastActiveAt.toISOString() ?? v.firstSeenAt.toISOString(),
      currentSessionActive,
      stampCount: (v as any).stampCount ?? 0,
      badges: enrichBadgesWithEarnedAt(
        computeBadges(badgeContext),
        (v as any).earnedBadges ?? []
      ),
      ...metrics,
    };
  });

  // Si on triait par totalStreams, on re-trie cote JS
  if (sortBy === "totalStreams") {
    detailedViewers.sort((a, b) =>
      sortOrder === "desc" ? b.totalStreams - a.totalStreams : a.totalStreams - b.totalStreams
    );
  }

  return {
    viewers: detailedViewers,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Detail complet d'un viewer par son ID Prisma ou twitchId.
 */
export async function getViewerDetail(idOrTwitchId: string, currentStreamId?: string | null): Promise<ViewerDetailed | null> {
  const viewer = await prisma.viewer.findFirst({
    where: {
      OR: [
        { id: idOrTwitchId },
        { twitchId: idOrTwitchId },
      ],
    },
    include: {
      sessions: {
        select: {
          streamId: true,
          isActive: true,
          lastActiveAt: true,
          watchTime: true,
          messageCount: true,
        },
        orderBy: { lastActiveAt: "desc" },
      },
      earnedBadges: {
        select: { badgeId: true, earnedAt: true },
      },
    },
  });

  if (!viewer) return null;

  const totalStreams = new Set(viewer.sessions.map((s) => s.streamId)).size;
  const lastSession = viewer.sessions[0];
  const currentSessionActive = currentStreamId
    ? viewer.sessions.some((s) => s.streamId === currentStreamId && s.isActive)
    : false;

  const metrics = await computeViewerMetrics(viewer.id);

  const badgeContext: BadgeCheckContext = {
    ...viewer,
    isStreamer: (viewer as any).isStreamer ?? false,
    totalStreams,
    firstSeenAt: viewer.firstSeenAt,
    ...metrics,
  };

  return {
    id: viewer.id,
    twitchId: viewer.twitchId,
    username: viewer.username,
    displayName: viewer.displayName,
    totalMessages: viewer.totalMessages,
    totalWatchTime: viewer.totalWatchTime,
    totalBitsDonated: viewer.totalBitsDonated,
    totalChannelPointsUsed: viewer.totalChannelPointsUsed,
    isFollower: viewer.isFollower,
    isSubscriber: viewer.isSubscriber,
    isStreamer: (viewer as any).isStreamer ?? false,
    broadcasterType: (viewer as any).broadcasterType ?? null,
    twitchFollowerCount: (viewer as any).twitchFollowerCount ?? null,
    twitchProfileImageUrl: (viewer as any).twitchProfileImageUrl ?? null,
    firstSeenAt: viewer.firstSeenAt.toISOString(),
    totalStreams,
    lastSeenAt: lastSession?.lastActiveAt.toISOString() ?? viewer.firstSeenAt.toISOString(),
    currentSessionActive,
    stampCount: (viewer as any).stampCount ?? 0,
    badges: enrichBadgesWithEarnedAt(
      computeBadges(badgeContext),
      (viewer as any).earnedBadges ?? []
    ),
    ...metrics,
  };
}

/**
 * Timeline d'activite d'un viewer — tous ses events et messages importants.
 */
export async function getViewerTimeline(
  idOrTwitchId: string,
  options?: { limit?: number; offset?: number }
): Promise<ViewerTimelineEvent[]> {
  const limit = Math.min(200, options?.limit ?? 50);
  const offset = options?.offset ?? 0;

  const viewer = await prisma.viewer.findFirst({
    where: {
      OR: [
        { id: idOrTwitchId },
        { twitchId: idOrTwitchId },
      ],
    },
  });

  if (!viewer) return [];

  // Recuperer les events et les messages recents en parallele
  const [events, recentMessages] = await Promise.all([
    prisma.streamEvent.findMany({
      where: { viewerId: viewer.id },
      include: {
        stream: { select: { title: true, game: true } },
      },
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
    }),
    // Les 20 derniers messages (on ne veut pas flood la timeline)
    prisma.chatMessage.findMany({
      where: { viewerId: viewer.id },
      include: {
        stream: { select: { title: true, game: true } },
      },
      orderBy: { timestamp: "desc" },
      take: 20,
    }),
  ]);

  // Convertir les events en timeline
  const timelineEvents: ViewerTimelineEvent[] = events.map((e) => ({
    id: e.id,
    type: e.type,
    timestamp: e.timestamp.toISOString(),
    streamTitle: e.stream.title ?? undefined,
    streamGame: e.stream.game ?? undefined,
    data: e.data ? JSON.parse(e.data) : undefined,
  }));

  // Ajouter les messages comme events "message" dans la timeline
  const timelineMessages: ViewerTimelineEvent[] = recentMessages.map((m) => ({
    id: m.id,
    type: "message",
    timestamp: m.timestamp.toISOString(),
    streamTitle: m.stream.title ?? undefined,
    streamGame: m.stream.game ?? undefined,
    data: { content: m.content },
  }));

  // Fusionner et trier par date decroissante
  const merged = [...timelineEvents, ...timelineMessages]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);

  return merged;
}

/**
 * Stats live du stream en cours.
 */
export async function getLiveStreamStats(
  streamId: string,
  currentViewerCount: number,
): Promise<LiveStreamStats> {
  const stream = await prisma.stream.findUniqueOrThrow({
    where: { id: streamId },
  });

  const now = new Date();
  const durationMinutes = Math.round(
    (now.getTime() - stream.startedAt.getTime()) / 60000
  );

  // Toutes les queries en parallele
  const [
    totalMessages,
    totalViewers,
    newFollows,
    newSubs,
    bitsEvents,
    topSessions,
    activeSessions,
    recentEvents,
  ] = await Promise.all([
    prisma.chatMessage.count({ where: { streamId } }),
    prisma.viewerSession.count({ where: { streamId } }),
    prisma.streamEvent.count({ where: { streamId, type: "follow" } }),
    prisma.streamEvent.count({ where: { streamId, type: "sub" } }),
    prisma.streamEvent.findMany({
      where: { streamId, type: "bits" },
    }),
    prisma.viewerSession.findMany({
      where: { streamId, messageCount: { gt: 0 } },
      include: { viewer: true },
      orderBy: { messageCount: "desc" },
      take: 10,
    }),
    prisma.viewerSession.findMany({
      where: { streamId, isActive: true },
      include: { viewer: true },
      orderBy: { lastActiveAt: "desc" },
    }),
    prisma.streamEvent.findMany({
      where: { streamId },
      include: {
        viewer: true,
        stream: { select: { title: true, game: true } },
      },
      orderBy: { timestamp: "desc" },
      take: 20,
    }),
  ]);

  // Sommer les bits
  const bitsReceived = bitsEvents.reduce((sum, e) => {
    const data = e.data ? JSON.parse(e.data) : {};
    return sum + (data.amount ?? 0);
  }, 0);

  const toViewerInfo = (v: { twitchId: string; username: string; displayName: string }): ViewerInfo => ({
    twitchId: v.twitchId,
    username: v.username,
    displayName: v.displayName,
  });

  return {
    streamId,
    title: stream.title ?? "Stream sans titre",
    game: stream.game ?? "Just Chatting",
    startedAt: stream.startedAt.toISOString(),
    duration: durationMinutes,
    currentViewers: currentViewerCount,
    peakViewers: stream.peakViewers,
    totalMessages,
    totalViewers,
    newFollowers: newFollows,
    newSubs,
    bitsReceived,
    topChatters: topSessions.map((s) => ({
      viewer: toViewerInfo(s.viewer),
      messageCount: s.messageCount,
    })),
    activeViewers: activeSessions.map((s) => ({
      viewer: toViewerInfo(s.viewer),
      watchTime: s.watchTime,
      messageCount: s.messageCount,
    })),
    recentEvents: recentEvents.map((e) => ({
      id: e.id,
      type: e.type,
      timestamp: e.timestamp.toISOString(),
      streamTitle: e.stream.title ?? undefined,
      streamGame: e.stream.game ?? undefined,
      data: e.data ? JSON.parse(e.data) : undefined,
    })),
  };
}
