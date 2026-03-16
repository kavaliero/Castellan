import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import "./alerts.css";
import { lighten } from "../../utils/lighten";
import { getAnimationModule } from "../../animations/registry";

export type ScrollAlertVariant = "minor" | "major";

export interface ScrollAlertData {
  type: string;
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
  duration: number;
  onDone: () => void;
}

export function ScrollAlert({ alert, duration, onDone }: ScrollAlertProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  const sealGradient = `radial-gradient(circle at 40% 35%, ${lighten(alert.sealColor, 20)}, ${alert.sealColor})`;
  const wrapperClass = `scroll-alert scroll-alert--${alert.variant}`;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const module = getAnimationModule(alert.type);

    // Build enter timeline
    const enterTl = module.enter(el, {
      type: alert.type,
      variant: alert.variant,
      icon: alert.icon,
      sealColor: alert.sealColor,
      title: alert.title,
      viewerName: alert.viewerName,
      subtitle: alert.subtitle,
      ribbon: alert.ribbon,
    });

    const enterDuration = enterTl.duration();

    // Build exit timeline (paused, we play it after the pause)
    const exitTl = module.exit(el);
    exitTl.pause();

    const exitDuration = exitTl.duration();

    // Calculate pause: total duration minus enter and exit
    const pauseMs = Math.max(0, duration - (enterDuration * 1000) - (exitDuration * 1000));

    // Master timeline: enter → pause → exit → onDone
    let pauseTimer: ReturnType<typeof setTimeout>;
    const master = gsap.timeline();
    master.add(enterTl);
    master.call(() => {
      // After pause, play exit
      pauseTimer = setTimeout(() => {
        exitTl.play();
        exitTl.eventCallback("onComplete", onDone);
      }, pauseMs);
    });

    timelineRef.current = master;

    return () => {
      clearTimeout(pauseTimer);
      master.kill();
      exitTl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount, component is keyed by alert ID
  }, []);

  return (
    <div ref={containerRef} className={wrapperClass}>
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
