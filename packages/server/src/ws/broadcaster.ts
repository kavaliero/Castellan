import { WebSocketServer, WebSocket } from "ws";
import type { WSEvent } from "@castellan/shared";
import { getGoalsInitPayload, getGoalsState } from "../services/goals.service";

/**
 * Le Broadcaster gère toutes les connexions WebSocket.
 * 
 * Son rôle est simple :
 * 1. Accepter les connexions des overlays OBS (chat, alerts, goals, credits)
 * 2. Quand le server veut envoyer un event, l'envoyer à TOUS les overlays connectés
 * 
 * C'est le pattern "pub/sub" (publish/subscribe) :
 * - Le server "publie" des events
 * - Les overlays "souscrivent" en se connectant au WebSocket
 * - Le broadcaster fait le lien entre les deux
 * 
 * Pourquoi un fichier séparé ? Parce que le broadcaster sera utilisé
 * par plusieurs parties du server (routes HTTP, heartbeat, commandes...).
 * L'isoler permet de l'importer partout sans créer de dépendances circulaires.
 */

let wss: WebSocketServer;

/**
 * Initialise le serveur WebSocket.
 * @param port Le port d'écoute (défaut: 3002)
 * 
 * On ne l'attache PAS au serveur Express (pas de "server upgrade").
 * Pourquoi ? Parce que Express écoute sur le port 3001 (HTTP pour StreamerBot)
 * et le WebSocket sur 3002. Séparer les ports simplifie le debug :
 * - Port 3001 → HTTP (StreamerBot, API, dashboard)
 * - Port 3002 → WebSocket (overlays OBS)
 */

export function initWebSocket(port: number = 3002): WebSocketServer {
  wss = new WebSocketServer({ port });

  wss.on("connection", (socket, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`[WS] 🔌 Overlay connecté (${clientIp}) — Total: ${wss.clients.size}`);


    // Envoyer un message de bienvenue — StreamerBot peut l'utiliser
    // pour confirmer que la connexion est active
    socket.send(JSON.stringify({
      type: "system:welcome",
      payload: {
        name: "Castellan",
        version: "0.1.0",
        uptime: process.uptime(),
      },
    }));

    // Envoyer l'état actuel des goals à ce nouveau client
    // pour qu'il affiche immédiatement les bonnes valeurs
    const goalsState = getGoalsState();
    for (const goal of getGoalsInitPayload()) {
      socket.send(JSON.stringify({ type: "goal:update", payload: goal }));
    }
    // Envoyer les last follow/sub comme alertes pour initialiser les noms
    if (goalsState.lastFollow) {
      socket.send(JSON.stringify({
        type: "alert:follow",
        payload: {
          viewer: {
            twitchId: "",
            username: goalsState.lastFollow.toLowerCase(),
            displayName: goalsState.lastFollow,
          },
        },
      }));
    }
    if (goalsState.lastSub) {
      socket.send(JSON.stringify({
        type: "alert:sub",
        payload: {
          viewer: {
            twitchId: "",
            username: goalsState.lastSub.toLowerCase(),
            displayName: goalsState.lastSub,
          },
          tier: 1,
          months: 0,
        },
      }));
    }

    // Répondre aux pings (keep-alive)
    socket.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        // Si StreamerBot envoie un ping, on répond pong
        if (msg.type === "ping") {
          socket.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        }

        // Futur : ici on pourra recevoir des commandes DE StreamerBot
        // par exemple : { type: "command:scene_change", data: { scene: "Gaming" } }

      } catch {
        // Message non-JSON, on ignore
      }
    });

    // Quand un overlay se déconnecte (changement de scène OBS, refresh...)
    socket.on("close", () => {
      console.log(`[WS] ❌ Overlay déconnecté — Total: ${wss.clients.size}`);
    });

    // Gestion d'erreur pour éviter que le server crash
    // si un overlay envoie des données invalides
    socket.on("error", (err) => {
      console.error(`[WS] Erreur:`, err.message);
    });
  });

  console.log(`[WS] 📡 WebSocket server lancé sur ws://localhost:${port}`);
  return wss;
}

/**
* Envoie un event typé à TOUS les overlays connectés.
* 
* Pourquoi vérifier readyState ? Parce qu'entre le moment où on récupère
* la liste des clients et le moment où on envoie, un client peut s'être
* déconnecté. Sans cette vérification, on aurait une erreur silencieuse.
*/

export function broadcast(event: WSEvent): void {
  if (!wss) {
    console.warn("[WS] Broadcast appelé avant l'initialisation du WebSocket server");
    return;
  }

  const message = JSON.stringify(event);
  let sent = 0;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sent++;
    }
  });

  // Log seulement si c'est un event "visible" (pas chaque message chat, ça spammerait)
  if (event.type !== "chat:message") {
    console.log(`[WS] 📤 ${event.type} → ${sent} overlay(s)`);
  }
}

/**
 * Retourne le nombre de clients WebSocket connectés.
 * Utilisé par le health check.
 */
export function getClientCount(): number {
  return wss?.clients.size ?? 0;
}