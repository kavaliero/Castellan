import { useEffect, useRef, useCallback, useState } from "react";
import type { WSEvent } from "@castellan/shared";

/**
 * Hook React pour la connexion WebSocket.
 * 
 * Pourquoi un hook custom ?
 * Parce que chaque overlay a besoin de :
 * 1. Se connecter au WebSocket du server
 * 2. Se reconnecter automatiquement si la connexion tombe
 * 3. Recevoir les events typés
 * 4. Nettoyer la connexion quand le composant est détruit
 * 
 * En encapsulant tout ça dans un hook, chaque overlay n'a qu'à écrire :
 *   useWebSocket((event) => { ... })
 * 
 * Le hook gère tout le reste.
 * 
 * --- Reconnexion automatique ---
 * OBS peut couper les Browser Sources à tout moment (changement de scène,
 * refresh, etc.). Le hook se reconnecte automatiquement avec un délai
 * progressif (1s, 2s, 4s, 8s... jusqu'à 30s max) pour ne pas spammer
 * le server si celui-ci est éteint.
 */

const WS_URL = "ws://localhost:3002";
const MAX_RECONNECT_DELAY = 30000; // 30 secondes max entre les tentatives

export function useWebSocket(onEvent: (event: WSEvent) => void) {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectDelay = useRef(1000);
    const [isConnected, setIsConnected] = useState(false);

    // useCallback pour que la référence de la fonction ne change pas
    // à chaque render (sinon useEffect se relancerait en boucle)
    const stableOnEvent = useCallback(onEvent, []);

    useEffect(() => {
        let reconnectTimer: ReturnType<typeof setTimeout>;
        let isMounted = true; // Pour éviter de setState après unmount

        function connect() {
            // Ne pas reconnecter si le composant est détruit
            if (!isMounted) return;

            const ws = new WebSocket(WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("[WS] ✅ Connecté au server Castellan");
                setIsConnected(true);
                // Reset le délai de reconnexion après une connexion réussie
                reconnectDelay.current = 1000;
              };

            ws.onmessage = (rawMessage) => {
                try {
                    const event = JSON.parse(rawMessage.data) as WSEvent;
                    stableOnEvent(event);
                } catch (err) {
                    console.error("[WS] Message invalide:", err);
                }
            };

            ws.onclose = () => {
                setIsConnected(false);
                if (!isMounted) return;
        
                console.log(`[WS] Déconnecté. Reconnexion dans ${reconnectDelay.current / 1000}s...`);
                reconnectTimer = setTimeout(() => {
                  // Augmente le délai (backoff exponentiel), plafonne à 30s
                  reconnectDelay.current = Math.min(reconnectDelay.current * 2, MAX_RECONNECT_DELAY);
                  connect();
                }, reconnectDelay.current);
              };

            ws.onerror = (err) => {
                console.error("[WS] Erreur:", err);
                ws.close(); // Déclenche onclose → reconnexion
            };
        }

        connect();

        // Cleanup : ferme proprement quand le composant est détruit
        return () => {
            isMounted = false;
            clearTimeout(reconnectTimer);
            wsRef.current?.close();
        };
    }, [stableOnEvent]);

    return { isConnected };
}