import { prisma } from "../db/client";
import type { CreditsPayload, ViewerInfo } from "@castellan/shared";

/**
 * Service Credits — agrège les données d'un stream pour les crédits de fin.
 * 
 * C'est le service le plus "gourmand" en requêtes BDD parce qu'il
 * doit aller chercher des données dans presque toutes les tables.
 * Mais il n'est appelé qu'UNE FOIS en fin de stream, donc pas de
 * problème de performance.
 * 
 * Chaque section des crédits est récupérée dans sa propre requête
 * pour garder le code lisible. On pourrait tout faire en une seule
 * requête SQL complexe, mais ce serait illisible et dur à maintenir.
 */

/**
 * Transforme un viewer Prisma en ViewerInfo.
 * 
 * Pourquoi cette fonction utilitaire ? Parce que Prisma retourne
 * des objets avec TOUS les champs (id, totalMessages, etc.),
 * mais les crédits n'ont besoin que de twitchId/username/displayName.
 * On "projette" l'objet vers le type léger.
 */
function toViewerInfo(viewer: { twitchId: string; username: string; displayName: string }): ViewerInfo {
    return {
        twitchId: viewer.twitchId,
        username: viewer.username,
        displayName: viewer.displayName,
    };
}

/**
 * @param streamId  L'ID du stream en cours
 * @param broadcasterId  Le twitchId du broadcaster (optionnel).
 *                       Si fourni, le broadcaster est exclu de toutes les stats
 *                       (top chatters, lurkers, first message, compteurs...).
 *                       Capturé dynamiquement au stream start.
 */
