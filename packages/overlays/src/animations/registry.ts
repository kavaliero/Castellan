import type { AnimationModule } from "./types";

const registry: Record<string, AnimationModule> = {};

export function getAnimationModule(type: string): AnimationModule | null {
  return registry[type] ?? null;
}

export function registerAnimation(type: string, module: AnimationModule): void {
  registry[type] = module;
}
