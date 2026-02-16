import { useState, useCallback } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { WebcamFrame } from "../components/frame/WebcamFrame";
import type { WSEvent, StreamInfoPayload, StreamViewersPayload } from "@castellan/shared";

/**
 * Page Frame — affiche le cadre webcam dynamique.
 *
 * Écoute les events :
 * - stream:info    → game, title, startedAt
 * - stream:viewers → nombre de viewers actifs
 *
 * À utiliser comme Browser Source OBS par-dessus la webcam.
 */

export function FramePage() {
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
    <WebcamFrame
      streamInfo={streamInfo}
      viewerCount={viewers.count}
    />
  );
}
