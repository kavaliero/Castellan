import type { ChatMessagePayload, ChatEmote } from "@castellan/shared";

/**
 * Un seul message dans le chat.
 *
 * Pourquoi un composant séparé pour un seul message ?
 * 1. Isolation : les animations d'apparition seront sur CE composant
 * 2. Performance : React peut optimiser le re-render (un nouveau message
 *    n'a pas besoin de re-render tous les anciens)
 * 3. Lisibilité : badges, emotes, couleurs par rôle... tout est ici,
 *    pas mélangé avec la logique de scroll
 */

// ─── Emote parsing ────────────────────────────────────────────
//
// Transforme un message brut + son tableau d'emotes
// en segments affichables (texte ou image).
//
// Exemple :
//   content = "GG kavali1Hype bien joué"
//   emotes  = [{ name: "kavali1Hype", startIndex: 3, endIndex: 15, imageUrl: "..." }]
//   → [ {type:"text", text:"GG "}, {type:"emote", ...}, {type:"text", text:" bien joué"} ]

type MessagePart =
  | { type: "text"; text: string }
  | { type: "emote"; emote: ChatEmote };

function parseMessageParts(
  content: string,
  emotes: ChatEmote[] = [],
): MessagePart[] {
  if (!emotes.length) {
    return [{ type: "text", text: content }];
  }

  // Trier par startIndex croissant
  const sorted = [...emotes].sort((a, b) => a.startIndex - b.startIndex);
  const parts: MessagePart[] = [];
  let cursor = 0;

  for (const emote of sorted) {
    // Texte avant l'emote
    if (emote.startIndex > cursor) {
      const textBefore = content.slice(cursor, emote.startIndex);
      if (textBefore) parts.push({ type: "text", text: textBefore });
    }

    // L'emote elle-même
    parts.push({ type: "emote", emote });
    cursor = emote.endIndex + 1;
  }

  // Texte restant après la dernière emote
  if (cursor < content.length) {
    parts.push({ type: "text", text: content.slice(cursor) });
  }

  return parts;
}

// ─── Component ────────────────────────────────────────────────

interface ChatMessageProps {
  message: ChatMessagePayload;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const parts = parseMessageParts(message.content, message.emotes);

  return (
    <div className="chat-message">
      <span className="chat-username">{message.viewer.displayName}</span>
      <span className="chat-separator">:</span>
      <span className="chat-content">
        {parts.map((part, i) =>
          part.type === "text" ? (
            <span key={i}>{part.text}</span>
          ) : (
            <img
              key={i}
              src={part.emote.imageUrl}
              alt={part.emote.name}
              title={part.emote.name}
              className="chat-emote"
            />
          ),
        )}
      </span>
    </div>
  );
}