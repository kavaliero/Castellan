/**
 * Hook pour jouer des sons dans les overlays.
 * 
 * Les fichiers sons sont dans /public/sounds/ du projet overlays.
 * Quand Vite build, tout le dossier /public est copié tel quel.
 * → En prod, les sons sont accessibles via /sounds/follow.mp3
 * 
 * On pré-charge les sons au montage du composant pour éviter
 * un délai entre l'event et le son (le fichier doit être téléchargé
 * la première fois, ce qui peut prendre quelques centaines de ms).
 */

import { useRef, useEffect, useCallback } from "react";

// Catalogue de tous les sons disponibles
const SOUND_MAP: Record<string, string> = {
    follow: "/sounds/follow.mp3",
    sub: "/sounds/sub.mp3",
    raid: "/sounds/raid.mp3",
    bits: "/sounds/bits.mp3",
    dice: "/sounds/dice.mp3",
};

export function useSound() {
    // Cache des objets Audio pré-chargés
    const audioCache = useRef<Record<string, HTMLAudioElement>>({});

    // Pré-charger tous les sons au montage
    useEffect(() => {
        Object.entries(SOUND_MAP).forEach(([key, path]) => {
            const audio = new Audio(path);
            audio.preload = "auto"; // Télécharge le fichier immédiatement
            audio.volume = 0.7;     // Volume par défaut (0.0 à 1.0)
            audioCache.current[key] = audio;
        });
    }, []);

    /**
 * Joue un son par son nom.
 * Si le même son est déjà en train de jouer, on le relance
 * depuis le début (pour les follows rapides par exemple).
 */

    const playSound = useCallback((soundName: string) => {
        const audio = audioCache.current[soundName];
        if (!audio) {
            console.warn(`[Sound] Son inconnu: ${soundName}`);
            return;
        }

        // Reset au début si déjà en cours de lecture
        audio.currentTime = 0;
        audio.play().catch((err) => {
            // Les navigateurs bloquent l'autoplay tant que l'utilisateur
            // n'a pas interagi avec la page. Dans OBS Browser Source,
            // il y a une option "Interact" qui débloque ça.
            // En pratique, OBS autorise l'autoplay par défaut.
            console.warn(`[Sound] Impossible de jouer ${soundName}:`, err.message);
        });
    }, []);

    return { playSound };
}