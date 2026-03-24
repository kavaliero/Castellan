/**
 * ChallengeRollOverlay — Animation de défi de channel points.
 *
 * Séquence :
 * 1. Fond sombre semi-transparent apparaît
 * 2. Bannière dorée descend avec "DÉFIS : {label}"
 * 3. Photo de profil (taille fixe 120px) + nom du viewer apparaissent au centre
 * 4. Photo fait un dash rapide vers la droite et revient
 * 5. Dé apparaît à côté de la photo (pas de rétrécissement)
 * 6. Cycle tumble → résultat avec rebond
 * 7. Texte de résultat sous le dé
 * 8. Sortie : tout s'envole, fond disparaît
 *
 * Portal injecté sur document.body pour échapper au containing block.
 *
 * Browser source OBS : http://localhost:3000/overlay/alerts
 */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import {
  getDiceImagePath,
  getRandomFace,
  playDiceRollSound,
  playChallengeSound,
  stopChallengeSound,
} from "../dice/diceAssets";
import type { DiceColor } from "../dice/diceAssets";

export interface ChallengeAnimationTimings {
  bannerDelay: number;
  bannerDuration: number;
  viewerAppearDelay: number;
  viewerAppearDuration: number;
  diceAppearDelay: number;
  diceRollDelay: number;
  displayDuration: number;
  exitDuration: number;
}

const DEFAULT_TIMINGS: ChallengeAnimationTimings = {
  bannerDelay: 100,
  bannerDuration: 600,
  viewerAppearDelay: 600,
  viewerAppearDuration: 400,
  diceAppearDelay: 1800,
  diceRollDelay: 2000,
  displayDuration: 4000,
  exitDuration: 500,
};

export interface ChallengeRollData {
  viewerName: string;
  challengeName: string;
  challengeLabel: string;
  challengeType: "counter" | "timer";
  challengeIcon: string;
  challengeTitle: string;
  faces: number;
  result: number;
  amount: number;
  profileImageUrl: string | null;
  timings?: ChallengeAnimationTimings;
}

interface ChallengeRollOverlayProps {
  data: ChallengeRollData;
  onDone: () => void;
}

/** Couleur du dé pour les channel points */
const CHALLENGE_DICE_COLOR: DiceColor = "purple";

/** Fallback : icône médiévale si pas de photo de profil */
const FALLBACK_AVATAR = "data:image/svg+xml," + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="48" fill="#3E2A08" stroke="#D4A843" stroke-width="3"/>
  <text x="50" y="62" text-anchor="middle" font-size="40" fill="#D4A843" font-family="serif">⚔</text>
