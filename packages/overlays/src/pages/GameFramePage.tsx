import { useState, useCallback } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { GameFrame } from "../components/frame/GameFrame";
import type {
  WSEvent,
  StreamInfoPayload,
  StreamViewersPayload,
} from "@castellan/shared";

/**
 * Page GameFrame — affiche le cadre webcam in-game avec parchemin.
 *
 * Écoute les events :
 * - stream:info    → startedAt (pour l'uptime)
 * - stream:viewers → nombre de viewers actifs
 *
 * À utiliser comme Browser Source OBS par-dessus la webcam,
 * sur les scènes de gameplay (pas Just Chatting).
 */

export function GameFramePage() {
  const [streamInfo, setStreamInfo] = useState<StreamInfoPayload | null>(null);
  const [viewers, setViewers] = useState<StreamViewersPayload>({ count: 0 });

  const handleEvent = useCallback((event: WSEvent) => {
    switch (event.type) {
      case "stream:info":
        setStreamInfo(event.payload);
        break;
      case "stream:viewers":
        setViewers(event.payload);
        break;
    }
  }, []);

  useWebSocket(handleEvent);

  return (
    <GameFrame
      streamInfo={streamInfo}
      viewerCount={viewers.count}
    />
  );
}
