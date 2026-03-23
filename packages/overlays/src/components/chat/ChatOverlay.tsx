import type { ChatMessagePayload } from "@castellan/shared";
import { ChatMessage } from "./ChatMessage";
import { FrameCorners, MedievalParticles, OrnamentalDivider } from "../shared";
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
      <div className="chat-frame">
        <FrameCorners variant="subtle" />
      </div>

      <MedievalParticles variant="dust" />

      <div className="chat-messages">
        <div>
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <OrnamentalDivider variant="line" className="chat-bottom-ornament" />
    </div>
  );
}
