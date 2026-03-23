import type { StreamInfoPayload } from "@castellan/shared";
import { FrameCorners } from "../shared";
import { useUptime } from "../../hooks/useUptime";
import "./game-frame.css";

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
      <div className="game-frame-border" />
      <div className="game-frame-inner-border" />
      <FrameCorners variant="ornate" />

      <div className="game-frame-parchment">
        <div className="game-frame-parchment-roll game-frame-parchment-roll--left" />
        <div className="game-frame-parchment-surface">
          <div className="game-frame-parchment-name">{twitchName}</div>
        </div>
        <div className="game-frame-parchment-roll game-frame-parchment-roll--right" />
      </div>
    </div>
  );
}
