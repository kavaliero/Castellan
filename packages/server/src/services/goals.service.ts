import { readFileSync, writeFileSync, existsSync } from "fs";
import { broadcast } from "../ws/broadcaster";
import type { GoalPayload } from "@castellan/shared";

/**
 * Service Goals — gere la configuration et l'etat des objectifs.
 *
 * Architecture :
 * - Les targets (objectifs) sont configurables via HTTP API
 * - Les valeurs current sont mises a jour automatiquement (follow/sub events)
 * - L'etat complet est persiste dans un fichier JSON (survit aux restarts)
 * - On envoie l'etat initial aux overlays quand ils se connectent
 *
 * StreamerBot peut appeler :
 *   POST /api/goals/config  { followers: { target: 1000 }, subscribers: { target: 50 } }
 *   GET  /api/goals         → retourne l'etat complet
 *
 * Ou on peut editer directement goals-config.json
 */

const CONFIG_FILE = "./goals-config.json";

interface GoalState {
  current: number;
  target: number;
}

interface GoalsConfig {
  followers: GoalState;
  subscribers: GoalState;
  lastFollow: string | null;
  lastSub: string | null;
}

// ─── State en memoire ─────────────────────────────────────────

let state: GoalsConfig = {
  followers: { current: 0, target: 1000 },
  subscribers: { current: 0, target: 50 },
  lastFollow: null,
  lastSub: null,
};

// ─── Persistence JSON ──────────────────────────────────────────

function loadConfig(): void {
  try {
    if (existsSync(CONFIG_FILE)) {
      const raw = readFileSync(CONFIG_FILE, "utf-8");
      const saved = JSON.parse(raw) as Partial<GoalsConfig>;
      state = {
        followers: {
          current: saved.followers?.current ?? state.followers.current,
          target: saved.followers?.target ?? state.followers.target,
        },
        subscribers: {
          current: saved.subscribers?.current ?? state.subscribers.current,
          target: saved.subscribers?.target ?? state.subscribers.target,
        },
        lastFollow: saved.lastFollow ?? state.lastFollow,
        lastSub: saved.lastSub ?? state.lastSub,
      };
      console.log(`[Goals] 📂 Config chargée: followers ${state.followers.current}/${state.followers.target}, subs ${state.subscribers.current}/${state.subscribers.target}`);
    } else {
      console.log("[Goals] 📝 Pas de config existante, utilisation des défauts");
      saveConfig();
    }
  } catch (err) {
    console.error("[Goals] Erreur lecture config:", err);
  }
}

function saveConfig(): void {
  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error("[Goals] Erreur sauvegarde config:", err);
  }
}

// ─── Public API ────────────────────────────────────────────────

/** Initialise le service (appeler au démarrage du server) */
export function initGoals(): void {
  loadConfig();
}

/** Retourne l'état complet des goals */
export function getGoalsState(): GoalsConfig {
  return { ...state };
}

/** Met à jour les targets (depuis HTTP API ou StreamerBot) */
export function updateGoalsConfig(config: {
  followers?: { target?: number; current?: number };
  subscribers?: { target?: number; current?: number };
}): void {
  if (config.followers) {
    if (config.followers.target !== undefined) state.followers.target = config.followers.target;
    if (config.followers.current !== undefined) state.followers.current = config.followers.current;
  }
  if (config.subscribers) {
    if (config.subscribers.target !== undefined) state.subscribers.target = config.subscribers.target;
    if (config.subscribers.current !== undefined) state.subscribers.current = config.subscribers.current;
  }

  saveConfig();
  broadcastAllGoals();
}

/** Incrémente le compteur followers de +1 (appelé par handleFollow) */
export function incrementFollowerCount(): number {
  state.followers.current += 1;
  saveConfig();
  return state.followers.current;
}

/** Incrémente le compteur subscribers de +1 (appelé par handleSub) */
export function incrementSubscriberCount(): number {
  state.subscribers.current += 1;
  saveConfig();
  return state.subscribers.current;
}

/** Met à jour le dernier follower */
export function setLastFollow(name: string): void {
  state.lastFollow = name;
  saveConfig();
}

/** Met à jour le dernier subscriber */
export function setLastSub(name: string): void {
  state.lastSub = name;
  saveConfig();
}

/** Retourne le target followers (pour le broadcast dans handleFollow) */
export function getFollowersTarget(): number {
  return state.followers.target;
}

/** Retourne le target subscribers (pour le broadcast dans handleSub) */
export function getSubscribersTarget(): number {
  return state.subscribers.target;
}

/** Broadcast tous les goals + last follow/sub aux overlays */
export function broadcastAllGoals(): void {
  broadcast({
    type: "goal:update",
    payload: {
      type: "followers",
      current: state.followers.current,
      target: state.followers.target,
    },
  });
  broadcast({
    type: "goal:update",
    payload: {
      type: "subscribers",
      current: state.subscribers.current,
      target: state.subscribers.target,
    },
  });

  // Broadcast last follow/sub comme des alertes pour que l'overlay capte les noms
  if (state.lastFollow) {
    broadcast({
      type: "alert:follow",
      payload: {
        viewer: {
          twitchId: "",
          username: state.lastFollow.toLowerCase(),
          displayName: state.lastFollow,
        },
      },
    });
  }
  if (state.lastSub) {
    broadcast({
      type: "alert:sub",
      payload: {
        viewer: {
          twitchId: "",
          username: state.lastSub.toLowerCase(),
          displayName: state.lastSub,
        },
        tier: 1,
        months: 0,
      },
    });
  }
}

/** Envoie l'état initial à UN client spécifique (utilisé à la connexion WS) */
export function getGoalsInitPayload(): GoalPayload[] {
  return [
    {
      type: "followers",
      current: state.followers.current,
      target: state.followers.target,
    },
    {
      type: "subscribers",
      current: state.subscribers.current,
      target: state.subscribers.target,
    },
  ];
}
