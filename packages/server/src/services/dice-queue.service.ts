/**
 * Service Dice Queue — Queue les animations de des et les mises a jour de defis.
 *
 * Probleme : quand 2 rolls arrivent vite (ex: D6 puis D12), l'overlay les queue
 * et les joue en sequence. Mais le serveur doit aussi espacer les addChallenge
 * pour que le defi apparaisse APRES le reveal de chaque de, pas avant.
 *
 * Solution : on track le timestamp du prochain "slot" libre. Chaque roll reserve
 * un slot de duree totalAnimationDuration. Le addChallenge est programme a
 * startTime + revealDelay pour chaque roll.
 *
 * Timings configurables et persistes dans un fichier JSON.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { broadcast } from "../ws/broadcaster";
import { addChallenge } from "./challenge.service";
import { sendChatMessage } from "./streamerbot.service";
import type { ChallengeType } from "@castellan/shared";

// ═══════════════════════════════════════════════════════════════
// SETTINGS — Timings configurables
// ═══════════════════════════════════════════════════════════════

export interface DiceTimingSettings {
  /** Delai avant que le resultat soit visible (tumble + bounce + reveal) en ms */
  revealDelay: number;
  /** Duree d'affichage du resultat (apres reveal, avant exit) en ms */
  displayDuration: number;
  /** Duree de l'animation de sortie en ms */
  exitDuration: number;
}

const SETTINGS_FILE = resolve(__dirname, "../../config/dice-settings.json");

const DEFAULT_SETTINGS: DiceTimingSettings = {
  revealDelay: 2500,
  displayDuration: 3000,
  exitDuration: 500,
};

let settings: DiceTimingSettings = { ...DEFAULT_SETTINGS };

