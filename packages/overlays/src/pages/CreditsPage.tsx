import { useState, useCallback } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { CreditsOverlay } from "../components/credits/CreditsOverlay";
import type { WSEvent, CreditsPayload } from "@castellan/shared";

/**
 * Page Credits — attend l'event credits:data puis lance le défilement.
 *
 * Contrairement au Chat (qui accumule des messages), les crédits
 * sont envoyés en UN SEUL event contenant tout. L'overlay attend,
 * reçoit le payload, et lance l'animation.
 */

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}`;
  return `${m} min`;
}

/** Mappe le CreditsPayload du serveur vers le format attendu par CreditsOverlay */
function mapCreditsData(credits: CreditsPayload) {
  return {
    stream: {
      title: credits.stream.title,
      game: credits.stream.title, // pas de champ game dans le payload, on utilise le title
      duration: formatDuration(credits.stream.duration),
    },
    stats: {
      viewers: credits.stats.totalViewers,
      messages: credits.stats.totalMessages,
      topChatter: credits.stats.topChatter
        ? { name: credits.stats.topChatter.viewer.displayName, count: credits.stats.topChatter.messageCount }
        : null,
    },
    firstMessage: credits.firstMessage?.displayName ?? null,
    followers: (credits.followers ?? []).map((v) => v.displayName),
    subscribers: (credits.subscribers ?? []).map((s) => ({
      name: s.viewer.displayName,
      type: `Tier ${s.tier}`,
    })),
    raiders: (credits.raiders ?? []).map((r) => ({
      name: r.fromChannel,
      viewers: r.viewers,
    })),
    cheers: (credits.topBitsDonator ?? []).map((b) => ({
      name: b.viewer.displayName,
      bits: b.amount,
    })),
  };
}

export function CreditsPage() {
  const [credits, setCredits] = useState<CreditsPayload | null>(null);

  const handleEvent = useCallback((event: WSEvent) => {
    if (event.type === "credits:data") {
      setCredits(event.payload);
    }
  }, []);

  useWebSocket(handleEvent);

  if (!credits) {
    // Rien à afficher tant que les crédits n'ont pas été déclenchés
    return null;
  }

  return <CreditsOverlay data={mapCreditsData(credits)} />;
}
