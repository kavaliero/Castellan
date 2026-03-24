/**
 * Service Challenge Animation Settings
 *
 * Gere les timings de l'animation de defi (channel points).
 * Pattern identique a dice-queue.service pour les settings.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface ChallengeAnimationSettings {
  /** Delai avant que la banniere commence a descendre (ms) */
  bannerDelay: number;
  /** Duree de l'animation de descente de la banniere (ms) */
  bannerDuration: number;
  /** Delai avant l'apparition du viewer (photo + nom) (ms) */
  viewerAppearDelay: number;
  /** Duree de l'animation d'apparition du viewer (ms) */
  viewerAppearDuration: number;
  /** Delai avant l'apparition du de (ms) */
  diceAppearDelay: number;
  /** Delai avant le lancement du tumble du de (ms) */
  diceRollDelay: number;
  /** Duree d'affichage du resultat apres le reveal (ms) */
  displayDuration: number;
  /** Duree de l'animation de sortie (ms) */
  exitDuration: number;
}

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════

const SETTINGS_FILE = resolve(__dirname, "../../config/challenge-animation-settings.json");

const DEFAULT_SETTINGS: ChallengeAnimationSettings = {
  bannerDelay: 100,
  bannerDuration: 600,
  viewerAppearDelay: 600,
  viewerAppearDuration: 400,
  diceAppearDelay: 1800,
  diceRollDelay: 2000,
  displayDuration: 4000,
  exitDuration: 500,
};

let settings: ChallengeAnimationSettings = { ...DEFAULT_SETTINGS };

// ═══════════════════════════════════════════════════════════════
// LOAD / SAVE / GET
// ═══════════════════════════════════════════════════════════════

/** Charge les settings depuis le fichier JSON (ou cree les defaults) */
export function loadChallengeAnimationSettings(): ChallengeAnimationSettings {
  try {
    if (existsSync(SETTINGS_FILE)) {
      const raw = readFileSync(SETTINGS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      settings = { ...DEFAULT_SETTINGS, ...parsed };
      console.log("[ChallengeAnimation] Settings charges:", settings);
    } else {
      settings = { ...DEFAULT_SETTINGS };
      saveChallengeAnimationSettings(settings);
      console.log("[ChallengeAnimation] Settings par defaut crees");
    }
  } catch (err) {
    console.error("[ChallengeAnimation] Erreur chargement settings, utilisation des defaults:", err);
    settings = { ...DEFAULT_SETTINGS };
  }
  return settings;
}

/** Sauvegarde les settings dans le fichier JSON */
export function saveChallengeAnimationSettings(
  newSettings: Partial<ChallengeAnimationSettings>,
): ChallengeAnimationSettings {
  settings = { ...settings, ...newSettings };
  try {
    writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
    console.log("[ChallengeAnimation] Settings sauvegardes:", settings);
  } catch (err) {
    console.error("[ChallengeAnimation] Erreur sauvegarde settings:", err);
  }
  return settings;
}

/** Retourne les settings actuels */
export function getChallengeAnimationSettings(): ChallengeAnimationSettings {
  return { ...settings };
}
