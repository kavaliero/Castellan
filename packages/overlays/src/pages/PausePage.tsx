import { useCallback } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { PausePlayer } from "../components/pause/PausePlayer";
import type { WSEvent } from "@castellan/shared";

/**
 * Page Pause — Scène BRB qui joue les clips en boucle.
 *
 * Browser Source OBS : http://localhost:3000/overlay/pause
 *
 * Le WebSocket est utilisé ici pour :
 * - Recevoir les notifications clips:synced (re-sync en live si StreamerBot renvoie des clips)
 * - Futur : recevoir des commandes pause:stop, etc.
 *
 * Le PausePlayer gère lui-même le fetch des clips et la lecture.
 */

export function PausePage() {
  const handleEvent = useCallback((event: WSEvent) => {
    if (event.type === "clips:synced") {
      console.log(`[Pause] Clips re-synchronisés: ${event.payload.count} clips`);
      // Le PausePlayer re-fetch automatiquement quand il boucle,
      // donc pas besoin de forcer un refresh ici pour l'instant
    }
  }, []);

  useWebSocket(handleEvent);

  return <PausePlayer />;
}
