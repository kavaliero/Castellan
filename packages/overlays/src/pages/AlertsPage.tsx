import { useState, useRef, useCallback } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { useSound } from "../hooks/useSound";
import { ScrollAlert } from "../components/alerts/ScrollAlert";
import { ChallengeRollOverlay, type ChallengeRollData } from "../components/challenges/ChallengeRollOverlay";
import { resolveTemplate } from "../utils/resolveTemplate";
import type { ScrollAlertData } from "../components/alerts/ScrollAlert";
import type { WSEvent, AlertsConfig, AlertChallengeRollPayload } from "@castellan/shared";

const MEDIA_BASE_URL = "http://localhost:3001/media/alerts/videos";

// ── Queue unifiée : alertes standard OU challenge rolls ──

interface QueuedStandardAlert {
  kind: "standard";
  id: string;
  data: ScrollAlertData;
  soundFile: string | null;
  soundVolume: number;
  duration: number;
}

interface QueuedChallengeRoll {
  kind: "challenge_roll";
  id: string;
  data: ChallengeRollData;
}

type QueuedItem = QueuedStandardAlert | QueuedChallengeRoll;

/**
 * Extract template variables from a WS alert event payload.
 * Maps spec variable names to actual payload field names.
 */
function extractVariables(event: WSEvent): Record<string, string | number | undefined> {
  const vars: Record<string, string | number | undefined> = {};

  if ("payload" in event) {
    const p = event.payload as any;

    // viewer — most alert types have viewer.displayName, raid has fromChannel
    if (p.viewer?.displayName) vars.viewer = p.viewer.displayName;
    if (p.fromChannel) vars.viewer = p.fromChannel;

    // amounts
    if (p.viewers !== undefined) vars.amount = p.viewers;
    if (p.amount !== undefined) vars.amount = p.amount;

    // sub fields
    if (p.tier !== undefined) vars.tier = p.tier;
    if (p.months !== undefined) vars.months = p.months;
    if (p.recipientName) vars.recipient = p.recipientName;
    if (p.totalGifted !== undefined) vars.totalGifted = p.totalGifted;

    // hype train
    if (p.level !== undefined) vars.level = p.level;
    if (p.totalPoints !== undefined) vars.totalPoints = p.totalPoints;
    if (p.progress !== undefined) vars.progress = p.progress;

    // dice
    if (p.faces !== undefined) vars.faces = p.faces;
    if (p.result !== undefined) vars.result = p.result;

    // channel points
    if (p.rewardName) vars.rewardName = p.rewardName;
    if (p.rewardCost !== undefined) vars.rewardCost = p.rewardCost;
  }

  return vars;
}

/**
 * Map WSEvent type to config key. Handles resub logic.
 */
function getConfigKey(event: WSEvent): string | null {
  switch (event.type) {
    case "alert:follow": return "follow";
    case "alert:sub": {
      const p = event.payload as any;
      return p.months > 1 ? "resub" : "sub";
    }
    case "alert:gift_sub": return "gift_sub";
    case "alert:raid": return "raid";
    case "alert:bits": return "bits";
    case "alert:hype_train": return "hype_train";
    case "alert:first_word": return "first_word";
    case "alert:dice": return "dice";
    case "alert:channel_point_redemption": return "channel_point_redemption";
    default: return null;
  }
}

