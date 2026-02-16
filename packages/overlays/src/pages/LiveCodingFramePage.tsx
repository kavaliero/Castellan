import { useState, useCallback } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { LiveCodingFrame } from "../components/frame/LiveCodingFrame";
import type { WSEvent, StreamInfoPayload, StreamViewersPayload } from "@castellan/shared";


export function LiveCodinfFramePage() {

  const handleEvent = useCallback((event: WSEvent) => {
    switch (event.type) {
    }
  }, []);

  useWebSocket(handleEvent);

  return (
    <LiveCodingFrame
    />
  );
}
