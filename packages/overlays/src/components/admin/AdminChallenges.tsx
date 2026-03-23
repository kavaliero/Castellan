/**
 * AdminChallenges — Section admin pour gerer les defis actifs.
 *
 * Fonctionnalites :
 *   - Creer un nouveau defi (counter ou timer)
 *   - Incrementer un counter (+1, +5, +10)
 *   - Démarrer / arreter / completer un timer
 *   - Supprimer un defi
 */

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost, apiDelete } from "../../hooks/useAdminApi";
import type { ChallengePayload, ChallengeType } from "@castellan/shared";

// Presets de defis courants pour creation rapide
const PRESETS = [
  { name: "squatts", label: "Squatts", type: "counter" as ChallengeType, icon: "💪" },
  { name: "voix-stitch", label: "Voix de Stitch", type: "timer" as ChallengeType, icon: "🎤" },
  { name: "clavier-inverse", label: "Clavier à l'envers", type: "timer" as ChallengeType, icon: "⌨️" },
  { name: "glacons", label: "Glaçons a sucer", type: "counter" as ChallengeType, icon: "🧊" },
];

export function AdminChallenges() {
  const [challenges, setChallenges] = useState<ChallengePayload[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasStream, setHasStream] = useState<boolean | null>(null);

  // Log des lancers de des simules
  const [diceLog, setDiceLog] = useState<string[]>([]);

  // Formulaire nouveau defi
  const [newName, setNewName] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<ChallengeType>("counter");
  const [newAmount, setNewAmount] = useState(10);
  const [newIcon, setNewIcon] = useState("");

  const loadChallenges = useCallback(async () => {
    // Verifier si un stream est actif
    const healthRes = await apiGet<{ currentStream: boolean }>("/api/health");
    if (healthRes.data) setHasStream(healthRes.data.currentStream);

    const res = await apiGet<{ challenges: ChallengePayload[] }>("/api/challenges");
    if (res.data) setChallenges(res.data.challenges);
    if (res.error) setError(res.error);
  }, []);

  useEffect(() => {
    loadChallenges();
    // Poll toutes les 3 secondes pour le temps reel admin
    const interval = setInterval(loadChallenges, 3000);

    return () => clearInterval(interval);
  }, [loadChallenges]);

  async function handleCreate() {
    if (!newName || !newLabel || !newAmount) {
      setError("Nom, label et quantité requis");
      return;
    }
    setError(null);
    const amount = newType === "timer" ? newAmount * 60 : newAmount; // timer: minutes → secondes
    await apiPost("/api/challenges", {
      name: newName,
      label: newLabel,
      type: newType,
      amount,
      icon: newIcon || undefined,
    });
    setNewName("");
    setNewLabel("");
    setNewAmount(10);
    setNewIcon("");
    loadChallenges();
  }

  function handlePreset(preset: typeof PRESETS[number]) {
    setNewName(preset.name);
    setNewLabel(preset.label);
    setNewType(preset.type);
    setNewIcon(preset.icon);
    setNewAmount(preset.type === "timer" ? 2 : 10);
  }

  async function handleIncrement(id: string, amount: number) {
    await apiPost(`/api/challenges/${id}/increment`, { amount });
    loadChallenges();
  }

  async function handleStartTimer(id: string) {
    await apiPost(`/api/challenges/${id}/start`);
    loadChallenges();
  }

  async function handleStopTimer(id: string) {
    await apiPost(`/api/challenges/${id}/stop`);
    loadChallenges();
  }

  async function handleComplete(id: string) {
    await apiPost(`/api/challenges/${id}/complete`);
    loadChallenges();
  }

  async function handleDelete(id: string) {
    await apiDelete(`/api/challenges/${id}`);
    loadChallenges();
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  const activeChallenges = challenges.filter((c) => c.isActive);
  const completedChallenges = challenges.filter((c) => !c.isActive);

  return (
    <div>
      <div className="admin-header">
        <h2>Défis</h2>
        <p>Gérer les défis actifs du stream (squatts, timers, etc.)</p>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {/* Avertissement si pas de stream actif */}
      {hasStream === false && (
        <div className="admin-card" style={{ marginBottom: "16px", borderColor: "#f59e0b", background: "rgba(245, 158, 11, 0.1)" }}>
          <p style={{ margin: 0, color: "#f59e0b" }}>
            Pas de stream actif. Les défis ont besoin d'un stream pour fonctionner.
          </p>
          <button
            className="admin-btn admin-btn-primary"
            style={{ marginTop: "8px" }}
            onClick={async () => {
              await apiPost("/api/stream/start", { title: "Stream test", game: "Just Chatting" });
              loadChallenges();
            }}
          >
            Démarrer un stream test
          </button>
        </div>
      )}

      {/* Boutons de test rapide */}
      {hasStream && (
        <div className="admin-card" style={{ marginBottom: "16px", borderColor: "#4ade80", background: "rgba(74, 222, 128, 0.05)" }}>
          <h3>Test rapide</h3>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button
              className="admin-btn admin-btn-sm"
              onClick={async () => {
                await apiPost("/api/challenges", { name: "squatts", label: "Squatts", type: "counter", amount: 10, icon: "💪" });
                loadChallenges();
              }}
            >
              + 10 Squatts
            </button>
            <button
              className="admin-btn admin-btn-sm"
              onClick={async () => {
                await apiPost("/api/challenges", { name: "voix-stitch", label: "Voix de Stitch", type: "timer", amount: 120, icon: "🎤" });
                loadChallenges();
              }}
            >
              + 2min Stitch
            </button>
            <button
              className="admin-btn admin-btn-sm"
              onClick={async () => {
                await apiPost("/api/challenges", { name: "clavier-inverse", label: "Clavier à l'envers", type: "timer", amount: 60, icon: "⌨️" });
                loadChallenges();
              }}
            >
              + 1min Clavier
            </button>
            <button
              className="admin-btn admin-btn-sm"
              onClick={async () => {
                await apiPost("/api/challenges", { name: "glacons", label: "Glaçons", type: "counter", amount: 3, icon: "🧊" });
                loadChallenges();
              }}
            >
              + 3 Glaçons
            </button>
          </div>
        </div>
      )}

      {/* Simulation lancer de des */}
      {hasStream && (
        <div className="admin-card" style={{ marginBottom: "16px", borderColor: "#a78bfa", background: "rgba(167, 139, 250, 0.05)" }}>
          <h3>Simuler un lancer de dé</h3>
          <p style={{ fontSize: "0.85em", opacity: 0.7, marginTop: 0 }}>
            Simule un lancer comme si un viewer utilisait ses dés. Le résultat crée/update le défi automatiquement.
          </p>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button
              className="admin-btn admin-btn-sm"
              style={{ borderColor: "#a78bfa" }}
              onClick={async () => {
                const res = await apiPost<{ roll: number; faces: number }>("/api/challenges/test-roll", {
                  challengeName: "squatts", challengeLabel: "Squatts", challengeType: "counter",
                  faces: 6, tier: "follow", icon: "💪",
                });
                if (res.data) setDiceLog((prev) => [`D6 Squatts → ${res.data!.roll}`, ...prev.slice(0, 9)]);
                loadChallenges();
              }}
            >
              D6 Squatts (follow)
            </button>
            <button
              className="admin-btn admin-btn-sm"
              style={{ borderColor: "#a78bfa" }}
              onClick={async () => {
                const res = await apiPost<{ roll: number; faces: number }>("/api/challenges/test-roll", {
                  challengeName: "squatts", challengeLabel: "Squatts", challengeType: "counter",
                  faces: 12, tier: "sub", icon: "💪",
                });
                if (res.data) setDiceLog((prev) => [`D12 Squatts → ${res.data!.roll}`, ...prev.slice(0, 9)]);
                loadChallenges();
              }}
            >
              D12 Squatts (sub/raid)
            </button>
            <button
              className="admin-btn admin-btn-sm"
              style={{ borderColor: "#a78bfa" }}
              onClick={async () => {
                const res = await apiPost<{ roll: number; faces: number }>("/api/challenges/test-roll", {
                  challengeName: "voix-stitch", challengeLabel: "Voix de Stitch", challengeType: "timer",
                  faces: 4, tier: "follow", icon: "🎤",
                });
                if (res.data) setDiceLog((prev) => [`D4 Stitch → ${res.data!.roll}min`, ...prev.slice(0, 9)]);
                loadChallenges();
              }}
            >
              D4 Stitch (channel pts)
            </button>
            <button
              className="admin-btn admin-btn-sm"
              style={{ borderColor: "#a78bfa" }}
              onClick={async () => {
                const res = await apiPost<{ roll: number; faces: number }>("/api/challenges/test-roll", {
                  challengeName: "clavier-inverse", challengeLabel: "Clavier à l'envers", challengeType: "timer",
                  faces: 4, tier: "follow", icon: "⌨️",
                });
                if (res.data) setDiceLog((prev) => [`D4 Clavier → ${res.data!.roll}min`, ...prev.slice(0, 9)]);
                loadChallenges();
              }}
            >
              D4 Clavier (channel pts)
            </button>
          </div>
          {diceLog.length > 0 && (
            <div style={{ marginTop: "8px", fontSize: "0.8em", opacity: 0.7 }}>
              {diceLog.map((log, i) => (
                <div key={i} style={{ padding: "2px 0" }}>🎲 {log}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Creation rapide avec presets */}
      <div className="admin-card" style={{ marginBottom: "16px" }}>
        <h3>Nouveau défi</h3>

        <div style={{ display: "flex", gap: "6px", marginBottom: "12px", flexWrap: "wrap" }}>
          {PRESETS.map((p) => (
            <button
              key={p.name}
              className="admin-btn admin-btn-sm"
              onClick={() => handlePreset(p)}
              style={{ fontSize: "0.85em" }}
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
          <input
            className="admin-input"
            placeholder="Nom (ex: squatts)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className="admin-input"
            placeholder="Label (ex: Squatts)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <select
            className="admin-input"
            value={newType}
            onChange={(e) => setNewType(e.target.value as ChallengeType)}
          >
            <option value="counter">Compteur</option>
            <option value="timer">Timer</option>
          </select>
          <input
            className="admin-input"
            type="number"
            placeholder={newType === "timer" ? "Minutes" : "Quantité"}
            value={newAmount}
            onChange={(e) => setNewAmount(Number(e.target.value))}
            min={1}
          />
          <input
            className="admin-input"
            placeholder="Icône (emoji)"
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
          />
          <button className="admin-btn admin-btn-primary" onClick={handleCreate}>
            + Ajouter
          </button>
        </div>
      </div>

      {/* Defis actifs */}
      {activeChallenges.length > 0 && (
        <div className="admin-card" style={{ marginBottom: "16px" }}>
          <h3>Défis actifs ({activeChallenges.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {activeChallenges.map((c) => (
              <div
                key={c.id}
                style={{
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontWeight: 700 }}>
                    {c.icon} {c.label}
                    <span style={{ fontSize: "0.8em", opacity: 0.6, marginLeft: "6px" }}>
                      ({c.type})
                    </span>
                  </span>
                  <button
                    className="admin-btn admin-btn-sm"
                    style={{ fontSize: "0.75em", color: "#f87171" }}
                    onClick={() => handleDelete(c.id)}
                  >
                    Supprimer
                  </button>
                </div>

                {c.type === "counter" ? (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                      <div style={{ flex: 1, height: "8px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${c.target > 0 ? (c.current / c.target) * 100 : 0}%`,
                            height: "100%",
                            background: "#d4a843",
                            borderRadius: "4px",
                            transition: "width 0.3s",
                          }}
                        />
                      </div>
                      <span style={{ fontWeight: 700, minWidth: "60px", textAlign: "right" }}>
                        {c.current} / {c.target}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button className="admin-btn admin-btn-sm" onClick={() => handleIncrement(c.id, 1)}>+1</button>
                      <button className="admin-btn admin-btn-sm" onClick={() => handleIncrement(c.id, 5)}>+5</button>
                      <button className="admin-btn admin-btn-sm" onClick={() => handleIncrement(c.id, 10)}>+10</button>
                      <button
                        className="admin-btn admin-btn-sm"
                        style={{ marginLeft: "auto" }}
                        onClick={() => handleComplete(c.id)}
                      >
                        Terminer
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: "1.4em", fontWeight: 700, marginBottom: "6px" }}>
                      {formatTime(c.current)}
                      {c.isRunning && <span style={{ fontSize: "0.6em", color: "#4ade80", marginLeft: "8px" }}>EN COURS</span>}
                      {!c.isRunning && c.current > 0 && <span style={{ fontSize: "0.6em", color: "#facc15", marginLeft: "8px" }}>EN PAUSE</span>}
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {!c.isRunning ? (
                        <button
                          className="admin-btn admin-btn-primary admin-btn-sm"
                          onClick={() => handleStartTimer(c.id)}
                          disabled={c.current <= 0}
                        >
                          Démarrer
                        </button>
                      ) : (
                        <button className="admin-btn admin-btn-sm" onClick={() => handleStopTimer(c.id)}>
                          Pause
                        </button>
                      )}
                      <button
                        className="admin-btn admin-btn-sm"
                        style={{ marginLeft: "auto" }}
                        onClick={() => handleComplete(c.id)}
                      >
                        Terminer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Defis completes */}
      {completedChallenges.length > 0 && (
        <div className="admin-card">
          <h3 style={{ opacity: 0.6 }}>Complétés ({completedChallenges.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {completedChallenges.map((c) => (
              <div
                key={c.id}
                style={{ opacity: 0.5, fontSize: "0.9em", display: "flex", justifyContent: "space-between" }}
              >
                <span>{c.icon} {c.label}</span>
                <span>
                  {c.type === "counter"
                    ? `${c.target} réalisés`
                    : `${formatTime(c.target)} effectués`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
