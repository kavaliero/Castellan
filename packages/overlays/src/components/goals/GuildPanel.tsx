import type { GoalPayload } from "@castellan/shared";
import "./goals.css";

/**
 * Panneau de guilde medieval — Layout A du reference v3 :
 *
 * 1. Plaques de guilde (haut) : Dernier Brave (bois) + Grand Mecene (fer)
 * 2. Barres HP/Mana (bas) : Objectif Followers + Objectif Sub
 *
 * Tout en inline styles pour coller au pixel pres au visuel de reference.
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "16px 14px 10px",
        width: "420px",
      }}
    >
      {/* ─── Plaques de guilde ─── */}
      <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
        <GuildPlaque
          label="Dernier Brave"
          icon="⚔️"
          value={lastFollow}
          variant="wood"
        />
        <GuildPlaque
          label="Grand Mécène"
          icon="👑"
          value={lastSub}
          variant="iron"
        />
      </div>

      {/* ─── Barres d'objectifs ─── */}
      <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
        <RPGBar
          label="Objectif Followers"
          icon="❤️"
          current={followersGoal?.current ?? 0}
          target={followersGoal?.target ?? 1000}
          type="hp"
        />
        <RPGBar
          label="Objectif Sub"
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
  icon: string;
  value: string | null;
  variant: "wood" | "iron";
}

