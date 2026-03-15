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
