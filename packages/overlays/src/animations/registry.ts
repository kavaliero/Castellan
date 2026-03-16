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
