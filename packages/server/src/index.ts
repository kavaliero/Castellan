import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import multer from "multer";
import { initWebSocket, broadcast, getClientCount } from "./ws/broadcaster";
import { initAlerts, getAlertsConfig, updateAlertConfig, updateGlobalConfig } from "./services/alerts.service";
import { connectToStreamerBot, getCurrentStreamId, setCurrentStreamId, getBroadcasterId, setBroadcasterId, onBroadcasterIdChange } from "./services/streamerbot.service";
import { buildCredits } from "./services/credits.service";
import { initGoals, getGoalsState, updateGoalsConfig, broadcastAllGoals } from "./services/goals.service";
import { initStreamState, getViewerCount } from "./services/stream.service";
import { syncClips, getClips, getClipsCount, getClipsSyncedAt } from "./services/clips.service";
import { prisma } from "./db/client";
import { findOrCreateViewer, findOrCreateSession, listViewers, getViewerDetail, getViewerTimeline, getLiveStreamStats } from "./services/viewer.service";
import { enrichViewer, enrichViewerByTwitchId, enrichStaleViewers, getEnrichmentStats, isTwitchConfigured, setTwitchBroadcasterId, getOAuthUrl, exchangeOAuthCode, loadPersistedToken, hasUserToken } from "./services/twitch.service";
import { resetStamps } from "./services/badge.service";
import { rollDice, getAvailableDice, getDiceHistory } from "./services/dice.service";
import { addChallenge, incrementChallenge, startTimer, stopTimer, completeTimer, getActiveChallenges, getAllChallenges, removeChallenge, startTimerTick, getChallengeCredits } from "./services/challenge.service";
import { loadDiceSettings, getDiceSettings, saveDiceSettings, enqueueDiceRoll } from "./services/dice-queue.service";
import type { IncomingEvent, ClipsSyncPayload, ChallengeType } from "@castellan/shared";

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
  // Engagement — tampons & des
  stamp_3:        { type: "stamp:incremented", payload: { viewer: { displayName: "TestViewer" }, stampCount: 3, stampTotal: 10 } },
  stamp_9:        { type: "stamp:incremented", payload: { viewer: { displayName: "TestViewer" }, stampCount: 9, stampTotal: 10 } },
  stamp_max:      { type: "stamp:incremented", payload: { viewer: { displayName: "TestViewer" }, stampCount: 10, stampTotal: 10 } },
  dice_earned:    { type: "dice:earned", payload: { viewer: { displayName: "TestViewer" }, tier: "follow", source: "loyalty_card" } },
  dice_squatt_d6: { type: "dice:rolled", payload: { viewer: { displayName: "TestViewer" }, tier: "follow", dieType: "squatt", faces: 6, result: 4, isNat20: false } },
  dice_squatt_d12:{ type: "dice:rolled", payload: { viewer: { displayName: "TestViewer" }, tier: "sub", dieType: "squatt", faces: 12, result: 9, isNat20: false } },
  dice_raid_d12:  { type: "dice:rolled", payload: { viewer: { displayName: "TestRaider" }, tier: "raid", dieType: "squatt", faces: 12, result: 7, isNat20: false } },
  dice_wheel_miss:{ type: "dice:rolled", payload: { viewer: { displayName: "TestViewer" }, tier: "follow", dieType: "wheel", faces: 20, result: 13, isNat20: false } },
  dice_wheel_nat20:{ type: "dice:rolled", payload: { viewer: { displayName: "TestViewer" }, tier: "sub", dieType: "wheel", faces: 20, result: 20, isNat20: true } },
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
// SOUND UPLOAD (admin dashboard)
// ===========================

const VALID_SOUND_TYPES = new Set([
  "follow", "sub", "resub", "gift_sub", "raid",
  "bits", "hype_train", "first_word", "dice", "channel_point_redemption",
]);

