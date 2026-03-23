/**
 * DiceBoardPage — Page overlay pour le widget persistant des derniers lancers.
 * Ecoute l'event WS dice:rolled et maintient un historique en memoire.
 *
 * Browser source OBS : http://localhost:3000/overlay/dice-board
 * Taille recommandee : 260x300, position en bas a droite
 */

import { useState, useCallback } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  DiceBoardOverlay,
  type DiceBoardEntry,
} from "../components/dice/DiceBoardOverlay";
import type { DiceRollData } from "../components/dice/DiceRollOverlay";
import type { WSEvent } from "@castellan/shared";

const MAX_HISTORY = 3;

export function DiceBoardPage() {
  const [entries, setEntries] = useState<DiceBoardEntry[]>([]);

  const handleEvent = useCallback((event: WSEvent) => {
    if (event.type === "dice:rolled") {
      const { viewer, tier, dieType, faces, result, isNat20 } = event.payload;
      const newEntry: DiceBoardEntry = {
        id: crypto.randomUUID(),
        data: {
          displayName: viewer.displayName,
          tier,
          dieType,
          faces,
          result,
          isNat20,
        } as DiceRollData,
        timestamp: Date.now(),
      };

      setEntries((prev) => [newEntry, ...prev].slice(0, MAX_HISTORY));
    }
  }, []);

  useWebSocket(handleEvent);

  return (
    <div className="dice-board-page">
      <DiceBoardOverlay entries={entries} />
    </div>
  );
}
