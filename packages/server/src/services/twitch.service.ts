/**
 * Service Twitch API — enrichissement des viewers via l'API Helix.
 *
 * Utilise le flow Client Credentials (App Access Token) :
 * - Pas besoin d'OAuth user, juste CLIENT_ID + CLIENT_SECRET
 * - Le token est cache en memoire et renouvele automatiquement
 *
 * Endpoints Helix utilises :
 * - GET /users         → broadcasterType, profileImageUrl, createdAt
 * - GET /channels/followers → followerCount (pour les streamers)
 *
 * Strategie d'enrichissement :
 * - Lazy : a la premiere rencontre d'un viewer (ou si enrichedAt > 24h)
 * - Manuel : via GET /api/viewers/:id/enrich depuis le dashboard
 * - Batch : via enrichAllStale() pour rattraper les viewers non enrichis
 */

import { prisma } from "../db/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || "";
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || "";
const HELIX_BASE = "https://api.twitch.tv/helix";

/** Duree de validite du cache d'enrichissement (24h) */
const ENRICHMENT_TTL_MS = 24 * 60 * 60 * 1000;

/** Max viewers a enrichir en batch (pour ne pas spam l'API) */
const BATCH_SIZE = 100;

/** Broadcaster ID de la chaine — injecte depuis index.ts via setTwitchBroadcasterId() */
let _broadcasterId: string | null = null;

export function setTwitchBroadcasterId(id: string | null) {
  _broadcasterId = id;
}

export function getTwitchBroadcasterId(): string | null {
  return _broadcasterId;
}

// ═══════════════════════════════════════════════════════════════
// USER ACCESS TOKEN (OAuth Authorization Code)
// Necessaire pour /channels/followers et autres endpoints restreints.
// Persiste dans un fichier JSON local pour survivre aux redemarrages.
// ═══════════════════════════════════════════════════════════════

const TOKEN_FILE = path.resolve(__dirname, "../../.twitch-token.json");

/** Scopes necessaires pour l'enrichissement complet */
const OAUTH_SCOPES = [
  "moderator:read:followers",  // Lire les followers de la chaine
].join(" ");

const OAUTH_REDIRECT_URI = "http://localhost:3001/api/twitch/callback";

interface StoredToken {
  access_token: string;
  refresh_token: string;
  expires_at: number; // timestamp ms
  scope: string[];
  broadcaster_id?: string; // ID Twitch du proprietaire du token
}

let _userAccessToken: string | null = null;
let _refreshToken: string | null = null;
let _userTokenExpiresAt = 0;

/**
 * Charge le token persiste depuis le fichier JSON (au demarrage).
 */
export async function loadPersistedToken(): Promise<boolean> {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const raw = fs.readFileSync(TOKEN_FILE, "utf-8");
      const stored: StoredToken = JSON.parse(raw);
      _userAccessToken = stored.access_token;
      _refreshToken = stored.refresh_token;
      _userTokenExpiresAt = stored.expires_at;

      // Restaurer le broadcaster ID depuis le fichier token
      if (stored.broadcaster_id) {
        _broadcasterId = stored.broadcaster_id;
        console.log(`[Twitch] Broadcaster ID restaure: ${_broadcasterId}`);
      } else {
        // Pas de broadcaster ID persiste — on le detecte via GET /users
        try {
          const userRes = await fetch(`${HELIX_BASE}/users`, {
            headers: {
              Authorization: `Bearer ${_userAccessToken}`,
              "Client-Id": TWITCH_CLIENT_ID,
            },
          });
          if (userRes.ok) {
            const userData = (await userRes.json()) as { data: Array<{ id: string; login: string }> };
            if (userData.data?.[0]) {
              _broadcasterId = userData.data[0].id;
              console.log(`[Twitch] Broadcaster detecte: ${userData.data[0].login} (${_broadcasterId})`);
              // Re-persister avec le broadcaster ID
              persistToken(_userAccessToken!, _refreshToken!, Math.round((_userTokenExpiresAt - Date.now()) / 1000), stored.scope, _broadcasterId);
            }
          }
        } catch (err) {
          console.warn("[Twitch] Impossible de detecter le broadcaster ID au chargement:", err);
        }
      }

      console.log("[Twitch] User token charge depuis le fichier");
      return true;
    }
  } catch (err) {
    console.warn("[Twitch] Impossible de charger le token persiste:", err);
  }
  return false;
}

