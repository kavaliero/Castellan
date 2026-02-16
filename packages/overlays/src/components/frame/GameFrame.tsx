import { useState, useEffect } from "react";
import type { StreamInfoPayload } from "@castellan/shared";
import "./game-frame.css";

/**
 * GameFrame — cadre webcam in-game avec parchemin roulé.
 *
 * Structure :
 * - Bordure dorée avec coins ornementaux (identique à WebcamFrame)
 * - Pas de bannière catégorie en haut
 * - Parchemin roulé en bas avec pseudo Twitch + uptime + viewers
 * - Centre transparent (la webcam est derrière dans OBS)
 *
 * Le parchemin chevauche la bordure inférieure pour un look
 * "carte de quête" médiéval.
 */

interface GameFrameProps {
  streamInfo: StreamInfoPayload | null;
  viewerCount: number;
  twitchName?: string;
}

export function GameFrame({
  streamInfo,
  viewerCount,
  twitchName = "KavalieroGameDev",
}: GameFrameProps) {
  const uptime = useUptime(streamInfo?.startedAt ?? null);

  return (
    <div className="game-frame">
      {/* ── Bordure dorée principale ── */}
      <div className="game-frame-border" />
      <div className="game-frame-inner-border" />

      {/* ── Coins ornementaux ── */}
      <div className="game-frame-corner game-frame-corner--tl" />
      <div className="game-frame-corner game-frame-corner--tr" />
      <div className="game-frame-corner game-frame-corner--bl" />
      <div className="game-frame-corner game-frame-corner--br" />

      {/* ── Parchemin roulé (bas) ── */}
      <div className="game-frame-parchment">
        {/* Rouleau gauche */}
        <div className="game-frame-parchment-roll game-frame-parchment-roll--left" />

        {/* Surface du parchemin */}
        <div className="game-frame-parchment-surface">
          {/* Pseudo Twitch */}
          <div className="game-frame-parchment-name">{twitchName}</div>

          {/* Séparateur décoratif */}
          {/*<div className="game-frame-parchment-separator">
            <span className="game-frame-parchment-separator-ornament">⚜</span>
          </div>*/}

          {/* Infos stream */}
          {/*<div className="game-frame-parchment-info">
            <span className="game-frame-parchment-info-item">
              <span className="game-frame-parchment-info-icon">⏳</span>
              {uptime ? uptime : "0min"}
            </span>
            <span className="game-frame-parchment-info-divider">•</span>
            <span className="game-frame-parchment-info-item">
              <span className="game-frame-parchment-info-icon">⚔️</span>
              {viewerCount} {viewerCount <= 1 ? "Aventurier" : "Aventuriers"}
            </span>
          </div>*/}
        </div>

        {/* Rouleau droit */}
        <div className="game-frame-parchment-roll game-frame-parchment-roll--right" />
      </div>
    </div>
  );
}

// ─── Hook uptime ────────────────────────────────────────────

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
    const timer = setInterval(compute, 30000);
    return () => clearInterval(timer);
  }, [startedAt]);

  return uptime;
}
