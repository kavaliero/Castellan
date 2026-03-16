import { gsap } from "gsap";
import type { AnimationModule, ScrollAlertAnimationData } from "./types";

export const defaultModule: AnimationModule = {
  enter(container: HTMLElement, _data: ScrollAlertAnimationData): gsap.core.Timeline {
    const tl = gsap.timeline();

    const seal = container.querySelector(".scroll-seal") as HTMLElement;
    const sealLeft = container.querySelector(".scroll-seal-half--left") as HTMLElement;
    const sealRight = container.querySelector(".scroll-seal-half--right") as HTMLElement;
    const sealCrack = container.querySelector(".scroll-seal-crack") as HTMLElement;
    const sealIcon = container.querySelector(".scroll-seal-icon") as HTMLElement;
    const sealBurst = container.querySelector(".scroll-seal-burst") as HTMLElement;
    const content = container.querySelector(".scroll-content") as HTMLElement;

    // 1. Parchment slides in (0–0.8s)
    tl.fromTo(container,
      { opacity: 0, y: -40, scale: 0.85 },
      { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: "power3.out" },
      0
    );

    // 2. Seal appears (0.3–0.8s)
    if (seal) {
      tl.fromTo(seal,
        { opacity: 0, scale: 0 },
        { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)" },
        0.3
      );
    }

    // 3. Icon bounces (0.6–1.2s)
    if (sealIcon) {
      tl.fromTo(sealIcon,
        { scale: 1 },
        { scale: 1.3, duration: 0.3, yoyo: true, repeat: 1, ease: "power2.out" },
        0.6
      );
    }

    // 4. Crack appears (1.0s)
    if (sealCrack) {
      tl.fromTo(sealCrack,
        { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: "power2.in" },
        1.0
      );
    }

    // 5. Seal splits + icon/crack fades (1.2s)
    if (sealLeft) {
      tl.to(sealLeft,
        { x: -20, rotation: -15, opacity: 0, duration: 0.4, ease: "power2.in" },
        1.2
      );
    }
    if (sealRight) {
      tl.to(sealRight,
        { x: 20, rotation: 15, opacity: 0, duration: 0.4, ease: "power2.in" },
        1.2
      );
    }
    if (sealIcon) {
      tl.to(sealIcon, { opacity: 0, duration: 0.3 }, 1.2);
    }
    if (sealBurst) {
      tl.fromTo(sealBurst,
        { opacity: 0.8, scale: 0.3 },
        { opacity: 0, scale: 1.5, duration: 0.5, ease: "power2.out" },
        1.2
      );
    }
    if (sealCrack) {
      tl.to(sealCrack, { opacity: 0, duration: 0.3 }, 1.4);
    }

    // 6. Hide seal container (1.7s)
    if (seal) {
      tl.set(seal, { visibility: "hidden" }, 1.7);
    }

    // 7. Content unrolls (1.5–3.5s)
    if (content) {
      tl.fromTo(content,
        { maxHeight: 0 },
        { maxHeight: 300, duration: 2, ease: "power3.out" },
        1.5
      );
    }

    return tl;
  },

  exit(container: HTMLElement): gsap.core.Timeline {
    const tl = gsap.timeline();

    tl.to(container, {
      opacity: 0,
      y: -30,
      scale: 0.9,
      duration: 1,
      ease: "power2.in",
    });

    return tl;
  },
};
