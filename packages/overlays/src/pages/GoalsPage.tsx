import { useState, useCallback } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { GuildPanel } from "../components/goals/GuildPanel";
import type { WSEvent, GoalPayload } from "@castellan/shared";

/**
 * Page Goals — affiche le panneau de guilde complet.
 * 
 * Écoute les events:
 * - goal:update   → met à jour les barres Objectif Followers / Objectif Sub
 * - alert:follow  → capture le nom du dernier follower
 * - alert:sub     → capture le nom du dernier sub
 * - alert:gift_sub → capture le nom du dernier sub (gift)
 */

export function GoalsPage() {
    const [goals, setGoals] = useState<Record<string, GoalPayload>>({});
    const [lastFollow, setLastFollow] = useState<string | null>(null);
    const [lastSub, setLastSub] = useState<string | null>(null);
  
    const handleEvent = useCallback((event: WSEvent) => {
      switch (event.type) {
        case "goal:update":
          setGoals((prev) => ({
            ...prev,
            [event.payload.type]: event.payload,
          }));
          break;

        case "alert:follow":
          setLastFollow(event.payload.viewer.displayName);
          break;

        case "alert:sub":
          setLastSub(event.payload.viewer.displayName);
          break;

        case "alert:gift_sub":
          // Le gift sub compte aussi comme "dernier sub"
          setLastSub(event.payload.viewer.displayName);
          break;
      }
    }, []);

    useWebSocket(handleEvent);
    
    return (
      <GuildPanel
        goals={goals}
        lastFollow={lastFollow}
        lastSub={lastSub}
      />
    );
}
