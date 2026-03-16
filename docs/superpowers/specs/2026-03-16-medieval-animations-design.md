# Medieval Fantasy Animation System — Design Spec

## Overview

Replace the current CSS keyframe-based alert animations with a modular GSAP-powered animation system. Each alert type gets its own animation module with a unique medieval fantasy identity. Phase 1 covers the 4 most common alert types. Additionally, simplify the sound upload UX in the admin dashboard.

## Architecture

### Animation Module System

Each alert type has its own animation module — a file that exports an `enter()` and `exit()` function, each returning a GSAP timeline.

```
packages/overlays/src/animations/
├── types.ts              # AnimationModule interface
├── registry.ts           # Map alert type → module
├── medieval/
│   ├── follow.ts         # Royal parchment + wax seal
│   ├── sub.ts            # Sword + lightning
│   ├── bits.ts           # Treasure chest + gold coins
│   └── raid.ts           # Castle gate + knights
└── default.ts            # Fallback: current animation reproduced in GSAP
```

### AnimationModule Interface

```ts
interface AnimationModule {
  // Build the enter timeline. Caller is responsible for playing it.
  enter(container: HTMLElement, data: ScrollAlertData): gsap.core.Timeline;
  // Build the exit timeline.
  exit(container: HTMLElement): gsap.core.Timeline;
}
```

### Registry

```ts
// registry.ts
const registry: Record<string, AnimationModule> = {
  follow: followModule,
  sub: subModule,
  bits: bitsModule,
  raid: raidModule,
  // All others fall back to default
};

export function getAnimationModule(type: string): AnimationModule {
  return registry[type] ?? defaultModule;
}
```

### ScrollAlert Integration

`ScrollAlert.tsx` changes from CSS-animation-driven to GSAP-driven:

1. Component renders all DOM elements with refs (no animation classes)
2. `useEffect` on mount: calls `module.enter(containerRef.current, data)` → timeline plays
3. After configured duration, calls `module.exit(containerRef.current)` → timeline plays → `onComplete` triggers unmount
4. Each animation module is responsible for creating/appending any extra DOM elements it needs (particles, effects) inside the container

**Duration handling**: The total alert duration remains configurable in admin. The animation module's `enter()` timeline runs first, then a pause (reading time), then `exit()`. The pause duration = `totalDuration - enterDuration - exitDuration`.

## Phase 1 Animations

### Follow — Royal Parchment with Wax Seal

**Duration**: ~7s total

| Time | Action | GSAP Details |
|------|--------|-------------|
| 0–0.6s | Parchment drops from above with slight swing | `y: -100%→0`, `rotation: -3→0`, ease: `power2.out` |
| 0.6–0.9s | Wax seal stamps onto center | `scale: 0→1.2→1`, ease: `back.out(2)` |
| 0.9–1.3s | Seal cracks, wax particles burst | 8-12 particle divs, `scatter` with random angles, `opacity: 1→0` |
| 1.3–2.5s | Parchment unrolls downward revealing content | `height: 0→auto` (or clipPath), ease: `power2.out` |
| 2.5–6.0s | Reading pause | No animation |
| 6.0–7.0s | Parchment re-rolls and rises | Reverse of unroll + `y: 0→-100%`, `opacity: 1→0` |

**DOM elements**: Parchment background (textured div), wax seal (red circle with emblem), crack particles (small absolute divs), content text area.

### Sub — Planted Sword with Lightning

**Duration**: ~8s total

| Time | Action | GSAP Details |
|------|--------|-------------|
| 0–0.15s | Lightning flash | Full-screen white div, `opacity: 0→0.8→0` |
| 0.15–0.65s | Sword falls and plants | `y: -200%→0`, ease: `bounce.out` |
| 0.65–1.05s | Shockwave from impact point | Circle border, `scale: 0→3`, `opacity: 1→0` |
| 1.05–3.05s | Lightning crackles along blade | Looping particle divs along sword, `opacity` flicker |
| 1.05–1.85s | Banner unfurls behind sword | `scaleX: 0→1`, ease: `power2.out` |
| 1.85–5.5s | Reading pause | Lightning continues looping |
| 5.5–6.3s | Sword disintegrates into gold particles | 20-30 particles, stagger `y: random(-50,-150)`, `opacity: 1→0` |

**DOM elements**: Lightning flash (full div), sword (vertical div + SVG blade), shockwave (circle border), lightning particles (small divs), banner (text container), disintegration particles.

### Bits — Treasure Chest

**Duration**: ~7.5s total

