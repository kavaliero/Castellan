/**
 * trumpet-follow — Animation de follow style Shrek (fanfare de trompettes).
 *
 * Reference : Shrek 2 — Hawaii Five-O trumpet scene.
 *
 * Orientation des trompettes (comme dans le mockup) :
 * - Gauche : pavillon pointe vers la DROITE, embouchure depasse du bord gauche
 * - Droite : pavillon pointe vers la GAUCHE, embouchure depasse du bord droit
 * - Toutes sont legerement inclinées vers le haut (angle configurable)
 *
 * Sequence :
 * 1. 3 rangees de trompettes (bas, milieu, haut) glissent depuis les bords
 * 2. Banderole dorée tombe d'en haut
 * 3. Les trompettes RESTENT — seule la banderole part au exit
 *
 * Tous les elements sont injectes dans un portal sur document.body
 * pour contourner le containing block de .alerts-page.
 *
 * Config admin (tout paramétrable) :
 * - trumpet.rows : quelles rangees afficher
 * - trumpet.size : taille des trompettes (px)
 * - trumpet.angle : inclinaison vers le haut (degres)
 * - trumpet.pairStagger : delai entre rangees (s)
 * - trumpet.slideDuration : duree du slide (s)
 * - trumpet.bannerDelay : delai avant la banderole (s)
 */

import { gsap } from "gsap";
import type { AnimationModule, ScrollAlertAnimationData } from "../types";

// ═══════════════════════════════════════════════════════════════
// DEFAULTS (utilises si pas de config admin)
// ═══════════════════════════════════════════════════════════════

const DEFAULTS = {
  size: 250,
  angle: 15,
  pairStagger: 0.8,
  slideDuration: 0.7,
  bannerDelay: 0.3,
  bannerStayDuration: 6,
};

/** Rangees disponibles (de bas en haut) */
type RowName = "bottom" | "middle" | "top";
const ROW_ORDER: RowName[] = ["bottom", "middle", "top"];

/** Position Y de chaque rangee (% depuis le bas du viewport) */
const ROW_BOTTOM_POSITIONS: Record<RowName, number> = {
  bottom: 12,
  middle: 33,
  top: 54,
};

// ═══════════════════════════════════════════════════════════════
// HELPERS — Creation d'elements
// ═══════════════════════════════════════════════════════════════

/**
 * Cree une trompette.
 * - side="left" : pavillon pointe vers la DROITE (image telle quelle)
 *   → embouchure cote gauche (depasse du bord gauche)
 * - side="right" : pavillon pointe vers la GAUCHE (image mirrored)
 *   → embouchure cote droit (depasse du bord droit)
 */
