/**
 * ChallengePage — Page overlay pour la liste des defis actifs.
 * Affiche les compteurs (squatts) et timers (voix de Stitch, etc.)
 * avec animations d'entree/sortie GSAP.
 *
 * Gere une file de suppression differee : quand un defi est complete,
 * on le marque "exiting" pour laisser le temps a l'animation de sortie,
 * puis on le retire du DOM apres ~600ms.
 *
 * Browser source OBS : http://localhost:3000/overlay/challenges
 * Taille recommandee : 350x600, position a droite
 */

import { useState, useCallback, useRef } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { ChallengeListOverlay } from "../components/challenges/ChallengeListOverlay";
import type { WSEvent, ChallengePayload } from "@castellan/shared";

/** Extension locale : on ajoute un flag "exiting" pour l'animation de sortie */
export interface ChallengeWithState extends ChallengePayload {
  _exiting?: boolean;
}

const EXIT_ANIMATION_MS = 700; // duree de l'animation de sortie

export function ChallengePage() {
  const [challenges, setChallenges] = useState<ChallengeWithState[]>([]);
  const exitTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  /** Marque un defi comme "exiting" et programme sa suppression */
  const scheduleRemoval = useCallback((id: string) => {
    // Eviter les doublons
    if (exitTimers.current.has(id)) return;

    // Marquer exiting
    setChallenges((prev) =>
      prev.map((c) => (c.id === id ? { ...c, _exiting: true } : c))
    );

    // Retirer du DOM apres l'animation
    const timer = setTimeout(() => {
      setChallenges((prev) => prev.filter((c) => c.id !== id));
      exitTimers.current.delete(id);
    }, EXIT_ANIMATION_MS);

    exitTimers.current.set(id, timer);
  }, []);

  const handleEvent = useCallback((event: WSEvent) => {
    if (event.type === "challenge:list") {
      setChallenges(event.payload.challenges.filter((c) => c.isActive));
    }

    if (event.type === "challenge:update") {
      const updated = event.payload;

      if (!updated.isActive) {
        // Défi complété → mettre à jour les données (barre à 100%) PUIS animation de sortie
        setChallenges((prev) => {
          const exists = prev.find((c) => c.id === updated.id);
          if (exists) {
            // Forcer current = target pour que la barre soit pleine avant la sortie
            return prev.map((c) =>
              c.id === updated.id
                ? { ...updated, current: updated.target, isActive: true }
                : c
            );
          }
          return prev;
        });
        // Petit délai pour laisser le rendu de la barre à 100% avant l'animation de sortie
        setTimeout(() => scheduleRemoval(updated.id), 400);
        return;
      }

      setChallenges((prev) => {
        const exists = prev.find((c) => c.id === updated.id);
        if (exists) {
          return prev.map((c) => (c.id === updated.id ? { ...updated } : c));
        }
        return [...prev, { ...updated }];
      });
    }

    if (event.type === "challenge:completed") {
      // Forcer la barre à 100% avant la sortie (si pas déjà fait par challenge:update)
      setChallenges((prev) =>
        prev.map((c) =>
          c.id === event.payload.id
            ? { ...c, current: c.target, isActive: true }
            : c
        )
      );
      setTimeout(() => scheduleRemoval(event.payload.id), 400);
    }
  }, [scheduleRemoval]);

  useWebSocket(handleEvent);

  return (
    <div style={{ padding: "10px" }}>
      <ChallengeListOverlay challenges={challenges} />
    </div>
  );
}
