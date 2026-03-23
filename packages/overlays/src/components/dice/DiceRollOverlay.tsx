/**
 * DiceRollOverlay — Affiche le lancer de de d'un viewer avec images et sons.
 *
 * Animation :
 * 1. Container fade-in
 * 2. Son de lancer
 * 3. Cycle rapide d'images (setTimeout en chaine, pas GSAP)
 *    → demarre vite (50ms), ralentit progressivement (300ms)
 * 4. Image finale = resultat, rebond GSAP
 * 5. Texte de resultat apparait
 * 6. Effets speciaux (nat20 / squatt)
 * 7. Sortie apres DISPLAY_DURATION
 *
 * Browser source OBS : http://localhost:3000/overlay/dice
 */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import {
  getDiceColor,
  getDiceImagePath,
  getRandomFace,
  playDiceRollSound,
} from "./diceAssets";
import "./dice.css";

export interface DiceRollData {
  displayName: string;
  tier: string;
  dieType: string;
  faces: number;
  result: number;
  isNat20: boolean;
  /** Titre contextuel (ex: "Combien de squatts ?") */
  challengeTitle?: string;
  /** Type de défi (counter ou timer) — pour adapter le texte de résultat */
  challengeType?: "counter" | "timer";
  /** Label du défi (ex: "Voix de Stitch") — pour le texte de résultat */
  challengeLabel?: string;
}

interface DiceRollOverlayProps {
  data: DiceRollData;
  /** Duree d'affichage du resultat en ms (configurable via admin) */
  displayDuration?: number;
  onDone: () => void;
}

const DEFAULT_DISPLAY_DURATION = 3000;

/** Preload les images dans le cache navigateur */
function preloadImages(urls: string[]): Promise<void> {
  return new Promise((resolve) => {
    let loaded = 0;
    if (urls.length === 0) { resolve(); return; }
    urls.forEach((url) => {
      const img = new Image();
      img.onload = img.onerror = () => {
        loaded++;
        if (loaded >= urls.length) resolve();
      };
      img.src = url;
    });
  });
}

/** Texte de résultat contextuel selon le type de défi */
function getResultText(data: DiceRollData): string {
  // Roue de gains (nat 20)
  if (data.isNat20) {
    return "ROUE DE GAINS !";
  }
  // Dé de roue sans nat 20
  if (data.dieType === "wheel") {
    return `${data.result}/${data.faces} — Pas de roue cette fois !`;
  }
  // Timer → affiche en minutes
  if (data.challengeType === "timer") {
    const label = data.challengeLabel ?? "défi";
    return `${data.result} min de ${label} !`;
  }
  // Counter → affiche le nombre
  if (data.challengeType === "counter") {
    const label = data.challengeLabel?.toLowerCase() ?? "défis";
    return `${data.result} ${label} pour Kavaliero !`;
  }
  // Fallback (pas de contexte challenge)
  return `${data.result} !`;
}

/** Titre affiché sur l'overlay du dé — utilise le titre contextuel si disponible */
function getDiceTitle(data: DiceRollData): string {
  if (data.challengeTitle) return data.challengeTitle;
  // Fallback sur le tier si pas de titre contextuel
  switch (data.tier) {
    case "follow": return "Dé de follower";
    case "sub": return "Dé d'abonné";
    case "raid": return "Dé de raideur";
    default: return "Dé";
  }
}

/**
 * Lance le cycle d'images : rapide au debut, ralentit, puis appelle onDone.
 * Retourne une fonction cancel.
 */
function startTumbleCycle(
  imgEl: HTMLImageElement,
  faces: number,
  color: string,
  finalResult: number,
  onDone: () => void
): () => void {
  let cancelled = false;
  const TOTAL_STEPS = 12;
  // Durees : 50ms au debut → ~300ms a la fin (easing quadratique)
  const durations: number[] = [];
  for (let i = 0; i < TOTAL_STEPS; i++) {
    const t = i / (TOTAL_STEPS - 1); // 0 → 1
    durations.push(Math.round(50 + t * t * 250));
  }

  let step = 0;
  let lastFace = -1;

  function tick() {
    if (cancelled) return;

    if (step < TOTAL_STEPS) {
      // Face aleatoire (eviter la meme deux fois)
      let face = getRandomFace(faces);
      while (face === lastFace) face = getRandomFace(faces);
      lastFace = face;

      imgEl.src = getDiceImagePath(faces, color as any, face);
      step++;
      setTimeout(tick, durations[step - 1]);
    } else {
      // Derniere image = le vrai resultat
      imgEl.src = getDiceImagePath(faces, color as any, finalResult);
      onDone();
    }
  }

  tick();
  return () => { cancelled = true; };
}

