import { useState } from "react";
import { apiPost } from "../../hooks/useAdminApi";

interface HealthState {
  currentStream: boolean;
  uptime: number;
  wsClients: number;
}

interface AdminStreamProps {
  health: HealthState | null;
}

export function AdminStream({ health }: AdminStreamProps) {
  const [title, setTitle] = useState("Stream sans titre");
  const [game, setGame] = useState("Just Chatting");
  const [broadcasterId, setBroadcasterId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isLive = health?.currentStream ?? false;

  async function handleStart() {
    setLoading(true);
    setError(null);
    const res = await apiPost("/api/stream/start", { title, game, broadcasterId: broadcasterId || undefined });
    setLoading(false);
    if (res.error) setError(res.error);
  }

  async function handleEnd() {
    setLoading(true);
    setError(null);
    const res = await apiPost("/api/stream/end");
    setLoading(false);
    if (res.error) setError(res.error);
  }

  async function handleClearChat() {
    const res = await apiPost("/api/chat/clear");
    if (res.error) setError(res.error);
  }

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  return (
    <div>
      <div className="admin-header">
        <h2>Stream Controls</h2>
        <p>Manage stream session and chat</p>
      </div>

      {/* Status */}
      <div className="admin-stream-status">
        <div className={`admin-stream-badge${isLive ? " admin-stream-badge--live" : " admin-stream-badge--offline"}`}>
          {isLive ? "LIVE" : "OFFLINE"}
        </div>
        {health && (
          <div className="admin-stream-info">
            Uptime: {formatUptime(health.uptime)} · WS clients: {health.wsClients}
          </div>
        )}
      </div>

      {/* Start form (only when offline) */}
      {!isLive && (
        <div className="admin-stream-form">
          <div className="admin-field">
            <label className="admin-label">Title</label>
            <input className="admin-input" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="admin-field">
            <label className="admin-label">Game</label>
            <input className="admin-input" value={game} onChange={e => setGame(e.target.value)} />
          </div>
          <div className="admin-field">
            <label className="admin-label">Broadcaster ID</label>
            <input className="admin-input" value={broadcasterId} onChange={e => setBroadcasterId(e.target.value)} placeholder="optional" />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="admin-stream-actions">
        {!isLive && (
          <button className="admin-btn admin-btn--success" onClick={handleStart} disabled={loading}>
            Start Stream
          </button>
        )}
        {isLive && (
          <button className="admin-btn admin-btn--danger" onClick={handleEnd} disabled={loading}>
            End Stream
          </button>
        )}
        <button className="admin-btn admin-btn--secondary" onClick={handleClearChat}>
          Clear Chat
        </button>
      </div>

      {error && <div className="admin-error">{error}</div>}
    </div>
  );
}