/**
 * Persiste le token dans un fichier JSON local.
 */
function persistToken(accessToken: string, refreshToken: string, expiresIn: number, scope: string[], broadcasterId?: string) {
  _userAccessToken = accessToken;
  _refreshToken = refreshToken;
  _userTokenExpiresAt = Date.now() + expiresIn * 1000;

  const stored: StoredToken = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: _userTokenExpiresAt,
    scope,
    broadcaster_id: broadcasterId ?? _broadcasterId ?? undefined,
  };

  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(stored, null, 2));
    console.log("[Twitch] User token persiste dans", TOKEN_FILE);
  } catch (err) {
    console.error("[Twitch] Impossible de persister le token:", err);
  }
}

/**
 * Genere l'URL d'autorisation OAuth Twitch.
 * L'utilisateur doit ouvrir cette URL dans son navigateur.
 */
export function getOAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    redirect_uri: OAUTH_REDIRECT_URI,
    response_type: "code",
    scope: OAUTH_SCOPES,
    force_verify: "true",
  });
  return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
}

/**
 * Echange le code d'autorisation contre un access + refresh token.
 * Appele depuis la route callback.
 */
export async function exchangeOAuthCode(code: string): Promise<boolean> {
  try {
    const res = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: OAUTH_REDIRECT_URI,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Twitch] OAuth token exchange failed (${res.status}): ${text}`);
      return false;
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope: string[];
      token_type: string;
    };

    // Detecter le broadcaster ID via GET /users avec le nouveau token
    let detectedBroadcasterId: string | undefined;
    try {
      const userRes = await fetch(`${HELIX_BASE}/users`, {
        headers: {
          Authorization: `Bearer ${data.access_token}`,
          "Client-Id": TWITCH_CLIENT_ID,
        },
      });
      if (userRes.ok) {
        const userData = (await userRes.json()) as { data: Array<{ id: string; login: string }> };
        if (userData.data?.[0]) {
          detectedBroadcasterId = userData.data[0].id;
          _broadcasterId = detectedBroadcasterId;
          console.log(`[Twitch] Broadcaster detecte: ${userData.data[0].login} (${detectedBroadcasterId})`);
        }
      }
    } catch (err) {
      console.warn("[Twitch] Impossible de detecter le broadcaster ID:", err);
    }

    persistToken(data.access_token, data.refresh_token, data.expires_in, data.scope, detectedBroadcasterId);
    console.log(`[Twitch] OAuth reussi ! Scopes: ${data.scope.join(", ")}`);
    return true;
  } catch (err) {
    console.error("[Twitch] Erreur OAuth exchange:", err);
    return false;
  }
}

/**
 * Rafraichit le User Access Token via le refresh token.
 */
async function refreshUserToken(): Promise<boolean> {
  if (!_refreshToken) return false;

  try {
    const res = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        refresh_token: _refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Twitch] Token refresh failed (${res.status}): ${text}`);
      _userAccessToken = null;
      _refreshToken = null;
      return false;
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope: string[];
    };

    persistToken(data.access_token, data.refresh_token, data.expires_in, data.scope);
    console.log("[Twitch] User token rafraichi avec succes");
    return true;
  } catch (err) {
    console.error("[Twitch] Erreur refresh token:", err);
    return false;
  }
}

/**
 * Obtient un User Access Token valide (avec refresh auto si expire).
 */
async function getValidUserToken(): Promise<string | null> {
  if (!_userAccessToken) return null;

  // Refresh 5 min avant expiration
  if (Date.now() > _userTokenExpiresAt - 5 * 60 * 1000) {
    console.log("[Twitch] User token expire ou bientot expire, refresh...");
    const ok = await refreshUserToken();
    if (!ok) return null;
  }

  return _userAccessToken;
}

/**
 * Retourne true si un User Access Token est disponible.
 */
export function hasUserToken(): boolean {
  return Boolean(_userAccessToken);
}

