import { useState, useCallback } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { ChatOverlay } from "../components/chat/ChatOverlay";
import type { WSEvent, ChatMessagePayload } from "@castellan/shared";

/**
 * Page Chat — c'est ce qui sera affiché dans la Browser Source OBS.
 * 
 * Architecture :
 * - ChatPage gère l'ÉTAT (la liste des messages)
 * - ChatOverlay gère l'AFFICHAGE (le rendu visuel)
 * 
 * Pourquoi séparer ? Parce que plus tard, quand tu mettras le style
 * médiéval, tu ne toucheras QUE ChatOverlay, pas la logique ici.
 */

// Nombre max de messages affichés — les anciens disparaissent
const MAX_MESSAGES = 30;

export function ChatPage() {
    const [messages, setMessages] = useState<ChatMessagePayload[]>([]);
  
    const handleEvent = useCallback((event: WSEvent) => {
      switch (event.type) {
        case "chat:message":
          setMessages((prev) => {
            // Ajoute le nouveau message à la fin, garde les MAX_MESSAGES derniers
            const updated = [...prev, event.payload];
            return updated.slice(-MAX_MESSAGES);
          });
          break;
  
        case "chat:clear":
          // Quand un mod clear le chat
          setMessages([]);
          break;
      }
    }, []);
  
    useWebSocket(handleEvent);
  
    return <ChatOverlay messages={messages} />;
  }