export async function buildCredits(streamId: string, broadcasterId?: string | null): Promise<CreditsPayload> {
    // Filtre Prisma réutilisable : exclut le broadcaster si configuré
    const notBroadcaster = broadcasterId
        ? { viewer: { twitchId: { not: broadcasterId } } }
        : {};

    if (broadcasterId) {
        console.log(`[Credits] 🎙️ Exclusion du broadcaster (${broadcasterId}) des stats`);
    }

    // 1. Infos du stream
    const stream = await prisma.stream.findUniqueOrThrow({
        where: { id: streamId },
    });

    const endTime = stream.endedAt ?? new Date();
    const durationMinutes = Math.round(
        (endTime.getTime() - stream.startedAt.getTime()) / 60000
    );

    // 2. Nouveaux followers pendant ce stream
    const followEvents = await prisma.streamEvent.findMany({
        where: { streamId, type: "follow", ...notBroadcaster },
        include: { viewer: true },
    });
    const followers = followEvents
        .filter((e) => e.viewer !== null)
        .map((e) => toViewerInfo(e.viewer!));

    // 3. Nouveaux subs pendant ce stream
    const subEvents = await prisma.streamEvent.findMany({
        where: { streamId, type: "sub", ...notBroadcaster },
        include: { viewer: true },
    });
    const subscribers = subEvents
        .filter((e) => e.viewer !== null)
        .map((e) => ({
            viewer: toViewerInfo(e.viewer!),
            tier: e.data ? JSON.parse(e.data).tier ?? 1 : 1,
        }));

    // 4. Raids reçus pendant ce stream
    const raidEvents = await prisma.streamEvent.findMany({
        where: { streamId, type: "raid" },
    });
    const raiders = raidEvents.map((e) => {
        const data = e.data ? JSON.parse(e.data) : {};
        return {
            raider: data.fromChannel
                ? { twitchId: "", username: data.fromChannel.toLowerCase(), displayName: data.fromChannel }
                : { twitchId: "", username: "inconnu", displayName: "Inconnu" },
            fromChannel: data.fromChannel ?? "Inconnu",
            viewers: data.viewers ?? 0,
        };
    });

    // 5. Top chatters — les sessions avec le plus de messages
    const topSessions = await prisma.viewerSession.findMany({
        where: { streamId, messageCount: { gt: 0 }, ...notBroadcaster },
        include: { viewer: true },
        orderBy: { messageCount: "desc" },
        take: 10,
    });
    const topChatters = topSessions.map((s) => ({
        viewer: toViewerInfo(s.viewer),
        messageCount: s.messageCount,
    }));

    // 6. Lancers de dé
    const diceEvents = await prisma.streamEvent.findMany({
        where: { streamId, type: "dice", ...notBroadcaster },
        include: { viewer: true },
    });
    // Compter les lancers par viewer
    const diceCountMap = new Map<string, { viewer: ViewerInfo; rollCount: number }>();
    for (const e of diceEvents) {
        if (!e.viewer) continue;
        const existing = diceCountMap.get(e.viewer.twitchId);
        if (existing) {
            existing.rollCount++;
        } else {
            diceCountMap.set(e.viewer.twitchId, {
                viewer: toViewerInfo(e.viewer),
                rollCount: 1,
            });
        }
    }
    const diceRolls = Array.from(diceCountMap.values())
        .sort((a, b) => b.rollCount - a.rollCount);

    // 7. Top bits donators
    const bitsEvents = await prisma.streamEvent.findMany({
        where: { streamId, type: "bits", ...notBroadcaster },
        include: { viewer: true },
    });
    const bitsMap = new Map<string, { viewer: ViewerInfo; amount: number }>();
    for (const e of bitsEvents) {
        if (!e.viewer) continue;
        const data = e.data ? JSON.parse(e.data) : {};
        const amount = data.amount ?? 0;
        const existing = bitsMap.get(e.viewer.twitchId);
        if (existing) {
            existing.amount += amount;
        } else {
            bitsMap.set(e.viewer.twitchId, { viewer: toViewerInfo(e.viewer), amount });
        }
    }
    const topBitsDonator = Array.from(bitsMap.values())
        .sort((a, b) => b.amount - a.amount);

    // 8. Channel points utilisés
    const cpEvents = await prisma.streamEvent.findMany({
        where: { streamId, type: "channel_point_redemption", ...notBroadcaster },
        include: { viewer: true },
    });
    const cpMap = new Map<string, { viewer: ViewerInfo; amount: number }>();
    for (const e of cpEvents) {
        if (!e.viewer) continue;
        const data = e.data ? JSON.parse(e.data) : {};
        const cost = data.rewardCost ?? 0;
        const existing = cpMap.get(e.viewer.twitchId);
        if (existing) {
            existing.amount += cost;
        } else {
            cpMap.set(e.viewer.twitchId, { viewer: toViewerInfo(e.viewer), amount: cost });
        }
    }
    const channelPointUsed = Array.from(cpMap.values())
        .sort((a, b) => b.amount - a.amount);

    // 9. Lurkers — présents mais 0 messages
    const lurkerSessions = await prisma.viewerSession.findMany({
        where: { streamId, messageCount: 0, ...notBroadcaster },
        include: { viewer: true },
    });
    const lurkers = lurkerSessions.map((s) => toViewerInfo(s.viewer));

    // 10. Premier message du stream (hors broadcaster)
    const firstMsg = await prisma.chatMessage.findFirst({
        where: { streamId, ...notBroadcaster },
        orderBy: { timestamp: "asc" },
        include: { viewer: true },
    });

    // 11. Stats globales (hors broadcaster)
    const totalMessages = await prisma.chatMessage.count({ where: { streamId, ...notBroadcaster } });
    const totalViewers = await prisma.viewerSession.count({ where: { streamId, ...notBroadcaster } });

    // Peak viewers : le nombre max de sessions actives simultanées
    // Pour le MVP, on prend le totalViewers comme approximation.
    // Un vrai peakViewers nécessiterait un tracking par intervalle de temps.
    const peakViewers = stream.peakViewers || totalViewers;

    // Top chatter pour les stats
    const topChatterStat = topChatters.length > 0 ? topChatters[0] : undefined;
    const topBitsStat = topBitsDonator.length > 0 ? topBitsDonator[0] : undefined;
    const topCpStat = channelPointUsed.length > 0 ? channelPointUsed[0] : undefined;

    // Longest watcher (hors broadcaster)
    const longestSession = await prisma.viewerSession.findFirst({
        where: { streamId, ...notBroadcaster },
        orderBy: { watchTime: "desc" },
        include: { viewer: true },
    });
    const longestWatchStat = longestSession && longestSession.watchTime > 0
        ? { viewer: toViewerInfo(longestSession.viewer), duration: longestSession.watchTime }
        : undefined;

    return {
        stream: {
            title: stream.title ?? "Stream sans titre",
            duration: durationMinutes,
            startedAt: stream.startedAt.toISOString(),
        },
        followers: followers.length > 0 ? followers : undefined,
        subscribers: subscribers.length > 0 ? subscribers : undefined,
        raiders: raiders.length > 0 ? raiders : undefined,
        topChatters: topChatters.length > 0 ? topChatters : undefined,
        diceRolls: diceRolls.length > 0 ? diceRolls : undefined,
        topBitsDonator: topBitsDonator.length > 0 ? topBitsDonator : undefined,
        channelPointUsed: channelPointUsed.length > 0 ? channelPointUsed : undefined,
        lurkers: lurkers.length > 0 ? lurkers : undefined,
        firstMessage: firstMsg ? toViewerInfo(firstMsg.viewer) : undefined,
        stats: {
            totalMessages,
            totalViewers,
            peakViewers,
            topChatter: topChatterStat,
            topBitsDonator: topBitsStat,
            topChannelPointUsed: topCpStat,
            longestWatchSeries: longestWatchStat,
        },
    };
}