| Time | Action | GSAP Details |
|------|--------|-------------|
| 0–0.4s | Chest bounces in | `scale: 0→1`, ease: `back.out(1.7)` |
| 0.4–0.7s | Chest shakes, golden light leaks | `x: -3→3` rapid, glow div `opacity: 0→0.6` |
| 0.7–1.1s | Lid opens | Lid div `rotateX: 0→-110deg`, transform-origin top |
| 1.1–2.1s | Gold coins explode upward | 15-20 circle divs, `y: 0→random(-80,-200)` then gravity `y→+50`, parabolic via GSAP physics ease |
| 1.1–2.1s | Golden halo pulses behind chest | Radial gradient div, `scale: 0.8→1.2`, repeat, yoyo |
| 1.5–2.1s | Text rises from chest | `y: 30→0`, `opacity: 0→1` |
| 2.1–5.5s | Reading pause | Halo continues pulsing |
| 5.5–6.5s | Coins fall back, lid closes, fade out | Reverse coins, `rotateX: -110→0`, `opacity: 1→0` |

**DOM elements**: Chest base (div), chest lid (div, pivot top), gold coins (circle divs), golden halo (radial-gradient div), text area.

### Raid — Castle Gate and Knights

**Duration**: ~8.5s total

| Time | Action | GSAP Details |
|------|--------|-------------|
| 0–0.5s | Banners drop from sides | Left/right divs, `y: -100%→0`, ease: `power2.out` |
| 0.5–1.3s | Portcullis (herse) rises | Grid SVG, `y: 0→-100%`, ease: `power3.out` |
| 1.3–2.5s | Knight silhouettes advance | 3-4 divs, stagger 0.3s, `x: 0→offset`, `scale: 0.8→1` |
| 2.5–3.1s | Central banner unfurls with raider name | `scaleY: 0→1`, ease: `power2.out` |
| 1.3–6.5s | Dust particles at ground level | Small divs, slow drift, `opacity` flicker |
| 3.1–6.5s | Reading pause | Dust continues |
| 6.5–7.5s | Portcullis descends, banners rise, fade | Reverse enter, `opacity: 1→0` |

**DOM elements**: Side banners (2 divs), portcullis (SVG grid pattern), knight silhouettes (3-4 divs with CSS clip-path), central banner (text container), dust particles (8-10 small divs).

## CSS → GSAP Migration

### What changes in ScrollAlert.tsx

- Remove all animation-related CSS classes from elements
- Add `useRef` for the main container and key sub-elements
- On mount: get module from registry, call `enter()`, store timeline ref
- On exit trigger (duration timeout): call `exit()`, clean up on complete
- Keep React responsible for rendering structure, GSAP responsible for motion

### What stays in alerts.css

- Layout rules (flexbox, positioning, sizing)
- Visual styling (colors, backgrounds, textures, borders, gradients)
- The `.scroll-media` z-index layering

### What gets removed from alerts.css

All `@keyframes` blocks:
- `scroll-enter`, `scroll-exit`
- `seal-appear`, `seal-hide`, `seal-split-left`, `seal-split-right`
- `seal-icon-bounce`, `seal-icon-fade`
- `seal-burst`
- `crack-appear`, `crack-disappear`
- `scroll-unroll`

All `animation:` property declarations on elements.

### Default Module

The `default.ts` module reproduces the current CSS animation sequence in GSAP:
1. Parchment slides in (0.6s)
2. Seal appears and splits (0.8s)
3. Content unrolls (1.5s)
4. Pause
5. Fade out and slide up (1s)

This ensures the 6 types without custom animations (resub, gift_sub, gift_sub_bomb, hype_train, sub_goal, follow_goal) continue to work identically.

## Admin Sound Upload Simplification

### Current behavior
- Toggle enabled/disabled
- Text display showing current filename
- Upload button
- Volume slider

### New behavior
- Toggle enabled/disabled
- Upload button labeled "Remplacer le son" (or "Upload .mp3")
- Volume slider 0-100%
- No filename display, no text input

### Logic
- Sound file is always `{type}.mp3` — convention, not configurable
- Upload hits existing `POST /api/upload/sound/:type` → overwrites file on disk
- `sound.file` in config is auto-set to `{type}.mp3` after upload (kept for compat)
- On successful upload, a brief "✓ Uploadé" confirmation shows for 2s

### Changes
- **AlertCard.tsx**: Remove filename display, simplify sound section to toggle + upload button + volume
- **No server changes needed** — endpoint already works correctly

## Dependencies

- **gsap** (npm package) — MIT-compatible free license for non-commercial use. ~23kb minified.
- No other new dependencies.

## Out of Scope

- Phase 2 animations (hype_train dragon, sub variants, goals)
- Canvas/WebGL particles
- Complex SVG assets (everything is CSS shapes/gradients + simple inline SVG)
- Sound preview/playback in admin
- Animation preview in admin