export function DiceRollOverlay({ data, displayDuration, onDone }: DiceRollOverlayProps) {
  const DISPLAY_DURATION = displayDuration ?? DEFAULT_DISPLAY_DURATION;
  const containerRef = useRef<HTMLDivElement>(null);
  const diceImgRef = useRef<HTMLImageElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const color = getDiceColor(data.tier);

  // Pre-calculer les URLs a preload : toutes les faces possibles de ce de + couleur
  const allFaceUrls = useRef(
    Array.from({ length: data.faces }, (_, i) =>
      getDiceImagePath(data.faces, color, i + 1)
    )
  );

  useEffect(() => {
    const el = containerRef.current;
    const diceEl = diceImgRef.current;
    const resultEl = resultRef.current;
    if (!el || !diceEl || !resultEl) return;

    // ── Flag aborted : empêche les promises stale (React StrictMode double-mount) ──
    let aborted = false;
    let onDoneFired = false;
    let tl: gsap.core.Timeline | null = null;
    let cancelTumble: (() => void) | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    /** Appelle onDone une seule fois, même si plusieurs chemins y arrivent */
    function fireOnDone() {
      if (onDoneFired || aborted) return;
      onDoneFired = true;
      if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
      console.log(`[DiceOverlay] ✅ onDone fired for d${data.faces} → ${data.result}`);
      onDone();
    }

    // Fallback : si l'animation ne termine jamais, forcer onDone
    // (revealDelay + displayDuration + exitDuration + marge de 4s)
    const maxAnimTime = 2500 + DISPLAY_DURATION + 500 + 4000;
    fallbackTimer = setTimeout(() => {
      if (!onDoneFired && !aborted) {
        console.warn(`[DiceOverlay] ⚠️ Fallback timeout (${maxAnimTime}ms) — force onDone pour d${data.faces}`);
        fireOnDone();
      }
    }, maxAnimTime);

    console.log(`[DiceOverlay] 🎬 Mount d${data.faces} → ${data.result} (preloading ${allFaceUrls.current.length} images)`);

    // Preload TOUTES les faces de ce de/couleur, puis go
    preloadImages(allFaceUrls.current).then(() => {
      // ── Guard StrictMode : si cleanup a déjà run, ignorer cette promise stale ──
      if (aborted) {
        console.log(`[DiceOverlay] 🚫 Preload résolu mais aborted (StrictMode cleanup) — ignoré`);
        return;
      }
      if (!containerRef.current) return;

      console.log(`[DiceOverlay] 🖼️ Preload terminé pour d${data.faces}, lancement animation`);

      // Premiere image
      diceEl.src = getDiceImagePath(data.faces, color, getRandomFace(data.faces));

      // Son
      playDiceRollSound(data.faces);

      // ── Phase 1 : Container apparait ──
      tl = gsap.timeline();

      tl.fromTo(
        el,
        { opacity: 0, scale: 0.8 },
        { opacity: 1, scale: 1, duration: 0.25, ease: "power2.out" }
      );

      // ── Phase 2 : Tumble (setTimeout, pas GSAP) ──
      // On lance le cycle APRES le fade-in
      tl.call(() => {
        if (aborted) return;
        cancelTumble = startTumbleCycle(
          diceEl,
          data.faces,
          color,
          data.result,
          () => {
            if (aborted) return;
            // ── Phase 3 : Resultat atterri ──
            // Petit rebond sur l'image finale
            gsap.fromTo(
              diceEl,
              { scale: 1.15, y: -8 },
              {
                scale: 1,
                y: 0,
                duration: 0.35,
                ease: "bounce.out",
                onComplete: () => {
                  if (aborted) return;
                  // ── Phase 4 : Texte resultat ──
                  gsap.fromTo(
                    resultEl,
                    { opacity: 0, y: 15 },
                    {
                      opacity: 1,
                      y: 0,
                      duration: 0.3,
                      ease: "power2.out",
                      onComplete: () => {
                        if (aborted) return;
                        // ── Phase 5 : Effets speciaux ──
                        if (data.isNat20) {
                          gsap.to(el, {
                            boxShadow: "0 0 60px rgba(255, 215, 0, 0.9), 0 0 120px rgba(255, 215, 0, 0.4)",
                            duration: 0.3,
                            yoyo: true,
                            repeat: 4,
                          });
                          gsap.to(diceEl, {
                            scale: 1.2,
                            filter: "drop-shadow(0 0 20px rgba(255, 215, 0, 0.8))",
                            duration: 0.25,
                            yoyo: true,
                            repeat: 3,
                          });
                        }

                        if (data.dieType === "squatt" && data.result > 3) {
                          gsap.to(el, {
                            x: 5,
                            duration: 0.05,
                            yoyo: true,
                            repeat: Math.min(data.result, 10) - 1,
                          });
                        }

                        // ── Phase 6 : Sortie ──
                        gsap.to(el, {
                          opacity: 0,
                          scale: 0.5,
                          y: -50,
                          duration: 0.5,
                          ease: "power2.in",
                          delay: DISPLAY_DURATION / 1000,
                          onComplete: fireOnDone,
                        });
                      },
                    }
                  );
                },
              }
            );
          }
        );
      });
    });

    return () => {
      console.log(`[DiceOverlay] 🧹 Cleanup d${data.faces} → ${data.result} (aborted=${aborted})`);
      aborted = true;
      if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
      if (tl) tl.kill();
      if (cancelTumble) cancelTumble();
      gsap.killTweensOf(el);
      gsap.killTweensOf(diceEl);
      gsap.killTweensOf(resultEl);
    };
  }, []);

  const isSquatt = data.dieType === "squatt";

  return (
    <div
      ref={containerRef}
      className={`dice-roll ${data.isNat20 ? "dice-roll--nat20" : ""} ${isSquatt ? "dice-roll--squatt" : "dice-roll--wheel"} dice-roll--${color}`}
      style={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="dice-roll-header">
        <span className="dice-roll-viewer">{data.displayName}</span>
        <span className="dice-roll-tier">{getDiceTitle(data)}</span>
      </div>

      {/* De avec image */}
      <div className="dice-roll-die">
        <img
          ref={diceImgRef}
          className="dice-roll-die-img"
          src={getDiceImagePath(data.faces, color, 1)}
          alt={`d${data.faces}`}
          draggable={false}
        />
        <span className="dice-roll-die-faces">d{data.faces}</span>
      </div>

      {/* Resultat (hidden until animation reveals it) */}
      <div
        ref={resultRef}
        className={`dice-roll-result ${data.isNat20 ? "dice-roll-result--nat20" : ""}`}
        style={{ opacity: 0 }}
      >
        <span className="dice-roll-result-number">{data.result}</span>
        <span className="dice-roll-result-text">{getResultText(data)}</span>
      </div>
    </div>
  );
}