function createTrumpet(side: "left" | "right", size: number, angle: number): HTMLElement {
  const height = Math.round(size * 0.55);
  const wrapper = document.createElement("div");
  wrapper.className = `trumpet-follow-trumpet trumpet-follow-trumpet--${side}`;

  // Rotation : gauche = angle positif (bout gauche en bas, pavillon droite en haut)
  //            droite = angle negatif (mirror)
  const rotation = side === "left" ? -angle : angle;

  wrapper.style.cssText = `
    position: fixed;
    width: ${size}px;
    height: ${height}px;
    pointer-events: none;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    transform: rotate(${rotation}deg);
  `;

  // Image PNG (asset principal)
  const img = document.createElement("img");
  img.src = "/images/alerts/trumpet.png";
  img.alt = "";
  img.draggable = false;
  img.style.cssText = `
    width: 100%;
    height: 100%;
    object-fit: contain;
    ${side === "right" ? "transform: scaleX(-1);" : ""}
  `;

  // Fallback SVG
  img.onerror = () => {
    img.remove();
    const uid = `tg-${side}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 200 60");
    svg.style.cssText = `width: 100%; height: 100%; ${side === "right" ? "transform: scaleX(-1);" : ""}`;
    svg.innerHTML = `
      <defs>
        <linearGradient id="${uid}" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#B8922E"/>
          <stop offset="50%" style="stop-color:#D4A843"/>
          <stop offset="100%" style="stop-color:#FFD700"/>
        </linearGradient>
      </defs>
      <rect x="10" y="22" width="140" height="16" rx="8" fill="url(#${uid})" stroke="#8B6914" stroke-width="1"/>
      <ellipse cx="170" cy="30" rx="28" ry="24" fill="url(#${uid})" stroke="#8B6914" stroke-width="1.5"/>
      <ellipse cx="170" cy="30" rx="18" ry="16" fill="#1E150D" opacity="0.6"/>
      <polygon points="60,22 60,2 110,12" fill="#8B1A1A" stroke="#D4A843" stroke-width="1"/>
    `;
    wrapper.appendChild(svg);
  };

  wrapper.appendChild(img);
  return wrapper;
}

/** Cree la banderole dorée avec le texte */
function createBanner(data: ScrollAlertAnimationData): HTMLElement {
  const banner = document.createElement("div");
  banner.className = "trumpet-follow-banner";
  banner.style.cssText = `
    position: fixed;
    top: -250px;
    left: 50%;
    transform: translateX(-50%);
    width: 500px;
    pointer-events: none;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    align-items: center;
  `;

  // Image de banderole (asset principal)
  const bannerImg = document.createElement("img");
  bannerImg.src = "/images/alerts/banner-follow.png";
  bannerImg.alt = "";
  bannerImg.draggable = false;
  bannerImg.style.cssText = `
    width: 100%;
    position: absolute;
    top: 0;
    left: 0;
    z-index: 0;
  `;

  // Fallback CSS ribbon
  bannerImg.onerror = () => {
    bannerImg.remove();
    const ribbon = document.createElement("div");
    ribbon.style.cssText = `
      position: absolute; top: 8px; left: 0; width: 100%; height: 130px;
      background: linear-gradient(180deg, #C49A2C 0%, #D4A843 30%, #E8C65A 50%, #D4A843 70%, #B8922E 100%);
      border-radius: 6px; border: 2px solid #8B6914;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,215,0,0.3);
      z-index: 0;
    `;
    const leftTail = document.createElement("div");
    leftTail.style.cssText = `position: absolute; left: -16px; top: 12px; width: 0; height: 0;
      border-top: 52px solid transparent; border-bottom: 52px solid transparent;
      border-right: 20px solid #B8922E; z-index: -1;`;
    const rightTail = document.createElement("div");
    rightTail.style.cssText = `position: absolute; right: -16px; top: 12px; width: 0; height: 0;
      border-top: 52px solid transparent; border-bottom: 52px solid transparent;
      border-left: 20px solid #B8922E; z-index: -1;`;
    ribbon.appendChild(leftTail);
    ribbon.appendChild(rightTail);
    banner.insertBefore(ribbon, banner.firstChild);
  };

  // Texte
  const textWrap = document.createElement("div");
  textWrap.style.cssText = `
    position: relative; z-index: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center; padding: 100px 30px 15px; width: 70%;
  `;

  const titleEl = document.createElement("div");
  titleEl.textContent = data.title;
  titleEl.style.cssText = `
    font-family: 'MedievalSharp', cursive; font-size: 18px; font-weight: 700;
    color: #3E2A08; text-align: center; letter-spacing: 3px;
    text-shadow: 0 1px 2px rgba(255,215,0,0.4); margin-bottom: 4px;
    text-transform: uppercase;
  `;

  // Ligne 2 : viewerName (toujours affiche si dispo)
  const nameEl = document.createElement("div");
  nameEl.textContent = data.viewerName ?? "";
  nameEl.style.cssText = `
    font-family: 'Cinzel', serif; font-size: 16px; font-weight: 700;
    color: #1E150D; text-align: center;
    text-shadow: 0 1px 3px rgba(212,168,67,0.5);
    margin-bottom: 2px;
  `;

  // Ligne 3 : subtitle (optionnel, plus petit)
  const subtitleEl = document.createElement("div");
  subtitleEl.textContent = data.subtitle ?? "";
  subtitleEl.style.cssText = `
    font-family: 'Cinzel', serif; font-size: 12px; font-weight: 600;
    color: #5C3D10; text-align: center;
    text-shadow: 0 1px 2px rgba(212,168,67,0.3);
    font-style: italic;
  `;

  textWrap.appendChild(titleEl);
  if (data.viewerName) textWrap.appendChild(nameEl);
  if (data.subtitle) textWrap.appendChild(subtitleEl);
  banner.appendChild(bannerImg);
  banner.appendChild(textWrap);

  return banner;
}

// ═══════════════════════════════════════════════════════════════
// MODULE
// ═══════════════════════════════════════════════════════════════

export const trumpetFollowModule: AnimationModule = {

  enter(container: HTMLElement, data: ScrollAlertAnimationData): gsap.core.Timeline {
    const tl = gsap.timeline();

    // Cacher le parchemin et le sceau
    const parchment = container.querySelector(".scroll-parchment") as HTMLElement;
    const seal = container.querySelector(".scroll-seal") as HTMLElement;
    if (parchment) gsap.set(parchment, { display: "none" });
    if (seal) gsap.set(seal, { display: "none" });

    // ── Lire la config (avec fallback defaults) ──
    const cfg = data.trumpet;
    const size = cfg?.size ?? DEFAULTS.size;
    const angle = cfg?.angle ?? DEFAULTS.angle;
    const pairStagger = cfg?.pairStagger ?? DEFAULTS.pairStagger;
    const slideDuration = cfg?.slideDuration ?? DEFAULTS.slideDuration;
    const bannerDelay = cfg?.bannerDelay ?? DEFAULTS.bannerDelay;
    const rowConfig = cfg?.rows ?? { bottom: true, middle: true, top: true };

    // ── Portal sur document.body ──
    const portal = document.createElement("div");
    portal.className = "trumpet-follow-portal";
    portal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      pointer-events: none; z-index: 9998; overflow: visible;
    `;
    document.body.appendChild(portal);

    // ── Rangees actives ──
    const activeRows = ROW_ORDER.filter((r) => rowConfig[r]);

    // ── Creer les trompettes ──
    const trumpets: HTMLElement[] = [];
    // Le bout de la trompette (embouchure) doit depasser du bord
    // → position initiale : bien hors ecran
    // → position finale : decalage negatif pour que ~30% depasse
    const overshoot = Math.round(size * 0.3); // portion qui depasse du bord

    for (let i = 0; i < activeRows.length; i++) {
      const row = activeRows[i];
      const bottomPct = ROW_BOTTOM_POSITIONS[row];

      // Trompette gauche : pavillon → droite, embouchure depasse a gauche
      const left = createTrumpet("left", size, angle);
      left.style.bottom = `${bottomPct}%`;
      left.style.left = `${-size - 50}px`; // hors ecran
      portal.appendChild(left);
      trumpets.push(left);

      // Trompette droite : pavillon → gauche (mirror), embouchure depasse a droite
      const right = createTrumpet("right", size, angle);
      right.style.bottom = `${bottomPct}%`;
      right.style.right = `${-size - 50}px`; // hors ecran
      portal.appendChild(right);
      trumpets.push(right);
    }

    // ── Banderole ──
    const banner = createBanner(data);
    portal.appendChild(banner);

    // ── Animation des trompettes ──
    for (let i = 0; i < activeRows.length; i++) {
      const leftTrumpet = trumpets[i * 2];
      const rightTrumpet = trumpets[i * 2 + 1];
      const startTime = i * pairStagger;

      // Position finale : embouchure depasse du bord de -overshoot px
      tl.to(leftTrumpet, {
        left: `${-overshoot}px`,
        duration: slideDuration,
        ease: "power2.out",
      }, startTime);

      tl.to(rightTrumpet, {
        right: `${-overshoot}px`,
        duration: slideDuration,
        ease: "power2.out",
      }, startTime);

      // Petit rebond a l'arrivée
      tl.to(leftTrumpet, {
        x: 10, duration: 0.12, yoyo: true, repeat: 1, ease: "power1.inOut",
      }, startTime + slideDuration);
      tl.to(rightTrumpet, {
        x: -10, duration: 0.12, yoyo: true, repeat: 1, ease: "power1.inOut",
      }, startTime + slideDuration);
    }

    // ── Banderole — apres la derniere rangée ──
    const bannerStartTime = activeRows.length > 0
      ? (activeRows.length - 1) * pairStagger + slideDuration + bannerDelay
      : bannerDelay;

    tl.to(banner, {
      top: "30px",
      duration: 0.6,
      ease: "bounce.out",
    }, bannerStartTime);

    // Balancement subtil
    tl.to(banner, {
      rotation: -1.5,
      duration: 0.8,
      yoyo: true,
      repeat: 3,
      ease: "sine.inOut",
    }, bannerStartTime + 0.6);

    // Stocker pour cleanup
    (container as any).__trumpetDynamic = { trumpets, banner, portal };

    return tl;
  },

  exit(container: HTMLElement): gsap.core.Timeline {
    const tl = gsap.timeline();
    const dynamic = (container as any).__trumpetDynamic as {
      trumpets: HTMLElement[];
      banner: HTMLElement;
      portal: HTMLElement;
    } | undefined;

    if (!dynamic) return tl;

    const { trumpets, banner, portal } = dynamic;

    // Banderole remonte
    tl.to(banner, {
      top: "-250px",
      duration: 0.5,
      ease: "power2.in",
    }, 0);

    // Trompettes fade out subtil
    tl.to(trumpets, {
      opacity: 0,
      duration: 0.4,
      stagger: 0.05,
    }, 0.3);

    // Cleanup
    tl.call(() => {
      portal.remove();
      delete (container as any).__trumpetDynamic;

      const parchment = container.querySelector(".scroll-parchment") as HTMLElement;
      const seal = container.querySelector(".scroll-seal") as HTMLElement;
      if (parchment) gsap.set(parchment, { display: "" });
      if (seal) gsap.set(seal, { display: "" });
    });

    return tl;
  },
};
