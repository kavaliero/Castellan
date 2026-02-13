import { StreamerbotClient } from "@streamerbot/client";
import { writeFileSync, appendFileSync } from "fs";
import { prisma } from "../db/client";
import { broadcast } from "../ws/broadcaster";
import { findOrCreateViewer, findOrCreateSession } from "./viewer.service";
import { incrementFollowerCount, incrementSubscriberCount, setLastFollow, setLastSub, getFollowersTarget, getSubscribersTarget, updateGoalsConfig } from "./goals.service";

/**
 * Service StreamerBot — se connecte au WebSocket Server de StreamerBot
 * et écoute TOUS les events Twitch.
 *
 * Architecture :
 * StreamerBot WS Server (8080) → @streamerbot/client → Castellan → OBS overlays (3002)
 *
 * IMPORTANT — Dual-mode event handling:
 * - `Twitch.*` events (Follow, Sub, Cheer, Raid, etc.) fire ONLY from live Twitch data
 * - `Raw.Action` events fire from StreamerBot test triggers (clic droit → Test Trigger)
 * - Both are handled to support testing AND production
 */

let client: StreamerbotClient;
let currentStreamId: string | null = null;
let currentBroadcasterId: string | null = null;

// ─── Public accessors ──────────────────────────────────────

export function getCurrentStreamId(): string | null {
    return currentStreamId;
}

export function setCurrentStreamId(id: string | null): void {
    currentStreamId = id;
}

/**
 * Le twitchId du broadcaster (= le streamer lui-même).
 * Capturé dynamiquement au démarrage du stream depuis StreamerBot
 * (broadcastUserId dans CastellanStreamStart) ou via HTTP.
 * Utilisé pour exclure le broadcaster des crédits de fin.
 */
export function getBroadcasterId(): string | null {
    return currentBroadcasterId;
}

export function setBroadcasterId(id: string | null): void {
    currentBroadcasterId = id;
    if (id) {
        console.log(`[StreamerBot] 🎙️ Broadcaster ID configuré: ${id}`);
    }
}

// ─── ViewerInfo extraction ──────────────────────────────────
//
// StreamerBot sends users in TWO different formats depending on the event source:
//
// Twitch.* events (live):
//   { id: "12345", login: "kavaliero", name: "Kavaliero", type: "twitch" }
//
// Raw.Action events (test triggers):
//   { id: "12345", name: "kavaliero", display: "Kavaliero", role: 1, type: "twitch" }
//
// This function handles both transparently.

type ViewerInfo = { twitchId: string; username: string; displayName: string };

function extractViewer(user: any): ViewerInfo | null {
    if (!user) return null;
    const twitchId = String(user.id ?? "");
    if (!twitchId) return null;

    return {
        twitchId,
        username: String(user.login ?? user.name ?? ""),
        displayName: String(user.display ?? user.name ?? user.login ?? ""),
    };
}

// ─── Tier parsing ───────────────────────────────────────────
//
// Twitch.* events: subTier as "prime", "1000", "2000", "3000"
// Raw.Action events: tier as "prime", "tier 1", "tier 2", "tier 3"

function parseTier(raw: any): number {
    if (!raw) return 1;
    const s = String(raw).toLowerCase();
    if (s === "prime") return 1;
    if (s === "tier 1" || s === "1000") return 1;
    if (s === "tier 2" || s === "2000") return 2;
    if (s === "tier 3" || s === "3000") return 3;
    const num = parseInt(s);
    if (num >= 1000) return num / 1000;
    return num || 1;
}

// ═══════════════════════════════════════════════════════════════
// HANDLER FUNCTIONS (shared between Twitch.* and Raw.Action)
// ═══════════════════════════════════════════════════════════════