function GuildPlaque({ label, icon, value, variant }: GuildPlaqueProps) {
  const colors =
    variant === "iron"
      ? {
          bg: "linear-gradient(180deg, #5A5A6E 0%, #3E3E50 40%, #4A4A5C 60%, #363646 100%)",
          border: "#6E6E82",
          borderDark: "#2A2A38",
          text: "#D4D4E8",
          labelBg: "linear-gradient(180deg, #6E6E82, #50506A)",
          labelBorder: "#888",
          nail: "#888",
          nailInner: "#AAA",
          engrave: "rgba(0,0,0,0.4)",
          engraveLight: "rgba(255,255,255,0.08)",
          chainColor: "#6E6E82",
        }
      : {
          bg: "linear-gradient(180deg, #8B6914 0%, #6B4E12 30%, #7A5C15 60%, #5D4410 100%)",
          border: "#A07818",
          borderDark: "#3E2A08",
          text: "#F5E6C8",
          labelBg: "linear-gradient(180deg, #D4A843, #B8922E)",
          labelBorder: "#A0801A",
          nail: "#D4A843",
          nailInner: "#FFD700",
          engrave: "rgba(0,0,0,0.35)",
          engraveLight: "rgba(255,255,255,0.12)",
          chainColor: "#A07818",
        };

  const nailPositions = [
    { top: "4px", left: "4px" },
    { top: "4px", right: "4px" },
    { bottom: "4px", left: "4px" },
    { bottom: "4px", right: "4px" },
  ] as const;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flex: 1,
      }}
    >
      {/* Chain links */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0px",
          marginBottom: "-2px",
        }}
      >
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              width: "8px",
              height: "10px",
              borderRadius: "4px",
              border: `2px solid ${colors.chainColor}`,
              background: "transparent",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.15), 0 1px 2px rgba(0,0,0,0.3)",
            }}
          />
        ))}
      </div>

      {/* Plaque body */}
      <div
        style={{
          position: "relative",
          background: colors.bg,
          borderRadius: "6px",
          border: `2px solid ${colors.border}`,
          borderBottom: `3px solid ${colors.borderDark}`,
          boxShadow: `
            0 4px 12px rgba(0,0,0,0.4),
            inset 0 1px 0 ${colors.engraveLight},
            inset 0 -1px 0 ${colors.engrave}
          `,
          padding: "20px 16px 10px",
          minWidth: "140px",
          textAlign: "center" as const,
        }}
      >
        {/* Corner nails */}
        {nailPositions.map((pos, i) => (
          <div
            key={i}
            style={{
              position: "absolute" as const,
              ...pos,
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: `radial-gradient(circle at 35% 35%, ${colors.nailInner}, ${colors.nail})`,
              boxShadow:
                "0 1px 2px rgba(0,0,0,0.4), inset 0 -1px 1px rgba(0,0,0,0.2)",
            }}
          />
        ))}

        {/* Label badge */}
        <div
          style={{
            position: "absolute" as const,
            top: "-9px",
            left: "50%",
            transform: "translateX(-50%)",
            background: colors.labelBg,
            borderRadius: "3px",
            padding: "1px 10px",
            border: `1px solid ${colors.labelBorder}`,
            boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
            whiteSpace: "nowrap" as const,
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span style={{ fontSize: "10px" }}>{icon}</span>
          <span
            style={{
              fontFamily: "'MedievalSharp', cursive",
              fontSize: "8px",
              color: "#2C1810",
              letterSpacing: "0.5px",
              textTransform: "uppercase" as const,
              fontWeight: "bold",
              textShadow: "0 1px 0 rgba(255,255,255,0.25)",
            }}
          >
            {label}
          </span>
        </div>

        {/* Engraved name */}
        <div
          key={value ?? "empty"}
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: "15px",
            fontWeight: 700,
            color: colors.text,
            textShadow: `
              0 -1px 0 ${colors.engrave},
              0 1px 0 ${colors.engraveLight}
            `,
            letterSpacing: "1px",
            whiteSpace: "nowrap" as const,
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "150px",
            animation: "engraveIn 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {value || "—"}
        </div>
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

  const palette =
    type === "hp"
      ? {
          fill: isComplete
            ? "linear-gradient(180deg, #66BB6A 0%, #4CAF50 50%, #388E3C 100%)"
            : "linear-gradient(180deg, #E85454 0%, #C62828 40%, #B71C1C 60%, #8B0000 100%)",
          fillGlow: isComplete
            ? "rgba(76, 175, 80, 0.5)"
            : "rgba(232, 84, 84, 0.4)",
          track:
            "linear-gradient(180deg, #1A0505 0%, #2A0A0A 50%, #1A0505 100%)",
          labelColor: "#FF6B6B",
          shine: "rgba(255, 150, 150, 0.3)",
          pulse:
            isComplete
              ? "none"
              : pct < 25
                ? "hpCritical 1s ease-in-out infinite"
                : "none",
        }
      : {
          fill: isComplete
            ? "linear-gradient(180deg, #66BB6A 0%, #4CAF50 50%, #388E3C 100%)"
            : "linear-gradient(180deg, #64B5F6 0%, #1E88E5 40%, #1565C0 60%, #0D47A1 100%)",
          fillGlow: isComplete
            ? "rgba(76, 175, 80, 0.5)"
            : "rgba(100, 181, 246, 0.4)",
          track:
            "linear-gradient(180deg, #050A1A 0%, #0A102A 50%, #050A1A 100%)",
          labelColor: "#64B5F6",
          shine: "rgba(150, 200, 255, 0.3)",
          pulse: "none",
        };

  return (
    <div style={{ flex: 1 }}>
      {/* Label row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "3px",
          padding: "0 2px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ fontSize: "12px" }}>{icon}</span>
          <span
            style={{
              fontFamily: "'MedievalSharp', cursive",
              fontSize: "11px",
              color: palette.labelColor,
              letterSpacing: "1px",
              textShadow: `0 0 8px ${palette.fillGlow}`,
            }}
          >
            {label}
          </span>
        </div>
        <span
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: "11px",
            color: "#E8DCC8",
            fontWeight: 700,
          }}
        >
          {current} / {target}
          {isComplete && (
            <span style={{ marginLeft: "4px", color: "#4CAF50" }}>✓</span>
          )}
        </span>
      </div>

      {/* Bar container with ornate golden border */}
      <div
        style={{
          position: "relative",
          padding: "3px",
          borderRadius: "8px",
          background:
            "linear-gradient(180deg, #D4A843 0%, #8B6914 30%, #C4A055 50%, #8B6914 70%, #D4A843 100%)",
          boxShadow: `
            0 2px 8px rgba(0,0,0,0.4),
            inset 0 1px 0 rgba(255,215,0,0.3),
            0 0 12px ${palette.fillGlow}
          `,
          animation: palette.pulse,
        }}
      >
        {/* Inner ornate line */}
        <div
          style={{
            position: "absolute",
            top: "1px",
            left: "8px",
            right: "8px",
            height: "1px",
            background:
              "linear-gradient(90deg, transparent, rgba(255,215,0,0.4), transparent)",
          }}
        />

        {/* Track */}
        <div
          style={{
            width: "100%",
            height: "16px",
            borderRadius: "5px",
            background: palette.track,
            overflow: "hidden",
            position: "relative",
            boxShadow: "inset 0 2px 4px rgba(0,0,0,0.6)",
          }}
        >
          {/* Fill */}
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              borderRadius: "4px",
              background: palette.fill,
              transition: "width 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
              position: "relative",
              boxShadow: `0 0 8px ${palette.fillGlow}`,
            }}
          >
            {/* Top shine */}
            <div
              style={{
                position: "absolute",
                top: "1px",
                left: "4px",
                right: "4px",
                height: "5px",
                borderRadius: "3px",
                background: `linear-gradient(180deg, ${palette.shine}, transparent)`,
              }}
            />

            {/* Animated shimmer */}
            <div
              className="rpg-bar-shimmer"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: "4px",
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)",
                animation: "shimmer 3s ease-in-out infinite",
              }}
            />
          </div>

          {/* Percentage text centered in bar */}
          <span
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              fontFamily: "'Cinzel', serif",
              fontSize: "9px",
              fontWeight: 900,
              color: "rgba(255,255,255,0.85)",
              textShadow: "0 1px 3px rgba(0,0,0,0.8)",
              letterSpacing: "1px",
            }}
          >
            {Math.round(pct)}%
          </span>
        </div>
      </div>
    </div>
  );
}