export function setTwitchUserToken(token: string | null) {
  _userAccessToken = token;
  if (token) {
    console.log("[Twitch] User Access Token configure (manual)");
  }
}

// ═══════════════════════════════════════════════════════════════
// APP ACCESS TOKEN (Client Credentials)
// ═══════════════════════════════════════════════════════════════

let appAccessToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Obtient un App Access Token via Client Credentials.
 * Le token est cache en memoire et renouvele 5 min avant expiration.
 */
async function getAppToken(): Promise<string> {
  if (appAccessToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return appAccessToken;
  }

  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    throw new Error(
      "[Twitch] TWITCH_CLIENT_ID et TWITCH_CLIENT_SECRET requis dans .env"
    );
  }

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[Twitch] Token request failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  appAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;

  console.log(
    `[Twitch] App Access Token obtenu, expire dans ${Math.round(data.expires_in / 60)} min`
  );

  return appAccessToken;
}

/**
 * Helper pour les appels Helix avec gestion auto du token.
 */
async function helixGet<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const token = await getAppToken();
  const url = new URL(`${HELIX_BASE}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": TWITCH_CLIENT_ID,
    },
  });

  if (res.status === 401) {
    // Token expire, on le reset et on retry une fois
    appAccessToken = null;
    const newToken = await getAppToken();
    const retry = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${newToken}`,
        "Client-Id": TWITCH_CLIENT_ID,
      },
    });
    if (!retry.ok) {
      throw new Error(`[Twitch] Helix ${endpoint} failed: ${retry.status}`);
    }
    return (await retry.json()) as T;
  }

  if (!res.ok) {
    throw new Error(`[Twitch] Helix ${endpoint} failed: ${res.status}`);
  }

  return (await res.json()) as T;
}

/**
 * Helper pour les appels Helix avec un User Access Token.
 * Necessaire pour les endpoints restreints (ex: /channels/followers).
 * Gere le refresh automatique du token si expire.
 */
async function helixGetWithUserToken<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const token = await getValidUserToken();
  if (!token) {
    throw new Error("[Twitch] User Access Token non disponible");
  }

  const url = new URL(`${HELIX_BASE}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": TWITCH_CLIENT_ID,
    },
  });

  // Si 401, tenter un refresh et retry
  if (res.status === 401) {
    const refreshed = await refreshUserToken();
    if (refreshed && _userAccessToken) {
      const retry = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${_userAccessToken}`,
          "Client-Id": TWITCH_CLIENT_ID,
        },
      });
      if (!retry.ok) {
        throw new Error(`[Twitch] Helix (user) ${endpoint} failed after refresh: ${retry.status}`);
      }
      return (await retry.json()) as T;
    }
    throw new Error(`[Twitch] Helix (user) ${endpoint} failed: 401 (refresh echoue)`);
  }

  if (!res.ok) {
    throw new Error(`[Twitch] Helix (user) ${endpoint} failed: ${res.status}`);
  }

  return (await res.json()) as T;
}

// ═══════════════════════════════════════════════════════════════
// TYPES HELIX
// ═══════════════════════════════════════════════════════════════

interface HelixUser {
  id: string;
  login: string;
  display_name: string;
  type: string; // "" | "admin" | "global_mod" | "staff"
  broadcaster_type: string; // "" | "affiliate" | "partner"
  description: string;
  profile_image_url: string;
  offline_image_url: string;
  created_at: string;
}

interface HelixFollowersResponse {
  total: number;
  data: Array<{
    user_id: string;
    user_login: string;
    user_name: string;
    followed_at: string;
  }>;
  pagination: { cursor?: string };
}

// ═══════════════════════════════════════════════════════════════
// ENRICHISSEMENT
// ═══════════════════════════════════════════════════════════════

/**
 * Enrichit un viewer avec les donnees Twitch API.
 * Remplit : isStreamer, broadcasterType, twitchFollowerCount, twitchProfileImageUrl,
 * isFollower (verifie si le viewer suit la chaine du broadcaster).
 *
 * @param viewerDbId - L'ID interne Castellan (pas le twitchId)
 * @param force - Si true, ignore le TTL et force le refresh
 * @returns Le viewer mis a jour, ou null si echec
 */
