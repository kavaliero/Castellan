import type { TwitchClip } from "@castellan/shared";

/**
 * Service Clips — gère le cache des clips Twitch pour la scène pause.
 *
 * Architecture :
 * - StreamerBot télécharge les clips en local (public/clips/)
 * - Il POST la liste des métadonnées avec videoUrl pointant vers le fichier local
 * - Ce service stocke les clips en mémoire et les sert shufflés
 * - L'overlay /pause fetch GET /api/clips et joue les vidéos locales
 */

// ─── State en mémoire ─────────────────────────────────────────

let clips: TwitchClip[] = [];
let syncedAt: string | null = null;

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Fisher-Yates shuffle — mélange un tableau en place.
 * Utilisé pour randomiser l'ordre des clips à chaque requête.
 */
function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Synchronise les clips reçus de StreamerBot.
 * Remplace entièrement le cache (on ne fait pas de merge).
 * Les clips contiennent déjà un videoUrl pointant vers le fichier local.
 */
export function syncClips(newClips: TwitchClip[]): { count: number; syncedAt: string } {
  clips = newClips;
  syncedAt = new Date().toISOString();

  console.log(`[Clips] 🎬 ${clips.length} clips synchronisés`);

  return { count: clips.length, syncedAt };
}

/**
 * Retourne les clips en ordre aléatoire.
 * Chaque appel donne un ordre différent.
 */
export function getClips(options?: {
  limit?: number;
}): TwitchClip[] {
  const { limit } = options ?? {};

  let result = shuffle(clips);

  if (limit && limit > 0) {
    result = result.slice(0, limit);
  }

  return result;
}

/** Nombre de clips en cache */
export function getClipsCount(): number {
  return clips.length;
}

/** Date de dernière synchronisation */
export function getClipsSyncedAt(): string | null {
  return syncedAt;
}
