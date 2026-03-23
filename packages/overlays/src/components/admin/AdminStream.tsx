import { useState, useCallback } from "react";
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

      {/* Test Overlays */}
      <TestOverlaysPanel />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TEST OVERLAYS PANEL
// ═══════════════════════════════════════════════════════════════

interface TestButton {
  key: string;
  label: string;
  icon: string;
}

const TEST_GROUPS: { title: string; icon: string; buttons: TestButton[] }[] = [
  {
    title: "Alertes",
    icon: "\u{1F514}",
    buttons: [
      { key: "follow", label: "Follow", icon: "\u{2764}\u{FE0F}" },
      { key: "sub", label: "Sub", icon: "\u{2B50}" },
      { key: "resub", label: "Resub", icon: "\u{1F504}" },
      { key: "gift_sub", label: "Gift Sub", icon: "\u{1F381}" },
      { key: "raid", label: "Raid", icon: "\u{1F3F0}" },
      { key: "bits", label: "Bits", icon: "\u{1F4B0}" },
      { key: "first_word", label: "First Word", icon: "\u{1F4AC}" },
      { key: "dice", label: "Dice (old)", icon: "\u{1F3B2}" },
    ],
  },
  {
    title: "Carte de Fidelite",
    icon: "\u{1F4DC}",
    buttons: [
      { key: "stamp_3", label: "Tampon 3/10", icon: "\u{1F4CD}" },
      { key: "stamp_9", label: "Tampon 9/10", icon: "\u{1F4CD}" },
      { key: "stamp_max", label: "Carte pleine !", icon: "\u{2728}" },
    ],
  },
  {
    title: "Systeme de Des",
    icon: "\u{1F3B2}",
    buttons: [
      { key: "dice_earned", label: "De gagne", icon: "\u{1F381}" },
      { key: "dice_squatt_d6", label: "d6 squatt (4)", icon: "\u{1F4AA}" },
      { key: "dice_squatt_d12", label: "d12 squatt sub (9)", icon: "\u{1F4AA}" },
      { key: "dice_raid_d12", label: "d12 squatt raid (7)", icon: "\u{2694}\u{FE0F}" },
      { key: "dice_wheel_miss", label: "d20 roue (13)", icon: "\u{1F3AF}" },
      { key: "dice_wheel_nat20", label: "d20 NAT 20 !", icon: "\u{1F451}" },
    ],
  },
];

function TestOverlaysPanel() {
  const [lastTest, setLastTest] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const fireTest = useCallback(async (key: string) => {
    setTesting(true);
    setLastTest(null);
    const res = await apiPost(`/api/alerts/test/${key}`);
    setTesting(false);
    if (res.error) {
      setLastTest(`Erreur: ${res.error}`);
    } else {
      setLastTest(key);
    }
  }, []);

  return (
    <div className="admin-test-panel">
      <div className="admin-test-header">
        <h3>{"\u{1F9EA}"} Test Overlays</h3>
        {lastTest && !lastTest.startsWith("Erreur") && (
          <span className="admin-test-last">{"\u{2705}"} {lastTest}</span>
        )}
        {lastTest?.startsWith("Erreur") && (
          <span className="admin-test-last admin-test-last--error">{lastTest}</span>
        )}
      </div>
      {TEST_GROUPS.map((group) => (
        <div key={group.title} className="admin-test-group">
          <div className="admin-test-group-title">
            {group.icon} {group.title}
          </div>
          <div className="admin-test-buttons">
            {group.buttons.map((btn) => (
              <button
                key={btn.key}
                className="admin-btn admin-btn--test"
                onClick={() => fireTest(btn.key)}
                disabled={testing}
                title={btn.key}
              >
                {btn.icon} {btn.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
