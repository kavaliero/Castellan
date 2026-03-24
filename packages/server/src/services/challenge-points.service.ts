/**
 * Service Challenge Points — Mapping entre channel point rewards et defis.
 *
 * Charge la config depuis challenge-points-config.json et fournit :
 * - findChallengeByReward(rewardName) → config du defi ou null
 * - rollChallengePointDice(config, viewer) → lance le de auto + enqueue
 *
 * Les channel points NE consomment PAS de DiceCapacity.
 * Le de est lance automatiquement, pas de choix du viewer.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { enqueueDiceRoll } from "./dice-queue.service";
import { prisma } from "../db/client";
import type { ChallengeType } from "@castellan/shared";

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

export interface ChallengePointConfig {
  rewardName: string;
  aliases?: string[];
  name: string;
  label: string;
  type: ChallengeType;
  faces: number;
  icon: string;
  title: string;
  cost: number;
}

interface ChallengePointsFile {
  challenges: Record<string, ChallengePointConfig>;
}

const CONFIG_PATH = resolve(__dirname, "../../challenge-points-config.json");

let challengeConfigs: ChallengePointConfig[] = [];

/** Charge la config des defis de channel points */
export function loadChallengePointsConfig(): void {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const parsed: ChallengePointsFile = JSON.parse(raw);
    challengeConfigs = Object.values(parsed.challenges);
    console.log(`[ChallengePoints] ${challengeConfigs.length} défis chargés`);
  } catch (err) {
    console.error("[ChallengePoints] Erreur chargement config:", err);
    challengeConfigs = [];
  }
}

/**
 * Trouve la config d'un defi par le nom du reward Twitch.
 * Matching en 3 niveaux (case-insensitive) :
 * 1. Match exact sur rewardName
 * 2. Match sur un alias
 * 3. Le rewardName Twitch contient le label du defi (ex: "Defis : Gant de cuisine" contient "Gant de cuisine")
 */
export function findChallengeByReward(rewardName: string): ChallengePointConfig | null {
  const normalized = rewardName.toLowerCase().trim();

  // 1. Match exact sur rewardName
  const exact = challengeConfigs.find(c => c.rewardName.toLowerCase().trim() === normalized);
  if (exact) return exact;

  // 2. Match sur un alias
  const aliasMatch = challengeConfigs.find(c =>
    c.aliases?.some(a => a.toLowerCase().trim() === normalized)
  );
  if (aliasMatch) return aliasMatch;

  // 3. Le reward Twitch contient le label du defi
  const containsMatch = challengeConfigs.find(c =>
    normalized.includes(c.label.toLowerCase())
  );
  if (containsMatch) return containsMatch;

  return null;
}

/** Retourne toutes les configs */
export function getAllChallengePointConfigs(): ChallengePointConfig[] {
  return [...challengeConfigs];
}

// ═══════════════════════════════════════════════════════════════
// ROLL — Lancer de de automatique pour un defi de channel points
// ═══════════════════════════════════════════════════════════════

export interface ChallengeRollResult {
  config: ChallengePointConfig;
  result: number;
  amount: number;
  profileImageUrl: string | null;
}

/**
 * Lance le de associe a un defi de channel points.
 * Pas de DiceCapacity consommee — c'est un lancer automatique.
 *
 * @returns Le resultat du lancer + la config du defi
 */
export async function rollChallengePointDice(
  config: ChallengePointConfig,
  viewer: { displayName: string; twitchId?: string },
  viewerDbId?: string,
): Promise<ChallengeRollResult> {
  // Lancer le de
  const result = Math.floor(Math.random() * config.faces) + 1;

  // Pour les timers, le resultat est en minutes → on stocke en secondes
  const amount = config.type === "timer" ? result * 60 : result;

  // Recuperer la photo de profil
  let profileImageUrl: string | null = null;
  if (viewerDbId) {
    try {
      const dbViewer = await prisma.viewer.findUnique({
        where: { id: viewerDbId },
        select: { twitchProfileImageUrl: true },
      });
      profileImageUrl = (dbViewer as any)?.twitchProfileImageUrl ?? null;

      // Si pas enrichi, lancer un enrichissement lazy (non-bloquant)
      if (!profileImageUrl) {
        const { enrichViewer } = await import("./twitch.service");
        enrichViewer(viewerDbId).catch(() => {});
      }
    } catch {
      // Pas grave, on utilisera le fallback
    }
  }

  // Enqueue dans la dice queue — PAS de broadcast dice:rolled (l'animation est dans ChallengeRollOverlay)
  // On utilise la queue uniquement pour le timing addChallenge + message chat
  enqueueDiceRoll({
    broadcastPayload: {
      viewer: { displayName: viewer.displayName },
      tier: "channel_points",
      dieType: "challenge",
      faces: config.faces,
      result,
      isNat20: false,
      challengeTitle: config.title,
      challengeType: config.type,
      challengeLabel: config.label,
    },
    challenge: {
      name: config.name,
      label: config.label,
      type: config.type,
      amount,
      icon: config.icon,
    },
    skipDiceBroadcast: true, // Le de est anime dans ChallengeRollOverlay, pas dans DiceRollPage
  });

  // Broadcast l'event specifique pour l'animation de defi
  // (sera capte par AlertsPage pour jouer la nouvelle animation)
  const { broadcast } = await import("../ws/broadcaster");
  const { getChallengeAnimationSettings } = await import("./challenge-animation.service");
  broadcast({
    type: "alert:challenge_roll" as any,
    payload: {
      viewer: { displayName: viewer.displayName },
      challengeName: config.name,
      challengeLabel: config.label,
      challengeType: config.type,
      challengeIcon: config.icon,
      challengeTitle: config.title,
      faces: config.faces,
      result,
      amount,
      profileImageUrl,
      timings: getChallengeAnimationSettings(),
    },
  });

  return { config, result, amount, profileImageUrl };
}
