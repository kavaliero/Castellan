import { FrameCorners } from "../shared";
import "./live-coding-frame.css";

export function LiveCodingFrame() {
  return (
    <div className="live-coding-frame">
      <div className="live-coding-frame-banner">
        <div className="live-coding-frame-banner-text">
          {"Live Coding : GRANITE NOIR"}
        </div>
      </div>

      <div className="live-coding-frame-border" />
      <div className="live-coding-frame-inner-border" />
      <FrameCorners variant="ornate" />
    </div>
  );
}