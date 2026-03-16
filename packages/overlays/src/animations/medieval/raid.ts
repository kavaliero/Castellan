import { gsap } from "gsap";
import type { AnimationModule, ScrollAlertAnimationData } from "../types";

function createBanner(side: "left" | "right"): HTMLElement {
  const banner = document.createElement("div");
  const isLeft = side === "left";
  banner.style.cssText = `
    position: absolute;
    ${isLeft ? "left: -20px" : "right: -20px"};
    top: 0;
    width: 30px;
    height: 100%;
    background: linear-gradient(180deg, #991b1b, #7f1d1d, #991b1b);
    border: 2px solid #d97706;
    z-index: 5;
    pointer-events: none;
    transform: translateY(-100%);
  `;

  // Banner decoration (gold stripe)
  const stripe = document.createElement("div");
  stripe.style.cssText = `
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    top: 10%;
    width: 60%;
    height: 80%;
    background: linear-gradient(180deg, transparent, rgba(217,119,6,0.4), transparent);
  `;
  banner.appendChild(stripe);

  return banner;
}

function createPortcullis(container: HTMLElement): HTMLElement {
  const gate = document.createElement("div");
  gate.style.cssText = `
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 120px;
    height: 100px;
    z-index: 20;
    pointer-events: none;
    overflow: hidden;
  `;

  // Vertical bars
  for (let i = 0; i < 5; i++) {
    const bar = document.createElement("div");
    bar.style.cssText = `
      position: absolute;
      left: ${10 + i * 25}px;
      top: 0;
      width: 4px;
      height: 100%;
      background: linear-gradient(180deg, #6b7280, #9ca3af, #6b7280);
      border-radius: 1px;
    `;
    gate.appendChild(bar);
  }

  // Horizontal bars
  for (let i = 0; i < 4; i++) {
    const bar = document.createElement("div");
    bar.style.cssText = `
      position: absolute;
      top: ${10 + i * 25}px;
      left: 0;
      width: 100%;
      height: 3px;
      background: linear-gradient(90deg, #6b7280, #9ca3af, #6b7280);
    `;
    gate.appendChild(bar);
  }

  container.appendChild(gate);
  return gate;
}

function createKnight(container: HTMLElement, index: number): HTMLElement {
  const knight = document.createElement("div");
  const xBase = 50 + (index - 1.5) * 30;

  knight.style.cssText = `
    position: absolute;
    left: ${xBase}%;
    bottom: 5%;
    transform: translateX(-50%) scale(0.8);
    width: 24px;
    height: 40px;
    z-index: ${18 - index};
    pointer-events: none;
    opacity: 0;
  `;

  // Body (armor)
  const body = document.createElement("div");
  body.style.cssText = `
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 18px;
    height: 26px;
    background: linear-gradient(180deg, #6b7280, #4b5563);
    border-radius: 3px 3px 0 0;
    clip-path: polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%);
  `;

  // Helmet
  const helmet = document.createElement("div");
  helmet.style.cssText = `
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 14px;
    height: 16px;
    background: linear-gradient(180deg, #9ca3af, #6b7280);
    border-radius: 7px 7px 2px 2px;
  `;

  // Shield
  const shield = document.createElement("div");
  shield.style.cssText = `
    position: absolute;
    bottom: 5px;
    ${index % 2 === 0 ? "left: -6px" : "right: -6px"};
    width: 10px;
    height: 14px;
    background: linear-gradient(135deg, #991b1b, #7f1d1d);
    border: 1px solid #d97706;
    border-radius: 2px 2px 2px 8px;
  `;

  knight.append(helmet, body, shield);
  container.appendChild(knight);
  return knight;
}

function createDust(container: HTMLElement, count: number): HTMLElement[] {
  const particles: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.style.cssText = `
      position: absolute;
      left: ${10 + Math.random() * 80}%;
      bottom: ${Math.random() * 15}%;
      width: ${3 + Math.random() * 5}px;
      height: ${3 + Math.random() * 5}px;
      background: rgba(168, 162, 158, ${0.3 + Math.random() * 0.3});
      border-radius: 50%;
      pointer-events: none;
      z-index: 4;
      opacity: 0;
    `;
    container.appendChild(el);
    particles.push(el);
  }
  return particles;
}

