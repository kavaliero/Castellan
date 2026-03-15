import "./alerts.css";
import { lighten } from "../../utils/lighten";

export type ScrollAlertVariant = "minor" | "major";

export interface ScrollAlertData {
  variant: ScrollAlertVariant;
  icon: string;
  sealColor: string;
  title: string;
  viewerName: string | null;
  subtitle: string | null;
  ribbon: string | null;
  mediaUrl: string | null;
  mediaType: "video" | "gif" | null;
}

interface ScrollAlertProps {
  alert: ScrollAlertData;
}

export function ScrollAlert({ alert }: ScrollAlertProps) {
  const sealGradient = `radial-gradient(circle at 40% 35%, ${lighten(alert.sealColor, 20)}, ${alert.sealColor})`;

  // Keep original CSS class pattern: scroll-alert--{variant}
  const wrapperClass = `scroll-alert scroll-alert--${alert.variant}`;

  return (
    <div className={wrapperClass}>
      {/* Media layer behind parchment */}
      {alert.mediaUrl && alert.mediaType === "video" && (
        <video className="scroll-media" src={alert.mediaUrl} autoPlay muted playsInline />
      )}
      {alert.mediaUrl && alert.mediaType === "gif" && (
        <img className="scroll-media" src={alert.mediaUrl} alt="" />
      )}

      {/* Sceau de cire */}
      <div className="scroll-seal">
        <div className="scroll-seal-half--left" style={{ background: sealGradient }} />
        <div className="scroll-seal-half--right" style={{ background: sealGradient }} />
        <div className="scroll-seal-crack" />
        <div className="scroll-seal-icon">{alert.icon}</div>
        <div className="scroll-seal-burst" />
      </div>

      {/* Corps du parchemin */}
      <div className="scroll-parchment">
        <div className="scroll-roll" />
        <div className="scroll-content">
          <div className="scroll-content-inner">
            <div className="scroll-title">{alert.title}</div>
            <div className="scroll-separator" />
            {alert.viewerName && (
              <div className="scroll-viewer-name">{alert.viewerName}</div>
            )}
            {alert.subtitle && (
              <div className="scroll-subtitle">{alert.subtitle}</div>
            )}
            {alert.ribbon && (
              <div className="scroll-ribbon">{alert.ribbon}</div>
            )}
          </div>
        </div>
        <div className="scroll-roll" />
      </div>
    </div>
  );
}