const soundsDir = path.resolve(__dirname, "../media/alerts/sounds");
const soundUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.post("/api/upload/sound/:type", soundUpload.single("file"), (req, res) => {
  const { type } = req.params;
  if (!VALID_SOUND_TYPES.has(type)) {
    res.status(400).json({ ok: false, error: "Invalid alert type" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ ok: false, error: "No file provided" });
    return;
  }
  const dest = path.join(soundsDir, `${type}.mp3`);
  fs.mkdirSync(soundsDir, { recursive: true });
  fs.writeFileSync(dest, req.file.buffer);
  console.log(`[Upload] 🔊 Sound updated: ${type}.mp3`);
  res.json({ ok: true, file: `${type}.mp3` });
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
// VIEWERS API (dashboard admin)
// ===========================

/**
 * GET /api/viewers — Liste paginee avec tri, recherche et filtres.
 *
 * Query params :
 * - page (default 1)
 * - pageSize (default 25, max 100)
 * - sortBy: "displayName" | "totalMessages" | "totalWatchTime" | "totalBitsDonated" | "totalChannelPointsUsed" | "firstSeenAt" | "totalStreams"
 * - sortOrder: "asc" | "desc"
 * - search: recherche par nom
 * - follower: "true" | "false" (filtre followers)
 * - subscriber: "true" | "false" (filtre subs)
 */
app.get("/api/viewers", async (req, res) => {
  try {
    const result = await listViewers({
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
      sortBy: req.query.sortBy as any,
      sortOrder: req.query.sortOrder as any,
      search: req.query.search as string | undefined,
      filterFollower: req.query.follower !== undefined ? req.query.follower === "true" : undefined,
      filterSubscriber: req.query.subscriber !== undefined ? req.query.subscriber === "true" : undefined,
      currentStreamId: getCurrentStreamId(),
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[Viewers] Erreur liste:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

/**
 * GET /api/viewers/:id — Detail complet d'un viewer (par ID Prisma ou twitchId).
 */
app.get("/api/viewers/:id", async (req, res) => {
  try {
    const viewer = await getViewerDetail(req.params.id, getCurrentStreamId());
    if (!viewer) {
      res.status(404).json({ ok: false, error: "Viewer non trouve" });
      return;
    }
    res.json({ ok: true, viewer });
  } catch (err) {
    console.error("[Viewers] Erreur detail:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

/**
 * GET /api/viewers/:id/timeline — Timeline d'activite d'un viewer.
 *
 * Query params :
 * - limit (default 50, max 200)
 * - offset (default 0)
 */
app.get("/api/viewers/:id/timeline", async (req, res) => {
  try {
    const timeline = await getViewerTimeline(req.params.id, {
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    });
    res.json({ ok: true, timeline });
  } catch (err) {
    console.error("[Viewers] Erreur timeline:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

// ===========================
// TWITCH OAUTH
// ===========================

/**
 * GET /api/twitch/auth — Redirige vers la page d'autorisation Twitch OAuth.
 * L'utilisateur autorise Castellan a lire ses followers.
 */
app.get("/api/twitch/auth", (_req, res) => {
  if (!isTwitchConfigured()) {
    res.status(503).json({ ok: false, error: "Twitch API non configuree" });
    return;
  }
  const url = getOAuthUrl();
  res.redirect(url);
});

/**
 * GET /api/twitch/callback — Callback OAuth Twitch.
 * Recoit le code d'autorisation et l'echange contre un token.
 */
app.get("/api/twitch/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  const error = req.query.error as string | undefined;

  if (error) {
    res.status(400).send(`
      <html><body style="background:#0f0f1a;color:#e0e0e0;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px">
        <h2 style="color:#f87171">Autorisation refusee</h2>
        <p>${error}</p>
        <p style="color:#888">Tu peux fermer cette page.</p>
      </body></html>
    `);
    return;
  }

  if (!code) {
    res.status(400).send("Code manquant");
    return;
  }

  const ok = await exchangeOAuthCode(code);
  if (ok) {
    res.send(`
      <html><body style="background:#0f0f1a;color:#e0e0e0;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px">
        <h2 style="color:#4ade80">Connexion Twitch reussie !</h2>
        <p>Castellan peut maintenant verifier les followers et enrichir les viewers.</p>
        <p style="color:#888">Tu peux fermer cette page et retourner au dashboard.</p>
      </body></html>
    `);
  } else {
    res.status(500).send(`
      <html><body style="background:#0f0f1a;color:#e0e0e0;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px">
        <h2 style="color:#f87171">Erreur de connexion</h2>
        <p>L'echange du code a echoue. Verifie les logs du serveur.</p>
      </body></html>
    `);
  }
});

/**
 * GET /api/twitch/auth-status — Statut de l'authentification Twitch.
 */
app.get("/api/twitch/auth-status", (_req, res) => {
  res.json({
    ok: true,
    configured: isTwitchConfigured(),
    hasUserToken: hasUserToken(),
    oauthUrl: isTwitchConfigured() ? "/api/twitch/auth" : null,
  });
});

// ===========================
// TWITCH ENRICHMENT
// ===========================

/**
 * POST /api/viewers/:id/enrich — Force le refresh des donnees Twitch d'un viewer.
 * Utile depuis le dashboard pour mettre a jour manuellement.
 */
app.post("/api/viewers/:id/enrich", async (req, res) => {
  try {
    if (!isTwitchConfigured()) {
      res.status(503).json({ ok: false, error: "Twitch API non configuree (CLIENT_ID/SECRET manquants)" });
      return;
    }
    const ok = await enrichViewer(req.params.id, true);
    if (ok) {
      const viewer = await getViewerDetail(req.params.id);
      res.json({ ok: true, viewer });
    } else {
      res.status(404).json({ ok: false, error: "Viewer introuvable ou enrichissement echoue" });
    }
  } catch (err) {
    console.error("[Twitch] Erreur enrich:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

/**
 * POST /api/viewers/:id/reset-stamps — Reset les tampons d'un viewer a 0.
 * Utilise apres qu'un viewer a utilise sa relance de de.
 */
app.post("/api/viewers/:id/reset-stamps", async (req, res) => {
  try {
    await resetStamps(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("[Stamps] Erreur reset:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

/**
 * GET /api/viewers/:id/dice — Capacites de des disponibles pour un viewer.
 */
app.get("/api/viewers/:id/dice", async (req, res) => {
  try {
    const available = await getAvailableDice(req.params.id);
    const history = await getDiceHistory(req.params.id);
    res.json({ ok: true, available, history });
  } catch (err) {
    console.error("[Dice] Erreur lecture:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

/**
 * POST /api/viewers/:id/dice/roll — Lance un de pour un viewer (depuis le dashboard).
 * Body: { dieType: "squatt" | "wheel" }
 */
app.post("/api/viewers/:id/dice/roll", async (req, res) => {
  try {
    const dieType = req.body?.dieType;
    if (dieType !== "squatt" && dieType !== "wheel") {
      res.status(400).json({ ok: false, error: "dieType doit etre 'squatt' ou 'wheel'" });
      return;
    }
    const result = await rollDice(req.params.id, dieType);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[Dice] Erreur roll:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

/**
 * POST /api/twitch/enrich-batch — Lance l'enrichissement batch des viewers stale.
 * Retourne le nombre de viewers enrichis/echoues.
 */
app.post("/api/twitch/enrich-batch", async (req, res) => {
  try {
    if (!isTwitchConfigured()) {
      res.status(503).json({ ok: false, error: "Twitch API non configuree" });
      return;
    }
    const forceAll = req.body?.forceAll === true;
    const result = await enrichStaleViewers(forceAll);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[Twitch] Erreur batch:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

/**
 * GET /api/viewers/purgeable — Liste les viewers supprimables (comptes Twitch supprimes + donnees de test).
 */
app.get("/api/viewers/purgeable", async (_req, res) => {
  try {
    const deleted = await prisma.viewer.findMany({
      where: { twitchDeletedAt: { not: null } },
      select: { id: true, username: true, displayName: true, twitchId: true, totalMessages: true, twitchDeletedAt: true },
      orderBy: { totalMessages: "asc" },
    });
    const testData = await prisma.viewer.findMany({
      where: {
        twitchId: { in: ["0", "1", "2", "3", "10", "11", "12", "13", "20", "21", "22", "23", "24", "25", "26", "30"] },
      },
      select: { id: true, username: true, displayName: true, twitchId: true, totalMessages: true },
    });
    res.json({
      ok: true,
      deleted: deleted.map((v) => ({ ...v, reason: "Compte Twitch supprime" })),
      testData: testData.map((v) => ({ ...v, reason: "Donnees de test" })),
      totalPurgeable: deleted.length + testData.length,
    });
  } catch (err) {
    console.error("[Viewers] Erreur purgeable:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

/**
 * POST /api/viewers/purge — Supprime les viewers par IDs (cascade: sessions, messages, events).
 */
app.post("/api/viewers/purge", async (req, res) => {
  try {
    const { ids } = req.body as { ids?: string[] };
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ ok: false, error: "ids requis (tableau)" });
      return;
    }

    // Suppression en cascade : sessions, messages, events, puis viewer
    const deleteSessions = prisma.viewerSession.deleteMany({ where: { viewerId: { in: ids } } });
    const deleteMessages = prisma.chatMessage.deleteMany({ where: { viewerId: { in: ids } } });
    const deleteEvents = prisma.streamEvent.deleteMany({ where: { viewerId: { in: ids } } });
    await Promise.all([deleteSessions, deleteMessages, deleteEvents]);

    const result = await prisma.viewer.deleteMany({ where: { id: { in: ids } } });

    console.log(`[Viewers] Purge: ${result.count} viewers supprimes`);
    res.json({ ok: true, purged: result.count });
  } catch (err) {
    console.error("[Viewers] Erreur purge:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

/**
 * GET /api/twitch/stats — Stats d'enrichissement (combien de viewers enrichis, en attente, etc.)
 */
app.get("/api/twitch/stats", async (_req, res) => {
  try {
    const stats = await getEnrichmentStats();
    res.json({ ok: true, ...stats });
  } catch (err) {
    console.error("[Twitch] Erreur stats:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

/**
 * POST /api/twitch/sync-followers — Sync manuelle du statut follower.
 * Accepte un tableau de usernames Twitch et les marque comme followers.
 * Usage : depuis le dashboard ou via curl/PowerShell.
 *
 * Body : { "usernames": ["darkann2444", "autre_viewer"] }
 * Ou : { "all": true } pour marquer TOUS les viewers existants comme followers
 */
app.post("/api/twitch/sync-followers", async (req, res) => {
  try {
    const { usernames, all } = req.body;

    if (all === true) {
      // Marquer tous les viewers comme followers
      const result = await prisma.viewer.updateMany({
        where: { isFollower: false },
        data: { isFollower: true },
      });
      console.log(`[Twitch] Sync followers: ${result.count} viewers marques comme followers`);
      res.json({ ok: true, updated: result.count, mode: "all" });
      return;
    }

    if (!Array.isArray(usernames) || usernames.length === 0) {
      res.status(400).json({ ok: false, error: "Body requis: { usernames: string[] } ou { all: true }" });
      return;
    }

    // Normaliser en lowercase
    const normalized = usernames.map((u: string) => u.toLowerCase().trim());

    const result = await prisma.viewer.updateMany({
      where: {
        username: { in: normalized },
      },
      data: { isFollower: true },
    });

    console.log(`[Twitch] Sync followers: ${result.count}/${normalized.length} viewers marques comme followers`);
    res.json({ ok: true, updated: result.count, total: normalized.length });
  } catch (err) {
    console.error("[Twitch] Erreur sync-followers:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

/**
 * POST /api/twitch/unsync-followers — Retirer le statut follower de viewers specifiques.
 * Body : { "usernames": ["viewer1", "viewer2"] }
 */
app.post("/api/twitch/unsync-followers", async (req, res) => {
  try {
    const { usernames } = req.body;
    if (!Array.isArray(usernames) || usernames.length === 0) {
      res.status(400).json({ ok: false, error: "Body requis: { usernames: string[] }" });
      return;
    }

    const normalized = usernames.map((u: string) => u.toLowerCase().trim());
    const result = await prisma.viewer.updateMany({
      where: { username: { in: normalized } },
      data: { isFollower: false },
    });

    res.json({ ok: true, updated: result.count });
  } catch (err) {
    console.error("[Twitch] Erreur unsync-followers:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

/**
 * GET /api/stream/live-stats — Stats en temps reel du stream en cours.
 * Retourne les top chatters, viewers actifs, events recents, compteurs.
 */
app.get("/api/stream/live-stats", async (req, res) => {
  try {
    const streamId = getCurrentStreamId();
    if (!streamId) {
      res.status(400).json({ ok: false, error: "Aucun stream en cours" });
      return;
    }
    const stats = await getLiveStreamStats(streamId, getViewerCount());
    res.json({ ok: true, stats });
  } catch (err) {
    console.error("[Stream] Erreur live-stats:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
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

  // Configurer le broadcaster ID pour exclure le streamer des crédits + enrichissement Twitch
  if (broadcasterId) {
    setBroadcasterId(String(broadcasterId));
    setTwitchBroadcasterId(String(broadcasterId));
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
          data: {
            streamId, viewerId: dbViewer.id, content: event.data.content,
            emotes: event.data.emotes ? JSON.stringify(event.data.emotes) : null,
          },
        });
        await prisma.viewerSession.updateMany({
          where: { viewerId: dbViewer.id, streamId },
          data: { messageCount: { increment: 1 }, lastActiveAt: new Date() },
        });
        // Mettre a jour le total global du viewer
        await prisma.viewer.update({
          where: { id: dbViewer.id },
          data: { totalMessages: { increment: 1 } },
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
        await prisma.viewer.update({
          where: { id: dbViewer.id },
          data: { isSubscriber: true },
        });
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
        await prisma.viewer.update({
          where: { id: dbViewer.id },
          data: { totalBitsDonated: { increment: amount } },
        });
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
        await prisma.viewer.update({
          where: { id: dbViewer.id },
          data: { totalChannelPointsUsed: { increment: rewardCost } },
        });
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
        await prisma.streamEvent.create({
          data: { streamId, viewerId: dbViewer.id, type: "first_word" },
        });
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
// CHALLENGES (defis : squatts, timers, etc.)
// ===========================

// Liste tous les defis (actifs + completes, pour l'admin)
app.get("/api/challenges", async (_req, res) => {
  try {
    const challenges = await getAllChallenges();
    res.json({ ok: true, challenges });
  } catch (err) {
    console.error("[Challenge] Erreur GET /api/challenges:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

// Liste les defis actifs uniquement (pour l'overlay)
app.get("/api/challenges/active", async (_req, res) => {
  try {
    const challenges = await getActiveChallenges();
    res.json({ ok: true, challenges });
  } catch (err) {
    console.error("[Challenge] Erreur GET /api/challenges/active:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

// Creer / ajouter a un defi
app.post("/api/challenges", async (req, res) => {
  try {
    const { name, label, type, amount, icon } = req.body;
    if (!name || !label || !type || !amount) {
      res.status(400).json({ ok: false, error: "name, label, type et amount requis" });
      return;
    }
    const challenge = await addChallenge({
      name,
      label,
      type: type as ChallengeType,
      amount: Number(amount),
      icon,
    });
    if (!challenge) {
      res.status(400).json({ ok: false, error: "Pas de stream en cours" });
      return;
    }
    res.json({ ok: true, challenge });
  } catch (err) {
    console.error("[Challenge] Erreur POST /api/challenges:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

// Incrementer un counter (+1, +5, +10, etc.)
app.post("/api/challenges/:id/increment", async (req, res) => {
  try {
    const { amount } = req.body;
    const challenge = await incrementChallenge(req.params.id, Number(amount) || 1);
    if (!challenge) {
      res.status(404).json({ ok: false, error: "Defi non trouve ou inactif" });
      return;
    }
    res.json({ ok: true, challenge });
  } catch (err) {
    console.error("[Challenge] Erreur increment:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

// Demarrer un timer
app.post("/api/challenges/:id/start", async (req, res) => {
  try {
    const challenge = await startTimer(req.params.id);
    if (!challenge) {
      res.status(404).json({ ok: false, error: "Timer non trouve ou pas un timer" });
      return;
    }
    res.json({ ok: true, challenge });
  } catch (err) {
    console.error("[Challenge] Erreur start timer:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

// Arreter un timer (pause)
app.post("/api/challenges/:id/stop", async (req, res) => {
  try {
    const challenge = await stopTimer(req.params.id);
    if (!challenge) {
      res.status(404).json({ ok: false, error: "Timer non trouve ou pas en cours" });
      return;
    }
    res.json({ ok: true, challenge });
  } catch (err) {
    console.error("[Challenge] Erreur stop timer:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

// Completer un defi manuellement
app.post("/api/challenges/:id/complete", async (req, res) => {
  try {
    await completeTimer(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("[Challenge] Erreur complete:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

// Supprimer un defi
app.delete("/api/challenges/:id", async (req, res) => {
  try {
    const ok = await removeChallenge(req.params.id);
    if (!ok) {
      res.status(404).json({ ok: false, error: "Defi non trouve" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[Challenge] Erreur delete:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

// Stats des defis pour les credits
app.get("/api/challenges/credits", async (_req, res) => {
  try {
    const streamId = getCurrentStreamId();
    if (!streamId) {
      res.status(400).json({ ok: false, error: "Pas de stream en cours" });
      return;
    }
    const credits = await getChallengeCredits(streamId);
    res.json({ ok: true, credits });
  } catch (err) {
    console.error("[Challenge] Erreur credits:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

// ===========================
// DICE SETTINGS (admin configurable)
// ===========================

app.get("/api/settings/dice", (_req, res) => {
  res.json({ ok: true, settings: getDiceSettings() });
});

app.put("/api/settings/dice", (req, res) => {
  const { revealDelay, displayDuration, exitDuration } = req.body;
  const updated = saveDiceSettings({
    ...(revealDelay != null ? { revealDelay: Number(revealDelay) } : {}),
    ...(displayDuration != null ? { displayDuration: Number(displayDuration) } : {}),
    ...(exitDuration != null ? { exitDuration: Number(exitDuration) } : {}),
  });
  // Notifier les overlays du changement de settings
  broadcast({ type: "settings:dice", payload: updated } as any);
  res.json({ ok: true, settings: updated });
});

// ===========================
// DICE TEST ROLL (admin simulation via queue)
// ===========================

interface TestRollBody {
  challengeName: string;
  challengeLabel: string;
  challengeType: string;
  faces: number;
  tier?: string;
  icon?: string;
  challengeTitle?: string;
}

/** Génère un titre contextuel pour l'overlay de dé */
function getDiceChallengeTitle(name: string, type: string, label: string): string {
  const TITLES: Record<string, string> = {
    "squatts": "Combien de squatts ?",
    "voix-stitch": "Voix de Stitch pendant combien de temps ?",
    "clavier-inverse": "Clavier à l'envers pendant combien de temps ?",
    "glacons": "Combien de glaçons ?",
  };
  if (TITLES[name]) return TITLES[name];
  // Fallback générique selon le type
  return type === "timer"
    ? `${label} pendant combien de temps ?`
    : `Combien de ${label.toLowerCase()} ?`;
}

app.post("/api/challenges/test-roll", (req, res) => {
  try {
    const { challengeName, challengeLabel, challengeType, faces, tier, icon } = req.body as TestRollBody;

    if (!challengeName || !challengeLabel || !challengeType || !faces) {
      res.status(400).json({ ok: false, error: "challengeName, challengeLabel, challengeType et faces requis" });
      return;
    }

    const result = Math.floor(Math.random() * faces) + 1;
    const amount = challengeType === "timer" ? result * 60 : result;

    // Générer le titre contextuel pour l'overlay
    const title = getDiceChallengeTitle(challengeName, challengeType, challengeLabel);

    // Utiliser la queue : broadcast + addChallenge au bon timing
    enqueueDiceRoll({
      broadcastPayload: {
        viewer: { displayName: "TestViewer" },
        tier: tier ?? "follow",
        dieType: "squatt",
        faces,
        result,
        isNat20: false,
        challengeTitle: title,
        challengeType: challengeType as "counter" | "timer",
        challengeLabel,
      },
      challenge: {
        name: challengeName,
        label: challengeLabel,
        type: challengeType as ChallengeType,
        amount,
        icon,
      },
    });

    res.json({ ok: true, roll: result, faces });
  } catch (err) {
    console.error("[Challenge] Erreur test-roll:", err);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

// ===========================
// DÉMARRAGE
// ===========================
async function start() {
  loadDiceSettings();
  initGoals();
  initAlerts();
  initStreamState();
  initWebSocket(3002);
  startTimerTick();

  // Charger le User Access Token Twitch persiste (si deja autorise)
  if (isTwitchConfigured()) {
    const loaded = await loadPersistedToken();
    if (loaded) {
      console.log("[Twitch] User token charge — enrichissement follower actif");
    } else {
      console.log("[Twitch] Pas de user token — autoriser via http://localhost:3001/api/twitch/auth");
    }
  }

  // Synchroniser le broadcaster ID entre StreamerBot et le service Twitch
  onBroadcasterIdChange((id) => setTwitchBroadcasterId(id));

  app.listen(3001, () => {
    console.log("[Server] 🏰 Castellan démarré !");
    console.log("[Server] 📡 HTTP: http://localhost:3001");
    console.log("[Server] 🔌 WS overlays: ws://localhost:3002");

    // Enrichissement batch au demarrage (fire-and-forget, non bloquant)
    if (isTwitchConfigured()) {
      console.log("[Twitch] Credentials detectees, lancement enrichissement batch...");
      enrichStaleViewers()
        .then((r) => console.log(`[Twitch] Batch startup: ${r.enriched} enrichis, ${r.failed} echecs`))
        .catch((err) => console.error("[Twitch] Batch startup echoue:", err));
    } else {
      console.log("[Twitch] Pas de credentials configurees, enrichissement desactive");
    }
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