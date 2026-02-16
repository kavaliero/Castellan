import { useState, useEffect } from "react";
import type { StreamInfoPayload } from "@castellan/shared";
import "./frame.css";

/**
 * WebcamFrame — cadre webcam médiéval dynamique.
 *
 * Structure :
 * - Bordure dorée avec coins ornementaux (CSS)
 * - Bannière catégorie en haut (game name)
 * - Barre info en bas (uptime + viewers)
 * - Centre transparent (la webcam est derrière dans OBS)
 *
 * L'uptime est calculé côté client à partir de startedAt.
 */

interface WebcamFrameProps {
  streamInfo: StreamInfoPayload | null;
  viewerCount: number;
}

export function WebcamFrame({ streamInfo, viewerCount }: WebcamFrameProps) {
  const uptime = useUptime(streamInfo?.startedAt ?? null);

  return (
    <div className="webcam-frame">
      {/* Bordure dorée principale */}
      <div className="webcam-frame-border" />
      <div className="webcam-frame-inner-border" />

      {/* Coins ornementaux */}
      <div className="webcam-frame-corner webcam-frame-corner--tl" />
      <div className="webcam-frame-corner webcam-frame-corner--tr" />
      <div className="webcam-frame-corner webcam-frame-corner--bl" />
      <div className="webcam-frame-corner webcam-frame-corner--br" />

      {/* Bannière catégorie (haut) */}
      <div className="webcam-frame-banner">
        <div className="webcam-frame-banner-text">
          {streamInfo?.game ?? "Just Chatting"}
        </div>
      </div>

      {/* Barre info (bas) */}
      <div className="webcam-frame-info">
        {/* Uptime */}
        <div className="webcam-frame-uptime">
          <span className="webcam-frame-uptime-icon">⏳</span>
          <span className="webcam-frame-uptime-text">
            {uptime ? `En quête depuis ${uptime}` : "En préparation..."}
          </span>
        </div>

        <div className="webcam-frame-info-separator" />

        {/* Viewers */}
        <div className="webcam-frame-viewers">
          <span className="webcam-frame-viewers-icon">⚔️</span>
          <span className="webcam-frame-viewers-count">{viewerCount}</span>
          <span className="webcam-frame-viewers-label">
            {viewerCount <= 1 ? "Aventurier" : "Aventuriers"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Hook uptime ────────────────────────────────────────────

/**
 * Calcule l'uptime à partir de startedAt (ISO string).
 * Met à jour toutes les 30 secondes.
 * Retourne un string formaté ("1h24") ou null si pas de stream.
 */
function useUptime(startedAt: string | null): string | null {
  const [uptime, setUptime] = useState<string | null>(null);

  useEffect(() => {
    if (!startedAt) {
      setUptime(null);
      return;
    }

    function compute() {
      const start = new Date(startedAt!).getTime();
      const now = Date.now();
      const diffMs = now - start;

      if (diffMs < 0) {
        setUptime(null);
        return;
      }

      const totalMinutes = Math.floor(diffMs / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      if (hours > 0) {
        setUptime(`${hours}h${minutes.toString().padStart(2, "0")}`);
      } else {
        setUptime(`${minutes}min`);
      }
    }

    compute();
    const timer = setInterval(compute, 30000); // Update toutes les 30s

    return () => clearInterval(timer);
  }, [startedAt]);

  return uptime;
}
