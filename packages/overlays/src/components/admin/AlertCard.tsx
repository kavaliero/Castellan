import { useState, useEffect, useRef } from "react";
import { apiPut, apiPost } from "../../hooks/useAdminApi";
import type { AlertTypeConfig, TrumpetConfig, TrumpetRowsConfig } from "@castellan/shared";

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

  const defaultTrumpet: TrumpetConfig = {
    rows: { bottom: true, middle: true, top: true },
    size: 250, angle: 15,
    pairStagger: 0.8, slideDuration: 0.7, bannerDelay: 0.3, bannerStayDuration: 6,
  };

  function updateTrumpet(patch: Partial<TrumpetConfig>) {
    setForm(prev => ({
      ...prev,
      trumpet: { ...defaultTrumpet, ...prev.trumpet, ...patch },
    }));
  }

  function updateTrumpetRow(row: keyof TrumpetRowsConfig, value: boolean) {
    setForm(prev => {
      const current = prev.trumpet ?? defaultTrumpet;
      return {
        ...prev,
        trumpet: {
          ...current,
          rows: { ...current.rows, [row]: value },
        },
      };
    });
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

                {/* Trumpet Config — pour tous les types qui ont une config trumpet */}
                {form.trumpet && (
                  <>
                    <div className="admin-field admin-field--full" style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 12 }}>
                      <span className="admin-label" style={{ fontSize: 14 }}>🎺 Animation Trompettes</span>
                    </div>

                    {/* Row toggles */}
                    <div className="admin-field">
                      <span className="admin-label">Rangée Bas</span>
                      <div className="admin-toggle" onClick={() => updateTrumpetRow("bottom", !(form.trumpet?.rows.bottom ?? true))}>
                        <div className={`admin-toggle-track${(form.trumpet?.rows.bottom ?? true) ? " admin-toggle-track--on" : ""}`}>
                          <div className="admin-toggle-thumb" />
                        </div>
                      </div>
                    </div>
                    <div className="admin-field">
                      <span className="admin-label">Rangée Milieu</span>
                      <div className="admin-toggle" onClick={() => updateTrumpetRow("middle", !(form.trumpet?.rows.middle ?? true))}>
                        <div className={`admin-toggle-track${(form.trumpet?.rows.middle ?? true) ? " admin-toggle-track--on" : ""}`}>
                          <div className="admin-toggle-thumb" />
                        </div>
                      </div>
                    </div>
                    <div className="admin-field">
                      <span className="admin-label">Rangée Haut</span>
                      <div className="admin-toggle" onClick={() => updateTrumpetRow("top", !(form.trumpet?.rows.top ?? true))}>
                        <div className={`admin-toggle-track${(form.trumpet?.rows.top ?? true) ? " admin-toggle-track--on" : ""}`}>
                          <div className="admin-toggle-thumb" />
                        </div>
                      </div>
                    </div>

                    {/* Size */}
                    <div className="admin-field admin-field--full">
                      <label className="admin-label">Taille trompettes (px)</label>
                      <div className="admin-slider-field">
                        <input
                          type="range" className="admin-slider"
                          min={100} max={400} step={10}
                          value={form.trumpet?.size ?? 250}
                          onChange={e => updateTrumpet({ size: Number(e.target.value) })}
                        />
                        <span className="admin-slider-value">{form.trumpet?.size ?? 250}px</span>
                      </div>
                    </div>

                    {/* Angle */}
                    <div className="admin-field admin-field--full">
                      <label className="admin-label">Angle inclinaison (°)</label>
                      <div className="admin-slider-field">
                        <input
                          type="range" className="admin-slider"
                          min={0} max={45} step={1}
                          value={form.trumpet?.angle ?? 15}
                          onChange={e => updateTrumpet({ angle: Number(e.target.value) })}
                        />
                        <span className="admin-slider-value">{form.trumpet?.angle ?? 15}°</span>
                      </div>
                    </div>

                    {/* Pair Stagger */}
                    <div className="admin-field admin-field--full">
                      <label className="admin-label">Délai entre rangées (s)</label>
                      <div className="admin-slider-field">
                        <input
                          type="range" className="admin-slider"
                          min={0.2} max={2.0} step={0.1}
                          value={form.trumpet?.pairStagger ?? 0.8}
                          onChange={e => updateTrumpet({ pairStagger: Number(e.target.value) })}
                        />
                        <span className="admin-slider-value">{(form.trumpet?.pairStagger ?? 0.8).toFixed(1)}s</span>
                      </div>
                    </div>

                    {/* Slide Duration */}
                    <div className="admin-field admin-field--full">
                      <label className="admin-label">Durée slide trompettes (s)</label>
                      <div className="admin-slider-field">
                        <input
                          type="range" className="admin-slider"
                          min={0.2} max={2.0} step={0.1}
                          value={form.trumpet?.slideDuration ?? 0.7}
                          onChange={e => updateTrumpet({ slideDuration: Number(e.target.value) })}
                        />
                        <span className="admin-slider-value">{(form.trumpet?.slideDuration ?? 0.7).toFixed(1)}s</span>
                      </div>
                    </div>

                    {/* Banner Delay */}
                    <div className="admin-field admin-field--full">
                      <label className="admin-label">Délai avant banderole (s)</label>
                      <div className="admin-slider-field">
                        <input
                          type="range" className="admin-slider"
                          min={0.0} max={2.0} step={0.1}
                          value={form.trumpet?.bannerDelay ?? 0.3}
                          onChange={e => updateTrumpet({ bannerDelay: Number(e.target.value) })}
                        />
                        <span className="admin-slider-value">{(form.trumpet?.bannerDelay ?? 0.3).toFixed(1)}s</span>
                      </div>
                    </div>

                    {/* Banner Stay Duration */}
                    <div className="admin-field admin-field--full">
                      <label className="admin-label">Durée affichage banderole (s)</label>
                      <div className="admin-slider-field">
                        <input
                          type="range" className="admin-slider"
                          min={2} max={15} step={0.5}
                          value={form.trumpet?.bannerStayDuration ?? 6}
                          onChange={e => updateTrumpet({ bannerStayDuration: Number(e.target.value) })}
                        />
                        <span className="admin-slider-value">{(form.trumpet?.bannerStayDuration ?? 6).toFixed(1)}s</span>
                      </div>
                    </div>
                  </>
                )}

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
