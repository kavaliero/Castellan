/**
 * LoyaltyCardPage — Page overlay pour la carte de fidelite.
 * Ecoute les events WS stamp:incremented et stamp:max_reached,
 * affiche la carte pendant quelques secondes puis la cache.
 *
 * Browser source OBS : http://localhost:3000/overlay/loyalty-card
 * Taille recommandee : 500x400, position bas-droite
 */

import { useState, useCallback, useRef } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  LoyaltyCardOverlay,
  type LoyaltyCardData,
} from "../components/loyalty-card/LoyaltyCardOverlay";
import type { WSEvent } from "@castellan/shared";

interface QueuedCard {
  id: string;
  data: LoyaltyCardData;
}

export function LoyaltyCardPage() {
  const [current, setCurrent] = useState<QueuedCard | null>(null);
  const queueRef = useRef<QueuedCard[]>([]);
  const isShowingRef = useRef(false);

  const showNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) {
      setCurrent(null);
      isShowingRef.current = false;
      return;
    }
    isShowingRef.current = true;
    setCurrent(next);
  }, []);

  const enqueue = useCallback(
    (card: QueuedCard) => {
      queueRef.current.push(card);
      if (!isShowingRef.current) {
        showNext();
      }
    },
    [showNext]
  );

  const handleEvent = useCallback(
    (event: WSEvent) => {
      if (event.type === "stamp:incremented") {
        const { viewer, stampCount, stampTotal } = event.payload;
        // Si c'est le 10e tampon, on affiche directement avec maxReached
        // (stamp:max_reached arrive juste apres, on l'ignore)
        enqueue({
          id: crypto.randomUUID(),
          data: {
            displayName: viewer.displayName,
            stampCount,
            stampTotal,
            maxReached: stampCount >= stampTotal,
          },
        });
      }

      // On ignore stamp:max_reached car deja gere au-dessus
    },
    [enqueue]
  );

  useWebSocket(handleEvent);

  return (
    <div className="loyalty-card-page">
      {current && (
        <LoyaltyCardOverlay
          key={current.id}
          data={current.data}
          onDone={showNext}
        />
      )}
    </div>
  );
}
