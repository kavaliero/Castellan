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
  broadcast({ type: "dice:rolled", payload: roll.broadcastPayload } as any);

  // Programmer le addChallenge au moment du reveal (basé sur la position dans la queue)
  if (roll.challenge) {
    const { challenge } = roll;
    setTimeout(async () => {
      try {
        await addChallenge(challenge);
        console.log(
          `[DiceQueue] Challenge mis à jour après reveal: ${challenge.label} +${challenge.amount}`
        );
      } catch (err) {
        console.error("[DiceQueue] Erreur addChallenge après reveal:", err);
      }
    }, challengeDelay);
  }

  return { roll: roll.broadcastPayload.result, scheduledAt: startTime };
}

/**
 * Reset la queue (utile si on veut forcer un nettoyage).
 */
export function resetDiceQueue(): void {
  nextSlotTime = 0;
  console.log("[DiceQueue] Queue reset");
}
