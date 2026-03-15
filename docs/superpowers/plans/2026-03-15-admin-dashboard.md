# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin dashboard page (`/admin`) for managing alerts, goals, and stream controls during live streams.

**Architecture:** New route in the overlays React app with a sidebar + content layout. Dark theme CSS isolated with `admin-` prefix. Communicates via existing REST API + WebSocket. One new server endpoint for test alerts.

**Tech Stack:** React 19, TypeScript, Vite 7, Express 5, WebSocket

**Spec:** `docs/superpowers/specs/2026-03-15-admin-dashboard-design.md`

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `packages/overlays/src/hooks/useAdminApi.ts` | Thin fetch wrapper: `apiGet`, `apiPut`, `apiPost` |
| `packages/overlays/src/components/admin/admin.css` | All admin styles (dark theme, `admin-` prefix) |
| `packages/overlays/src/pages/AdminPage.tsx` | Sidebar layout + section switching |
| `packages/overlays/src/components/admin/AdminStream.tsx` | Stream status, start/end/clear buttons |
| `packages/overlays/src/components/admin/AdminGoals.tsx` | Goals cards with progress bars |
| `packages/overlays/src/components/admin/AlertCard.tsx` | Single alert card (collapsed + expanded form) |
| `packages/overlays/src/components/admin/AdminAlerts.tsx` | Global config + alert cards grid |

### Modified files
| File | Changes |
|------|---------|
| `packages/overlays/src/App.tsx` | Add `/admin` route import + `<Route>` |
| `packages/server/src/index.ts` | Add `POST /api/alerts/test/:type` endpoint |

---

## Chunk 1: Foundation + Server

### Task 1: Create useAdminApi hook

**Files:**
- Create: `packages/overlays/src/hooks/useAdminApi.ts`

- [ ] **Step 1: Create the hook file**

```typescript
const API_BASE = "http://localhost:3001";

interface ApiResult<T = any> {
  data: T | null;
  error: string | null;
}

export async function apiGet<T = any>(path: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { data: null, error: body.error ?? `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { data, error: null };
  } catch {
    return { data: null, error: "Cannot connect to server" };
  }
}

export async function apiPut<T = any>(path: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { data: null, error: data.error ?? `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { data, error: null };
  } catch {
    return { data: null, error: "Cannot connect to server" };
  }
}

export async function apiPost<T = any>(path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { data: null, error: data.error ?? `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { data, error: null };
  } catch {
    return { data: null, error: "Cannot connect to server" };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/overlays/src/hooks/useAdminApi.ts
git commit -m "feat(admin): add useAdminApi fetch wrapper"
```

---

### Task 2: Create admin.css

**Files:**
- Create: `packages/overlays/src/components/admin/admin.css`

This is the full dark-theme stylesheet for the admin dashboard. All classes prefixed with `admin-`.

- [ ] **Step 1: Create the CSS file**

```css
/* ═══════════════════════════════════════════════════════════════
   ADMIN DASHBOARD — Dark theme
   All classes prefixed with admin- to avoid overlay collisions.
   ═══════════════════════════════════════════════════════════════ */

/* ─── Layout ─────────────────────────────────────────────────── */

.admin-layout {
  display: flex;
  min-height: 100vh;
  background: #0f0f1a;
  color: #e0e0e0;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 14px;
}

/* ─── Sidebar ────────────────────────────────────────────────── */

.admin-sidebar {
  width: 200px;
  min-width: 200px;
  background: #1a1a2e;
  border-right: 1px solid #2d2d44;
  display: flex;
  flex-direction: column;
  padding: 16px 0;
}

.admin-sidebar-logo {
  padding: 8px 16px 20px;
}

.admin-sidebar-logo h1 {
  font-size: 16px;
  font-weight: 700;
  color: #a78bfa;
  margin: 0;
}

.admin-sidebar-logo span {
  font-size: 11px;
  color: #666;
}

.admin-nav-item {
  padding: 10px 16px;
  cursor: pointer;
  color: #888;
  transition: color 0.15s, background 0.15s;
  border-left: 3px solid transparent;
}

.admin-nav-item:hover {
  color: #ccc;
  background: #ffffff08;
}

.admin-nav-item--active {
  color: #a78bfa;
  background: #a78bfa15;
  border-left-color: #a78bfa;
}

.admin-sidebar-footer {
  margin-top: auto;
  padding: 12px 16px;
  border-top: 1px solid #2d2d44;
  font-size: 11px;
  color: #555;
  display: flex;
  align-items: center;
  gap: 6px;
}

.admin-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ef4444;
}

.admin-status-dot--connected {
  background: #4ade80;
}

/* ─── Main content ───────────────────────────────────────────── */

.admin-main {
  flex: 1;
  padding: 24px 32px;
  overflow-y: auto;
}

.admin-header {
  margin-bottom: 20px;
}

.admin-header h2 {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 4px;
  color: #f0f0f0;
}

.admin-header p {
  color: #888;
  font-size: 13px;
  margin: 0;
}

/* ─── Cards ──────────────────────────────────────────────────── */

.admin-card {
  background: #1e1e32;
  border: 1px solid #2d2d44;
  border-radius: 8px;
  padding: 14px;
  transition: border-color 0.15s;
}

.admin-card--expanded {
  border-color: #a78bfa;
  grid-column: span 2;
}

.admin-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.admin-card-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.admin-card-icon {
  font-size: 22px;
}

.admin-card-name {
  font-weight: 600;
  font-size: 14px;
}

.admin-card-title {
  color: #888;
  font-size: 11px;
  margin-top: 1px;
}

.admin-card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.admin-chevron {
  color: #888;
  font-size: 12px;
  transition: transform 0.15s;
}

.admin-chevron--open {
  transform: rotate(180deg);
}

/* ─── Badge ON/OFF ───────────────────────────────────────────── */

.admin-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
}

