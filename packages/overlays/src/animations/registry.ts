import type { AnimationModule } from "./types";
import { defaultModule } from "./default";
import { followModule } from "./medieval/follow";
import { subModule } from "./medieval/sub";

const registry: Record<string, AnimationModule> = {
  follow: followModule,
  sub: subModule,
};

export function getAnimationModule(type: string): AnimationModule {
  return registry[type] ?? defaultModule;
}

export function registerAnimation(type: string, module: AnimationModule): void {
  registry[type] = module;
}
