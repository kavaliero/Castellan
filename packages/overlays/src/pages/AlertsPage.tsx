import { useState, useCallback, useRef } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { useSound } from "../hooks/useSound";
import { ScrollAlert } from "../components/alerts/ScrollAlert";
import type { ScrollAlertType, ScrollAlertVariant } from "../components/alerts/ScrollAlert";
import type { WSEvent } from "@castellan/shared";

/**
 * Page Alerts — gère la FILE d'attente des alertes "Parchemin Scellé".
 *
 * Chaque alerte est un parchemin avec un sceau de cire coloré.
 * L'animation complète dure ~8s (apparition, crack du sceau,
 * déroulement, pause lecture, disparition).
 */

interface AlertItem {
    id: string;
    type: ScrollAlertType;
    variant: ScrollAlertVariant;
    icon: string;
    title: string;
    viewerName: string;
    subtitle?: string;
    ribbon?: string;
    sound: string;
}

// Durée d'affichage d'une alerte (en ms)
// Doit correspondre à la durée totale de l'animation CSS (~9.5s)
const ALERT_DURATION = 9500;

export function AlertsPage() {
    const [currentAlert, setCurrentAlert] = useState<AlertItem | null>(null);
    const queueRef = useRef<AlertItem[]>([]);
    const isShowingRef = useRef(false);
    const { playSound } = useSound();

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
                        variant: "minor",
                        icon: "⚔️",
                        title: "Un nouveau chevalier rejoint La Kavalry !",
                        viewerName: event.payload.viewer.displayName,
                        sound: "follow",
                    });
                    break;

                case "alert:sub": {
                    const isResub = event.payload.months > 1;
                    const tierName = event.payload.tier === 3 ? "Seigneur"
                                   : event.payload.tier === 2 ? "Chevalier"
                                   : "Écuyer";
                    enqueueAlert({
                        id: crypto.randomUUID(),
                        type: isResub ? "resub" : "sub",
                        variant: "minor",
                        icon: "👑",
                        title: isResub ? "Renouvelle son serment !" : "Serment d'allégeance !",
                        viewerName: event.payload.viewer.displayName,
                        subtitle: `Rang : ${tierName}`,
                        ribbon: isResub ? `${event.payload.months} lunes` : undefined,
                        sound: "sub",
                    });
                    break;
                }

                case "alert:gift_sub": {
                    const gifterName = event.payload.anonymous
                        ? "Un bienfaiteur anonyme"
                        : event.payload.viewer.displayName;
                    enqueueAlert({
                        id: crypto.randomUUID(),
                        type: "gift_sub",
                        variant: "minor",
                        icon: "🎁",
                        title: "Don d'allégeance !",
                        viewerName: gifterName,
                        subtitle: `offre un sub à ${event.payload.recipientName}`,
                        sound: "sub",
                    });
                    break;
                }

                case "alert:raid":
                    enqueueAlert({
                        id: crypto.randomUUID(),
                        type: "raid",
                        variant: "major",
                        icon: "🏰",
                        title: "Les portes sont assiégées !",
                        viewerName: event.payload.fromChannel,
                        subtitle: `${event.payload.viewers} chevaliers débarquent !`,
                        sound: "raid",
                    });
                    break;

                case "alert:bits":
                    enqueueAlert({
                        id: crypto.randomUUID(),
                        type: "bits",
                        variant: "minor",
                        icon: "💎",
                        title: "Tribut au royaume !",
                        viewerName: event.payload.viewer.displayName,
                        subtitle: `${event.payload.amount} gemmes`,
                        sound: "bits",
                    });
                    break;

                case "alert:hype_train":
                    enqueueAlert({
                        id: crypto.randomUUID(),
                        type: "hype_train",
                        variant: "major",
                        icon: "🔥",
                        title: `Hype Train — Niveau ${event.payload.level} !`,
                        viewerName: "Le royaume s'enflamme !",
                        subtitle: `${event.payload.totalPoints} points`,
                        sound: "raid",
                    });
                    break;

                case "alert:first_word":
                    enqueueAlert({
                        id: crypto.randomUUID(),
                        type: "first_word",
                        variant: "minor",
                        icon: "✒",
                        title: "Première parole au conseil !",
                        viewerName: event.payload.viewer.displayName,
                        sound: "follow",
                    });
                    break;

                case "alert:dice":
                    enqueueAlert({
                        id: crypto.randomUUID(),
                        type: "dice",
                        variant: "minor",
                        icon: "🎲",
                        title: `Lancer de d${event.payload.faces}`,
                        viewerName: event.payload.viewer.displayName,
                        subtitle: `Résultat : ${event.payload.result}`,
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
                <ScrollAlert key={currentAlert.id} alert={currentAlert} />
            )}
        </div>
    );
}
