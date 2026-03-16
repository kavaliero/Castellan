import { gsap } from "gsap";
import type { AnimationModule, ScrollAlertAnimationData } from "../types";

/** Create a lightning bolt div */
function createLightning(container: HTMLElement, x: number, y: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "anim-lightning-bolt";
  el.style.cssText = `
    position: absolute;
    left: ${x}px;
    top: ${y}px;
    width: 2px;
    height: ${15 + Math.random() * 25}px;
    background: linear-gradient(180deg, #fff, #7dd3fc, transparent);
    transform: rotate(${-20 + Math.random() * 40}deg);
    pointer-events: none;
    z-index: 15;
    opacity: 0;
    box-shadow: 0 0 6px #7dd3fc, 0 0 12px #38bdf8;
  `;
  container.appendChild(el);
  return el;
}

/** Create disintegration particles */
function createDisintegrationParticles(container: HTMLElement, cx: number, cy: number, count: number): HTMLElement[] {
  const particles: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.style.cssText = `
      position: absolute;
      width: ${3 + Math.random() * 5}px;
      height: ${3 + Math.random() * 5}px;
      background: ${Math.random() > 0.5 ? "#fbbf24" : "#f59e0b"};
      border-radius: 50%;
      left: ${cx + (Math.random() - 0.5) * 20}px;
      top: ${cy + (Math.random() - 0.5) * 80}px;
      pointer-events: none;
      z-index: 20;
    `;
    container.appendChild(el);
    particles.push(el);
  }
  return particles;
}