/** Charge les settings depuis le fichier JSON (ou defaults) */
export function loadDiceSettings(): DiceTimingSettings {
  try {
    if (existsSync(SETTINGS_FILE)) {
      const raw = readFileSync(SETTINGS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      settings = { ...DEFAULT_SETTINGS, ...parsed };
      console.log("[DiceQueue] Settings charges:", settings);
    } else {
      settings = { ...DEFAULT_SETTINGS };
      saveDiceSettings(settings);
      console.log("[DiceQueue] Settings par defaut crees");
    }
  } catch (err) {
    console.error("[DiceQueue] Erreur chargement settings, utilisation des defaults:", err);
    settings = { ...DEFAULT_SETTINGS };
  }
  return settings;
}

/** Sauvegarde les settings dans le fichier JSON */
export function saveDiceSettings(newSettings: Partial<DiceTimingSettings>): DiceTimingSettings {
  settings = { ...settings, ...newSettings };
  try {
    writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
    console.log("[DiceQueue] Settings sauvegardes:", settings);
  } catch (err) {
    console.error("[DiceQueue] Erreur sauvegarde settings:", err);
  }
  return settings;
}

/** Retourne les settings actuels */
export function getDiceSettings(): DiceTimingSettings {
  return { ...settings };
}

/** Duree totale d'une animation de de */
function getTotalAnimationDuration(): number {
  return settings.revealDelay + settings.displayDuration + settings.exitDuration;
}

// ═══════════════════════════════════════════════════════════════
// QUEUE — File d'attente des rolls
// ═══════════════════════════════════════════════════════════════

interface QueuedDiceRoll {
  // Broadcast payload
  broadcastPayload: {
    viewer: { displayName: string };
    tier: string;
    dieType: string;
    faces: number;
    result: number;
    isNat20: boolean;
    challengeTitle?: string;
    challengeType?: "counter" | "timer";
    challengeLabel?: string;
  };
  // Challenge a creer/update apres le reveal (optionnel)
  challenge?: {
    name: string;
    label: string;
    type: ChallengeType;
    amount: number;
    icon?: string;
  };
  // Des restants apres ce roll (pour le message chat)
  remaining?: { d6: number; d12: number; d20: number };
  // Si true, ne PAS broadcast dice:rolled (l'animation est geree ailleurs, ex: ChallengeRollOverlay)
  skipDiceBroadcast?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// CHAT — Messages de L'Intendant pour les lancers de dés
// ═══════════════════════════════════════════════════════════════

/** Construit le suffixe "il te reste X dY" pour le message chat */
function buildRemainingText(
  faces: number,
  remaining?: { d6: number; d12: number; d20: number }
): string {
  if (!remaining) return "";

  // Pour un d6, indiquer les d6 restants
  if (faces === 6) {
    return remaining.d6 > 0
      ? ` | Il te reste ${remaining.d6} d6`
      : " | Plus de d6 !";
  }
  // Pour un d12, indiquer les d12 restants
  if (faces === 12) {
    return remaining.d12 > 0
      ? ` | Il te reste ${remaining.d12} d12`
      : " | Plus de d12 !";
  }
  // Pour un d20, indiquer le total restant (tous tiers confondus)
  if (faces === 20) {
    return remaining.d20 > 0
      ? ` | Il te reste ${remaining.d20} d20`
      : " | Plus de d20 !";
  }
  return "";
}

/** Construit le message chat pour un resultat de de */
function buildDiceRollChatMessage(
  bp: QueuedDiceRoll["broadcastPayload"],
  challenge?: QueuedDiceRoll["challenge"],
  remaining?: { d6: number; d12: number; d20: number }
): string | null {
  const viewer = bp.viewer.displayName;
  const suffix = buildRemainingText(bp.faces, remaining);

  // Nat 20 → roue de gains
  if (bp.isNat20) {
    return `🎰 ${viewer} a fait un 20 naturel ! ROUE DE GAINS !${suffix}`;
  }

  // De de roue sans nat 20
  if (bp.dieType === "wheel") {
    return `🎲 ${viewer} lance un d${bp.faces}... ${bp.result}. Pas de roue cette fois !${suffix}`;
  }

  // Défi timer (ex: voix de Stitch)
  if (challenge && bp.challengeType === "timer") {
    const label = bp.challengeLabel ?? "défi";
    return `🎲 ${viewer} lance un d${bp.faces}... ${bp.result} min de ${label} pour Kavaliero ! 💀${suffix}`;
  }

  // Défi counter (ex: squatts)
  if (challenge && bp.challengeType === "counter") {
    const label = bp.challengeLabel?.toLowerCase() ?? "défis";
    return `🎲 ${viewer} lance un d${bp.faces}... ${bp.result} ${label} pour Kavaliero ! 💪${suffix}`;
  }

  // Fallback générique
  return `🎲 ${viewer} lance un d${bp.faces}... ${bp.result} !${suffix}`;
}

/** Timestamp a partir duquel le prochain slot est libre */
let nextSlotTime = 0;

/**
 * Ajoute un lancer de dé à la queue.
 *
 * Architecture simplifiée :
 *   - Broadcast dice:rolled IMMÉDIATEMENT (le client gère sa propre queue d'animations)
 *   - addChallenge différé au moment du reveal (basé sur la position dans la queue)
 *
 * Le client reçoit tous les events instantanément et les joue en séquence.
 * Le serveur ne s'occupe QUE du timing des addChallenge pour que le défi
 * apparaisse après le reveal de chaque dé.
 */
export function enqueueDiceRoll(roll: QueuedDiceRoll): { roll: number; scheduledAt: number } {
  const now = Date.now();
  const startTime = Math.max(now, nextSlotTime);
  const totalDuration = getTotalAnimationDuration();
  const challengeDelay = (startTime - now) + settings.revealDelay;

  // Réserver le slot pour le prochain roll (utilisé pour le timing addChallenge)
  nextSlotTime = startTime + totalDuration;

  console.log(
    `[DiceQueue] Roll d${roll.broadcastPayload.faces} → ${roll.broadcastPayload.result} | ` +
    `broadcast immédiat, challenge dans ${challengeDelay}ms, ` +
    `prochain slot dans ${nextSlotTime - now}ms`
  );

  // Broadcast IMMÉDIAT — le client queue les animations lui-même
  // (sauf si skipDiceBroadcast, ex: challenge points qui ont leur propre animation)
  if (!roll.skipDiceBroadcast) {
    broadcast({ type: "dice:rolled", payload: roll.broadcastPayload } as any);
  }

  // Programmer le addChallenge + message chat au moment du reveal
  const { broadcastPayload: bp } = roll;
  setTimeout(async () => {
    // 1. Mettre à jour le défi si applicable
    if (roll.challenge) {
      try {
        await addChallenge(roll.challenge);
        console.log(
          `[DiceQueue] Challenge mis à jour après reveal: ${roll.challenge.label} +${roll.challenge.amount}`
        );
      } catch (err) {
        console.error("[DiceQueue] Erreur addChallenge après reveal:", err);
      }
    }

    // 2. L'Intendant annonce le résultat dans le chat
    try {
      const chatMsg = buildDiceRollChatMessage(bp, roll.challenge, roll.remaining);
      if (chatMsg) await sendChatMessage(chatMsg);
    } catch (err) {
      console.error("[DiceQueue] Erreur message chat:", err);
    }
  }, challengeDelay);

  return { roll: roll.broadcastPayload.result, scheduledAt: startTime };
}

/**
 * Reset la queue (utile si on veut forcer un nettoyage).
 */
export function resetDiceQueue(): void {
  nextSlotTime = 0;
  console.log("[DiceQueue] Queue reset");
}
