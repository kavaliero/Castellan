import { gsap } from "gsap";
import type { AnimationModule, ScrollAlertAnimationData } from "../types";

function createCoins(container: HTMLElement, cx: number, cy: number, count: number): HTMLElement[] {
  const coins: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    const size = 8 + Math.random() * 8;
    el.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      background: radial-gradient(circle at 35% 35%, #fde68a, #f59e0b, #b45309);
      border-radius: 50%;
      left: ${cx}px;
      top: ${cy}px;
      pointer-events: none;
      z-index: 20;
      box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    `;
    container.appendChild(el);
    coins.push(el);
  }
  return coins;
}

export const bitsModule: AnimationModule = {
  enter(container: HTMLElement, _data: ScrollAlertAnimationData): gsap.core.Timeline {
    const tl = gsap.timeline();

    const seal = container.querySelector(".scroll-seal") as HTMLElement;
    const content = container.querySelector(".scroll-content") as HTMLElement;

    // Initial state
    gsap.set(container, { opacity: 1 });
    if (seal) gsap.set(seal, { visibility: "hidden" });
    if (content) gsap.set(content, { clipPath: "inset(0 0 100% 0)" });

    // Create chest base
    const chest = document.createElement("div");
    chest.style.cssText = `
      position: absolute;
      left: 50%;
      top: 40%;
      width: 80px;
      height: 50px;
      z-index: 25;
      pointer-events: none;
    `;
    // Let GSAP handle all transforms (position + scale)
    gsap.set(chest, { xPercent: -50, yPercent: -50, scale: 0 });

    // Chest body
    const body = document.createElement("div");
    body.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 35px;
      background: linear-gradient(180deg, #92400e, #78350f, #451a03);
      border-radius: 4px;
      border: 2px solid #78350f;
      box-shadow: 0 4px 8px rgba(0,0,0,0.5);
    `;

    // Metal band
    const band = document.createElement("div");
    band.style.cssText = `
      position: absolute;
      top: 50%;
      left: 0;
      width: 100%;
      height: 4px;
      background: linear-gradient(90deg, #d97706, #fbbf24, #d97706);
      transform: translateY(-50%);
    `;
    body.appendChild(band);

    // Lock
    const lock = document.createElement("div");
    lock.style.cssText = `
      position: absolute;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%);
      width: 12px;
      height: 14px;
      background: radial-gradient(circle, #fbbf24, #b45309);
      border-radius: 2px;
      z-index: 2;
    `;

    // Lid
    const lid = document.createElement("div");
    lid.style.cssText = `
      position: absolute;
      top: 0;
      left: -2px;
      width: calc(100% + 4px);
      height: 22px;
      background: linear-gradient(180deg, #b45309, #92400e);
      border-radius: 6px 6px 0 0;
      border: 2px solid #78350f;
      transform-origin: top center;
      z-index: 3;
    `;

    // Glow behind chest
    const glow = document.createElement("div");
    glow.style.cssText = `
      position: absolute;
      left: 50%;
      top: 40%;
      transform: translate(-50%, -50%);
      width: 160px;
      height: 160px;
      background: radial-gradient(circle, rgba(251,191,36,0.4) 0%, transparent 70%);
      pointer-events: none;
      z-index: 15;
      opacity: 0;
    `;

    chest.append(body, lock, lid);
    container.append(glow, chest);

    // 1. Chest bounces in (0–0.4s)
    tl.to(chest, {
      scale: 1, duration: 0.4, ease: "back.out(1.7)",
    }, 0);

    // 2. Chest shakes + light leaks (0.4–0.7s)
    tl.to(chest, {
      x: 3, duration: 0.04, repeat: 7, yoyo: true, ease: "none",
    }, 0.4);
    tl.to(glow, { opacity: 0.6, duration: 0.3 }, 0.4);

    // 3. Lid opens (0.7–1.1s)
    tl.to(lid, {
      rotateX: -110, duration: 0.4, ease: "power2.out",
    }, 0.7);

    // 4. Gold coins explode (1.1–2.1s)
    tl.call(() => {
      const chestRect = chest.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const cx = chestRect.left - containerRect.left + chestRect.width / 2;
      const cy = chestRect.top - containerRect.top;

      const coins = createCoins(container, cx, cy, 18);
      coins.forEach((coin) => {
        const xOffset = (Math.random() - 0.5) * 120;
        const peakY = -(80 + Math.random() * 120);

        // Up phase
        gsap.to(coin, {
          x: xOffset * 0.6,
          y: peakY,
          rotation: Math.random() * 360,
          duration: 0.4,
          ease: "power2.out",
        });
        // Down phase (gravity)
        gsap.to(coin, {
          x: xOffset,
          y: peakY + 50 + Math.random() * 30,
          opacity: 0.6,
          duration: 0.5,
          ease: "power2.in",
          delay: 0.4,
          onComplete: () => coin.remove(),
        });
      });
    }, [], 1.1);

    // Glow pulses
    tl.to(glow, {
      scale: 1.2, duration: 0.8, repeat: -1, yoyo: true, ease: "sine.inOut",
    }, 1.1);

    // 5. Text rises from chest — unroll content (1.5–2.1s)
    if (content) {
      tl.to(content, {
        clipPath: "inset(0 0 0% 0)",
        duration: 0.6, ease: "power2.out",
      }, 1.5);
    }

    // Store for cleanup (including lid ref for exit)
    (container as any).__animDynamic = { chest, glow, lid };

    return tl;
  },

  exit(container: HTMLElement): gsap.core.Timeline {
    const tl = gsap.timeline();
    const dynamic = (container as any).__animDynamic as {
      chest: HTMLElement; glow: HTMLElement; lid: HTMLElement;
    } | undefined;

    // Lid closes
    if (dynamic?.lid) {
      tl.to(dynamic.lid, { rotateX: 0, duration: 0.3, ease: "power2.in" }, 0);
    }

    // Fade glow
    if (dynamic?.glow) {
      tl.to(dynamic.glow, { opacity: 0, duration: 0.5 }, 0.2);
    }

    // Fade everything
    tl.to(container, {
      opacity: 0, y: -20,
      duration: 0.7, ease: "power2.in",
    }, 0.3);

    // Cleanup
    tl.call(() => {
      dynamic?.chest?.remove();
      dynamic?.glow?.remove();
      delete (container as any).__animDynamic;
    });

    return tl;
  },
};
