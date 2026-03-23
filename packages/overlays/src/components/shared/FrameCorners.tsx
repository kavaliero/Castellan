import "./shared.css";

/**
 * Quatre coins ornementaux dorés pour les cadres médiévaux.
 *
 * Deux variantes :
 * - "subtle" (par défaut) : petits L dorés, animation cornerShine (chat, goals)
 * - "ornate" : L plus grands avec point brillant (webcam, game frame)
 */

interface FrameCornersProps {
  variant?: "subtle" | "ornate";
  className?: string;
}

export function FrameCorners({ variant = "subtle", className }: FrameCornersProps) {
  const base = variant === "ornate" ? "frame-corner--ornate" : "frame-corner--subtle";
  const extra = className ? ` ${className}` : "";

  return (
    <>
      <div className={`frame-corner ${base} frame-corner--tl${extra}`} />
      <div className={`frame-corner ${base} frame-corner--tr${extra}`} />
      <div className={`frame-corner ${base} frame-corner--bl${extra}`} />
      <div className={`frame-corner ${base} frame-corner--br${extra}`} />
    </>
  );
}