export async function enrichViewer(
  viewerDbId: string,
  force = false
): Promise<boolean> {
  try {
    const viewer = await prisma.viewer.findUnique({
      where: { id: viewerDbId },
    });

    if (!viewer) {
      console.warn(`[Twitch] Viewer ${viewerDbId} introuvable en BDD`);
      return false;
    }

    // Check TTL (sauf si force)
    if (
      !force &&
      (viewer as any).twitchEnrichedAt &&
      Date.now() - new Date((viewer as any).twitchEnrichedAt).getTime() < ENRICHMENT_TTL_MS
    ) {
      return true; // Deja enrichi et recent
    }

    // 1. Get User info
    const usersRes = await helixGet<{ data: HelixUser[] }>("/users", {
      id: viewer.twitchId,
    });

    if (!usersRes.data || usersRes.data.length === 0) {
      console.warn(
        `[Twitch] Viewer ${viewer.username} (${viewer.twitchId}) introuvable sur Twitch — marquage supprime`
      );
      // Marquer comme supprime sur Twitch
      await prisma.viewer.update({
        where: { id: viewerDbId },
        data: {
          twitchDeletedAt: (viewer as any).twitchDeletedAt ?? new Date(),
          twitchEnrichedAt: new Date(),
        },
      });
      return false;
    }

    const twitchUser = usersRes.data[0];
    const isStreamer =
      twitchUser.broadcaster_type === "partner" ||
      twitchUser.broadcaster_type === "affiliate";

    // 1b. Sync pseudo si changement
    const newUsername = twitchUser.login?.toLowerCase();
    const newDisplayName = twitchUser.display_name;
    if (newUsername && newUsername !== viewer.username) {
      console.log(
        `[Twitch] Changement de pseudo detecte: ${viewer.username} → ${newUsername}`
      );
    }

    // 2. Get follower count (seulement si c'est un streamer/affiliate/partner)
    // NOTE: /channels/followers requiert un User Access Token — on skip si pas dispo
    let followerCount: number | null = (viewer as any).twitchFollowerCount ?? null;
    if (isStreamer && _userAccessToken) {
      try {
        const followersRes = await helixGetWithUserToken<HelixFollowersResponse>(
          "/channels/followers",
          {
            broadcaster_id: twitchUser.id,
            first: "1",
          }
        );
        followerCount = followersRes.total;
      } catch (err) {
        console.warn(
          `[Twitch] Impossible de recuperer les followers de ${viewer.username}:`,
          err
        );
      }
    }

    // 3. Verifier si le viewer suit la chaine du broadcaster
    // NOTE: /channels/followers requiert un User Access Token (scope moderator:read:followers)
    // Avec un simple App Token (Client Credentials), on obtient un 401.
    // Le statut follower est donc mis a jour uniquement via :
    // - Les events StreamerBot en live (follow event)
    // - Le endpoint POST /api/twitch/sync-followers (sync manuelle via User Token)
    // On garde la valeur existante en BDD.
    let isFollower = viewer.isFollower;
    const myBroadcasterId = _broadcasterId;
    if (_userAccessToken && myBroadcasterId && viewer.twitchId !== myBroadcasterId) {
      try {
        const followerCheck = await helixGetWithUserToken<HelixFollowersResponse>(
          "/channels/followers",
          {
            broadcaster_id: myBroadcasterId,
            user_id: viewer.twitchId,
            first: "1",
          }
        );
        isFollower = followerCheck.data.length > 0;
      } catch (err) {
        // Pas grave — on garde la valeur actuelle
        console.warn(
          `[Twitch] Impossible de verifier le follow de ${viewer.username}:`,
          err
        );
      }
    }

    // 4. Update en BDD (sync pseudo + enrichissement + reset flag suppression)
    await prisma.viewer.update({
      where: { id: viewerDbId },
      data: {
        ...(newUsername ? { username: newUsername } : {}),
        ...(newDisplayName ? { displayName: newDisplayName } : {}),
        isFollower,
        isStreamer,
        broadcasterType: twitchUser.broadcaster_type || null,
        twitchFollowerCount: followerCount,
        twitchProfileImageUrl: twitchUser.profile_image_url || null,
        twitchEnrichedAt: new Date(),
        twitchDeletedAt: null, // Le compte existe, reset le flag
      },
    });

    const nameChanged = newUsername && newUsername !== viewer.username;
    console.log(
      `[Twitch] Viewer enrichi: ${nameChanged ? viewer.username + " → " : ""}${newUsername ?? viewer.username} | follower=${isFollower} | streamer=${isStreamer} | followers=${followerCount ?? "N/A"}`
    );
    return true;
  } catch (err) {
    console.error(`[Twitch] Erreur enrichissement viewer ${viewerDbId}:`, err);
    return false;
  }
}