.admin-badge--on {
  background: #065f46;
  color: #4ade80;
}

.admin-badge--off {
  background: #7f1d1d;
  color: #f87171;
}

/* ─── Form ───────────────────────────────────────────────────── */

.admin-form {
  padding-top: 14px;
  margin-top: 14px;
  border-top: 1px solid #2d2d44;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.admin-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.admin-field--full {
  grid-column: span 2;
}

.admin-label {
  font-size: 10px;
  text-transform: uppercase;
  color: #888;
  letter-spacing: 0.5px;
}

.admin-input {
  background: #0f0f1a;
  border: 1px solid #2d2d44;
  border-radius: 4px;
  padding: 7px 10px;
  color: #e0e0e0;
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}

.admin-input:focus {
  border-color: #a78bfa;
}

.admin-input::placeholder {
  color: #555;
}

.admin-select {
  background: #0f0f1a;
  border: 1px solid #2d2d44;
  border-radius: 4px;
  padding: 7px 10px;
  color: #e0e0e0;
  font-size: 13px;
  font-family: inherit;
  outline: none;
  cursor: pointer;
}

.admin-select:focus {
  border-color: #a78bfa;
}

.admin-color-field {
  display: flex;
  align-items: center;
  gap: 6px;
}

.admin-color-picker {
  width: 32px;
  height: 32px;
  border: 1px solid #555;
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
  background: none;
}

.admin-color-picker::-webkit-color-swatch-wrapper {
  padding: 2px;
}

.admin-color-picker::-webkit-color-swatch {
  border: none;
  border-radius: 2px;
}

/* ─── Toggle ─────────────────────────────────────────────────── */

.admin-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.admin-toggle-track {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: #2d2d44;
  position: relative;
  transition: background 0.15s;
}

.admin-toggle-track--on {
  background: #065f46;
}

.admin-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #888;
  transition: transform 0.15s, background 0.15s;
}

.admin-toggle-track--on .admin-toggle-thumb {
  transform: translateX(16px);
  background: #4ade80;
}

/* ─── Slider ─────────────────────────────────────────────────── */

.admin-slider-field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.admin-slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: #2d2d44;
  border-radius: 2px;
  outline: none;
}

.admin-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #a78bfa;
  cursor: pointer;
}

.admin-slider-value {
  font-size: 12px;
  color: #a78bfa;
  min-width: 35px;
  text-align: right;
}

/* ─── Buttons ────────────────────────────────────────────────── */

.admin-btn {
  padding: 7px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;
}

.admin-btn:hover {
  opacity: 0.85;
}

.admin-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.admin-btn--primary {
  background: #a78bfa;
  color: #fff;
}

.admin-btn--secondary {
  background: #2d2d44;
  color: #ccc;
}

.admin-btn--danger {
  background: #7f1d1d;
  color: #f87171;
}