</svg>
`);

/** Texte de résultat contextuel */
function getResultText(data: ChallengeRollData): string {
  if (data.challengeType === "timer") {
    return `${data.result} min de ${data.challengeLabel} !`;
  }
  return `${data.result} ${data.challengeLabel.toLowerCase()} pour Kavaliero !`;
}

/**
 * Lance le cycle d'images de dé : rapide au début, ralentit, puis appelle onReveal.
 */
function startTumbleCycle(
  imgEl: HTMLImageElement,
  faces: number,
  color: DiceColor,
  finalResult: number,
  onReveal: () => void
): () => void {
  let cancelled = false;
  const TOTAL_STEPS = 12;
  const durations: number[] = [];
  for (let i = 0; i < TOTAL_STEPS; i++) {
    const t = i / (TOTAL_STEPS - 1);
    durations.push(Math.round(50 + t * t * 250));
  }

  let step = 0;
  let lastFace = -1;

  function tick() {
    if (cancelled) return;
    if (step < TOTAL_STEPS) {
      let face = getRandomFace(faces);
      while (face === lastFace) face = getRandomFace(faces);
      lastFace = face;
      imgEl.src = getDiceImagePath(faces, color, face);
      step++;
      setTimeout(tick, durations[step - 1]);
    } else {
      imgEl.src = getDiceImagePath(faces, color, finalResult);
      onReveal();
    }
  }

  tick();
  return () => { cancelled = true; };
}

export function ChallengeRollOverlay({ data, onDone }: ChallengeRollOverlayProps) {
  const portalRef = useRef<HTMLDivElement | null>(null);
  const abortedRef = useRef(false);
  const onDoneFiredRef = useRef(false);

  useEffect(() => {
    abortedRef.current = false;
    onDoneFiredRef.current = false;

    // Timings configurables (depuis le payload WS ou defaults)
    const t = { ...DEFAULT_TIMINGS, ...data.timings };
    // Convertir en secondes pour GSAP
    const ts = {
      bannerDelay: t.bannerDelay / 1000,
      bannerDuration: t.bannerDuration / 1000,
      viewerAppearDelay: t.viewerAppearDelay / 1000,
      viewerAppearDuration: t.viewerAppearDuration / 1000,
      diceAppearDelay: t.diceAppearDelay / 1000,
      diceRollDelay: t.diceRollDelay / 1000,
      displayDuration: t.displayDuration / 1000,
      exitDuration: t.exitDuration / 1000,
    };
    // Dash timing = entre viewer appear et dice appear
    const dashDelay = ts.viewerAppearDelay + ts.viewerAppearDuration + 0.2;

    function fireOnDone() {
      if (onDoneFiredRef.current || abortedRef.current) return;
      onDoneFiredRef.current = true;
      onDone();
    }

    // Safety timeout
    const safetyTimer = setTimeout(() => {
      console.warn("[ChallengeRoll] Safety timeout — force onDone");
      fireOnDone();
    }, 20000);

    // ── Portal sur document.body ──
    const portal = document.createElement("div");
    portal.className = "challenge-roll-portal";
    portal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      pointer-events: none; z-index: 9998; overflow: hidden;
      font-family: 'Cinzel', serif;
    `;
    document.body.appendChild(portal);
    portalRef.current = portal;

    // ═══════════════════════════════════════════════════════════════
    // 0. FOND SOMBRE — visibilité du dé et de la photo
    // ═══════════════════════════════════════════════════════════════
    const backdrop = document.createElement("div");
    backdrop.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: radial-gradient(ellipse at center, rgba(20, 14, 8, 0.85) 0%, rgba(10, 7, 4, 0.65) 60%, rgba(0, 0, 0, 0.4) 100%);
      z-index: 9999; opacity: 0;
    `;
    portal.appendChild(backdrop);

    // ═══════════════════════════════════════════════════════════════
    // 1. BANNIÈRE — titre court "DÉFIS : {label}"
    // ═══════════════════════════════════════════════════════════════
    const banner = document.createElement("div");
    banner.style.cssText = `
      position: fixed; top: -200px; left: 50%; transform: translateX(-50%);
      width: 520px; pointer-events: none; z-index: 10000;
      display: flex; flex-direction: column; align-items: center;
    `;

    // Image de bannière
    const bannerImg = document.createElement("img");
    bannerImg.src = "/images/alerts/banner-follow.png";
    bannerImg.alt = "";
    bannerImg.draggable = false;
    bannerImg.style.cssText = `width: 100%; position: absolute; top: 0; left: 0; z-index: 0;`;
    bannerImg.onerror = () => {
      bannerImg.remove();
      const ribbon = document.createElement("div");
      ribbon.style.cssText = `
        position: absolute; top: 8px; left: 0; width: 100%; height: 120px;
        background: linear-gradient(180deg, #C49A2C 0%, #D4A843 30%, #E8C65A 50%, #D4A843 70%, #B8922E 100%);
        border-radius: 6px; border: 2px solid #8B6914;
        box-shadow: 0 4px 16px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,215,0,0.3); z-index: 0;
      `;
      banner.insertBefore(ribbon, banner.firstChild);
    };

    // Texte bannière — deux lignes : "DÉFIS" + label
    const textWrap = document.createElement("div");
    textWrap.style.cssText = `
      position: relative; z-index: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center; padding: 100px 20px 10px; width: 90%;
    `;

    // Ligne 1 : "⚔ DÉFIS"
    const titleLine1 = document.createElement("div");
    titleLine1.textContent = `${data.challengeIcon} DÉFIS`;
    titleLine1.style.cssText = `
      font-family: 'MedievalSharp', cursive; font-size: 20px; font-weight: 700;
      color: #3E2A08; text-align: center; letter-spacing: 3px;
      text-shadow: 0 1px 2px rgba(255,215,0,0.4); text-transform: uppercase;
    `;

    // Ligne 2 : label du défi (plus gros, accrocheur)
    const titleLine2 = document.createElement("div");
    titleLine2.textContent = data.challengeLabel.toUpperCase();
    titleLine2.style.cssText = `
      font-family: 'MedievalSharp', cursive; font-size: 26px; font-weight: 700;
      color: #1E150D; text-align: center; letter-spacing: 2px; margin-top: 2px;
      text-shadow: 0 1px 3px rgba(212,168,67,0.5); text-transform: uppercase;
    `;

    textWrap.appendChild(titleLine1);
    textWrap.appendChild(titleLine2);
    banner.appendChild(bannerImg);
    banner.appendChild(textWrap);
    portal.appendChild(banner);

    // ═══════════════════════════════════════════════════════════════
    // 2. ZONE CENTRALE — conteneur pour photo + dé côte à côte
    // ═══════════════════════════════════════════════════════════════
    const centerStage = document.createElement("div");
    centerStage.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      display: flex; flex-direction: row; align-items: center; gap: 30px;
      z-index: 10001; opacity: 0;
    `;
    portal.appendChild(centerStage);

    // ── Photo de profil (taille fixe 120px, ne rétrécit jamais) ──
    const avatarWrap = document.createElement("div");
    avatarWrap.style.cssText = `
      display: flex; flex-direction: column; align-items: center; gap: 8px;
    `;

    const avatarContainer = document.createElement("div");
    avatarContainer.style.cssText = `
      width: 120px; height: 120px; border-radius: 50%; overflow: hidden;
      border: 4px solid #D4A843; box-shadow: 0 0 30px rgba(212,168,67,0.5),
        0 0 60px rgba(212,168,67,0.2);
      flex-shrink: 0;
    `;

    const avatarImg = document.createElement("img");
    avatarImg.src = data.profileImageUrl || FALLBACK_AVATAR;
    avatarImg.alt = data.viewerName;
    avatarImg.draggable = false;
    avatarImg.style.cssText = `width: 100%; height: 100%; object-fit: cover;`;
    avatarImg.onerror = () => { avatarImg.src = FALLBACK_AVATAR; };

    // Nom du viewer sous la photo
    const viewerNameEl = document.createElement("div");
    viewerNameEl.textContent = data.viewerName;
    viewerNameEl.style.cssText = `
      font-family: 'Cinzel', serif; font-size: 16px; font-weight: 700;
      color: #D4A843; text-align: center; text-shadow: 0 1px 4px rgba(0,0,0,0.8),
        0 0 12px rgba(212,168,67,0.4);
      white-space: nowrap;
    `;

    avatarContainer.appendChild(avatarImg);
    avatarWrap.appendChild(avatarContainer);
    avatarWrap.appendChild(viewerNameEl);
    centerStage.appendChild(avatarWrap);

    // ── Dé (à droite de la photo, même hauteur) ──
    const diceContainer = document.createElement("div");
    diceContainer.style.cssText = `
      width: 140px; height: 140px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      position: relative; opacity: 0;
    `;

    const diceImg = document.createElement("img");
    diceImg.src = getDiceImagePath(data.faces, CHALLENGE_DICE_COLOR, 1);
    diceImg.alt = `d${data.faces}`;
    diceImg.draggable = false;
    diceImg.style.cssText = `width: 100%; height: 100%; object-fit: contain;`;

    const diceFacesLabel = document.createElement("div");
    diceFacesLabel.textContent = `d${data.faces}`;
    diceFacesLabel.style.cssText = `
      position: absolute; bottom: -5px; right: -5px;
      font-family: 'MedievalSharp', cursive; font-size: 14px; color: #D4A843;
      background: rgba(30, 21, 13, 0.9); padding: 2px 8px; border-radius: 8px;
      border: 1px solid #D4A843;
    `;

    diceContainer.appendChild(diceImg);
    diceContainer.appendChild(diceFacesLabel);
    centerStage.appendChild(diceContainer);

    // ═══════════════════════════════════════════════════════════════
    // 3. RÉSULTAT (texte sous la zone centrale)
    // ═══════════════════════════════════════════════════════════════
    const resultContainer = document.createElement("div");
    resultContainer.style.cssText = `
      position: fixed; top: calc(50% + 120px); left: 50%; transform: translateX(-50%);
      z-index: 10003; opacity: 0; text-align: center; width: 500px;
    `;

    const resultNumber = document.createElement("div");
    resultNumber.textContent = String(data.result);
    resultNumber.style.cssText = `
      font-family: 'MedievalSharp', cursive; font-size: 56px; font-weight: 700;
      color: #D4A843; text-shadow: 0 0 20px rgba(212,168,67,0.6), 0 2px 4px rgba(0,0,0,0.5);
    `;

    const resultText = document.createElement("div");
    resultText.textContent = getResultText(data);
    resultText.style.cssText = `
      font-family: 'Cinzel', serif; font-size: 18px; color: #F5E6C8;
      text-shadow: 0 1px 4px rgba(0,0,0,0.8); margin-top: 4px;
    `;

    resultContainer.appendChild(resultNumber);
    resultContainer.appendChild(resultText);
    portal.appendChild(resultContainer);

    // ═══════════════════════════════════════════════════════════════
    // TIMELINE D'ANIMATION (timings configurables via admin)
    // ═══════════════════════════════════════════════════════════════

    const tl = gsap.timeline();
    let cancelTumble: (() => void) | null = null;
    let heartbeatAudio: HTMLAudioElement | null = null;

    // Phase 0 : Fond sombre fade-in + son de cor
    tl.to(backdrop, {
      opacity: 1,
      duration: 0.3,
      ease: "power2.out",
    }, 0);

    tl.call(() => {
      if (abortedRef.current) return;
      playChallengeSound("horn", 0.7);
    }, undefined, undefined, 0);

    // Phase 1 : Bannière descend (bounce)
    tl.to(banner, {
      top: "20px",
      duration: ts.bannerDuration,
      ease: "bounce.out",
    }, ts.bannerDelay);

    // Phase 2 : Zone centrale (photo + nom) apparaît
    tl.to(centerStage, {
      opacity: 1,
      duration: 0.3,
      ease: "power2.out",
    }, ts.viewerAppearDelay);

    // Scale-in de la photo
    tl.fromTo(avatarWrap, {
      scale: 0.5,
    }, {
      scale: 1,
      duration: ts.viewerAppearDuration,
      ease: "back.out(1.7)",
    }, ts.viewerAppearDelay);

    // Phase 3 : Dash vers la droite rapide + retour (sur toute la zone)
    tl.to(centerStage, {
      x: 120,
      duration: 0.15,
      ease: "power3.out",
    }, dashDelay);

    tl.to(centerStage, {
      x: 0,
      duration: 0.25,
      ease: "power2.inOut",
    }, dashDelay + 0.15);

    // Phase 4 : Le dé apparaît à droite de la photo + heartbeat en boucle
    tl.to(diceContainer, {
      opacity: 1,
      duration: 0.3,
      ease: "power2.out",
    }, ts.diceAppearDelay);

    tl.fromTo(diceContainer, {
      scale: 0.3,
    }, {
      scale: 1,
      duration: 0.4,
      ease: "back.out(1.7)",
    }, ts.diceAppearDelay);

    tl.call(() => {
      if (abortedRef.current) return;
      heartbeatAudio = playChallengeSound("heartbeat", 0.6, true);
    }, undefined, undefined, ts.diceAppearDelay);

    // Phase 5 : Lancer le tumble du dé + sons (dice roll + heartbeat)
    tl.call(() => {
      if (abortedRef.current) return;
      playDiceRollSound(data.faces, 0.5);
      cancelTumble = startTumbleCycle(
        diceImg,
        data.faces,
        CHALLENGE_DICE_COLOR,
        data.result,
        () => {
          if (abortedRef.current) return;

          // Stop heartbeat en fade-out
          if (heartbeatAudio) {
            stopChallengeSound(heartbeatAudio, 400);
            heartbeatAudio = null;
          }

          // Rebond sur l'image finale
          gsap.fromTo(diceImg, { scale: 1.2, y: -10 }, {
            scale: 1, y: 0, duration: 0.35, ease: "bounce.out",
            onComplete: () => {
              if (abortedRef.current) return;

              // Phase 6 : Résultat apparaît + rire thriller
              playChallengeSound("reveal", 0.8);

              gsap.to(resultContainer, {
                opacity: 1, y: 0, duration: 0.3, ease: "power2.out",
              });

              gsap.fromTo(resultNumber, { scale: 0.5 }, {
                scale: 1, duration: 0.4, ease: "back.out(2)",
              });

              // Shake si gros résultat (counter > 6, ou timer > 3)
              const isHighRoll = data.challengeType === "counter"
                ? data.result >= 6
                : data.result >= 3;

              if (isHighRoll) {
                gsap.to(diceContainer, {
                  x: 4, duration: 0.04, yoyo: true,
                  repeat: Math.min(data.result, 8),
                });
              }

              // Phase 7 : Sortie après displayDuration
              gsap.delayedCall(ts.displayDuration, () => {
                if (abortedRef.current) return;

                const exitTl = gsap.timeline({ onComplete: () => {
                  portal.remove();
                  fireOnDone();
                }});

                // Bannière remonte
                exitTl.to(banner, {
                  top: "-200px", duration: ts.exitDuration, ease: "power2.in",
                }, 0);

                // Zone centrale + résultat fade out vers le haut
                exitTl.to([centerStage, resultContainer], {
                  opacity: 0, y: -40, duration: ts.exitDuration, ease: "power2.in",
                  stagger: 0.05,
                }, 0.1);

                // Fond sombre disparaît
                exitTl.to(backdrop, {
                  opacity: 0, duration: ts.exitDuration + 0.1, ease: "power2.in",
                }, 0.2);
              });
            },
          });
        }
      );
    }, undefined, undefined, ts.diceRollDelay);

    return () => {
      abortedRef.current = true;
      clearTimeout(safetyTimer);
      tl.kill();
      if (cancelTumble) cancelTumble();
      // Cleanup heartbeat si encore en cours
      if (heartbeatAudio) {
        heartbeatAudio.pause();
        heartbeatAudio = null;
      }
      if (portalRef.current) {
        gsap.killTweensOf(portalRef.current.querySelectorAll("*"));
        portalRef.current.remove();
      }
    };
  }, []);

  // Pas de rendu React — tout est dans le portal DOM
  return null;
}