/**
 * Enrichit un viewer par son twitchId (plus pratique depuis les events).
 */
export async function enrichViewerByTwitchId(
  twitchId: string,
  force = false
): Promise<boolean> {
  const viewer = await prisma.viewer.findUnique({
    where: { twitchId },
  });
  if (!viewer) return false;
  return enrichViewer(viewer.id, force);
}

/**
 * Enrichit en batch tous les viewers jamais enrichis ou avec un enrichissement expire.
 * Appele au demarrage du server ou periodiquement.
 * Respecte le rate limit Twitch (800 req/min pour App tokens).
 */
export async function enrichStaleViewers(forceAll = false): Promise<{
  enriched: number;
  failed: number;
  skipped: number;
}> {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    console.warn(
      "[Twitch] Pas de credentials configurees, enrichissement batch ignore"
    );
    return { enriched: 0, failed: 0, skipped: 0 };
  }

  const staleDate = new Date(Date.now() - ENRICHMENT_TTL_MS);

  // forceAll: tous les viewers (sans limite) | sinon: jamais enrichis ou expires (limite BATCH_SIZE)
  const viewers = await prisma.viewer.findMany({
    where: forceAll
      ? { twitchDeletedAt: null } // Skip les deja marques supprimes
      : {
          OR: [
            { twitchEnrichedAt: null },
            { twitchEnrichedAt: { lt: staleDate } },
          ],
        },
    select: { id: true, username: true, twitchId: true },
    ...(forceAll ? {} : { take: BATCH_SIZE }),
    orderBy: { updatedAt: "desc" }, // Les plus actifs d'abord
  });

  if (viewers.length === 0) {
    return { enriched: 0, failed: 0, skipped: 0 };
  }

  console.log(
    `[Twitch] Enrichissement batch de ${viewers.length} viewers...`
  );

  let enriched = 0;
  let failed = 0;

  let skippedCount = 0;

  // Traitement sequentiel pour respecter le rate limit
  for (const v of viewers) {
    // Ignorer les viewers avec des faux twitchIds (donnees de test)
    const numId = parseInt(v.twitchId, 10);
    if (!isNaN(numId) && numId < 100) {
      skippedCount++;
      continue;
    }

    try {
      const ok = await enrichViewer(v.id, true);
      if (ok) enriched++;
      else failed++;
    } catch {
      failed++;
    }
    // Petit delai entre chaque appel (75ms = ~13 req/s, bien sous la limite)
    await new Promise((r) => setTimeout(r, 75));
  }

  console.log(
    `[Twitch] Batch termine: ${enriched} enrichis, ${failed} echecs, ${skippedCount} ignores (test data)`
  );

  return {
    enriched,
    failed,
    skipped: skippedCount,
  };
}

/**
 * Verifie si les credentials Twitch sont configurees.
 */
export function isTwitchConfigured(): boolean {
  return Boolean(TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET);
}

/**
 * Retourne les stats d'enrichissement (pour le dashboard).
 */
export async function getEnrichmentStats() {
  const [total, enriched, stale] = await Promise.all([
    prisma.viewer.count(),
    prisma.viewer.count({ where: { twitchEnrichedAt: { not: null } } }),
    prisma.viewer.count({
      where: {
        OR: [
          { twitchEnrichedAt: null },
          { twitchEnrichedAt: { lt: new Date(Date.now() - ENRICHMENT_TTL_MS) } },
        ],
      },
    }),
  ]);

  return {
    configured: isTwitchConfigured(),
    total,
    enriched,
    stale,
    pending: total - enriched,
  };
}