.admin-btn--success {
  background: #065f46;
  color: #4ade80;
}

.admin-btn-row {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  grid-column: span 2;
}

/* ─── Alert cards grid ───────────────────────────────────────── */

.admin-alerts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

/* ─── Global settings row ────────────────────────────────────── */

.admin-global-row {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #1e1e32;
  border-radius: 8px;
  border: 1px solid #2d2d44;
}

.admin-global-row .admin-field {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

/* ─── Goals ──────────────────────────────────────────────────── */

.admin-goals-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.admin-goal-card {
  background: #1e1e32;
  border: 1px solid #2d2d44;
  border-radius: 8px;
  padding: 16px;
}

.admin-goal-card h3 {
  margin: 0 0 12px;
  font-size: 16px;
  color: #f0f0f0;
}

.admin-progress-bar {
  height: 8px;
  background: #2d2d44;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.admin-progress-fill {
  height: 100%;
  background: #a78bfa;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.admin-goal-fields {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.admin-goal-fields .admin-field {
  flex: 1;
}

.admin-goal-last {
  font-size: 12px;
  color: #888;
  margin-top: 8px;
}

/* ─── Stream controls ────────────────────────────────────────── */

.admin-stream-status {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.admin-stream-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
}

.admin-stream-badge--live {
  background: #065f46;
  color: #4ade80;
}

.admin-stream-badge--offline {
  background: #2d2d44;
  color: #888;
}

.admin-stream-info {
  font-size: 12px;
  color: #666;
}

.admin-stream-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.admin-stream-form {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  margin-bottom: 16px;
}

.admin-stream-form .admin-field {
  flex: 1;
}

/* ─── Template help text ─────────────────────────────────────── */

.admin-help {
  font-size: 11px;
  color: #666;
  margin-top: 2px;
}

/* ─── Error message ──────────────────────────────────────────── */

.admin-error {
  color: #f87171;
  font-size: 12px;
  margin-top: 6px;
}

/* ─── Connection error full-page ─────────────────────────────── */

.admin-connection-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #0f0f1a;
  color: #888;
  gap: 16px;
}

