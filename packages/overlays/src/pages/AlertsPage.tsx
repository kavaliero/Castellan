import { useState, useCallback, useRef } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { useSound } from "../hooks/useSound";
import { AlertPopup } from "../components/alerts/AlertPopup";
import type { WSEvent } from "@castellan/shared";

/**
 * Page Alerts — gère la FILE d'attente des alertes.
 * 
 * Problème : si 3 personnes follow en même temps, on ne veut pas
 * 3 popups empilées. On veut les montrer une par une.
 * 
 * Solution : une queue. Chaque alerte est ajoutée à la queue.
 * On affiche la première, et quand elle disparaît (après X secondes),
 * on passe à la suivante.
 * 
 * Le type AlertItem contient toutes les infos nécessaires pour
 * afficher n'importe quel type d'alerte (follow, sub, raid, bits, dice).
 */

interface AlertItem {
    id: string;
    type: string;
    title: string;
    message: string;
    icon: string;
    sound: string;
}

// Durée d'affichage d'une alerte (en ms)
const ALERT_DURATION = 5000;

export function AlertsPage() {
    const [currentAlert, setCurrentAlert] = useState<AlertItem | null>(null);
    const queueRef = useRef<AlertItem[]>([]);
    const isShowingRef = useRef(false);
    const { playSound } = useSound();

    /**
     * Affiche la prochaine alerte de la queue.
     * Se rappelle elle-même après ALERT_DURATION pour enchaîner.
     */

    const showNext = useCallback(() => {

        if (queueRef.current.length === 0) {
            isShowingRef.current = false;
            setCurrentAlert(null);
            return;
        }

        isShowingRef.current = true;
        const next = queueRef.current.shift()!;
        setCurrentAlert(next);
        playSound(next.sound);

        setTimeout(() => {
            showNext();
        }, ALERT_DURATION);
    }, [playSound]);

    /**
     * Ajoute une alerte à la queue.
     * Si rien n'est affiché, lance immédiatement.
     */

    const enqueueAlert = useCallback(
        (alert: AlertItem) => {
            queueRef.current.push(alert);
            if (!isShowingRef.current) {
                showNext();
            }
        },
        [showNext]
    );

    const handleEvent = useCallback(
        (event: WSEvent) => {
            switch (event.type) {
                case "alert:follow":
                    enqueueAlert({
                        id: crypto.randomUUID(),
                        type: "follow",
                        icon: "❤️",
                        title: "Nouveau Follower !",
                        message: event.payload.viewer.displayName,
                        sound: "follow",
                    });
                    break;

                case "alert:sub":
                    enqueueAlert({
                        id: crypto.randomUUID(),
                        type: "sub",
                        icon: "⭐",
                        title: `Sub Tier ${event.payload.tier} !`,
                        message: `${event.payload.viewer.displayName} (${event.payload.months} mois)`,
                        sound: "sub",
                    });
                    break;

                case "alert:raid":
                    enqueueAlert({
                        id: crypto.randomUUID(),
                        type: "raid",
                        icon: "🏰",
                        title: `Raid de ${event.payload.fromChannel} !`,
                        message: `${event.payload.viewers} chevaliers débarquent !`,
                        sound: "raid",
                    });
                    break;

                case "alert:bits":
                    enqueueAlert({
                        id: crypto.randomUUID(),
                        type: "bits",
                        icon: "💎",
                        title: `${event.payload.amount} Bits !`,
                        message: event.payload.viewer.displayName,
                        sound: "bits",
                    });
                    break;

                case "alert:dice":
                    enqueueAlert({
                        id: crypto.randomUUID(),
                        type: "dice",
                        icon: "🎲",
                        title: `Lancer de d${event.payload.faces}`,
                        message: `${event.payload.viewer.displayName} → ${event.payload.result} !`,
                        sound: "dice",
                    });
                    break;
            }
        },

        [enqueueAlert]
    );

    useWebSocket(handleEvent);

    return (
        <div className="alerts-page">
            {currentAlert && (
                <AlertPopup key={currentAlert.id} alert={currentAlert} />
            )}
        </div>
    );
}