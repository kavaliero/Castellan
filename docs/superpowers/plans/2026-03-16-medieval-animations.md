# Medieval Fantasy Animation System — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CSS keyframe animations with a modular GSAP animation system featuring 4 medieval fantasy animations (follow, sub, bits, raid), and simplify admin sound upload UX.

**Architecture:** Each alert type maps to an animation module via a registry. Modules export `enter()`/`exit()` functions returning GSAP timelines. `ScrollAlert` orchestrates timing (enter → pause → exit → onDone). The default module reproduces the current CSS animation for backward compatibility.

**Tech Stack:** GSAP (core only, no plugins), React 19, TypeScript, existing Express 5 server

---

## File Structure

### New files
- `packages/overlays/src/animations/types.ts` — AnimationModule interface
- `packages/overlays/src/animations/registry.ts` — type→module mapping
- `packages/overlays/src/animations/default.ts` — fallback animation (CSS-equivalent in GSAP)
- `packages/overlays/src/animations/medieval/follow.ts` — royal parchment + wax seal
- `packages/overlays/src/animations/medieval/sub.ts` — sword + lightning
- `packages/overlays/src/animations/medieval/bits.ts` — treasure chest + gold coins
- `packages/overlays/src/animations/medieval/raid.ts` — castle gate + knights

### Modified files
- `packages/overlays/package.json` — add gsap dependency
- `packages/overlays/src/components/alerts/ScrollAlert.tsx` — GSAP integration, add `type` to data, `onDone` callback, `duration` prop
- `packages/overlays/src/components/alerts/alerts.css` — remove all `@keyframes` and `animation:` declarations
- `packages/overlays/src/pages/AlertsPage.tsx` — pass `type` in data, replace setTimeout with onDone, pass duration prop
- `packages/overlays/src/components/admin/AlertCard.tsx` — simplify sound section (remove filename, upload-only)

---

## Chunk 1: Foundation

### Task 1: Install GSAP

**Files:**
- Modify: `packages/overlays/package.json`

- [ ] **Step 1: Install gsap**

```bash
cd packages/overlays && pnpm add gsap
```

- [ ] **Step 2: Verify import works**

```bash
cd packages/overlays && npx vite build
```
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/overlays/package.json pnpm-lock.yaml
git commit -m "deps: add gsap to overlays package"
```

---

### Task 2: Animation types and registry

**Files:**
- Create: `packages/overlays/src/animations/types.ts`
- Create: `packages/overlays/src/animations/registry.ts`

- [ ] **Step 1: Create AnimationModule interface**

Create `packages/overlays/src/animations/types.ts`:

```ts
import type { gsap } from "gsap";

export interface ScrollAlertAnimationData {
  type: string;
  variant: "minor" | "major";
  icon: string;
  sealColor: string;
  title: string;
  viewerName: string | null;
  subtitle: string | null;
  ribbon: string | null;
}

export interface AnimationModule {
  /** Build and return the enter timeline. Caller plays it. */
  enter(container: HTMLElement, data: ScrollAlertAnimationData): gsap.core.Timeline;
  /** Build and return the exit timeline. Must clean up any dynamic DOM elements on complete. */
  exit(container: HTMLElement): gsap.core.Timeline;
}
```

- [ ] **Step 2: Create empty registry**

Create `packages/overlays/src/animations/registry.ts`:

```ts
import type { AnimationModule } from "./types";

const registry: Record<string, AnimationModule> = {};

export function getAnimationModule(type: string): AnimationModule | null {
  return registry[type] ?? null;
}

export function registerAnimation(type: string, module: AnimationModule): void {
  registry[type] = module;
}
```

- [ ] **Step 3: Verify build**

```bash
cd packages/overlays && npx vite build
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/overlays/src/animations/
git commit -m "feat: add animation module types and registry"
```

---

### Task 3: Default animation module (CSS → GSAP migration)

**Files:**
- Create: `packages/overlays/src/animations/default.ts`
- Modify: `packages/overlays/src/animations/registry.ts`

This module reproduces the current CSS keyframe animation in GSAP so all existing alert types keep working when we remove the CSS keyframes.

- [ ] **Step 1: Create default module**

Create `packages/overlays/src/animations/default.ts`:

```ts
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
```

- [ ] **Step 2: Register as fallback in registry**

Update `packages/overlays/src/animations/registry.ts` to import and use the default:

```ts
import type { AnimationModule } from "./types";
import { defaultModule } from "./default";

