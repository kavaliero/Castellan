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
