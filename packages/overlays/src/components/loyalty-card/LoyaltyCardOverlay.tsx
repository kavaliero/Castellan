/**
 * LoyaltyCardOverlay — Affiche la carte de fidelite d'un viewer
 * quand il recoit un tampon (stamp:incremented) ou atteint le max (stamp:max_reached).
 *
 * Utilise les images generees :
 *   - /images/card-bg.png (1376x768) — fond parchemin avec emplacements vides
 *   - /images/wax-seal.png (1024x1024) — sceau de cire "K" pour les tampons remplis
 *
 * Browser source OBS : http://localhost:3000/overlay/loyalty-card
 */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import "./loyalty-card.css";

export interface LoyaltyCardData {
  displayName: string;
  stampCount: number;
  stampTotal: number;
  maxReached: boolean;
}

interface LoyaltyCardOverlayProps {
  data: LoyaltyCardData;
  onDone: () => void;
}

const DISPLAY_DURATION = 5000; // ms visible apres animation d'entree

/**
 * Positions des 10 emplacements sur card-bg.png (en % de l'image 1376x768).
 * 2 rangees de 5, mesurees sur l'image generee.
 */
const SEAL_POSITIONS: { left: number; top: number }[] = [
  // Rangee 1 — espacement 9%, centre a 50%
  { left: 32, top: 53 },
  { left: 41, top: 53 },
  { left: 50, top: 53 },
  { left: 59, top: 53 },
  { left: 68, top: 53 },
  // Rangee 2
  { left: 32, top: 69 },
  { left: 41, top: 69 },
  { left: 50, top: 69 },
  { left: 59, top: 69 },
  { left: 68, top: 69 },
];

/** Taille du sceau en % de la largeur de la carte */
const SEAL_SIZE = 10.5;

export function LoyaltyCardOverlay({ data, onDone }: LoyaltyCardOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const newSealRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    const sealEl = newSealRef.current;
    if (!el || !sealEl) return;

    const tl = gsap.timeline();

    // Entree : la carte slide depuis la droite
    tl.fromTo(
      el,
      { x: 400, opacity: 0, scale: 0.8 },
      { x: 0, opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.4)" }
    );

    // Le nouveau sceau arrive avec un effet de frappe (tombe d'en haut et s'ecrase)
    // Son de tampon Papers Please synchronise avec l'impact
    const stampSound = new Audio("/sounds/stamp.mp3");
    stampSound.volume = 0.8;

    tl.fromTo(
      sealEl,
      { scale: 3, opacity: 0, rotation: -30 },
      {
        scale: 1,
        opacity: 1,
        rotation: 0,
        duration: 0.4,
        ease: "back.out(2)",
        onStart: () => {
          stampSound.play().catch(() => {});
        },
      },
      "+=0.3"
    );

    // Shake sur la carte quand le sceau tape
    tl.to(el, { x: 3, duration: 0.05, yoyo: true, repeat: 3 }, "-=0.2");

    // Si max atteint, glow dore
    if (data.maxReached) {
      tl.to(el, {
        filter: "drop-shadow(0 0 20px rgba(255, 215, 0, 0.8))",
        duration: 0.3,
        yoyo: true,
        repeat: 2,
      });
    }

    // Pause puis sortie
    tl.to(el, {
      x: 400,
      opacity: 0,
      scale: 0.8,
      duration: 0.5,
      ease: "power2.in",
      delay: DISPLAY_DURATION / 1000,
      onComplete: onDone,
    });

    return () => {
      tl.kill();
    };
  }, []);

  const stamps = Array.from({ length: data.stampTotal }, (_, i) => {
    const isFilled = i < data.stampCount;
    const isNew = i === data.stampCount - 1;
    return { index: i, isFilled, isNew, pos: SEAL_POSITIONS[i] };
  });

  return (
    <div ref={containerRef} className="loyalty-card">
      {/* Fond : image de la carte */}
      <img
        src="/images/card-bg.png"
        alt=""
        className="loyalty-card-bg"
        draggable={false}
      />

      {/* Nom du viewer sur la banniere en bas */}
      <div className="loyalty-card-viewer">{data.displayName}</div>

      {/* Sceaux de cire positionnes sur les emplacements */}
      {stamps.map((s) =>
        s.isFilled ? (
          <img
            key={s.index}
            ref={s.isNew ? newSealRef : undefined}
            src="/images/wax-seal.png"
            alt=""
            className={`loyalty-card-seal ${s.isNew ? "loyalty-card-seal--new" : ""}`}
            draggable={false}
            style={{
              left: `${s.pos.left}%`,
              top: `${s.pos.top}%`,
              width: `${SEAL_SIZE}%`,
              height: "auto",
              marginLeft: `${-SEAL_SIZE / 2}%`,
              marginTop: `${-SEAL_SIZE / 2}%`,
            }}
          />
        ) : null
      )}

      {/* Compteur discret */}
      <div className="loyalty-card-count">
        {data.stampCount}/{data.stampTotal}
      </div>

      {/* Message bonus quand la carte est pleine */}
      {data.maxReached && (
        <div className="loyalty-card-bonus">
          {"\u{1F3B2}"} De de follower debloque ! Tape !de squatt ou !de roue
        </div>
      )}
    </div>
  );
}
