import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { initWebSocket, broadcast, getClientCount } from "./ws/broadcaster";
import { initAlerts, getAlertsConfig, updateAlertConfig, updateGlobalConfig } from "./services/alerts.service";
import { connectToStreamerBot, getCurrentStreamId, setCurrentStreamId, getBroadcasterId, setBroadcasterId } from "./services/streamerbot.service";
import { buildCredits } from "./services/credits.service";
import { initGoals, getGoalsState, updateGoalsConfig, broadcastAllGoals } from "./services/goals.service";
import { initStreamState } from "./services/stream.service";
import { syncClips, getClips, getClipsCount, getClipsSyncedAt } from "./services/clips.service";
import { prisma } from "./db/client";
import { findOrCreateViewer, findOrCreateSession } from "./services/viewer.service";
import type { IncomingEvent, ClipsSyncPayload } from "@castellan/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());
app.use('/media', express.static(path.resolve(__dirname, '../media')));

// ===========================
// HEALTH CHECK
// ===========================
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    name: "Castellan",
    version: "0.1.0",
    uptime: Math.round(process.uptime()),
    currentStream: getCurrentStreamId() ? true : false,
    wsClients: getClientCount(),
  });
});

// ===========================
// CREDITS (déclenché par commande !credits)
// ===========================
app.get("/api/credits", async (req, res) => {
  try {
    const streamId = getCurrentStreamId();
    if (!streamId) {
      res.status(400).json({ ok: false, error: "Aucun stream en cours" });
      return;
    }

    const credits = await buildCredits(streamId, getBroadcasterId());

    broadcast({
      type: "credits:data",
      payload: credits,
    });

    console.log(`[Credits] 🎬 Crédits envoyés aux overlays`);
    res.json({ ok: true, credits });
  } catch (err) {
    console.error("[Credits] Erreur:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

// ===========================
// GOALS CONFIG API
// StreamerBot ou n'importe quel outil peut appeler ces endpoints
// pour configurer/mettre à jour les objectifs
// ===========================

/**
 * GET /api/goals — Retourne l'état actuel des goals
 * Utile pour debug ou dashboard
 */
app.get("/api/goals", (_req, res) => {
  res.json({ ok: true, goals: getGoalsState() });
});

/**
 * POST /api/goals/config — Met à jour la configuration des goals
 * 
 * Body JSON:
 * {
 *   "followers": { "target": 1000, "current": 324 },   // current est optionnel
 *   "subscribers": { "target": 50 }
 * }
 * 
 * Depuis StreamerBot : action "Fetch URL" avec method POST
 * URL: http://localhost:3001/api/goals/config
 * Body: { "followers": { "target": 500 }, "subscribers": { "target": 25 } }
 */
app.post("/api/goals/config", (req, res) => {
  const { followers, subscribers } = req.body;
  updateGoalsConfig({ followers, subscribers });
  console.log("[Goals] 🎯 Config mise à jour:", JSON.stringify(req.body));
  res.json({ ok: true, goals: getGoalsState() });
});

// ===========================
// ALERTS CONFIG API
// ===========================

app.get("/api/alerts/config", (_req, res) => {
  res.json(getAlertsConfig());
});

app.put("/api/alerts/config/global", (req, res) => {
  const error = updateGlobalConfig(req.body);
  if (error) return res.status(400).json({ error });
  res.json(getAlertsConfig());
});

app.put("/api/alerts/config/:type", (req, res) => {
  const error = updateAlertConfig(req.params.type, req.body);
  if (error) return res.status(400).json({ error });
  res.json(getAlertsConfig());
});

// ===========================
// ALERTS TEST (admin dashboard)
// ===========================

const TEST_PAYLOADS: Record<string, object> = {
  follow:     { type: "alert:follow", payload: { viewer: { displayName: "TestViewer" } } },
  sub:        { type: "alert:sub", payload: { viewer: { displayName: "TestViewer" }, tier: 1, months: 1 } },
  resub:      { type: "alert:sub", payload: { viewer: { displayName: "TestViewer" }, tier: 1, months: 6 } },
  gift_sub:   { type: "alert:gift_sub", payload: { viewer: { displayName: "TestViewer" }, recipientName: "LuckyViewer", tier: 1, totalGifted: 5, anonymous: false } },
  raid:       { type: "alert:raid", payload: { fromChannel: "TestRaider", viewers: 42, game: "Just Chatting" } },
  bits:       { type: "alert:bits", payload: { viewer: { displayName: "TestViewer" }, amount: 100 } },
  hype_train: { type: "alert:hype_train", payload: { level: 2, totalPoints: 5000, progress: 75 } },
  first_word: { type: "alert:first_word", payload: { viewer: { displayName: "TestViewer" } } },
  dice:       { type: "alert:dice", payload: { viewer: { displayName: "TestViewer" }, faces: 20, result: 17 } },
  channel_point_redemption: { type: "alert:channel_point_redemption", payload: { viewer: { displayName: "TestViewer" }, rewardName: "Test Reward", rewardCost: 500 } },
};

app.post("/api/alerts/test/:type", (req, res) => {
  const testEvent = TEST_PAYLOADS[req.params.type];
  if (!testEvent) {
    res.status(404).json({ ok: false, error: "Unknown alert type" });
    return;
  }
  broadcast(testEvent as any);
  console.log(`[Alerts] 🧪 Test alert: ${req.params.type}`);
  res.json({ ok: true, type: req.params.type });
});

// ===========================
// CLIPS (pour la scène pause)
// StreamerBot récupère les clips via l'API Twitch
// et les POST ici pour que l'overlay /pause les joue
// ===========================

/**
 * POST /api/clips/sync — Reçoit les clips depuis StreamerBot
 * 
 * Body JSON:
 * {
 *   "clips": [
 *     {
 *       "id": "AwkwardHelplessSalamanderSwiftRage",
 *       "url": "https://clips.twitch.tv/...",
 *       "embedUrl": "https://clips.twitch.tv/embed?clip=...",
 *       "creatorName": "Toto",
 *       "title": "Moment épique",
 *       "viewCount": 42,
 *       "createdAt": "2026-01-15T20:00:00Z",
 *       "thumbnailUrl": "https://clips-media-assets2.twitch.tv/...-preview-480x272.jpg",
 *       "duration": 30,
 *       "gameName": "Elden Ring"
 *     }
 *   ]
 * }
 * 
 * Depuis StreamerBot : action C# qui fetch l'API Twitch /helix/clips
 * puis POST le résultat ici.
 */
app.post("/api/clips/sync", (req, res) => {
  try {
    const body = req.body as ClipsSyncPayload;

    if (!body.clips || !Array.isArray(body.clips)) {
      res.status(400).json({ ok: false, error: "Le body doit contenir un tableau 'clips'" });
      return;
    }

    const result = syncClips(body.clips);

    // Notifier les overlays que les clips sont disponibles
    broadcast({
      type: "clips:synced",
      payload: {
        count: result.count,
        syncedAt: result.syncedAt,
      },
    });

    console.log(`[Clips] 🎬 ${result.count} clips reçus et synchronisés`);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[Clips] Erreur sync:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

/**
 * GET /api/clips — Retourne les clips en ordre aléatoire
 * 
 * Query params optionnels :
 * - limit : nombre max de clips (défaut : tous)
 * 
 * Chaque appel retourne un ordre différent (shuffle).
 * L'overlay /pause appelle cet endpoint au mount.
 */
app.get("/api/clips", (_req, res) => {
  const limit = _req.query.limit ? parseInt(_req.query.limit as string) : undefined;

  const clips = getClips({ limit });

  res.json({
    ok: true,
    count: clips.length,
    total: getClipsCount(),
    syncedAt: getClipsSyncedAt(),
    clips,
  });
});

// ===========================
// CHAT CLEAR (modérateurs / StreamerBot)
// ===========================
app.post("/api/chat/clear", (_req, res) => {
  broadcast({ type: "chat:clear" });
  console.log("[Chat] 🧹 Chat clear envoyé aux overlays");
  res.json({ ok: true });
});

// ===========================
// ROUTES HTTP MANUELLES (pour tests + fallback)
// On les garde pour pouvoir tester avec PowerShell
// sans avoir besoin de StreamerBot
// ===========================

app.post("/api/stream/start", async (req, res) => {
  const { title, game, broadcasterId } = req.body;
  const stream = await prisma.stream.create({
    data: {
      title: title ?? "Stream sans titre",
      game: game ?? "Just Chatting",
    },
  });
  setCurrentStreamId(stream.id);

  // Configurer le broadcaster ID pour exclure le streamer des crédits
  if (broadcasterId) {
    setBroadcasterId(String(broadcasterId));
  }

  console.log(`[HTTP] 🟢 Stream démarré: ${stream.id}${broadcasterId ? ` (broadcaster: ${broadcasterId})` : ""}`);
  res.json({ ok: true, streamId: stream.id });
});

app.post("/api/stream/end", async (req, res) => {
  const streamId = getCurrentStreamId();
  if (!streamId) {
    res.status(400).json({ ok: false, error: "Aucun stream en cours" });
    return;
  }
  await prisma.stream.update({
    where: { id: streamId },
    data: { endedAt: new Date() },
  });
  await prisma.viewerSession.updateMany({
    where: { streamId, isActive: true },
    data: { isActive: false },
  });
  setCurrentStreamId(null);
  console.log(`[HTTP] 🔴 Stream terminé: ${streamId}`);
  res.json({ ok: true });
});

app.post("/api/event", async (req, res) => {
  const event = req.body as IncomingEvent;
  // Garder le handler HTTP pour les tests manuels
  // (même logique qu'avant, en fallback)
  console.log(`[HTTP] Event reçu: ${event.type}`);

  const streamId = getCurrentStreamId();
  if (!streamId) {
    res.status(400).json({ ok: false, error: "Aucun stream en cours" });
    return;
  }

  try {
    if (event.viewer) {
      const dbViewer = await findOrCreateViewer(event.viewer);
      await findOrCreateSession(dbViewer.id, streamId);

      if (event.type === "message" && event.data?.content) {
        await prisma.chatMessage.create({
          data: { streamId, viewerId: dbViewer.id, content: event.data.content },
        });
        await prisma.viewerSession.updateMany({
          where: { viewerId: dbViewer.id, streamId },
          data: { messageCount: { increment: 1 }, lastActiveAt: new Date() },
        });
        broadcast({
          type: "chat:message",
          payload: {
            id: crypto.randomUUID(),
            viewer: event.viewer,
            content: event.data.content,
            emotes: event.data.emotes,
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (event.type === "follow") {
        await prisma.viewer.update({ where: { id: dbViewer.id }, data: { isFollower: true } });
        await prisma.streamEvent.create({ data: { streamId, viewerId: dbViewer.id, type: "follow" } });
        broadcast({ type: "alert:follow", payload: { viewer: event.viewer } });
      }

      if (event.type === "sub" && event.data) {
        const tier = event.data.tier ?? 1;
        const months = event.data.months ?? 1;
        await prisma.streamEvent.create({
          data: { streamId, viewerId: dbViewer.id, type: "sub", data: JSON.stringify({ tier, months }) },
        });
        broadcast({ type: "alert:sub", payload: { viewer: event.viewer, tier, months } });
      }

      if (event.type === "gift_sub" && event.data) {
        const recipientName = event.data.recipientName ?? "Inconnu";
        const tier = event.data.tier ?? 1;
        const totalGifted = event.data.totalGifted ?? 1;
        const anonymous = event.data.anonymous ?? false;
        await prisma.streamEvent.create({
          data: { streamId, viewerId: dbViewer.id, type: "gift_sub", data: JSON.stringify({ recipientName, tier, totalGifted, anonymous }) },
        });
        broadcast({ type: "alert:gift_sub", payload: { viewer: event.viewer, recipientName, tier, totalGifted, anonymous } });
      }

      if (event.type === "raid" && event.data) {
        const viewers = event.data.viewers ?? 0;
        const fromChannel = event.data.fromChannel ?? event.viewer.displayName;
        await prisma.streamEvent.create({
          data: { streamId, viewerId: dbViewer.id, type: "raid", data: JSON.stringify({ viewers, fromChannel }) },
        });
        broadcast({ type: "alert:raid", payload: { fromChannel, viewers, game: event.data.game } });
      }

      if (event.type === "bits" && event.data) {
        const amount = event.data.amount ?? 0;
        await prisma.streamEvent.create({
          data: { streamId, viewerId: dbViewer.id, type: "bits", data: JSON.stringify({ amount }) },
        });
        broadcast({ type: "alert:bits", payload: { viewer: event.viewer, amount } });
      }

      if (event.type === "dice" && event.data) {
        const faces = event.data.faces ?? 20;
        const result = event.data.result ?? 1;
        await prisma.streamEvent.create({
          data: { streamId, viewerId: dbViewer.id, type: "dice", data: JSON.stringify({ faces, result }) },
        });
        broadcast({
          type: "alert:dice",
          payload: { viewer: event.viewer, faces, result },
        });
      }

      if (event.type === "channel_point_redemption" && event.data) {
        const rewardName = event.data.rewardName ?? "Inconnu";
        const rewardCost = event.data.rewardCost ?? 0;
        await prisma.streamEvent.create({
          data: { streamId, viewerId: dbViewer.id, type: "channel_point_redemption", data: JSON.stringify({ rewardName, rewardCost }) },
        });
        broadcast({
          type: "alert:channel_point_redemption",
          payload: { viewer: event.viewer, rewardName, rewardCost },
        });
      }

      if (event.type === "hype_train" && event.data) {
        await prisma.streamEvent.create({
          data: { streamId, viewerId: dbViewer.id, type: "hype_train", data: JSON.stringify({ level: event.data.level, totalPoints: event.data.totalPoints, progress: event.data.progress }) },
        });
        broadcast({
          type: "alert:hype_train",
          payload: {
            level: event.data.level ?? 1,
            totalPoints: event.data.totalPoints ?? 0,
            progress: event.data.progress ?? 0,
          },
        });
      }

      if (event.type === "first_word") {
        broadcast({ type: "alert:first_word", payload: { viewer: event.viewer } });
      }

      if (event.type === "join") {
        await findOrCreateSession(dbViewer.id, streamId);
      }

      if (event.type === "leave") {
        await prisma.viewerSession.updateMany({
          where: { viewerId: dbViewer.id, streamId, isActive: true },
          data: { isActive: false },
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[HTTP] Erreur:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

// ===========================
// DÉMARRAGE
// ===========================
async function start() {
  initGoals();
  initAlerts();
  initStreamState();
  initWebSocket(3002);

  app.listen(3001, () => {
    console.log("[Server] 🏰 Castellan démarré !");
    console.log("[Server] 📡 HTTP: http://localhost:3001");
    console.log("[Server] 🔌 WS overlays: ws://localhost:3002");
  });

  // Connexion à StreamerBot
  // (ne bloque pas le démarrage si SB n'est pas lancé)
  try {
    await connectToStreamerBot({
      host: "127.0.0.1",
      port: 8080,
    });
  } catch (err) {
    console.warn("[Server] ⚠️ StreamerBot non disponible, mode HTTP uniquement");
  }
}

start();