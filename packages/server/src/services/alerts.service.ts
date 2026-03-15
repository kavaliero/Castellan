import { readFileSync, writeFileSync } from "fs";
import type { AlertsConfig, AlertTypeConfig, AlertGlobalConfig } from "@castellan/shared";
import { broadcast } from "../ws/broadcaster";

const CONFIG_PATH = "./alerts-config.json";

const DEFAULT_CONFIG: AlertsConfig = {
  global: {
    defaultParchmentDuration: 9500,
    defaultVolume: 0.7,
  },
  alerts: {
    follow: {
      enabled: true, variant: "minor", icon: "⚔️", sealColor: "#4a90d9",
      title: "Nouveau Chevalier !", subtitle: null, viewerName: "{viewer}", ribbon: null,
      parchmentDuration: 9500,
      sound: { enabled: true, file: "follow.mp3", volume: 0.7 },
      media: { enabled: false, file: null, type: null },
    },
    sub: {
      enabled: true, variant: "minor", icon: "🛡️", sealColor: "#9b59b6",
      title: "Nouveau Serment !", subtitle: "Tier {tier}", viewerName: "{viewer}", ribbon: null,
      parchmentDuration: 9500,
      sound: { enabled: true, file: "sub.mp3", volume: 0.7 },
      media: { enabled: false, file: null, type: null },
    },
    resub: {
      enabled: true, variant: "minor", icon: "🛡️", sealColor: "#9b59b6",
      title: "Renouvellement de Serment !", subtitle: "Tier {tier}", viewerName: "{viewer}", ribbon: "{months} mois",
      parchmentDuration: 9500,
      sound: { enabled: true, file: "sub.mp3", volume: 0.7 },
      media: { enabled: false, file: null, type: null },
    },
    gift_sub: {
      enabled: true, variant: "minor", icon: "🎁", sealColor: "#e67e22",
      title: "Don Genereux !", subtitle: "Offre un sub Tier {tier} a {recipient}", viewerName: "{viewer}", ribbon: null,
      parchmentDuration: 9500,
      sound: { enabled: true, file: "sub.mp3", volume: 0.7 },
      media: { enabled: false, file: null, type: null },
    },
    raid: {
      enabled: true, variant: "major", icon: "🏰", sealColor: "#e74c3c",
      title: "Raid !", subtitle: "{amount} envahisseurs aux portes !", viewerName: "{viewer}", ribbon: null,
      parchmentDuration: 9500,
      sound: { enabled: true, file: "raid.mp3", volume: 0.8 },
      media: { enabled: false, file: null, type: null },
    },
    bits: {
      enabled: true, variant: "minor", icon: "💎", sealColor: "#f1c40f",
      title: "Offrande de {amount} Bits !", subtitle: null, viewerName: "{viewer}", ribbon: null,
      parchmentDuration: 9500,
      sound: { enabled: true, file: "bits.mp3", volume: 0.7 },
      media: { enabled: false, file: null, type: null },
    },
    hype_train: {
      enabled: true, variant: "major", icon: "🔥", sealColor: "#e74c3c",
      title: "Hype Train Niveau {level} !", subtitle: "{totalPoints} points", viewerName: null, ribbon: null,
      parchmentDuration: 9500,
      sound: { enabled: true, file: "raid.mp3", volume: 0.8 },
      media: { enabled: false, file: null, type: null },
    },
    first_word: {
      enabled: true, variant: "minor", icon: "📜", sealColor: "#2ecc71",
      title: "Premiere Parole !", subtitle: null, viewerName: "{viewer}", ribbon: null,
      parchmentDuration: 9500,
      sound: { enabled: true, file: "follow.mp3", volume: 0.7 },
      media: { enabled: false, file: null, type: null },
    },
    dice: {
      enabled: true, variant: "minor", icon: "🎲", sealColor: "#1abc9c",
      title: "Lance un D{faces} !", subtitle: "Resultat : {result}", viewerName: "{viewer}", ribbon: null,
      parchmentDuration: 9500,
      sound: { enabled: true, file: "dice.mp3", volume: 0.7 },
      media: { enabled: false, file: null, type: null },
    },
    channel_point_redemption: {
      enabled: true, variant: "minor", icon: "✨", sealColor: "#8e44ad",
      title: "{rewardName}", subtitle: "{rewardCost} points", viewerName: "{viewer}", ribbon: null,
      parchmentDuration: 9500,
      sound: { enabled: true, file: "bits.mp3", volume: 0.7 },
      media: { enabled: false, file: null, type: null },
    },
  },
};

let state: AlertsConfig = structuredClone(DEFAULT_CONFIG);

function loadConfig(): AlertsConfig {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as AlertsConfig;
  } catch {
    console.log("[AlertsService] No config found, writing defaults");
    saveConfig(DEFAULT_CONFIG);
    return structuredClone(DEFAULT_CONFIG);
  }
}

function saveConfig(config: AlertsConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] === null) {
      result[key] = null;
    } else if (
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      typeof target[key] === "object" &&
      target[key] !== null
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/** Validates a MERGED (full) alert config, not a partial. */
function validateAlertConfig(config: AlertTypeConfig): string | null {
  if (!["minor", "major"].includes(config.variant)) {
    return "variant must be 'minor' or 'major'";
  }
  if (config.parchmentDuration <= 0) {
    return "parchmentDuration must be > 0";
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(config.sealColor)) {
    return "sealColor must be a valid hex color (e.g. #4a90d9)";
  }
  if (typeof config.enabled !== "boolean") {
    return "enabled must be a boolean";
  }
  if (config.sound.volume < 0 || config.sound.volume > 1) {
    return "sound.volume must be between 0 and 1";
  }
  if (config.sound.enabled && !config.sound.file) {
    return "sound.file must be set when sound.enabled is true";
  }
  if (config.media.type !== null && !["video", "gif"].includes(config.media.type)) {
    return "media.type must be 'video', 'gif', or null";
  }
  if (config.media.enabled && !config.media.file) {
    return "media.file must be set when media.enabled is true";
  }
  return null;
}

export function initAlerts(): void {
  state = loadConfig();
  console.log(`[AlertsService] Loaded config with ${Object.keys(state.alerts).length} alert types`);
}

export function getAlertsConfig(): AlertsConfig {
  return state;
}

export function updateAlertConfig(type: string, partial: Partial<AlertTypeConfig>): string | null {
  if (!state.alerts[type]) {
    return `Unknown alert type: ${type}`;
  }
  // Validate against merged state (not just the partial) so that
  // e.g. { "sound": { "enabled": true } } is valid if file already exists
  const merged = deepMerge(state.alerts[type], partial) as AlertTypeConfig;
  const error = validateAlertConfig(merged);
  if (error) return error;

  state.alerts[type] = merged;
  saveConfig(state);
  broadcastAlertsConfig();
  return null;
}

export function updateGlobalConfig(partial: Partial<AlertGlobalConfig>): string | null {
  if (partial.defaultParchmentDuration !== undefined && partial.defaultParchmentDuration <= 0) {
    return "defaultParchmentDuration must be > 0";
  }
  if (partial.defaultVolume !== undefined && (partial.defaultVolume < 0 || partial.defaultVolume > 1)) {
    return "defaultVolume must be between 0 and 1";
  }
  state.global = deepMerge(state.global, partial);
  saveConfig(state);
  broadcastAlertsConfig();
  return null;
}

export function broadcastAlertsConfig(): void {
  broadcast({ type: "alerts:config", payload: state });
}
