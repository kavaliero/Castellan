/**
 * AdminConfig — Page de configuration globale.
 * Accessible sans stream actif.
 *
 * Sections :
 *   - Timings animation des (reveal, affichage, sortie)
 *   - Timings alertes (a venir)
 *   - Overlays (a venir)
 */

import { useState, useEffect } from "react";
import { apiGet, apiPut } from "../../hooks/useAdminApi";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface DiceTimingSettings {
  revealDelay: number;
  displayDuration: number;
  exitDuration: number;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export function AdminConfig() {
  const [diceSettings, setDiceSettings] = useState<DiceTimingSettings>({
    revealDelay: 2500,
    displayDuration: 3000,
    exitDuration: 500,
  });
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiGet<{ settings: DiceTimingSettings }>("/api/settings/dice").then((res) => {
      if (res.data?.settings) {
        setDiceSettings(res.data.settings);
        setLoaded(true);
      }
    });
  }, []);

  async function handleSaveDice() {
    await apiPut("/api/settings/dice", diceSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const diceTotal = diceSettings.revealDelay + diceSettings.displayDuration + diceSettings.exitDuration;

  return (
    <div>
      <div className="admin-header">
        <h2>Configuration</h2>
        <p>Paramètres globaux des overlays et animations. Pas besoin de stream actif.</p>
      </div>

      {/* ── Dice Timings ── */}
      <div className="admin-card" style={{ marginBottom: "16px" }}>
        <h3>Animation des dés</h3>
        <p style={{ fontSize: "0.85em", opacity: 0.7, marginTop: 0 }}>
          Contrôle la durée de chaque phase de l'animation quand un dé est lancé.
          Si plusieurs dés arrivent, ils sont mis en queue et joués un par un.
        </p>

        {loaded ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={{ fontSize: "0.8em", opacity: 0.7, display: "block", marginBottom: "4px" }}>
                  Reveal (ms)
                </label>
                <input
                  className="admin-input"
                  type="number"
                  value={diceSettings.revealDelay}
                  onChange={(e) => setDiceSettings((s) => ({ ...s, revealDelay: Number(e.target.value) }))}
                  min={500}
                  max={10000}
                  step={100}
                />
                <span style={{ fontSize: "0.7em", opacity: 0.5, display: "block", marginTop: "2px" }}>
                  Tumble des images + bounce + texte résultat
                </span>
              </div>
              <div>
                <label style={{ fontSize: "0.8em", opacity: 0.7, display: "block", marginBottom: "4px" }}>
                  Affichage (ms)
                </label>
                <input
                  className="admin-input"
                  type="number"
                  value={diceSettings.displayDuration}
                  onChange={(e) => setDiceSettings((s) => ({ ...s, displayDuration: Number(e.target.value) }))}
                  min={1000}
                  max={15000}
                  step={500}
                />
                <span style={{ fontSize: "0.7em", opacity: 0.5, display: "block", marginTop: "2px" }}>
                  Temps que le résultat reste visible
                </span>
              </div>
              <div>
                <label style={{ fontSize: "0.8em", opacity: 0.7, display: "block", marginBottom: "4px" }}>
                  Sortie (ms)
                </label>
                <input
                  className="admin-input"
                  type="number"
                  value={diceSettings.exitDuration}
                  onChange={(e) => setDiceSettings((s) => ({ ...s, exitDuration: Number(e.target.value) }))}
                  min={200}
                  max={3000}
                  step={100}
                />
                <span style={{ fontSize: "0.7em", opacity: 0.5, display: "block", marginTop: "2px" }}>
                  Fade out + scale down
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button className="admin-btn admin-btn-primary" onClick={handleSaveDice}>
                Sauvegarder
              </button>
              <span style={{ fontSize: "0.85em", opacity: 0.6 }}>
                Durée totale par dé : {(diceTotal / 1000).toFixed(1)}s
              </span>
              {saved && (
                <span style={{ fontSize: "0.85em", color: "#4ade80" }}>Sauvegardé !</span>
              )}
            </div>
          </>
        ) : (
          <p style={{ opacity: 0.5 }}>Chargement...</p>
        )}
      </div>

      {/* ── Alertes (placeholder) ── */}
      <div className="admin-card" style={{ marginBottom: "16px", opacity: 0.5 }}>
        <h3>Alertes</h3>
        <p style={{ fontSize: "0.85em", margin: 0 }}>
          Durée des alertes follow, sub, raid, bits... (à venir)
        </p>
      </div>

      {/* ── Overlays (placeholder) ── */}
      <div className="admin-card" style={{ opacity: 0.5 }}>
        <h3>Overlays</h3>
        <p style={{ fontSize: "0.85em", margin: 0 }}>
          Thème, couleurs, polices des overlays OBS... (à venir)
        </p>
      </div>
    </div>
  );
}
