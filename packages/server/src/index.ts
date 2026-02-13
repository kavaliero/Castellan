import express from "express";
import cors from "cors";
import { initWebSocket, broadcast, getClientCount } from "./ws/broadcaster";
import { connectToStreamerBot, getCurrentStreamId, setCurrentStreamId, getBroadcasterId, setBroadcasterId } from "./services/streamerbot.service";
import { buildCredits } from "./services/credits.service";
import { initGoals, getGoalsState, updateGoalsConfig, broadcastAllGoals } from "./services/goals.service";
import { syncClips, getClips, getClipsCount, getClipsSyncedAt } from "./services/clips.service";
import { prisma } from "./db/client";
import { findOrCreateViewer, findOrCreateSession } from "./services/viewer.service";
import type { IncomingEvent, ClipsSyncPayload } from "@castellan/shared";

const app = express();
app.use(cors());
app.use(express.json());

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