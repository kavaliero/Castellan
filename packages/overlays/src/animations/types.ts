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