export const raidModule: AnimationModule = {
  enter(container: HTMLElement, _data: ScrollAlertAnimationData): gsap.core.Timeline {
    const tl = gsap.timeline();

    const seal = container.querySelector(".scroll-seal") as HTMLElement;
    const content = container.querySelector(".scroll-content") as HTMLElement;

    // Initial state
    gsap.set(container, { opacity: 1 });
    if (seal) gsap.set(seal, { visibility: "hidden" });
    if (content) gsap.set(content, { clipPath: "inset(0 0 100% 0)" });

    // Create elements
    const bannerLeft = createBanner("left");
    const bannerRight = createBanner("right");
    container.append(bannerLeft, bannerRight);

    const portcullis = createPortcullis(container);
    const knights = [0, 1, 2, 3].map(i => createKnight(container, i));
    const dust = createDust(container, 10);

    // 1. Banners drop (0–0.5s)
    tl.to(bannerLeft, { y: 0, duration: 0.5, ease: "power2.out" }, 0);
    tl.to(bannerRight, { y: 0, duration: 0.5, ease: "power2.out" }, 0.05);

    // 2. Portcullis rises (0.5–1.3s)
    tl.to(portcullis, {
      y: "-100%", duration: 0.8, ease: "power3.out",
    }, 0.5);

    // 3. Knights advance (1.3–2.5s)
    knights.forEach((knight, i) => {
      tl.to(knight, {
        opacity: 1, scale: 1,
        duration: 0.4, ease: "power2.out",
      }, 1.3 + i * 0.3);
    });

    // 4. Central banner / content unfurls (2.5–3.1s)
    if (content) {
      tl.to(content, {
        clipPath: "inset(0 0 0% 0)",
        duration: 0.6, ease: "power2.out",
      }, 2.5);
    }

    // 5. Dust particles ambient (1.3s onward)
    dust.forEach((p, i) => {
      tl.to(p, {
        opacity: 0.6, y: -(10 + Math.random() * 20),
        x: (Math.random() - 0.5) * 20,
        duration: 1.5 + Math.random(),
        repeat: -1, yoyo: true,
        ease: "sine.inOut",
      }, 1.3 + i * 0.15);
    });

    // Store for cleanup
    (container as any).__animDynamic = {
      bannerLeft, bannerRight, portcullis, knights, dust,
    };

    return tl;
  },

  exit(container: HTMLElement): gsap.core.Timeline {
    const tl = gsap.timeline();
    const dynamic = (container as any).__animDynamic as {
      bannerLeft: HTMLElement; bannerRight: HTMLElement;
      portcullis: HTMLElement; knights: HTMLElement[];
      dust: HTMLElement[];
    } | undefined;

    // Portcullis descends
    if (dynamic?.portcullis) {
      tl.to(dynamic.portcullis, {
        y: 0, duration: 0.5, ease: "power2.in",
      }, 0);
    }

    // Knights retreat
    dynamic?.knights?.forEach((knight, i) => {
      tl.to(knight, { opacity: 0, scale: 0.7, duration: 0.3 }, 0.1 + i * 0.1);
    });

    // Banners rise
    if (dynamic?.bannerLeft) {
      tl.to(dynamic.bannerLeft, { y: "-100%", duration: 0.4 }, 0.3);
    }
    if (dynamic?.bannerRight) {
      tl.to(dynamic.bannerRight, { y: "-100%", duration: 0.4 }, 0.35);
    }

    // Fade all
    tl.to(container, {
      opacity: 0, duration: 0.6, ease: "power2.in",
    }, 0.5);

    // Cleanup
    tl.call(() => {
      dynamic?.bannerLeft?.remove();
      dynamic?.bannerRight?.remove();
      dynamic?.portcullis?.remove();
      dynamic?.knights?.forEach(k => k.remove());
      dynamic?.dust?.forEach(d => d.remove());
      delete (container as any).__animDynamic;
    });

    return tl;
  },
};
