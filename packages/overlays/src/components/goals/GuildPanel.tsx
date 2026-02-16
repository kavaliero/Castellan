import type { GoalPayload } from "@castellan/shared";
import "./goals.css";

/**
 * Panneau de guilde médiéval — v5 refonte lisibilité.
 *
 * Layout côte à côte (placement sous webcam) :
 * 1. Plaques (haut) : Nouvel Allié (bois) + Soutien Royal (fer)
 * 2. Barres HP/Mana (bas, côte à côte) : Followers + Subs
 *
 * Changements vs v3/v4 :
 * - Panneau sombre semi-transparent avec bordure dorée (comme chat/credits)
 * - backdrop-filter: blur pour se détacher du fond
 * - Contour noir épais (text-shadow stroke) sur TOUS les textes
 * - Couleurs : doré pour les titres, blanc pur pour les valeurs
 * - Sous-titre discret "Dernier Follow" / "Dernier Sub" pour la clarté
 * - Styles en CSS classes (goals.css)
 */

interface GuildPanelProps {
  goals: Record<string, GoalPayload>;
  lastFollow: string | null;
  lastSub: string | null;
}

export function GuildPanel({ goals, lastFollow, lastSub }: GuildPanelProps) {
  const followersGoal = goals["followers"];
  const subscribersGoal = goals["subscribers"];

  return (
    <div className="guild-panel">
      {/* ─── Plaques de guilde ─── */}
      <div className="guild-plaques">
        <GuildPlaque
          label="Nouvel Allié"
          subtitle="Dernier Follow"
          icon="⚔️"
          value={lastFollow}
          variant="wood"
        />
        <GuildPlaque
          label="Soutien Royal"
          subtitle="Dernier Sub"
          icon="👑"
          value={lastSub}
          variant="iron"
        />
      </div>

      {/* ─── Barres d'objectifs (côte à côte) ─── */}
      <div className="guild-bars">
        <RPGBar
          label="Followers"
          icon="❤️"
          current={followersGoal?.current ?? 0}
          target={followersGoal?.target ?? 1000}
          type="hp"
        />
        <RPGBar
          label="Subs"
          icon="💎"
          current={subscribersGoal?.current ?? 0}
          target={subscribersGoal?.target ?? 50}
          type="mana"
        />
      </div>
    </div>
  );
}

// ============================================
// GUILD PLAQUE — Bois (follow) / Fer (sub)
// ============================================

interface GuildPlaqueProps {
  label: string;
  subtitle: string;
  icon: string;
  value: string | null;
  variant: "wood" | "iron";
}

function GuildPlaque({ label, subtitle, icon, value, variant }: GuildPlaqueProps) {
  return (
    <div className={`guild-plaque guild-plaque--${variant}`}>
      {/* Chaînes */}
      <div className="guild-plaque-chain">
        <div className="guild-plaque-chain-link" />
        <div className="guild-plaque-chain-link" />
      </div>

      {/* Corps de la plaque */}
      <div className="guild-plaque-body">
        {/* Clous aux coins */}
        <div className="guild-plaque-nail guild-plaque-nail--tl" />
        <div className="guild-plaque-nail guild-plaque-nail--tr" />
        <div className="guild-plaque-nail guild-plaque-nail--bl" />
        <div className="guild-plaque-nail guild-plaque-nail--br" />

        {/* Badge label */}
        <div className="guild-plaque-label">
          <span className="guild-plaque-label-icon">{icon}</span>
          <span className="guild-plaque-label-text">{label}</span>
        </div>

        {/* Nom gravé */}
        <div className="guild-plaque-name" key={value ?? "empty"}>
          {value || "—"}
        </div>

        {/* Sous-titre explicatif */}
        <div className="guild-plaque-subtitle">{subtitle}</div>
      </div>
    </div>
  );
}

// ============================================
// RPG BAR — HP (followers) / Mana (subs)
// ============================================

interface RPGBarProps {
  label: string;
  icon: string;
  current: number;
  target: number;
  type: "hp" | "mana";
}

function RPGBar({ label, icon, current, target, type }: RPGBarProps) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const isComplete = current >= target;
  const isCritical = type === "hp" && !isComplete && pct < 25;

  const barClass = [
    "rpg-bar",
    `rpg-bar--${type}`,
    isComplete && "rpg-bar--complete",
    isCritical && "rpg-bar--critical",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={barClass}>
      {/* Label + chiffres au-dessus */}
      <div className="rpg-bar-header">
        <div className="rpg-bar-label">
          <span className="rpg-bar-label-icon">{icon}</span>
          <span className="rpg-bar-label-text">{label}</span>
        </div>
        <span className="rpg-bar-values">
          {current} / {target}
          {isComplete && <span className="rpg-bar-values-check">✓</span>}
        </span>
      </div>

      {/* Cadre doré */}
      <div className="rpg-bar-frame">
        <div className="rpg-bar-ornament" />

        {/* Track */}
        <div className="rpg-bar-track">
          {/* Fill */}
          <div className="rpg-bar-fill" style={{ width: `${pct}%` }}>
            <div className="rpg-bar-shine" />
            <div className="rpg-bar-shimmer" />
          </div>

          {/* Pourcentage centré */}
          <span className="rpg-bar-pct">{Math.round(pct)}%</span>
        </div>
      </div>
    </div>
  );
}
