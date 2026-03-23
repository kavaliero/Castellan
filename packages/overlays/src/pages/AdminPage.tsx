import { useState, useEffect, useCallback } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { apiGet } from "../hooks/useAdminApi";
import { AdminAlerts } from "../components/admin/AdminAlerts";
import { AdminGoals } from "../components/admin/AdminGoals";
import { AdminStream } from "../components/admin/AdminStream";
import { AdminViewers } from "../components/admin/AdminViewers";
import { AdminLiveStats } from "../components/admin/AdminLiveStats";
import { AdminChallenges } from "../components/admin/AdminChallenges";
import { AdminConfig } from "../components/admin/AdminConfig";
import "../components/admin/admin.css";
import type { AlertsConfig, WSEvent } from "@castellan/shared";

type Tab = "alerts" | "goals" | "challenges" | "stream" | "viewers" | "live" | "config";

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
    { key: "challenges", icon: "💪", label: "Défis" },
    { key: "stream", icon: "📡", label: "Stream" },
    { key: "viewers", icon: "👥", label: "Viewers" },
    { key: "live", icon: "📊", label: "Live Stats" },
    { key: "config", icon: "⚙️", label: "Config" },
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
        {tab === "challenges" && (
          <AdminChallenges />
        )}
        {tab === "stream" && (
          <AdminStream health={health} />
        )}
        {tab === "viewers" && (
          <AdminViewers />
        )}
        {tab === "live" && (
          <AdminLiveStats />
        )}
        {tab === "config" && (
          <AdminConfig />
        )}
      </main>
    </div>
  );
}
