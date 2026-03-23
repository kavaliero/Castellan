import type { StreamInfoPayload } from "@castellan/shared";
import { FrameCorners } from "../shared";
import { useUptime } from "../../hooks/useUptime";
import "./frame.css";

interface WebcamFrameProps {
  streamInfo: StreamInfoPayload | null;
  viewerCount: number;
}

export function WebcamFrame({ streamInfo, viewerCount }: WebcamFrameProps) {
  const uptime = useUptime(streamInfo?.startedAt ?? null);

  return (
    <div className="webcam-frame">
      <div className="webcam-frame-border" />
      <div className="webcam-frame-inner-border" />
      <FrameCorners variant="ornate" />

      <div className="webcam-frame-banner">
        <div className="webcam-frame-banner-text">
          {streamInfo?.game ?? "Just Chatting"}
        </div>
      </div>

      <div className="webcam-frame-info">
        <div className="webcam-frame-uptime">
          <span className="webcam-frame-uptime-icon">⏳</span>
          <span className="webcam-frame-uptime-text">
            {uptime ? `En quête depuis ${uptime}` : "En préparation..."}
          </span>
        </div>

        <div className="webcam-frame-info-separator" />

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
