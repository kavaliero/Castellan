import { useRef, useCallback, useEffect } from "react";
import type { AlertsConfig } from "@castellan/shared";

const SOUND_BASE_URL = "http://localhost:3001/media/alerts/sounds";

export function useSound() {
  const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());

  const preloadFromConfig = useCallback((config: AlertsConfig) => {
    // Collect unique sound files from config
    const files = new Set<string>();
    for (const alertConfig of Object.values(config.alerts)) {
      if (alertConfig.sound.enabled && alertConfig.sound.file) {
        files.add(alertConfig.sound.file);
      }
    }

    // Preload new files, keep existing ones
    const newCache = new Map<string, HTMLAudioElement>();
    for (const file of files) {
      const existing = audioCache.current.get(file);
      if (existing) {
        newCache.set(file, existing);
      } else {
        const audio = new Audio(`${SOUND_BASE_URL}/${file}`);
        audio.preload = "auto";
        newCache.set(file, audio);
      }
    }
    audioCache.current = newCache;
  }, []);

  const playSound = useCallback((file: string | null, volume: number) => {
    if (!file) return;
    const audio = audioCache.current.get(file);
    if (!audio) return;
    try {
      audio.volume = volume;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {
      // Autoplay blocked in some browsers
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioCache.current.clear();
    };
  }, []);

  return { playSound, preloadFromConfig };
}
