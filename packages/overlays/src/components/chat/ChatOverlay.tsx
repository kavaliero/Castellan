import type { ChatMessagePayload } from "@castellan/shared";
import { ChatMessage } from "./ChatMessage";
import { Particles } from "./Particles";
import { useEffect, useRef } from "react";
import "./chat.css";

interface ChatOverlayProps {
  messages: ChatMessagePayload[];
}

export function ChatOverlay({ messages }: ChatOverlayProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="chat-container">
      {/* Cadre intérieur doré */}
      <div className="chat-frame">
        <div className="chat-frame-corner chat-frame-corner--tl" />
        <div className="chat-frame-corner chat-frame-corner--tr" />
        <div className="chat-frame-corner chat-frame-corner--bl" />
        <div className="chat-frame-corner chat-frame-corner--br" />
      </div>

      <Particles />

      <div className="chat-messages">
        <div>
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="chat-bottom-ornament" />
    </div>
  );
}
