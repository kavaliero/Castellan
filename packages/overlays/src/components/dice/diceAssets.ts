/**
 * diceAssets — Helpers pour les images et sons de des.
 *
 * Images : /images/HiResDicePack/{DiceFolder}/{prefix}_{color}_{value}.png
 * Sons   : /sounds/SFX Pack - Rolling Dice/{diceFolder}/Roll 1d{faces}.wav
 *
 * Mapping tier → couleur :
 *   follow → green   (accessible, amical)
 *   sub    → blue    (premium)
 *   raid   → red     (action, excitation)
 */

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type DiceColor = "black" | "blue" | "green" | "purple" | "red" | "white" | "yellow";

export interface DiceImageInfo {
  folder: string;   // ex: "D6", "D20"
  prefix: string;   // ex: "D6N", "d20"
  maxFace: number;
}

// ═══════════════════════════════════════════════════════════════
// MAPPING TIER → COULEUR
// ═══════════════════════════════════════════════════════════════

const TIER_COLOR: Record<string, DiceColor> = {
  follow: "green",
  sub: "blue",
  raid: "red",
};

/** Couleur du de selon le tier du viewer */
export function getDiceColor(tier: string): DiceColor {
  return TIER_COLOR[tier] ?? "purple";
}

// ═══════════════════════════════════════════════════════════════
// MAPPING FACES → DOSSIER / PREFIX IMAGE
// ═══════════════════════════════════════════════════════════════

const DICE_INFO: Record<number, DiceImageInfo> = {
  4:  { folder: "D4",  prefix: "d4",  maxFace: 4 },
  6:  { folder: "D6",  prefix: "D6N", maxFace: 6 },   // D6N = numerote (pas pips)
  8:  { folder: "D8",  prefix: "d8",  maxFace: 8 },
  10: { folder: "D10_and_D100", prefix: "d10", maxFace: 10 },
  12: { folder: "D12", prefix: "d12", maxFace: 12 },
  20: { folder: "D20", prefix: "d20", maxFace: 20 },
};

/**
 * Retourne le chemin vers l'image d'un de.
 * Ex: getDiceImagePath(20, "red", 17) → "/images/HiResDicePack/D20/d20_red_17.png"
 */
export function getDiceImagePath(faces: number, color: DiceColor, value: number): string {
  const info = DICE_INFO[faces];
  if (!info) {
    // Fallback d6
    return `/images/HiResDicePack/D6/D6N_${color}_${value}.png`;
  }
  return `/images/HiResDicePack/${info.folder}/${info.prefix}_${color}_${value}.png`;
}

/**
 * Retourne une face aleatoire pour un de donne (pour l'animation tumble).
 */
export function getRandomFace(faces: number): number {
  return Math.floor(Math.random() * faces) + 1;
}

/**
 * Genere la sequence de faces pour l'animation tumble.
 * Commence rapide, ralentit vers la fin, termine sur le resultat.
 */
export function generateTumbleSequence(faces: number, result: number, steps = 8): number[] {
  const sequence: number[] = [];
  for (let i = 0; i < steps - 1; i++) {
    let face = getRandomFace(faces);
    // Eviter deux faces identiques d'affilee
    while (sequence.length > 0 && face === sequence[sequence.length - 1]) {
      face = getRandomFace(faces);
    }
    sequence.push(face);
  }
  // Derniere face = le vrai resultat
  sequence.push(result);
  return sequence;
}

// ═══════════════════════════════════════════════════════════════
// SONS
// ═══════════════════════════════════════════════════════════════

/** Mapping faces → dossier son */
const SOUND_FOLDER: Record<number, string> = {
  4: "d4",
  6: "d6",
  8: "d8",
  10: "d10",
  12: "d12",
  20: "d20",
};

/**
 * Retourne le chemin vers le son de lancer de de.
 * Ex: getDiceRollSoundPath(20) → "/sounds/SFX Pack - Rolling Dice/d20/Roll 1d20.wav"
 */
export function getDiceRollSoundPath(faces: number): string {
  const folder = SOUND_FOLDER[faces] ?? "d6";
  return `/sounds/SFX Pack - Rolling Dice/${folder}/Roll 1${folder}.wav`;
}

/**
 * Joue le son de lancer de de.
 * Retourne la promesse de l'Audio pour pouvoir le controler si besoin.
 */
export function playDiceRollSound(faces: number, volume = 0.7): HTMLAudioElement {
  const audio = new Audio(getDiceRollSoundPath(faces));
  audio.volume = volume;
  audio.play().catch((err) => {
    console.warn("[DiceSound] Impossible de jouer le son:", err);
  });
  return audio;
}
