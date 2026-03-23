/**
 * ChallengeListOverlay — Liste des defis actifs avec animations GSAP.
 *
 * Chaque defi a :
 *   - Une barre de progression (counter ET timer)
 *   - Un texte de valeur ("5 / 20" ou "01:42")
 *   - Animation d'entree : slide depuis la droite + fade in
 *   - Animation de sortie : flash dore + scale down + fade out
 *   - Animation update : pulse sur la barre quand ca change
 */

import { useRef, useEffect } from "react";
import gsap from "gsap";
import type { ChallengeWithState } from "../../pages/ChallengePage";
import "./challenges.css";

interface Props {
  challenges: ChallengeWithState[];
}

/** Formate des secondes en MM:SS */
function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/** Calcule le temps restant pour un timer en cours */
function getTimerRemaining(challenge: ChallengeWithState): number {
  if (challenge.type !== "timer") return challenge.current;
  if (challenge.isRunning && challenge.startedAt) {
    const elapsed = Math.floor(
      (Date.now() - new Date(challenge.startedAt).getTime()) / 1000
    );
    return Math.max(0, challenge.current - elapsed);
  }
  return challenge.current;
}

/** Calcule le pourcentage de progression d'un timer */
function getTimerProgress(challenge: ChallengeWithState): number {
  if (challenge.target <= 0) return 0;
  const remaining = getTimerRemaining(challenge);
  const elapsed = challenge.target - remaining;
  return Math.min(100, (elapsed / challenge.target) * 100);
}

function ChallengeItem({ challenge }: { challenge: ChallengeWithState }) {
  const itemRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const timerBarRef = useRef<HTMLDivElement>(null);
  const prevCurrentRef = useRef(challenge.current);
  const prevTargetRef = useRef(challenge.target);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const displayRef = useRef<HTMLSpanElement>(null);
  const inlineDisplayRef = useRef<HTMLSpanElement>(null);
  const hasAnimatedEntry = useRef(false);
  const hasAnimatedExit = useRef(false);

  // Animation d'entree (une seule fois)
  useEffect(() => {
    if (!itemRef.current || hasAnimatedEntry.current) return;
    hasAnimatedEntry.current = true;
    gsap.fromTo(
      itemRef.current,
      { x: 80, opacity: 0, scale: 0.85 },
      {
        x: 0,
        opacity: 1,
        scale: 1,
        duration: 0.6,
        ease: "back.out(1.4)",
      }
    );
  }, []);

  // Animation de sortie
  useEffect(() => {
    if (!challenge._exiting || !itemRef.current || hasAnimatedExit.current) return;
    hasAnimatedExit.current = true;

    const el = itemRef.current;
    const tl = gsap.timeline();

    // Flash dore → shrink → fade out
    tl.to(el, {
      borderColor: "rgba(212, 168, 67, 1)",
      boxShadow: "0 0 20px rgba(212, 168, 67, 0.8), inset 0 0 10px rgba(212, 168, 67, 0.3)",
      duration: 0.15,
    })
    .to(el, {
      scale: 1.05,
      duration: 0.1,
      ease: "power2.out",
    })
    .to(el, {
      x: 80,
      opacity: 0,
      scale: 0.7,
      height: 0,
      padding: 0,
      marginBottom: 0,
      duration: 0.45,
      ease: "power3.in",
    });
  }, [challenge._exiting]);

  // Animation pulse quand le current ou target change (counter)
  useEffect(() => {
    if (challenge.type !== "counter") return;
    const changed = challenge.current !== prevCurrentRef.current
      || challenge.target !== prevTargetRef.current;
    if (changed && barRef.current) {
      gsap.fromTo(
        barRef.current,
        { scaleY: 1.3 },
        { scaleY: 1, duration: 0.4, ease: "elastic.out(1, 0.5)" }
      );
    }
    prevCurrentRef.current = challenge.current;
    prevTargetRef.current = challenge.target;
  }, [challenge.current, challenge.target, challenge.type]);

  // Timer : decompte local pour fluidite + mise a jour barre
  useEffect(() => {
    if (challenge.type !== "timer") return;

    function tick() {
      const remaining = getTimerRemaining(challenge);
      const formatted = formatTime(remaining);
      if (displayRef.current) {
        displayRef.current.textContent = formatted;
      }
      // Le header inline affiche le target total (pas le remaining)
      // On le met à jour uniquement si le target change (ajout de temps)
      if (inlineDisplayRef.current) {
        inlineDisplayRef.current.textContent = formatTime(challenge.target);
      }
      // Mettre a jour la barre de progression du timer
      if (timerBarRef.current && challenge.target > 0) {
        const elapsed = challenge.target - remaining;
        const pct = Math.min(100, (elapsed / challenge.target) * 100);
        timerBarRef.current.style.width = `${pct}%`;
      }
    }

    tick(); // Afficher immediatement

    if (challenge.isRunning) {
      timerRef.current = setInterval(tick, 250); // 4x/sec pour fluidite barre
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [challenge]);

  const isCounter = challenge.type === "counter";
  const counterProgress = isCounter && challenge.target > 0
    ? (challenge.current / challenge.target) * 100
    : 0;

  const initialRemaining = getTimerRemaining(challenge);
  const timerProgress = !isCounter ? getTimerProgress(challenge) : 0;

  return (
    <div
      ref={itemRef}
      className={`challenge-item challenge-${challenge.type}${
        challenge.isRunning ? " challenge-running" : ""
      }${challenge._exiting ? " challenge-exiting" : ""}`}
    >
      <div className="challenge-header">
        {challenge.icon && (
          <span className="challenge-icon">{challenge.icon}</span>
        )}
        <span className="challenge-label">{challenge.label}</span>
        <span className="challenge-value-inline" ref={isCounter ? undefined : inlineDisplayRef}>
          {isCounter
            ? `${challenge.current} / ${challenge.target}`
            : formatTime(challenge.target)
          }
        </span>
      </div>

      {/* Barre de progression commune aux deux types */}
      <div className="challenge-bar-bg">
        <div
          ref={isCounter ? barRef : timerBarRef}
          className={`challenge-bar-fill${!isCounter ? " challenge-bar-timer" : ""}`}
          style={{ width: `${Math.min(isCounter ? counterProgress : timerProgress, 100)}%` }}
        />
      </div>

      {/* Info supplementaire pour les timers */}
      {!isCounter && (
        <div className="challenge-timer-info">
          <span ref={displayRef} className="challenge-time">
            {formatTime(initialRemaining)}
          </span>
          {!challenge.isRunning && challenge.current > 0 && (
            <span className="challenge-paused">EN PAUSE</span>
          )}
        </div>
      )}
    </div>
  );
}

export function ChallengeListOverlay({ challenges }: Props) {
  return (
    <div className="challenge-list">
      {challenges.map((c) => (
        <ChallengeItem key={c.id} challenge={c} />
      ))}
    </div>
  );
}