const registry: Record<string, AnimationModule> = {};

export function getAnimationModule(type: string): AnimationModule {
  return registry[type] ?? defaultModule;
}

export function registerAnimation(type: string, module: AnimationModule): void {
  registry[type] = module;
}
```

- [ ] **Step 3: Verify build**

```bash
cd packages/overlays && npx vite build
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/overlays/src/animations/
git commit -m "feat: add default animation module (CSS equivalent in GSAP)"
```

---

### Task 4: Integrate GSAP into ScrollAlert + AlertsPage lifecycle

**Files:**
- Modify: `packages/overlays/src/components/alerts/ScrollAlert.tsx`
- Modify: `packages/overlays/src/pages/AlertsPage.tsx`
- Modify: `packages/overlays/src/components/alerts/alerts.css`

This is the core integration task. We:
1. Add `type` to `ScrollAlertData`
2. Add `onDone` callback + `duration` prop to `ScrollAlert`
3. Wire GSAP timeline (enter → pause → exit → onDone)
4. Update `AlertsPage` to use `onDone` instead of `setTimeout`
5. Remove all CSS `@keyframes` and `animation:` declarations

- [ ] **Step 1: Update ScrollAlert component**

Rewrite `packages/overlays/src/components/alerts/ScrollAlert.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import "./alerts.css";
import { lighten } from "../../utils/lighten";
import { getAnimationModule } from "../../animations/registry";

export type ScrollAlertVariant = "minor" | "major";

export interface ScrollAlertData {
  type: string;
  variant: ScrollAlertVariant;
  icon: string;
  sealColor: string;
  title: string;
  viewerName: string | null;
  subtitle: string | null;
  ribbon: string | null;
  mediaUrl: string | null;
  mediaType: "video" | "gif" | null;
}

interface ScrollAlertProps {
  alert: ScrollAlertData;
  duration: number;
  onDone: () => void;
}

export function ScrollAlert({ alert, duration, onDone }: ScrollAlertProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  const sealGradient = `radial-gradient(circle at 40% 35%, ${lighten(alert.sealColor, 20)}, ${alert.sealColor})`;
  const wrapperClass = `scroll-alert scroll-alert--${alert.variant}`;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const module = getAnimationModule(alert.type);

    // Build enter timeline
    const enterTl = module.enter(el, {
      type: alert.type,
      variant: alert.variant,
      icon: alert.icon,
      sealColor: alert.sealColor,
      title: alert.title,
      viewerName: alert.viewerName,
      subtitle: alert.subtitle,
      ribbon: alert.ribbon,
    });

    const enterDuration = enterTl.duration();

    // Build exit timeline (paused, we play it after the pause)
    const exitTl = module.exit(el);
    exitTl.pause();

    const exitDuration = exitTl.duration();

    // Calculate pause: total duration minus enter and exit
    const pauseMs = Math.max(0, duration - (enterDuration * 1000) - (exitDuration * 1000));

    // Master timeline: enter → pause → exit → onDone
    const master = gsap.timeline();
    master.add(enterTl);
    master.call(() => {
      // After pause, play exit
      setTimeout(() => {
        exitTl.play();
        exitTl.eventCallback("onComplete", onDone);
      }, pauseMs);
    });

    timelineRef.current = master;

    return () => {
      master.kill();
      exitTl.kill();
    };
  }, []); // Run once on mount

  return (
    <div ref={containerRef} className={wrapperClass}>
      {/* Media layer behind parchment */}
      {alert.mediaUrl && alert.mediaType === "video" && (
        <video className="scroll-media" src={alert.mediaUrl} autoPlay muted playsInline />
      )}
      {alert.mediaUrl && alert.mediaType === "gif" && (
        <img className="scroll-media" src={alert.mediaUrl} alt="" />
      )}

      {/* Sceau de cire */}
      <div className="scroll-seal">
        <div className="scroll-seal-half--left" style={{ background: sealGradient }} />
        <div className="scroll-seal-half--right" style={{ background: sealGradient }} />
        <div className="scroll-seal-crack" />
        <div className="scroll-seal-icon">{alert.icon}</div>
        <div className="scroll-seal-burst" />
      </div>

      {/* Corps du parchemin */}
      <div className="scroll-parchment">
        <div className="scroll-roll" />
        <div className="scroll-content">
          <div className="scroll-content-inner">
            <div className="scroll-title">{alert.title}</div>
            <div className="scroll-separator" />
            {alert.viewerName && (
              <div className="scroll-viewer-name">{alert.viewerName}</div>
            )}
            {alert.subtitle && (
              <div className="scroll-subtitle">{alert.subtitle}</div>
            )}
            {alert.ribbon && (
              <div className="scroll-ribbon">{alert.ribbon}</div>
            )}
          </div>
        </div>
        <div className="scroll-roll" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update AlertsPage to pass type, duration, onDone**

In `packages/overlays/src/pages/AlertsPage.tsx`, make these changes:

**a)** In `handleEvent`, add `type: configKey` to the `data` object (around line 162):

