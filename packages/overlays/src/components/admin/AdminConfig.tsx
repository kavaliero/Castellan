/**
 * AdminConfig — Page de configuration globale.
 * Accessible sans stream actif.
 *
 * Sections :
 *   - Timings animation des (reveal, affichage, sortie)
 *   - Timings animation des defis (banderole, viewer, de, sortie)
 *   - Alertes (a venir)
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

interface ChallengeAnimationSettings {
  bannerDelay: number;
  bannerDuration: number;
  viewerAppearDelay: number;
  viewerAppearDuration: number;
  diceAppearDelay: number;
  diceRollDelay: number;
  displayDuration: number;
  exitDuration: number;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

interface TimingFieldProps {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

function TimingField({ label, hint, value, onChange, min = 0, max = 15000, step = 100 }: TimingFieldProps) {
  return (
    <div>
      <label style={{ fontSize: "0.8em", opacity: 0.7, display: "block", marginBottom: "4px" }}>
        {label}
      </label>
      <input
        className="admin-input"
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
      />
      <span style={{ fontSize: "0.7em", opacity: 0.5, display: "block", marginTop: "2px" }}>
        {hint}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export function AdminConfig() {
  // ── Dice settings ──
  const [diceSettings, setDiceSettings] = useState<DiceTimingSettings>({
    revealDelay: 2500,
    displayDuration: 3000,
    exitDuration: 500,
  });
  const [diceLoaded, setDiceLoaded] = useState(false);
  const [diceSaved, setDiceSaved] = useState(false);

  // ── Challenge animation settings ──
  const [challengeSettings, setChallengeSettings] = useState<ChallengeAnimationSettings>({
    bannerDelay: 100,
    bannerDuration: 600,
    viewerAppearDelay: 600,
    viewerAppearDuration: 400,
    diceAppearDelay: 1800,
    diceRollDelay: 2000,
    displayDuration: 4000,
    exitDuration: 500,
  });
  const [challengeLoaded, setChallengeLoaded] = useState(false);
  const [challengeSaved, setChallengeSaved] = useState(false);

  useEffect(() => {
    apiGet<{ settings: DiceTimingSettings }>("/api/settings/dice").then((res) => {
      if (res.data?.settings) {
        setDiceSettings(res.data.settings);
        setDiceLoaded(true);
      }
    });
    apiGet<{ settings: ChallengeAnimationSettings }>("/api/settings/challenge-animation").then((res) => {
      if (res.data?.settings) {
        setChallengeSettings(res.data.settings);
        setChallengeLoaded(true);
      }
    });
  }, []);

  async function handleSaveDice() {
    await apiPut("/api/settings/dice", diceSettings);
    setDiceSaved(true);
    setTimeout(() => setDiceSaved(false), 2000);
  }

  async function handleSaveChallenge() {
    await apiPut("/api/settings/challenge-animation", challengeSettings);
    setChallengeSaved(true);
    setTimeout(() => setChallengeSaved(false), 2000);
  }

  const diceTotal = diceSettings.revealDelay + diceSettings.displayDuration + diceSettings.exitDuration;

  const challengeTotal = challengeSettings.diceRollDelay
    + 2500  // ~tumble duration approximative
    + challengeSettings.displayDuration
    + challengeSettings.exitDuration;

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

        {diceLoaded ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <TimingField
                label="Reveal (ms)"
                hint="Tumble des images + bounce + texte résultat"
                value={diceSettings.revealDelay}
                onChange={(v) => setDiceSettings((s) => ({ ...s, revealDelay: v }))}
                min={500}
                max={10000}
              />
              <TimingField
                label="Affichage (ms)"
                hint="Temps que le résultat reste visible"
                value={diceSettings.displayDuration}
                onChange={(v) => setDiceSettings((s) => ({ ...s, displayDuration: v }))}
                min={1000}
                max={15000}
                step={500}
              />
              <TimingField
                label="Sortie (ms)"
                hint="Fade out + scale down"
                value={diceSettings.exitDuration}
                onChange={(v) => setDiceSettings((s) => ({ ...s, exitDuration: v }))}
                min={200}
                max={3000}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button className="admin-btn admin-btn-primary" onClick={handleSaveDice}>
                Sauvegarder
              </button>
              <span style={{ fontSize: "0.85em", opacity: 0.6 }}>
                Durée totale par dé : {(diceTotal / 1000).toFixed(1)}s
              </span>
              {diceSaved && (
                <span style={{ fontSize: "0.85em", color: "#4ade80" }}>Sauvegardé !</span>
              )}
            </div>
          </>
        ) : (
          <p style={{ opacity: 0.5 }}>Chargement...</p>
        )}
      </div>

      {/* ── Challenge Animation Timings ── */}
      <div className="admin-card" style={{ marginBottom: "16px" }}>
        <h3>Animation des défis (channel points)</h3>
        <p style={{ fontSize: "0.85em", opacity: 0.7, marginTop: 0 }}>
          Contrôle la durée de chaque phase quand un viewer lance un défi via les points de chaîne.
          Les valeurs sont en millisecondes. Chaque phase se déclenche au temps indiqué depuis le début.
        </p>

        {challengeLoaded ? (
          <>
            {/* Row 1 : Banderole */}
            <div style={{ marginBottom: "8px" }}>
              <span style={{ fontSize: "0.8em", fontWeight: 700, color: "#D4A843" }}>Banderole</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <TimingField
                label="Délai d'apparition (ms)"
                hint="Quand la banderole commence à descendre"
                value={challengeSettings.bannerDelay}
                onChange={(v) => setChallengeSettings((s) => ({ ...s, bannerDelay: v }))}
                min={0}
                max={3000}
                step={50}
              />
              <TimingField
                label="Durée animation (ms)"
                hint="Durée du bounce de la banderole"
                value={challengeSettings.bannerDuration}
                onChange={(v) => setChallengeSettings((s) => ({ ...s, bannerDuration: v }))}
                min={200}
                max={3000}
              />
            </div>

            {/* Row 2 : Viewer */}
            <div style={{ marginBottom: "8px" }}>
              <span style={{ fontSize: "0.8em", fontWeight: 700, color: "#D4A843" }}>Apparition du viewer</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <TimingField
                label="Délai d'apparition (ms)"
                hint="Quand la photo + nom du viewer apparaissent"
                value={challengeSettings.viewerAppearDelay}
                onChange={(v) => setChallengeSettings((s) => ({ ...s, viewerAppearDelay: v }))}
                min={0}
                max={5000}
              />
              <TimingField
                label="Durée animation (ms)"
                hint="Durée du scale-in de la photo"
                value={challengeSettings.viewerAppearDuration}
                onChange={(v) => setChallengeSettings((s) => ({ ...s, viewerAppearDuration: v }))}
                min={100}
                max={2000}
              />
            </div>

            {/* Row 3 : Dé */}
            <div style={{ marginBottom: "8px" }}>
              <span style={{ fontSize: "0.8em", fontWeight: 700, color: "#D4A843" }}>Lancé de dé</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <TimingField
                label="Délai apparition dé (ms)"
                hint="Quand le dé apparaît à côté de la photo"
                value={challengeSettings.diceAppearDelay}
                onChange={(v) => setChallengeSettings((s) => ({ ...s, diceAppearDelay: v }))}
                min={500}
                max={8000}
              />
              <TimingField
                label="Délai lancé tumble (ms)"
                hint="Quand le tumble du dé + sons démarrent"
                value={challengeSettings.diceRollDelay}
                onChange={(v) => setChallengeSettings((s) => ({ ...s, diceRollDelay: v }))}
                min={500}
                max={8000}
              />
            </div>

            {/* Row 4 : Résultat + Sortie */}
            <div style={{ marginBottom: "8px" }}>
              <span style={{ fontSize: "0.8em", fontWeight: 700, color: "#D4A843" }}>Résultat & sortie</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <TimingField
                label="Affichage résultat (ms)"
                hint="Combien de temps le résultat reste visible"
                value={challengeSettings.displayDuration}
                onChange={(v) => setChallengeSettings((s) => ({ ...s, displayDuration: v }))}
                min={1000}
                max={15000}
                step={500}
              />
              <TimingField
                label="Durée sortie (ms)"
                hint="Fade out + banderole remonte"
                value={challengeSettings.exitDuration}
                onChange={(v) => setChallengeSettings((s) => ({ ...s, exitDuration: v }))}
                min={200}
                max={3000}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button className="admin-btn admin-btn-primary" onClick={handleSaveChallenge}>
                Sauvegarder
              </button>
              <span style={{ fontSize: "0.85em", opacity: 0.6 }}>
                Durée totale estimée : ~{(challengeTotal / 1000).toFixed(1)}s
              </span>
              {challengeSaved && (
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