export function AlertsPage() {
  const [currentItem, setCurrentItem] = useState<QueuedItem | null>(null);
  const queueRef = useRef<QueuedItem[]>([]);
  const isShowingRef = useRef(false);
  const configRef = useRef<AlertsConfig | null>(null);
  const mediaDurationsRef = useRef<Map<string, number>>(new Map());

  const { playSound, preloadFromConfig } = useSound();

  const showNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) {
      setCurrentItem(null);
      isShowingRef.current = false;
      return;
    }

    isShowingRef.current = true;
    setCurrentItem(next);

    // Son uniquement pour les alertes standard
    if (next.kind === "standard") {
      playSound(next.soundFile, next.soundVolume);
    }
  }, [playSound]);

  const enqueueItem = useCallback((item: QueuedItem) => {
    queueRef.current.push(item);
    if (!isShowingRef.current) {
      showNext();
    }
  }, [showNext]);

  const handleEvent = useCallback((event: WSEvent) => {
    // Handle config updates
    if (event.type === "alerts:config") {
      configRef.current = event.payload;
      preloadFromConfig(event.payload);

      // Preload video metadata to get durations
      for (const [type, alertCfg] of Object.entries(event.payload.alerts)) {
        if (alertCfg.media.enabled && alertCfg.media.file && alertCfg.media.type === "video") {
          const video = document.createElement("video");
          video.preload = "metadata";
          video.src = `${MEDIA_BASE_URL}/${alertCfg.media.file}`;
          video.onloadedmetadata = () => {
            mediaDurationsRef.current.set(type, video.duration * 1000);
          };
        }
      }
      return;
    }

    // ── Challenge roll : animation dédiée (pas de config alerts-config.json) ──
    if (event.type === "alert:challenge_roll") {
      const p = event.payload as AlertChallengeRollPayload;
      const challengeItem: QueuedChallengeRoll = {
        kind: "challenge_roll",
        id: crypto.randomUUID(),
        data: {
          viewerName: p.viewer.displayName,
          challengeName: p.challengeName,
          challengeLabel: p.challengeLabel,
          challengeType: p.challengeType,
          challengeIcon: p.challengeIcon,
          challengeTitle: p.challengeTitle,
          faces: p.faces,
          result: p.result,
          amount: p.amount,
          profileImageUrl: p.profileImageUrl,
          timings: p.timings,
        },
      };
      enqueueItem(challengeItem);
      return;
    }

    // ── Standard alerts : config-driven ──
    const config = configRef.current;
    if (!config) return;

    const configKey = getConfigKey(event);
    if (!configKey) return;

    const alertCfg = config.alerts[configKey];
    if (!alertCfg || !alertCfg.enabled) return;

    const vars = extractVariables(event);

    // Resolve templates
    const title = resolveTemplate(alertCfg.title, vars);
    const subtitle = alertCfg.subtitle ? resolveTemplate(alertCfg.subtitle, vars) : null;
    const viewerName = alertCfg.viewerName ? resolveTemplate(alertCfg.viewerName, vars) : null;
    const ribbon = alertCfg.ribbon ? resolveTemplate(alertCfg.ribbon, vars) : null;

    // Media URL
    let mediaUrl: string | null = null;
    if (alertCfg.media.enabled && alertCfg.media.file) {
      mediaUrl = `${MEDIA_BASE_URL}/${alertCfg.media.file}`;
    }

    // Duration: trumpet bannerStayDuration overrides parchmentDuration if present
    const baseDuration = alertCfg.trumpet?.bannerStayDuration
      ? alertCfg.trumpet.bannerStayDuration * 1000
      : alertCfg.parchmentDuration;
    const mediaDuration = mediaDurationsRef.current.get(configKey) ?? 0;
    const duration = Math.max(baseDuration, mediaDuration);

    const queued: QueuedStandardAlert = {
      kind: "standard",
      id: crypto.randomUUID(),
      data: {
        type: configKey,
        variant: alertCfg.variant,
        icon: alertCfg.icon,
        sealColor: alertCfg.sealColor,
        title,
        viewerName,
        subtitle,
        ribbon,
        mediaUrl,
        mediaType: alertCfg.media.type,
        trumpet: alertCfg.trumpet,
      },
      soundFile: alertCfg.sound.enabled ? alertCfg.sound.file : null,
      soundVolume: alertCfg.sound.volume,
      duration,
    };

    enqueueItem(queued);
  }, [enqueueItem, preloadFromConfig]);

  useWebSocket(handleEvent);

  return (
    <div className="alerts-page">
      {currentItem?.kind === "standard" && (
        <ScrollAlert
          key={currentItem.id}
          alert={currentItem.data}
          duration={currentItem.duration}
          onDone={showNext}
        />
      )}
      {currentItem?.kind === "challenge_roll" && (
        <ChallengeRollOverlay
          key={currentItem.id}
          data={currentItem.data}
          onDone={showNext}
        />
      )}
    </div>
  );
}