.admin-connection-error h2 {
  color: #f87171;
  font-size: 18px;
  margin: 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/overlays/src/components/admin/admin.css
git commit -m "feat(admin): add dark theme admin CSS"
```

---

### Task 3: Add test alert endpoint to server

**Files:**
- Modify: `packages/server/src/index.ts` (add after the existing `PUT /api/alerts/config/:type` block, around line 114)

- [ ] **Step 1: Add the endpoint**

Add this after the `PUT /api/alerts/config/:type` handler (line 114):

```typescript
// ===========================
// ALERTS TEST (admin dashboard)
// ===========================

const TEST_PAYLOADS: Record<string, object> = {
  follow:     { type: "alert:follow", payload: { viewer: { displayName: "TestViewer" } } },
  sub:        { type: "alert:sub", payload: { viewer: { displayName: "TestViewer" }, tier: 1, months: 1 } },
  resub:      { type: "alert:sub", payload: { viewer: { displayName: "TestViewer" }, tier: 1, months: 6 } },
  gift_sub:   { type: "alert:gift_sub", payload: { viewer: { displayName: "TestViewer" }, recipientName: "LuckyViewer", tier: 1, totalGifted: 5, anonymous: false } },
  raid:       { type: "alert:raid", payload: { fromChannel: "TestRaider", viewers: 42, game: "Just Chatting" } },
  bits:       { type: "alert:bits", payload: { viewer: { displayName: "TestViewer" }, amount: 100 } },
  hype_train: { type: "alert:hype_train", payload: { level: 2, totalPoints: 5000, progress: 75 } },
  first_word: { type: "alert:first_word", payload: { viewer: { displayName: "TestViewer" } } },
  dice:       { type: "alert:dice", payload: { viewer: { displayName: "TestViewer" }, faces: 20, result: 17 } },
  channel_point_redemption: { type: "alert:channel_point_redemption", payload: { viewer: { displayName: "TestViewer" }, rewardName: "Test Reward", rewardCost: 500 } },
};

app.post("/api/alerts/test/:type", (req, res) => {
  const testEvent = TEST_PAYLOADS[req.params.type];
  if (!testEvent) {
    res.status(404).json({ ok: false, error: "Unknown alert type" });
    return;
  }
  broadcast(testEvent as any);
  console.log(`[Alerts] 🧪 Test alert: ${req.params.type}`);
  res.json({ ok: true, type: req.params.type });
});
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/index.ts
git commit -m "feat(server): add POST /api/alerts/test/:type endpoint"
```

---

### Task 4: Create AdminPage with sidebar layout + route

**Files:**
- Create: `packages/overlays/src/pages/AdminPage.tsx`
- Modify: `packages/overlays/src/App.tsx`

- [ ] **Step 1: Create AdminPage**

```tsx
import { useState, useEffect, useCallback } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { apiGet } from "../hooks/useAdminApi";
import { AdminAlerts } from "../components/admin/AdminAlerts";
import { AdminGoals } from "../components/admin/AdminGoals";
import { AdminStream } from "../components/admin/AdminStream";
import "../components/admin/admin.css";
import type { AlertsConfig, WSEvent } from "@castellan/shared";

type Tab = "alerts" | "goals" | "stream";

interface GoalsState {
  followers: { current: number; target: number };
  subscribers: { current: number; target: number };
  lastFollow: string | null;
  lastSub: string | null;
}

interface HealthState {
  currentStream: boolean;
  uptime: number;
  wsClients: number;
}

export function AdminPage() {
  const [tab, setTab] = useState<Tab>("alerts");
  const [alertsConfig, setAlertsConfig] = useState<AlertsConfig | null>(null);
  const [goals, setGoals] = useState<GoalsState | null>(null);
  const [health, setHealth] = useState<HealthState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load initial data via REST
  const loadData = useCallback(async () => {
    setLoadError(null);
    const [alertsRes, goalsRes, healthRes] = await Promise.all([
      apiGet<AlertsConfig>("/api/alerts/config"),
      apiGet<{ ok: boolean; goals: GoalsState }>("/api/goals"),
      apiGet<HealthState>("/api/health"),
    ]);

    if (alertsRes.error || goalsRes.error || healthRes.error) {
      setLoadError(alertsRes.error || goalsRes.error || healthRes.error);
      return;
    }

    setAlertsConfig(alertsRes.data);
    if (goalsRes.data) setGoals(goalsRes.data.goals);
    setHealth(healthRes.data);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Poll health every 10s for stream status + uptime
  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await apiGet<HealthState>("/api/health");
      if (res.data) setHealth(res.data);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // WS for real-time updates
  const handleWsEvent = useCallback((event: WSEvent) => {
    if (event.type === "alerts:config") {
      setAlertsConfig(event.payload);
    }
    if (event.type === "goal:update") {
      setGoals(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          [event.payload.type]: {
            current: event.payload.current,
            target: event.payload.target,
          },
        };
      });
    }
    if (event.type === "goal:lastFollow") {
      setGoals(prev => prev ? { ...prev, lastFollow: event.payload.displayName } : prev);
    }
    if (event.type === "goal:lastSub") {
      setGoals(prev => prev ? { ...prev, lastSub: event.payload.displayName } : prev);
    }
  }, []);

  const { isConnected } = useWebSocket(handleWsEvent);

  // Connection error screen
  if (loadError) {
    return (
      <div className="admin-connection-error">
        <h2>Cannot connect to server</h2>
        <p>{loadError}</p>
        <button className="admin-btn admin-btn--primary" onClick={loadData}>
          Retry
        </button>
      </div>
    );
  }

  const NAV: { key: Tab; icon: string; label: string }[] = [
    { key: "alerts", icon: "🔔", label: "Alerts" },
    { key: "goals", icon: "🎯", label: "Goals" },
    { key: "stream", icon: "📡", label: "Stream" },
  ];

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <nav className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <h1>Castellan</h1>
          <span>Admin Panel</span>
        </div>
        {NAV.map(n => (
          <div
            key={n.key}
            className={`admin-nav-item${tab === n.key ? " admin-nav-item--active" : ""}`}
            onClick={() => setTab(n.key)}
          >
            {n.icon} {n.label}
          </div>
        ))}
        <div className="admin-sidebar-footer">
          <div className={`admin-status-dot${isConnected ? " admin-status-dot--connected" : ""}`} />
          {isConnected ? "Server connected" : "Disconnected"}
        </div>
      </nav>

      {/* Main content */}
      <main className="admin-main">
        {tab === "alerts" && alertsConfig && (
          <AdminAlerts config={alertsConfig} onConfigUpdate={setAlertsConfig} />
        )}
        {tab === "goals" && goals && (
          <AdminGoals goals={goals} />
        )}
        {tab === "stream" && (
          <AdminStream health={health} />
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Add route in App.tsx**

Add to imports at top of `packages/overlays/src/App.tsx`:

```typescript
import { AdminPage } from "./pages/AdminPage";
```

Add inside `<Routes>`, after the last `<Route>`:

```tsx
<Route path="/admin" element={<AdminPage />} />
```

- [ ] **Step 3: Commit**

```bash
git add packages/overlays/src/pages/AdminPage.tsx packages/overlays/src/App.tsx
git commit -m "feat(admin): add AdminPage with sidebar layout and routing"
```

---

## Chunk 2: Admin Sections

### Task 5: Create AdminStream component

**Files:**
- Create: `packages/overlays/src/components/admin/AdminStream.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/overlays/src/components/admin/AdminStream.tsx
git commit -m "feat(admin): add AdminStream component"
```

---

### Task 6: Create AdminGoals component

**Files:**
- Create: `packages/overlays/src/components/admin/AdminGoals.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState, useEffect } from "react";
import { apiPost } from "../../hooks/useAdminApi";

interface GoalsState {
  followers: { current: number; target: number };
  subscribers: { current: number; target: number };
  lastFollow: string | null;
  lastSub: string | null;
}

interface AdminGoalsProps {
  goals: GoalsState;
}

export function AdminGoals({ goals }: AdminGoalsProps) {
  const [followersCurrent, setFollowersCurrent] = useState(goals.followers.current);
  const [followersTarget, setFollowersTarget] = useState(goals.followers.target);
  const [subsCurrent, setSubsCurrent] = useState(goals.subscribers.current);
  const [subsTarget, setSubsTarget] = useState(goals.subscribers.target);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Sync from props when WS updates arrive
  useEffect(() => {
    setFollowersCurrent(goals.followers.current);
    setFollowersTarget(goals.followers.target);
    setSubsCurrent(goals.subscribers.current);
    setSubsTarget(goals.subscribers.target);
  }, [goals]);

  async function handleSave() {
    setError(null);
    setSaved(false);
    const res = await apiPost("/api/goals/config", {
      followers: { current: followersCurrent, target: followersTarget },
      subscribers: { current: subsCurrent, target: subsTarget },
    });
    if (res.error) {
      setError(res.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  const pct = (current: number, target: number) =>
    target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  return (
    <div>
      <div className="admin-header">
        <h2>Goals</h2>
        <p>Manage follower and subscriber objectives</p>
      </div>

      <div className="admin-goals-grid">
        {/* Followers */}
        <div className="admin-goal-card">
          <h3>🎯 Followers</h3>
          <div className="admin-progress-bar">
            <div
              className="admin-progress-fill"
              style={{ width: `${pct(followersCurrent, followersTarget)}%` }}
            />
          </div>
          <div className="admin-goal-fields">
            <div className="admin-field">
              <label className="admin-label">Current</label>
              <input
                className="admin-input"
                type="number"
                value={followersCurrent}
                onChange={e => setFollowersCurrent(Number(e.target.value))}
              />
            </div>
            <div className="admin-field">
              <label className="admin-label">Target</label>
              <input
                className="admin-input"
                type="number"
                value={followersTarget}
                onChange={e => setFollowersTarget(Number(e.target.value))}
              />
            </div>
          </div>
          {goals.lastFollow && (
            <div className="admin-goal-last">Last follow: {goals.lastFollow}</div>
          )}
        </div>

        {/* Subscribers */}
        <div className="admin-goal-card">
          <h3>👑 Subscribers</h3>
          <div className="admin-progress-bar">
            <div
              className="admin-progress-fill"
              style={{ width: `${pct(subsCurrent, subsTarget)}%` }}
            />
          </div>
          <div className="admin-goal-fields">
            <div className="admin-field">
              <label className="admin-label">Current</label>
              <input
                className="admin-input"
                type="number"
                value={subsCurrent}
                onChange={e => setSubsCurrent(Number(e.target.value))}
              />
            </div>
            <div className="admin-field">
              <label className="admin-label">Target</label>
              <input
                className="admin-input"
                type="number"
                value={subsTarget}
                onChange={e => setSubsTarget(Number(e.target.value))}
              />
            </div>
          </div>
          {goals.lastSub && (
            <div className="admin-goal-last">Last sub: {goals.lastSub}</div>
          )}
        </div>
      </div>

      <div className="admin-btn-row" style={{ marginTop: "16px" }}>
        <button className="admin-btn admin-btn--primary" onClick={handleSave}>
          Save Goals
        </button>
        {saved && <span style={{ color: "#4ade80", fontSize: "13px", alignSelf: "center" }}>Saved!</span>}
      </div>
      {error && <div className="admin-error">{error}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/overlays/src/components/admin/AdminGoals.tsx
git commit -m "feat(admin): add AdminGoals component"
```

---

### Task 7: Create AlertCard component

**Files:**
- Create: `packages/overlays/src/components/admin/AlertCard.tsx`

This is the most complex component: collapsed view + expanded inline form with all alert config fields.

- [ ] **Step 1: Create the component**

```tsx
import { useState, useEffect } from "react";
import { apiPut, apiPost } from "../../hooks/useAdminApi";
import type { AlertTypeConfig } from "@castellan/shared";

interface AlertCardProps {
  type: string;
  config: AlertTypeConfig;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (config: AlertTypeConfig) => void;
}

const LABEL_MAP: Record<string, string> = {
  follow: "Follow",
  sub: "Sub",
  resub: "Resub",
  gift_sub: "Gift Sub",
  raid: "Raid",
  bits: "Bits",
  hype_train: "Hype Train",
  first_word: "First Word",
  dice: "Dice",
  channel_point_redemption: "Channel Points",
};

export function AlertCard({ type, config, isExpanded, onToggle, onUpdate }: AlertCardProps) {
  // Local form state (copy of config)
  const [form, setForm] = useState(config);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset form when config changes externally (WS update) or on expand
  useEffect(() => {
    setForm(config);
    setError(null);
  }, [config, isExpanded]);

  function updateForm(patch: Partial<AlertTypeConfig>) {
    setForm(prev => ({ ...prev, ...patch }));
  }

  function updateSound(patch: Partial<AlertTypeConfig["sound"]>) {
    setForm(prev => ({ ...prev, sound: { ...prev.sound, ...patch } }));
  }

  function updateMedia(patch: Partial<AlertTypeConfig["media"]>) {
    setForm(prev => ({ ...prev, media: { ...prev.media, ...patch } }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await apiPut(`/api/alerts/config/${type}`, form);
    setSaving(false);
    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      onUpdate(res.data.alerts[type]);
      onToggle(); // collapse after save
    }
  }

  async function handleTest() {
    const res = await apiPost(`/api/alerts/test/${type}`);
    if (res.error) setError(res.error);
  }

  return (
    <div className={`admin-card${isExpanded ? " admin-card--expanded" : ""}`}>
      {/* Header (always visible) */}
      <div className="admin-card-header" onClick={onToggle}>
        <div className="admin-card-info">
          <span className="admin-card-icon">{config.icon}</span>
          <div>
            <div className="admin-card-name">{LABEL_MAP[type] ?? type}</div>
            <div className="admin-card-title">{config.title}</div>
          </div>
        </div>
        <div className="admin-card-actions">
          <span className={`admin-badge${config.enabled ? " admin-badge--on" : " admin-badge--off"}`}>
            {config.enabled ? "ON" : "OFF"}
          </span>
          <span className={`admin-chevron${isExpanded ? " admin-chevron--open" : ""}`}>▼</span>
        </div>
      </div>

      {/* Expanded form */}
      {isExpanded && (
        <div className="admin-form">
          {/* Enabled toggle */}
          <div className="admin-field">
            <span className="admin-label">Enabled</span>
            <div className="admin-toggle" onClick={() => updateForm({ enabled: !form.enabled })}>
              <div className={`admin-toggle-track${form.enabled ? " admin-toggle-track--on" : ""}`}>
                <div className="admin-toggle-thumb" />
              </div>
            </div>
          </div>

          {/* Variant */}
          <div className="admin-field">
            <label className="admin-label">Variant</label>
            <select
              className="admin-select"
              value={form.variant}
              onChange={e => updateForm({ variant: e.target.value as "minor" | "major" })}
            >
              <option value="minor">Minor</option>
              <option value="major">Major</option>
            </select>
          </div>

          {/* Icon */}
          <div className="admin-field">
            <label className="admin-label">Icon</label>
            <input className="admin-input" value={form.icon} onChange={e => updateForm({ icon: e.target.value })} />
          </div>

          {/* Seal Color */}
          <div className="admin-field">
            <label className="admin-label">Seal Color</label>
            <div className="admin-color-field">
              <input
                type="color"
                className="admin-color-picker"
                value={form.sealColor}
                onChange={e => updateForm({ sealColor: e.target.value })}
              />
              <input
                className="admin-input"
                value={form.sealColor}
                onChange={e => updateForm({ sealColor: e.target.value })}
                style={{ flex: 1 }}
              />
            </div>
          </div>

          {/* Title */}
          <div className="admin-field admin-field--full">
            <label className="admin-label">Title</label>
            <input className="admin-input" value={form.title} onChange={e => updateForm({ title: e.target.value })} />
            <span className="admin-help">Variables: {"{viewer}"} {"{amount}"} {"{tier}"} {"{months}"} {"{recipient}"} {"{totalGifted}"} {"{level}"} {"{faces}"} {"{result}"} {"{rewardName}"} {"{rewardCost}"}</span>
          </div>

          {/* Viewer Name */}
          <div className="admin-field">
            <label className="admin-label">Viewer Name</label>
            <input
              className="admin-input"
              value={form.viewerName ?? ""}
              onChange={e => updateForm({ viewerName: e.target.value || null })}
              placeholder="null"
            />
          </div>

          {/* Subtitle */}
          <div className="admin-field">
            <label className="admin-label">Subtitle</label>
            <input
              className="admin-input"
              value={form.subtitle ?? ""}
              onChange={e => updateForm({ subtitle: e.target.value || null })}
              placeholder="null"
            />
          </div>

          {/* Ribbon */}
          <div className="admin-field">
            <label className="admin-label">Ribbon</label>
            <input
              className="admin-input"
              value={form.ribbon ?? ""}
              onChange={e => updateForm({ ribbon: e.target.value || null })}
              placeholder="null"
            />
          </div>

          {/* Duration */}
          <div className="admin-field">
            <label className="admin-label">Parchment Duration (ms)</label>
            <input
              className="admin-input"
              type="number"
              value={form.parchmentDuration}
              onChange={e => updateForm({ parchmentDuration: Number(e.target.value) })}
            />
          </div>

          {/* Sound section */}
          <div className="admin-field">
            <span className="admin-label">Sound</span>
            <div className="admin-toggle" onClick={() => updateSound({ enabled: !form.sound.enabled })}>
              <div className={`admin-toggle-track${form.sound.enabled ? " admin-toggle-track--on" : ""}`}>
                <div className="admin-toggle-thumb" />
              </div>
            </div>
          </div>

          <div className="admin-field">
            <label className="admin-label">Sound File</label>
            <input
              className="admin-input"
              value={form.sound.file ?? ""}
              onChange={e => updateSound({ file: e.target.value || null })}
              placeholder="e.g. follow.mp3"
            />
          </div>

          {/* Sound Volume */}
          <div className="admin-field admin-field--full">
            <label className="admin-label">Sound Volume</label>
            <div className="admin-slider-field">
              <input
                type="range"
                className="admin-slider"
                min={0}
                max={100}
                value={Math.round(form.sound.volume * 100)}
                onChange={e => updateSound({ volume: Number(e.target.value) / 100 })}
              />
              <span className="admin-slider-value">{Math.round(form.sound.volume * 100)}%</span>
            </div>
          </div>

          {/* Media section */}
          <div className="admin-field">
            <span className="admin-label">Media</span>
            <div className="admin-toggle" onClick={() => updateMedia({ enabled: !form.media.enabled })}>
              <div className={`admin-toggle-track${form.media.enabled ? " admin-toggle-track--on" : ""}`}>
                <div className="admin-toggle-thumb" />
              </div>
            </div>
          </div>

          <div className="admin-field">
            <label className="admin-label">Media Type</label>
            <select
              className="admin-select"
              value={form.media.type ?? ""}
              onChange={e => updateMedia({ type: (e.target.value || null) as "video" | "gif" | null })}
            >
              <option value="">None</option>
              <option value="video">Video</option>
              <option value="gif">GIF</option>
            </select>
          </div>

          {/* Media File */}
          <div className="admin-field admin-field--full">
            <label className="admin-label">Media File</label>
            <input
              className="admin-input"
              value={form.media.file ?? ""}
              onChange={e => updateMedia({ file: e.target.value || null })}
              placeholder="e.g. raid.webm"
            />
          </div>

          {/* Action buttons */}
          <div className="admin-btn-row">
            <button className="admin-btn admin-btn--primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button className="admin-btn admin-btn--secondary" onClick={handleTest}>
              🔔 Test Alert
            </button>
            <button className="admin-btn admin-btn--secondary" onClick={onToggle}>
              Cancel
            </button>
          </div>

          {error && <div className="admin-error">{error}</div>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/overlays/src/components/admin/AlertCard.tsx
git commit -m "feat(admin): add AlertCard with inline expand form"
```

---

### Task 8: Create AdminAlerts component

**Files:**
- Create: `packages/overlays/src/components/admin/AdminAlerts.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState } from "react";
import { apiPut } from "../../hooks/useAdminApi";
import { AlertCard } from "./AlertCard";
import type { AlertsConfig, AlertTypeConfig } from "@castellan/shared";

interface AdminAlertsProps {
  config: AlertsConfig;
  onConfigUpdate: (config: AlertsConfig) => void;
}

const ALERT_ORDER = [
  "follow", "sub", "resub", "gift_sub", "raid",
  "bits", "hype_train", "first_word", "dice", "channel_point_redemption",
];

export function AdminAlerts({ config, onConfigUpdate }: AdminAlertsProps) {
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [globalVolume, setGlobalVolume] = useState(Math.round(config.global.defaultVolume * 100));
  const [globalDuration, setGlobalDuration] = useState(config.global.defaultParchmentDuration);
  const [globalError, setGlobalError] = useState<string | null>(null);

  async function handleGlobalSave() {
    setGlobalError(null);
    const res = await apiPut("/api/alerts/config/global", {
      defaultVolume: globalVolume / 100,
      defaultParchmentDuration: globalDuration,
    });
    if (res.error) {
      setGlobalError(res.error);
    } else if (res.data) {
      onConfigUpdate(res.data);
    }
  }

  function handleAlertUpdate(type: string, updatedConfig: AlertTypeConfig) {
    onConfigUpdate({
      ...config,
      alerts: { ...config.alerts, [type]: updatedConfig },
    });
  }

  return (
    <div>
      <div className="admin-header">
        <h2>Alerts Configuration</h2>
        <p>Manage alert types, sounds, and visuals</p>
      </div>

      {/* Global settings */}
      <div className="admin-global-row">
        <div className="admin-field">
          <span className="admin-label">Default Volume</span>
          <div className="admin-slider-field">
            <input
              type="range"
              className="admin-slider"
              min={0}
              max={100}
              value={globalVolume}
              onChange={e => setGlobalVolume(Number(e.target.value))}
            />
            <span className="admin-slider-value">{globalVolume}%</span>
          </div>
        </div>
        <div className="admin-field">
          <span className="admin-label">Default Duration (ms)</span>
          <input
            className="admin-input"
            type="number"
            value={globalDuration}
            onChange={e => setGlobalDuration(Number(e.target.value))}
            style={{ width: "80px" }}
          />
        </div>
        <button className="admin-btn admin-btn--primary" onClick={handleGlobalSave}>
          Save Globals
        </button>
        {globalError && <span className="admin-error">{globalError}</span>}
      </div>

      {/* Alert cards grid */}
      <div className="admin-alerts-grid">
        {ALERT_ORDER.map(type => {
          const alertCfg = config.alerts[type];
          if (!alertCfg) return null;
          return (
            <AlertCard
              key={type}
              type={type}
              config={alertCfg}
              isExpanded={expandedType === type}
              onToggle={() => setExpandedType(expandedType === type ? null : type)}
              onUpdate={(updated) => handleAlertUpdate(type, updated)}
            />
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/overlays/src/components/admin/AdminAlerts.tsx
git commit -m "feat(admin): add AdminAlerts with global config and cards grid"
```

---

### Task 9: Build verification

- [ ] **Step 1: Run Vite build to verify no errors**

```bash
cd packages/overlays && pnpm vite build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Fix any TypeScript or import errors found**

If the build fails, fix the specific errors and re-run.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix(admin): resolve build errors"
```

Only if fixes were needed.
