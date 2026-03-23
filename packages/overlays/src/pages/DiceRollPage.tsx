/**
 * DiceRollPage — Page overlay pour les lancers de dés.
 * Écoute l'event WS dice:rolled et affiche l'animation.
 * Les animations sont mises en queue côté client : un seul dé visible à la fois.
 *
 * Architecture :
 *   - Le SERVEUR broadcast dice:rolled IMMÉDIATEMENT (pas de délai)
 *   - Le CLIENT queue les animations et les joue en séquence
 *   - Toute la logique de queue utilise des REFS (pas de useCallback/closures)
 *     pour éviter les problèmes de stale closures quand plusieurs events
 *     arrivent dans le même tick
 *   - Un safety timeout empêche la queue de rester bloquée
 *
 * Browser source OBS : http://localhost:3000/overlay/dice
 * Taille recommandée : 400x400, position centre
 */

import { useState, useRef, useEffect } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  DiceRollOverlay,
  type DiceRollData,
} from "../components/dice/DiceRollOverlay";
import type { WSEvent } from "@castellan/shared";

interface QueuedRoll {
  id: string;
  data: DiceRollData;
}

interface DiceTimingSettings {
  revealDelay: number;
  displayDuration: number;
  exitDuration: number;
}

const DEFAULT_SETTINGS: DiceTimingSettings = {
  revealDelay: 2500,
  displayDuration: 3000,
  exitDuration: 500,
};

/** Marge de sécurité ajoutée au safety timeout (ms) */
const SAFETY_MARGIN = 3000;

export function DiceRollPage() {
  // ── State visible par React (déclenche le rendu) ──
  const [current, setCurrent] = useState<QueuedRoll | null>(null);
  const [settings, setSettings] = useState<DiceTimingSettings>(DEFAULT_SETTINGS);

  // ── Refs internes (pas de re-render, pas de closure stale) ──
  const queueRef = useRef<QueuedRoll[]>([]);
  const isShowingRef = useRef(false);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef<DiceTimingSettings>(DEFAULT_SETTINGS);

  // Sync settingsRef à chaque render
  settingsRef.current = settings;

  // ── Charger les settings depuis le serveur au mount ──
  useEffect(() => {
    fetch("http://localhost:3001/api/settings/dice")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setSettings(data.settings);
          console.log("[DiceRoll] Settings chargés:", data.settings);
        }
      })
      .catch((err) => console.warn("[DiceRoll] Impossible de charger les settings:", err));
  }, []);

  // ══════════════════════════════════════════════════════════════
  // QUEUE LOGIC — Tout en refs, appelé via showNextRef.current()
  // ══════════════════════════════════════════════════════════════

  /**
   * showNextRef.current() — Passe à l'animation suivante dans la queue.
   * Utilise un ref pour que la même fonction soit accessible partout
   * sans dépendre de useCallback ni de closures React.
   */
  const showNextRef = useRef<() => void>(() => {});

  showNextRef.current = () => {
    // Clear safety timer
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }

    const next = queueRef.current.shift();
    if (!next) {
      setCurrent(null);
      isShowingRef.current = false;
      console.log("[DiceRoll] Queue vide, en attente");
      return;
    }

    isShowingRef.current = true;
    setCurrent(next);

    // Safety timeout : si onDone n'est jamais appelé, forcer le passage
    const s = settingsRef.current;
    const maxDuration = s.revealDelay + s.displayDuration + s.exitDuration + SAFETY_MARGIN;
    safetyTimerRef.current = setTimeout(() => {
      console.warn(`[DiceRoll] ⚠️ Safety timeout (${maxDuration}ms) — force passage au suivant`);
      showNextRef.current();
    }, maxDuration);

    console.log(
      `[DiceRoll] ▶ Animation d${next.data.faces} → ${next.data.result} ` +
      `(${queueRef.current.length} restant(s) en queue)`
    );
  };

  /**
   * Callback stable pour onDone — appelle toujours la dernière version
   * de showNext via le ref. Créé une seule fois, jamais recréé.
   */
  const onDoneRef = useRef(() => {
    console.log("[DiceRoll] 🔄 onDoneRef called → showNextRef.current()");
    showNextRef.current();
  });

  /**
   * handleEvent — Traite les events WebSocket.
   * Aussi via ref pour éviter toute dépendance useCallback.
   */
  const handleEventRef = useRef((event: WSEvent) => {
    if (event.type === "dice:rolled") {
      const { viewer, tier, dieType, faces, result, isNat20, challengeTitle, challengeType, challengeLabel } = event.payload;
      const roll: QueuedRoll = {
        id: crypto.randomUUID(),
        data: {
          displayName: viewer.displayName,
          tier,
          dieType,
          faces,
          result,
          isNat20,
          challengeTitle,
          challengeType,
          challengeLabel,
        },
      };

      queueRef.current.push(roll);
      console.log(
        `[DiceRoll] 📥 Reçu d${faces} → ${result} ` +
        `(queue: ${queueRef.current.length}, showing: ${isShowingRef.current})`
      );

      if (!isShowingRef.current) {
        showNextRef.current();
      }
    }

    if (event.type === "settings:dice" && event.payload) {
      setSettings(event.payload as DiceTimingSettings);
      console.log("[DiceRoll] Settings mis à jour via WS:", event.payload);
    }
  });

  // Le hook useWebSocket utilise déjà un ref interne (onEventRef),
  // donc on peut passer directement une fonction qui délègue au ref.
  useWebSocket((event) => handleEventRef.current(event));

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    };
  }, []);

  return (
    <div className="dice-roll-page">
      {current && (
        <DiceRollOverlay
          key={current.id}
          data={current.data}
          displayDuration={settings.displayDuration}
          onDone={onDoneRef.current}
        />
      )}
    </div>
  );
}
