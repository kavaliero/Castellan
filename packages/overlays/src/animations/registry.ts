import type { AnimationModule } from "./types";
import { defaultModule } from "./default";

const registry: Record<string, AnimationModule> = {};

export function getAnimationModule(type: string): AnimationModule {
  return registry[type] ?? defaultModule;
}

export function registerAnimation(type: string, module: AnimationModule): void {
  registry[type] = module;
}
