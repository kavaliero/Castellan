import { useState, useEffect } from "react";

/**
 * Calcule l'uptime à partir de startedAt (ISO string).
 * Met à jour toutes les 30 secondes.
 * Retourne un string formaté ("1h24", "12min") ou null si pas de stream.
 */
export function useUptime(startedAt: string | null): string | null {
  const [uptime, setUptime] = useState<string | null>(null);

  useEffect(() => {
    if (!startedAt) {
      setUptime(null);
      return;
    }

    function compute() {
      const start = new Date(startedAt!).getTime();
      const now = Date.now();
      const diffMs = now - start;

      if (diffMs < 0) {
        setUptime(null);
        return;
      }

      const totalMinutes = Math.floor(diffMs / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      if (hours > 0) {
        setUptime(`${hours}h${minutes.toString().padStart(2, "0")}`);
      } else {
        setUptime(`${minutes}min`);
      }
    }

    compute();
    const timer = setInterval(compute, 30000);
    return () => clearInterval(timer);
  }, [startedAt]);

  return uptime;
}
