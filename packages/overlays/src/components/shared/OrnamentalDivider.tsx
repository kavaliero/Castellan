import "./shared.css";

/**
 * Séparateur ornamental médiéval.
 *
 * - "symbol" : ligne — symbole — ligne (pour crédits, sections)
 * - "line"   : simple ligne dorée gradient (ornement de bas de cadre)
 */

interface OrnamentalDividerProps {
  variant?: "symbol" | "line";
  symbol?: string;
  width?: string;
  className?: string;
}

export function OrnamentalDivider({
  variant = "symbol",
  symbol = "⚜",
  width = "60%",
  className,
}: OrnamentalDividerProps) {
  if (variant === "line") {
    return (
      <div
        className={`ornamental-divider-line ${className ?? ""}`}
        style={{ width }}
      />
    );
  }

  return (
    <div className={`ornamental-divider ${className ?? ""}`} style={{ width }}>
      <div className="ornamental-divider-segment ornamental-divider-segment--left" />
      <span className="ornamental-divider-symbol">{symbol}</span>
      <div className="ornamental-divider-segment ornamental-divider-segment--right" />
    </div>
  );
}