```ts
// Change the data object in the queued alert to include type
data: {
  type: configKey,  // NEW
  variant: alertCfg.variant,
  icon: alertCfg.icon,
  // ... rest unchanged
},
```

**b)** Replace the `showNext` function — remove `setTimeout`, add `onDone`:

```ts
const showNext = useCallback(() => {
  const next = queueRef.current.shift();
  if (!next) {
    setCurrentAlert(null);
    isShowingRef.current = false;
    return;
  }

  isShowingRef.current = true;
  setCurrentAlert(next);
  playSound(next.soundFile, next.soundVolume);
  // No more setTimeout — ScrollAlert calls onDone when animation completes
}, [playSound]);
```

**c)** Update the JSX to pass `duration` and `onDone`:

```tsx
return (
  <div className="alerts-page">
    {currentAlert && (
      <ScrollAlert
        key={currentAlert.id}
        alert={currentAlert.data}
        duration={currentAlert.duration}
        onDone={showNext}
      />
    )}
  </div>
);
```

- [ ] **Step 3: Strip CSS keyframes and animation declarations**

In `packages/overlays/src/components/alerts/alerts.css`:

**Remove** all `animation:` properties from these selectors:
- `.scroll-alert` (lines 31-33) — remove the `animation:` block
- `.scroll-content` (line 122) — remove `animation: scroll-unroll...`
- `.scroll-seal` (lines 141-143) — remove the `animation:` block
- `.scroll-seal-half--left` (line 160) — remove `animation: seal-split-left...`
- `.scroll-seal-half--right` (line 165) — remove `animation: seal-split-right...`
- `.scroll-seal-crack` (lines 178-180) — remove the `animation:` block
- `.scroll-seal-icon` (lines 192-194) — remove the `animation:` block
- `.scroll-seal-burst` (line 208) — remove `animation: seal-burst...`

**Remove** the entire keyframes section (lines 263-358):
- `@keyframes scroll-enter`
- `@keyframes scroll-exit`
- `@keyframes scroll-unroll`
- `@keyframes seal-appear`
- `@keyframes seal-split-left`
- `@keyframes seal-split-right`
- `@keyframes crack-appear`
- `@keyframes seal-icon-bounce`
- `@keyframes seal-icon-fade`
- `@keyframes seal-hide`
- `@keyframes crack-disappear`
- `@keyframes seal-burst`

**Also** set `.scroll-content` to have `max-height: 0; overflow: hidden;` (keep these, remove only the animation).

- [ ] **Step 4: Verify build**

```bash
cd packages/overlays && npx vite build
```
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/overlays/src/components/alerts/ packages/overlays/src/pages/AlertsPage.tsx
git commit -m "feat: integrate GSAP into ScrollAlert, remove CSS keyframes

ScrollAlert now uses GSAP timelines via animation modules.
AlertsPage uses onDone callback instead of setTimeout.
All CSS keyframes removed — animation is now fully GSAP-driven."
```

---

## Chunk 2: Medieval Animations

### Task 5: Follow animation — Royal Parchment with Wax Seal

**Files:**
- Create: `packages/overlays/src/animations/medieval/follow.ts`
- Modify: `packages/overlays/src/animations/registry.ts`

- [ ] **Step 1: Create follow animation module**

Create `packages/overlays/src/animations/medieval/follow.ts`:

```ts
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
```

- [ ] **Step 2: Register in registry**

Add to `packages/overlays/src/animations/registry.ts`:

```ts
import type { AnimationModule } from "./types";
import { defaultModule } from "./default";
import { followModule } from "./medieval/follow";

