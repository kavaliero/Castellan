import { useState, useEffect, useRef } from "react";
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
  const [uploading, setUploading] = useState(false);
  const [soundUploaded, setSoundUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleSoundUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch(`http://localhost:3001/api/upload/sound/${type}`, {
        method: "POST",
        body: fd,
      });
      if (resp.ok) {
        setSoundUploaded(true);
        setTimeout(() => setSoundUploaded(false), 2000);
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      {/* Card in the grid */}
      <div className="admin-card">
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
          </div>
        </div>
      </div>

      {/* Modal */}
      {isExpanded && (
        <div className="admin-modal-overlay" onClick={onToggle}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div className="admin-card-info">
                <span className="admin-card-icon">{form.icon}</span>
                <div>
                  <div className="admin-card-name">{LABEL_MAP[type] ?? type}</div>
                </div>
              </div>
              <button className="admin-modal-close" onClick={onToggle}>✕</button>
            </div>

            <div className="admin-modal-body">
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

                {/* Upload button */}
                <div className="admin-field-row">
                  <label className="admin-label">Fichier</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      className="admin-btn admin-btn--secondary"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? "Upload..." : "Remplacer le son"}
                    </button>
                    {soundUploaded && (
                      <span style={{ color: "#4ade80", fontSize: 13 }}>✓ Uploadé</span>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".mp3"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleSoundUpload(f);
                        e.target.value = "";
                      }}
                    />
                  </div>
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
            </div>
          </div>
        </div>
      )}
    </>
  );
}
