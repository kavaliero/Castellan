import { gsap } from "gsap";
import type { AnimationModule, ScrollAlertAnimationData } from "../types";

function createParticles(container: HTMLElement, count: number, color: string): HTMLElement[] {
  const particles: HTMLElement[] = [];
  const seal = container.querySelector(".scroll-seal") as HTMLElement;
  if (!seal) return particles;

  const rect = seal.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const cx = rect.left - containerRect.left + rect.width / 2;
  const cy = rect.top - containerRect.top + rect.height / 2;

  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.style.cssText = `
      position: absolute;
      width: ${4 + Math.random() * 6}px;
      height: ${4 + Math.random() * 6}px;
      background: ${color};
      border-radius: 50%;
      left: ${cx}px;
      top: ${cy}px;
      pointer-events: none;
      z-index: 20;
    `;
    container.appendChild(el);
    particles.push(el);
  }
  return particles;
}

export const followModule: AnimationModule = {
  enter(container: HTMLElement, data: ScrollAlertAnimationData): gsap.core.Timeline {
    const tl = gsap.timeline();

    const seal = container.querySelector(".scroll-seal") as HTMLElement;
    const sealLeft = container.querySelector(".scroll-seal-half--left") as HTMLElement;
    const sealRight = container.querySelector(".scroll-seal-half--right") as HTMLElement;
    const sealCrack = container.querySelector(".scroll-seal-crack") as HTMLElement;
    const sealIcon = container.querySelector(".scroll-seal-icon") as HTMLElement;
    const content = container.querySelector(".scroll-content") as HTMLElement;

    // Initial state: everything hidden
    gsap.set(container, { opacity: 0, y: -80 });
    if (seal) gsap.set(seal, { opacity: 0, scale: 0 });
    if (content) gsap.set(content, { clipPath: "inset(0 0 100% 0)" });

    // 1. Parchment drops with slight swing (0–0.6s)
    tl.to(container, {
      opacity: 1, y: 0, rotation: 0,
      duration: 0.6, ease: "power2.out",
    }, 0);
    tl.fromTo(container,
      { rotation: -3 },
      { rotation: 0, duration: 0.6, ease: "power2.out" },
      0
    );

    // 2. Wax seal stamps (0.6–0.9s)
    if (seal) {
      tl.to(seal, {
        opacity: 1, scale: 1,
        duration: 0.3, ease: "back.out(3)",
      }, 0.6);
    }

    // 3. Seal cracks + particles burst (0.9–1.3s)
    if (sealCrack) {
      tl.fromTo(sealCrack,
        { opacity: 0 },
        { opacity: 1, duration: 0.15 },
        0.9
      );
    }

    // Create wax particles at 0.95s
    tl.call(() => {
      const particles = createParticles(container, 10, data.sealColor);
      particles.forEach((p) => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 40 + Math.random() * 60;
        gsap.to(p, {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          opacity: 0,
          duration: 0.4,
          ease: "power2.out",
          onComplete: () => p.remove(),
        });
      });
    }, [], 0.95);

    // Split seal halves
    if (sealLeft) {
      tl.to(sealLeft, {
        x: -20, rotation: -15, opacity: 0,
        duration: 0.35, ease: "power2.in",
      }, 1.0);
    }
    if (sealRight) {
      tl.to(sealRight, {
        x: 20, rotation: 15, opacity: 0,
        duration: 0.35, ease: "power2.in",
      }, 1.0);
    }
    if (sealIcon) {
      tl.to(sealIcon, { opacity: 0, duration: 0.2 }, 1.0);
    }

    // Hide seal
    if (seal) {
      tl.set(seal, { visibility: "hidden" }, 1.35);
    }

    // 4. Parchment unrolls (1.3–2.5s)
    if (content) {
      tl.to(content, {
        clipPath: "inset(0 0 0% 0)",
        duration: 1.2, ease: "power2.out",
      }, 1.3);
    }

    return tl;
  },

  exit(container: HTMLElement): gsap.core.Timeline {
    const tl = gsap.timeline();
    const content = container.querySelector(".scroll-content") as HTMLElement;

    // Re-roll parchment
    if (content) {
      tl.to(content, {
        clipPath: "inset(0 0 100% 0)",
        duration: 0.4, ease: "power2.in",
      }, 0);
    }

    // Rise and fade
    tl.to(container, {
      y: -60, opacity: 0,
      duration: 0.6, ease: "power2.in",
    }, 0.2);

    return tl;
  },
};
