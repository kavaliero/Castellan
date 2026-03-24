import type { AnimationModule } from "./types";
import { trumpetFollowModule } from "./medieval/trumpet-follow";

// Le module trompettes est utilise pour TOUTES les alertes.
// Les anciens modules (follow wax seal, sub, bits, raid) restent dans medieval/
// mais ne sont plus enregistres par defaut.

const registry: Record<string, AnimationModule> = {};

export function getAnimationModule(_type: string): AnimationModule {
  // Tous les types utilisent le module trompettes
  return registry[_type] ?? trumpetFollowModule;
}

export function registerAnimation(type: string, module: AnimationModule): void {
  registry[type] = module;
}