async function handleFollow(viewer: ViewerInfo) {
    if (!currentStreamId) return;
    console.log(`[StreamerBot] ❤️ Follow: ${viewer.displayName}`);

    try {
        const dbViewer = await findOrCreateViewer(viewer);
        await findOrCreateSession(dbViewer.id, currentStreamId);

        await prisma.viewer.update({
            where: { id: dbViewer.id },
            data: { isFollower: true },
        });

        await prisma.streamEvent.create({
            data: {
                streamId: currentStreamId,
                viewerId: dbViewer.id,
                type: "follow",
            },
        });

        broadcast({
            type: "alert:follow",
            payload: { viewer },
        });

        // Incrémenter le compteur goals (+1) et broadcast
        const newCount = incrementFollowerCount();
        setLastFollow(viewer.displayName);
        broadcast({
            type: "goal:update",
            payload: { type: "followers", current: newCount, target: getFollowersTarget() },
        });
    } catch (err) {
        console.error("[StreamerBot] Erreur Follow:", err);
    }
}

async function handleSub(viewer: ViewerInfo, tier: number, months: number) {
    if (!currentStreamId) return;
    console.log(`[StreamerBot] ⭐ Sub: ${viewer.displayName} (Tier ${tier}, ${months} mois)`);

    try {
        const dbViewer = await findOrCreateViewer(viewer);
        await findOrCreateSession(dbViewer.id, currentStreamId);

        await prisma.viewer.update({
            where: { id: dbViewer.id },
            data: { isSubscriber: true },
        });

        await prisma.streamEvent.create({
            data: {
                streamId: currentStreamId,
                viewerId: dbViewer.id,
                type: "sub",
                data: JSON.stringify({ tier, months }),
            },
        });

        broadcast({
            type: "alert:sub",
            payload: { viewer, tier, months },
        });

        // Incrémenter le compteur goals (+1) et broadcast
        const newCount = incrementSubscriberCount();
        setLastSub(viewer.displayName);
        broadcast({
            type: "goal:update",
            payload: { type: "subscribers", current: newCount, target: getSubscribersTarget() },
        });
    } catch (err) {
        console.error("[StreamerBot] Erreur Sub:", err);
    }
}

async function handleGiftSub(
    gifter: ViewerInfo,
    recipientName: string,
    tier: number,
    totalGifted: number,
    anonymous: boolean,
) {
    if (!currentStreamId) return;
    console.log(`[StreamerBot] 🎁 Gift Sub: ${gifter.displayName} → ${recipientName} (Tier ${tier})`);

    try {
        const dbViewer = await findOrCreateViewer(gifter);
        await findOrCreateSession(dbViewer.id, currentStreamId);

        await prisma.streamEvent.create({
            data: {
                streamId: currentStreamId,
                viewerId: dbViewer.id,
                type: "gift_sub",
                data: JSON.stringify({ recipientName, tier, totalGifted, anonymous }),
            },
        });

        broadcast({
            type: "alert:gift_sub",
            payload: { viewer: gifter, recipientName, tier, totalGifted, anonymous },
        });
    } catch (err) {
        console.error("[StreamerBot] Erreur GiftSub:", err);
    }
}

async function handleRaid(viewer: ViewerInfo, viewers: number) {
    if (!currentStreamId) return;
    console.log(`[StreamerBot] 🏰 Raid: ${viewer.displayName} avec ${viewers} viewers`);

    try {
        const dbViewer = await findOrCreateViewer(viewer);
        await findOrCreateSession(dbViewer.id, currentStreamId);

        await prisma.streamEvent.create({
            data: {
                streamId: currentStreamId,
                viewerId: dbViewer.id,
                type: "raid",
                data: JSON.stringify({ viewers, fromChannel: viewer.displayName }),
            },
        });

        broadcast({
            type: "alert:raid",
            payload: { viewer, viewers, fromChannel: viewer.displayName },
        });
    } catch (err) {
        console.error("[StreamerBot] Erreur Raid:", err);
    }
}

async function handleCheer(viewer: ViewerInfo, amount: number) {
    if (!currentStreamId) return;
    console.log(`[StreamerBot] 💎 Bits: ${viewer.displayName} → ${amount} bits`);

    try {
        const dbViewer = await findOrCreateViewer(viewer);
        await findOrCreateSession(dbViewer.id, currentStreamId);

        await prisma.viewer.update({
            where: { id: dbViewer.id },
            data: { totalBitsDonated: { increment: amount } },
        });

        await prisma.streamEvent.create({
            data: {
                streamId: currentStreamId,
                viewerId: dbViewer.id,
                type: "bits",
                data: JSON.stringify({ amount }),
            },
        });

        broadcast({
            type: "alert:bits",
            payload: { viewer, amount },
        });
    } catch (err) {
        console.error("[StreamerBot] Erreur Cheer:", err);
    }
}