const registry: Record<string, AnimationModule> = {
  follow: followModule,
};

export function getAnimationModule(type: string): AnimationModule {
  return registry[type] ?? defaultModule;
}

export function registerAnimation(type: string, module: AnimationModule): void {
  registry[type] = module;
}
```

- [ ] **Step 3: Verify build**

```bash
cd packages/overlays && npx vite build
```

- [ ] **Step 4: Commit**

```bash
git add packages/overlays/src/animations/
git commit -m "feat: add follow animation (royal parchment + wax seal)"
```

---

### Task 6: Sub animation — Planted Sword with Lightning

**Files:**
- Create: `packages/overlays/src/animations/medieval/sub.ts`
- Modify: `packages/overlays/src/animations/registry.ts`

- [ ] **Step 1: Create sub animation module**

Create `packages/overlays/src/animations/medieval/sub.ts`:

```ts
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
    tl.call(() => {
      const swordRect = sword.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const sx = swordRect.left - containerRect.left + swordRect.width / 2;
      const sy = swordRect.top - containerRect.top;

      for (let i = 0; i < 6; i++) {
        const bolt = createLightning(container, sx + (Math.random() - 0.5) * 20, sy + Math.random() * 80);
        lightningBolts.push(bolt);
        gsap.to(bolt, {
          opacity: 0.9, duration: 0.1,
          repeat: -1, yoyo: true,
          delay: Math.random() * 0.5,
          repeatDelay: 0.1 + Math.random() * 0.3,
        });
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
    (container as any).__animDynamic = { sword, flash, shockwave, lightningBolts };

    return tl;
  },

  exit(container: HTMLElement): gsap.core.Timeline {
    const tl = gsap.timeline();
    const dynamic = (container as any).__animDynamic as {
      sword: HTMLElement; flash: HTMLElement;
      shockwave: HTMLElement; lightningBolts: HTMLElement[];
    } | undefined;

    // Disintegrate sword into particles
    if (dynamic?.sword) {
      const swordRect = dynamic.sword.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const cx = swordRect.left - containerRect.left + swordRect.width / 2;
      const cy = swordRect.top - containerRect.top + swordRect.height / 2;

      tl.to(dynamic.sword, { opacity: 0, duration: 0.3 }, 0);

      const particles = createDisintegrationParticles(container, cx, cy, 25);
      particles.forEach((p, i) => {
        tl.to(p, {
          y: -(50 + Math.random() * 100),
          x: (Math.random() - 0.5) * 80,
          opacity: 0,
          duration: 0.6 + Math.random() * 0.3,
          ease: "power2.out",
          onComplete: () => p.remove(),
        }, i * 0.02);
      });
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
```

- [ ] **Step 2: Register in registry**

Update `packages/overlays/src/animations/registry.ts` — add:

```ts
import { subModule } from "./medieval/sub";
```

And in the registry object:

```ts
const registry: Record<string, AnimationModule> = {
  follow: followModule,
  sub: subModule,
};
```

- [ ] **Step 3: Verify build**

```bash
cd packages/overlays && npx vite build
```

- [ ] **Step 4: Commit**

```bash
git add packages/overlays/src/animations/
git commit -m "feat: add sub animation (planted sword + lightning)"
```

---

### Task 7: Bits animation — Treasure Chest

**Files:**
- Create: `packages/overlays/src/animations/medieval/bits.ts`
- Modify: `packages/overlays/src/animations/registry.ts`

- [ ] **Step 1: Create bits animation module**

Create `packages/overlays/src/animations/medieval/bits.ts`:

```ts
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

    const parchment = container.querySelector(".scroll-parchment") as HTMLElement;
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
```

- [ ] **Step 2: Register in registry**

Add `import { bitsModule } from "./medieval/bits";` and `bits: bitsModule` to the registry.

- [ ] **Step 3: Verify build**

```bash
cd packages/overlays && npx vite build
```

- [ ] **Step 4: Commit**

```bash
git add packages/overlays/src/animations/
git commit -m "feat: add bits animation (treasure chest + gold coins)"
```

---

### Task 8: Raid animation — Castle Gate and Knights

**Files:**
- Create: `packages/overlays/src/animations/medieval/raid.ts`
- Modify: `packages/overlays/src/animations/registry.ts`

- [ ] **Step 1: Create raid animation module**

Create `packages/overlays/src/animations/medieval/raid.ts`:

```ts
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
  const xBase = 50 + (index - 1.5) * 30; // spread from center

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
```

- [ ] **Step 2: Register in registry**

Final `packages/overlays/src/animations/registry.ts`:

```ts
import type { AnimationModule } from "./types";
import { defaultModule } from "./default";
import { followModule } from "./medieval/follow";
import { subModule } from "./medieval/sub";
import { bitsModule } from "./medieval/bits";
import { raidModule } from "./medieval/raid";

const registry: Record<string, AnimationModule> = {
  follow: followModule,
  sub: subModule,
  bits: bitsModule,
  raid: raidModule,
};

export function getAnimationModule(type: string): AnimationModule {
  return registry[type] ?? defaultModule;
}

export function registerAnimation(type: string, module: AnimationModule): void {
  registry[type] = module;
}
```

- [ ] **Step 3: Verify build**

```bash
cd packages/overlays && npx vite build
```

- [ ] **Step 4: Commit**

```bash
git add packages/overlays/src/animations/
git commit -m "feat: add raid animation (castle gate + knights)"
```

---

## Chunk 3: Admin Sound Simplification

### Task 9: Simplify sound section in AlertCard

**Files:**
- Modify: `packages/overlays/src/components/admin/AlertCard.tsx`

- [ ] **Step 1: Simplify the sound section**

In `packages/overlays/src/components/admin/AlertCard.tsx`, replace the sound section (around lines 224-273) with a simplified version:

Remove:
- The filename display (the span showing `form.sound.file || {type}.mp3`)
- Any `sound.file` state updates in the form (the `updateSound({ file: ... })` after upload should auto-set to `{type}.mp3`)

The sound section should become:
1. **Row 1**: "Son" label + toggle enabled/disabled
2. **Row 2**: "Remplacer le son" upload button + upload state indicator ("✓ Uploadé" for 2s)
3. **Row 3**: Volume slider 0-100%

Key changes in the `handleSoundUpload` function:
- After successful upload, set a `soundUploaded` state to true
- After 2s, reset it to false
- Don't update `form.sound.file` — it stays as `{type}.mp3` always

Add a `soundUploaded` state:
```ts
const [soundUploaded, setSoundUploaded] = useState(false);
```

Update `handleSoundUpload`:
```ts
async function handleSoundUpload(file: File) {
  setUploading(true);
  try {
    const fd = new FormData();
    fd.append("file", file);
    const resp = await fetch(`http://localhost:3001/api/upload/sound/${type}`, {
      method: "POST",
      body: fd,
    });
    if (resp.ok) {
      setSoundUploaded(true);
      setTimeout(() => setSoundUploaded(false), 2000);
    }
  } finally {
    setUploading(false);
  }
}
```

Replace the sound file display + upload area with:
```tsx
{/* Upload button */}
<div className="admin-field-row">
  <label className="admin-label">Fichier</label>
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <button
      type="button"
      className="admin-btn admin-btn--secondary"
      onClick={() => fileInputRef.current?.click()}
      disabled={uploading}
    >
      {uploading ? "Upload..." : "Remplacer le son"}
    </button>
    {soundUploaded && (
      <span style={{ color: "#4ade80", fontSize: 13 }}>✓ Uploadé</span>
    )}
    <input
      ref={fileInputRef}
      type="file"
      accept=".mp3"
      style={{ display: "none" }}
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) handleSoundUpload(f);
        e.target.value = "";
      }}
    />
  </div>
</div>
```

- [ ] **Step 2: Verify build**

```bash
cd packages/overlays && npx vite build
```

- [ ] **Step 3: Commit**

```bash
git add packages/overlays/src/components/admin/AlertCard.tsx
git commit -m "feat: simplify admin sound upload (remove filename, upload-only UX)"
```

---

### Task 10: Final build verification

**Files:** None (verification only)

- [ ] **Step 1: Full build check**

```bash
cd packages/overlays && npx vite build
```
Expected: Build succeeds, no TypeScript errors, no warnings.

- [ ] **Step 2: Verify all animation modules import correctly**

Check the output bundle includes the animation modules:
```bash
cd packages/overlays && npx vite build 2>&1 | grep -i "error\|warning"
```
Expected: No errors or warnings.

- [ ] **Step 3: Final commit if any cleanup needed**

Only if there are fixes from the verification steps.