export const subModule: AnimationModule = {
  enter(container: HTMLElement, _data: ScrollAlertAnimationData): gsap.core.Timeline {
    const tl = gsap.timeline();

    const parchment = container.querySelector(".scroll-parchment") as HTMLElement;
    const seal = container.querySelector(".scroll-seal") as HTMLElement;
    const content = container.querySelector(".scroll-content") as HTMLElement;

    // Initial state
    gsap.set(container, { opacity: 1 });
    if (seal) gsap.set(seal, { visibility: "hidden" });
    if (content) gsap.set(content, { clipPath: "inset(0 0 100% 0)" });

    // Create sword element
    const sword = document.createElement("div");
    sword.className = "anim-sword";
    sword.style.cssText = `
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 12px;
      height: 120px;
      z-index: 25;
      pointer-events: none;
    `;
    // Blade
    const blade = document.createElement("div");
    blade.style.cssText = `
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 8px;
      height: 80px;
      background: linear-gradient(180deg, #e2e8f0, #94a3b8, #cbd5e1);
      clip-path: polygon(50% 0%, 100% 15%, 100% 100%, 0% 100%, 0% 15%);
      box-shadow: 0 0 8px rgba(148, 163, 184, 0.5);
    `;
    // Guard
    const guard = document.createElement("div");
    guard.style.cssText = `
      position: absolute;
      top: 78px;
      left: 50%;
      transform: translateX(-50%);
      width: 36px;
      height: 6px;
      background: linear-gradient(90deg, #92400e, #d97706, #92400e);
      border-radius: 2px;
    `;
    // Grip
    const grip = document.createElement("div");
    grip.style.cssText = `
      position: absolute;
      top: 84px;
      left: 50%;
      transform: translateX(-50%);
      width: 8px;
      height: 28px;
      background: linear-gradient(180deg, #78350f, #451a03);
      border-radius: 2px;
    `;
    // Pommel
    const pommel = document.createElement("div");
    pommel.style.cssText = `
      position: absolute;
      top: 110px;
      left: 50%;
      transform: translateX(-50%);
      width: 14px;
      height: 10px;
      background: radial-gradient(circle, #fbbf24, #d97706);
      border-radius: 50%;
    `;
    sword.append(blade, guard, grip, pommel);
    container.appendChild(sword);

    // Flash overlay
    const flash = document.createElement("div");
    flash.style.cssText = `
      position: absolute;
      inset: -50%;
      background: white;
      pointer-events: none;
      z-index: 30;
      opacity: 0;
    `;
    container.appendChild(flash);

    // Shockwave
    const shockwave = document.createElement("div");
    shockwave.style.cssText = `
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%) scale(0);
      width: 100px;
      height: 100px;
      border: 2px solid rgba(148, 163, 184, 0.6);
      border-radius: 50%;
      pointer-events: none;
      z-index: 15;
      opacity: 0;
    `;
    container.appendChild(shockwave);

    // 1. Lightning flash (0–0.15s)
    tl.to(flash, { opacity: 0.8, duration: 0.07 }, 0);
    tl.to(flash, { opacity: 0, duration: 0.08 }, 0.07);

    // 2. Sword falls and plants (0.15–0.65s)
    gsap.set(sword, { y: "-200%", opacity: 1 });
    tl.to(sword, {
      y: 0, duration: 0.5, ease: "bounce.out",
    }, 0.15);

    // Parchment shakes on impact
    if (parchment) {
      tl.to(parchment, {
        x: 3, duration: 0.05, repeat: 5, yoyo: true, ease: "none",
      }, 0.55);
    }

    // 3. Shockwave (0.65–1.05s)
    tl.to(shockwave, {
      opacity: 1, scale: 3, duration: 0.4, ease: "power2.out",
    }, 0.65);
    tl.to(shockwave, { opacity: 0, duration: 0.2 }, 0.85);

    // 4. Lightning crackles along blade (1.05s, repeating)
    const lightningBolts: HTMLElement[] = [];
    const lightningTweens: gsap.core.Tween[] = [];
    tl.call(() => {
      const swordRect = sword.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const sx = swordRect.left - containerRect.left + swordRect.width / 2;
      const sy = swordRect.top - containerRect.top;

      for (let i = 0; i < 6; i++) {
        const bolt = createLightning(container, sx + (Math.random() - 0.5) * 20, sy + Math.random() * 80);
        lightningBolts.push(bolt);
        const tween = gsap.to(bolt, {
          opacity: 0.9, duration: 0.1,
          repeat: -1, yoyo: true,
          delay: Math.random() * 0.5,
          repeatDelay: 0.1 + Math.random() * 0.3,
        });
        lightningTweens.push(tween);
      }
    }, [], 1.05);

    // 5. Banner unfurls — actually unroll parchment content (1.05–1.85s)
    if (content) {
      tl.to(content, {
        clipPath: "inset(0 0 0% 0)",
        duration: 0.8, ease: "power2.out",
      }, 1.05);
    }

    // Store dynamic elements for cleanup
    (container as any).__animDynamic = { sword, flash, shockwave, lightningBolts, lightningTweens };

    return tl;
  },

  exit(container: HTMLElement): gsap.core.Timeline {
    const tl = gsap.timeline();
    const dynamic = (container as any).__animDynamic as {
      sword: HTMLElement; flash: HTMLElement;
      shockwave: HTMLElement; lightningBolts: HTMLElement[];
      lightningTweens: gsap.core.Tween[];
    } | undefined;

    // Kill standalone infinite lightning tweens to prevent memory leak
    dynamic?.lightningTweens?.forEach(t => t.kill());

    if (dynamic?.sword) {
      tl.to(dynamic.sword, { opacity: 0, duration: 0.3 }, 0);

      // Defer particle creation to play time so getBoundingClientRect is accurate
      tl.call(() => {
        const swordRect = dynamic.sword.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const cx = swordRect.left - containerRect.left + swordRect.width / 2;
        const cy = swordRect.top - containerRect.top + swordRect.height / 2;

        const particles = createDisintegrationParticles(container, cx, cy, 25);
        particles.forEach((p, i) => {
          gsap.to(p, {
            y: -(50 + Math.random() * 100),
            x: (Math.random() - 0.5) * 80,
            opacity: 0,
            duration: 0.6 + Math.random() * 0.3,
            delay: i * 0.02,
            ease: "power2.out",
            onComplete: () => p.remove(),
          });
        });
      }, [], 0.1);
    }

    // Fade everything
    tl.to(container, {
      opacity: 0, scale: 0.9,
      duration: 0.8, ease: "power2.in",
    }, 0.4);

    // Cleanup on complete
    tl.call(() => {
      if (dynamic) {
        dynamic.sword?.remove();
        dynamic.flash?.remove();
        dynamic.shockwave?.remove();
        dynamic.lightningBolts?.forEach(b => b.remove());
      }
      delete (container as any).__animDynamic;
    });

    return tl;
  },
};