async function handleRewardRedemption(
    viewer: ViewerInfo,
    rewardName: string,
    rewardCost: number,
) {
    if (!currentStreamId) return;
    console.log(`[StreamerBot] 🏆 Channel Points: ${viewer.displayName} → ${rewardName} (${rewardCost})`);

    try {
        const dbViewer = await findOrCreateViewer(viewer);
        await findOrCreateSession(dbViewer.id, currentStreamId);

        await prisma.viewer.update({
            where: { id: dbViewer.id },
            data: { totalChannelPointsUsed: { increment: rewardCost } },
        });

        await prisma.streamEvent.create({
            data: {
                streamId: currentStreamId,
                viewerId: dbViewer.id,
                type: "channel_point_redemption",
                data: JSON.stringify({ rewardName, rewardCost }),
            },
        });

        broadcast({
            type: "alert:channel_point_redemption",
            payload: { viewer, rewardName, rewardCost },
        });
    } catch (err) {
        console.error("[StreamerBot] Erreur RewardRedemption:", err);
    }
}

// ═══════════════════════════════════════════════════════════════
// MAIN CONNECTION
// ═══════════════════════════════════════════════════════════════

export async function connectToStreamerBot(options?: {
    host?: string;
    port?: number;
    password?: string;
}) {
    const host = options?.host ?? "127.0.0.1";
    const port = options?.port ?? 8080;
    const password = options?.password;

    console.log(`[StreamerBot] 🔌 Connexion à ws://${host}:${port}...`);

    client = new StreamerbotClient({
        host,
        port,
        password,
        autoReconnect: true,
        retries: -1,
        onConnect: () => {
            console.log("[StreamerBot] ✅ Connecté au WebSocket Server");
        },
        onDisconnect: () => {
            console.log("[StreamerBot] ❌ Déconnecté — tentative de reconnexion...");
        },
        onError: (err) => {
            console.error("[StreamerBot] Erreur:", err);
        },
    });

    // ===========================
    // DEBUG FILE LOGGER
    // À retirer une fois que tout marche en production
    // ===========================
    const logFile = "./debug-events.log";
    writeFileSync(logFile, `--- Castellan Debug Log — ${new Date().toISOString()} ---\n\n`);

    client.on("*" as any, ({ event, data }: { event: any; data: any }) => {
        const type = `${event?.source}.${event?.type}`;
        if (type === "Inputs.InputMouseClick" || type === "Raw.SubAction") return;

        const entry = `[${new Date().toISOString()}] ${type}\n${JSON.stringify(data, null, 2)}\n---\n\n`;
        appendFileSync(logFile, entry);

        if (type !== "Twitch.ChatMessage" && type !== "Raw.ActionCompleted") {
            console.log(`[StreamerBot][DEBUG] 📨 ${type}`);
        }
    });

    // ═══════════════════════════════════════════════════════════
    // TWITCH.* HANDLERS — fire from LIVE Twitch events only
    // ═══════════════════════════════════════════════════════════

    // ── Chat Message ──
    client.on("Twitch.ChatMessage", async ({ data }: { data: any }) => {
        if (!currentStreamId) return;

        const viewer = extractViewer(data.user);
        if (!viewer || !viewer.twitchId) return;

        const content = data.text ?? data.message?.message ?? "";

        // Extraire les emotes depuis data.message.emotes (tableau StreamerBot)
        // Chaque emote: { id, type, name, startIndex, endIndex, imageUrl, ... }
        const rawEmotes = data.message?.emotes ?? data.emotes ?? [];
        const emotes = rawEmotes.map((e: any) => ({
            id: String(e.id ?? ""),
            type: String(e.type ?? "Twitch"),
            name: String(e.name ?? ""),
            startIndex: Number(e.startIndex ?? 0),
            endIndex: Number(e.endIndex ?? 0),
            imageUrl: String(e.imageUrl ?? ""),
        })).filter((e: any) => e.name && e.imageUrl);

        try {
            const dbViewer = await findOrCreateViewer(viewer);
            const session = await findOrCreateSession(dbViewer.id, currentStreamId);

            await prisma.chatMessage.create({
                data: { streamId: currentStreamId, viewerId: dbViewer.id, content },
            });

            await prisma.viewerSession.update({
                where: { id: session.id },
                data: {
                    messageCount: { increment: 1 },
                    lastActiveAt: new Date(),
                    isActive: true,
                },
            });

            await prisma.viewer.update({
                where: { id: dbViewer.id },
                data: { totalMessages: { increment: 1 } },
            });

            broadcast({
                type: "chat:message",
                payload: {
                    id: crypto.randomUUID(),
                    viewer,
                    content,
                    emotes: emotes.length > 0 ? emotes : undefined,
                    timestamp: new Date().toISOString(),
                },
            });
        } catch (err) {
            console.error("[StreamerBot] Erreur ChatMessage:", err);
        }
    });

    // ── Follow (live) ──
    // Twitch.Follow envoie les champs à plat : user_id, user_login, user_name
    // (pas d'objet data.user imbriqué comme ChatMessage)
    client.on("Twitch.Follow", async ({ data }: { data: any }) => {
        const viewer = extractViewer(data.user) ?? extractViewer({
            id: data.user_id,
            login: data.user_login,
            display: data.user_name,
            name: data.user_name,
        });
        if (viewer) await handleFollow(viewer);
    });

    // ── Sub (live) ──
    // Twitch.Sub peut envoyer user_id/user_login/user_name à plat
    client.on("Twitch.Sub", async ({ data }: { data: any }) => {
        const viewer = extractViewer(data.user) ?? extractViewer({
            id: data.user_id,
            login: data.user_login,
            display: data.user_name,
            name: data.user_name,
        });
        if (!viewer) return;
        const tier = parseTier(data.sub_tier ?? data.subTier);
        await handleSub(viewer, tier, 1);
    });

    // ── ReSub (live) ──
    client.on("Twitch.ReSub", async ({ data }: { data: any }) => {
        const viewer = extractViewer(data.user) ?? extractViewer({
            id: data.user_id,
            login: data.user_login,
            display: data.user_name,
            name: data.user_name,
        });
        if (!viewer) return;
        const tier = parseTier(data.subTier ?? data.sub_tier);
        const months = data.cumulativeMonths ?? data.cumulative_months ?? 1;
        await handleSub(viewer, tier, months);
    });

    // ── Raid (live) ──
    // Twitch.Raid envoie from_broadcaster_user_id/login/name à plat
    client.on("Twitch.Raid", async ({ data }: { data: any }) => {
        const viewer = extractViewer(data.user) ?? extractViewer({
            id: data.from_broadcaster_user_id,
            login: data.from_broadcaster_user_login,
            display: data.from_broadcaster_user_name,
            name: data.from_broadcaster_user_name,
        });
        if (!viewer) return;
        const viewers = data.viewerCount ?? data.viewers ?? 0;
        await handleRaid(viewer, viewers);
    });

    // ── Cheer (live) ──
    // Twitch.Cheer peut envoyer user_id/user_login/user_name à plat
    client.on("Twitch.Cheer", async ({ data }: { data: any }) => {
        const viewer = extractViewer(data.user) ?? extractViewer({
            id: data.user_id,
            login: data.user_login,
            display: data.user_name,
            name: data.user_name,
        });
        if (!viewer) return;
        await handleCheer(viewer, data.bits ?? 0);
    });

    // ── Reward Redemption (live) ──
    client.on("Twitch.RewardRedemption", async ({ data }: { data: any }) => {
        const viewer = extractViewer(data.user);
        if (!viewer) return;
        const rewardName = data.reward?.title ?? data.rewardName ?? "Inconnu";
        const rewardCost = data.reward?.cost ?? data.rewardCost ?? 0;
        await handleRewardRedemption(viewer, rewardName, rewardCost);
    });

    // ── Stream Update (live) ──
    client.on("Twitch.StreamUpdate", async ({ data }: { data: any }) => {
        if (!currentStreamId) return;

        const title = data.status ?? data.title;
        const game = data.gameName ?? data.game;
        console.log(`[StreamerBot] 📺 Stream Update: "${title}" — ${game}`);

        try {
            const stream = await prisma.stream.findUnique({ where: { id: currentStreamId } });
            if (!stream) return;

            const updates: any = {};

            if (title && title !== stream.title) {
                const history = stream.titleHistory ? JSON.parse(stream.titleHistory) : [];
                if (stream.title) history.push(stream.title);
                updates.title = title;
                updates.titleHistory = JSON.stringify(history);
            }

            if (game && game !== stream.game) {
                const history = stream.gameHistory ? JSON.parse(stream.gameHistory) : [];
                if (stream.game) history.push(stream.game);
                updates.game = game;
                updates.gameHistory = JSON.stringify(history);
            }

            if (Object.keys(updates).length > 0) {
                await prisma.stream.update({ where: { id: currentStreamId }, data: updates });
            }
        } catch (err) {
            console.error("[StreamerBot] Erreur StreamUpdate:", err);
        }
    });

    // ── Present Viewers (live heartbeat) ──
    client.on("Twitch.PresentViewers", async ({ data }: { data: any }) => {
        if (!currentStreamId) return;

        const viewers = data.viewers ?? data.users ?? [];
        console.log(`[StreamerBot] 👥 Present Viewers: ${viewers.length} viewers`);

        try {
            for (const user of viewers) {
                const viewer = extractViewer(user);
                if (!viewer || !viewer.twitchId) continue;

                const dbViewer = await findOrCreateViewer(viewer);
                const session = await findOrCreateSession(dbViewer.id, currentStreamId);

                await prisma.viewerSession.update({
                    where: { id: session.id },
                    data: {
                        lastActiveAt: new Date(),
                        isActive: true,
                        watchTime: { increment: 5 },
                    },
                });

                await prisma.viewer.update({
                    where: { id: dbViewer.id },
                    data: { totalWatchTime: { increment: 5 } },
                });
            }

            const activeCount = viewers.length;
            const stream = await prisma.stream.findUnique({ where: { id: currentStreamId } });
            if (stream && activeCount > (stream.peakViewers ?? 0)) {
                await prisma.stream.update({
                    where: { id: currentStreamId },
                    data: { peakViewers: activeCount },
                });
            }
        } catch (err) {
            console.error("[StreamerBot] Erreur PresentViewers:", err);
        }
    });

    // ═══════════════════════════════════════════════════════════
    // CUSTOM EVENTS (Stream Start/End/GoalsInit)
    // ═══════════════════════════════════════════════════════════

    client.on("Custom.Event", async ({ data }: { data: any }) => {
        const eventName = data.eventName;
        const args = data.args ?? {};

        if (eventName === "CastellanStreamStart") {
            const game = args.game ?? "Just Chatting";
            const startedAt = args.startedAt ?? new Date().toISOString();

            // Capturer le broadcaster ID depuis l'event StreamerBot
            // StreamerBot envoie broadcastUserId dans les arguments
            const broadcasterId = args.broadcastUserId ?? args.broadcasterId ?? null;
            if (broadcasterId) {
                currentBroadcasterId = String(broadcasterId);
                console.log(`[StreamerBot] 🎙️ Broadcaster ID: ${currentBroadcasterId}`);
            }

            console.log(`[StreamerBot] 🟢 Stream Start: ${game}`);

            try {
                const stream = await prisma.stream.create({
                    data: {
                        title: args.status ?? game,
                        game,
                        startedAt: new Date(startedAt),
                    },
                });
                currentStreamId = stream.id;
                console.log(`[StreamerBot] 📝 Stream créé: ${stream.id}`);
            } catch (err) {
                console.error("[StreamerBot] Erreur StreamStart:", err);
            }
        }

        if (eventName === "CastellanGoalsInit") {
            console.log(`[StreamerBot] 🎯 GoalsInit reçu:`, JSON.stringify(args));

            // Helper : convertit en number ou retourne undefined si absent/invalide
            const safeNum = (v: any): number | undefined => {
                if (v == null) return undefined;
                const n = Number(v);
                return isNaN(n) ? undefined : n;
            };

            // Derniers follower/sub — set AVANT updateGoalsConfig pour que
            // broadcastAllGoals() envoie les bons noms aux overlays
            // latestFollower.user = display name ("Yurelias")
            // latestFollower.userName = login ("yurelias")
            const lastFollowName = args["latestFollower.user"]
                ?? args["latestFollower.userName"]
                ?? null;
            // latestSubscriber n'a pas de .user, .userName = login
            const lastSubName = args["latestSubscriber.userName"]
                ?? args["latestSubscriber.userLogin"]
                ?? null;

            if (lastFollowName) setLastFollow(String(lastFollowName));
            if (lastSubName) setLastSub(String(lastSubName));

            // Compteurs actuels + targets
            updateGoalsConfig({
                followers: {
                    current: safeNum(args.followerCount),
                    target: safeNum(args.followersTarget),
                },
                subscribers: {
                    current: safeNum(args.subscriberCount),
                    target: safeNum(args.subscribersTarget),
                },
            });

            console.log(
                `[StreamerBot] 🎯 Goals initialisés — `
                + `followers: ${args.followerCount ?? "?"}/${args.followersTarget ?? "?"}, `
                + `subs: ${args.subscriberCount ?? "?"}/${args.subscribersTarget ?? "?"}, `
                + `lastFollow: ${lastFollowName ?? "aucun"}, lastSub: ${lastSubName ?? "aucun"}`,
            );
        }

        if (eventName === "CastellanStreamEnd") {
            if (!currentStreamId) return;
            console.log(`[StreamerBot] 🔴 Stream End`);

            try {
                await prisma.stream.update({
                    where: { id: currentStreamId },
                    data: { endedAt: new Date() },
                });

                await prisma.viewerSession.updateMany({
                    where: { streamId: currentStreamId, isActive: true },
                    data: { isActive: false },
                });

                console.log(`[StreamerBot] 📝 Stream terminé: ${currentStreamId}`);
                currentStreamId = null;
                currentBroadcasterId = null;
            } catch (err) {
                console.error("[StreamerBot] Erreur StreamEnd:", err);
            }
        }
    });

    // ═══════════════════════════════════════════════════════════
    // RAW.ACTION HANDLER — for StreamerBot test triggers
    //
    // When you right-click a trigger in StreamerBot and click
    // "Test Trigger", it does NOT fire the native Twitch.* event.
    // Instead it fires Raw.Action with the trigger data in
    // data.arguments. We route these to the same handler functions.
    //
    // Only processes events with isTest: true to avoid
    // double-processing live events.
    // ═══════════════════════════════════════════════════════════

    client.on("Raw.Action" as any, async ({ data }: { data: any }) => {
        const args = data.arguments;
        if (!args) return;

        // Only handle test triggers — live events use Twitch.* handlers
        if (!args.isTest) return;

        const triggerName = args.triggerName;
        if (!triggerName) return;

        // Extract viewer from Raw.Action user format
        const viewer = extractViewer(data.user);

        switch (triggerName) {
            case "Follow": {
                if (viewer) await handleFollow(viewer);
                break;
            }

            case "Cheer": {
                if (viewer) await handleCheer(viewer, args.bits ?? 0);
                break;
            }

            case "Subscription": {
                if (viewer) {
                    const tier = parseTier(args.tier);
                    await handleSub(viewer, tier, 1);
                }
                break;
            }

            case "Resubscription": {
                if (viewer) {
                    const tier = parseTier(args.tier);
                    const months = args.cumulative ?? args.cumulativeMonths ?? 1;
                    await handleSub(viewer, tier, months);
                }
                break;
            }

            case "Gift Subscription": {
                if (viewer) {
                    const tier = parseTier(args.tier);
                    const recipientName = args.recipientUser ?? "Inconnu";
                    const totalGifted = args.totalSubsGifted ?? 1;
                    await handleGiftSub(viewer, recipientName, tier, totalGifted, args.anonymous ?? false);
                }
                break;
            }

            case "Raid": {
                if (viewer) await handleRaid(viewer, args.viewers ?? 0);
                break;
            }

            case "Reward Redemption": {
                if (viewer) {
                    const rewardName = args.rewardName ?? "Inconnu";
                    const rewardCost = args.rewardCost ?? 0;
                    await handleRewardRedemption(viewer, rewardName, rewardCost);
                }
                break;
            }

            default:
                break;
        }
    });

    console.log("[StreamerBot] 📡 Subscriptions enregistrées, en attente d'events...");
}