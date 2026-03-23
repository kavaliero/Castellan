/**
 * DiceBoardOverlay — Widget persistant qui affiche les derniers lancers de des.
 *
 * Affiche les 3 derniers lancers avec l'image du de, le pseudo, et le resultat.
 * Les nouvelles entrees arrivent par le haut avec une animation GSAP.
 *
 * Browser source OBS : http://localhost:3000/overlay/dice-board
 * Taille recommandee : 260x300, position en bas a droite
 */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { getDiceColor, getDiceImagePath } from "./diceAssets";
import type { DiceRollData } from "./DiceRollOverlay";
import "./dice.css";

const MAX_ENTRIES = 3;

export interface DiceBoardEntry {
  id: string;
  data: DiceRollData;
  timestamp: number;
}

interface DiceBoardOverlayProps {
  entries: DiceBoardEntry[];
}

export function DiceBoardOverlay({ entries }: DiceBoardOverlayProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Animer la nouvelle entree quand elle arrive
  useEffect(() => {
    if (!listRef.current) return;
    if (entries.length > prevCountRef.current) {
      const firstChild = listRef.current.firstElementChild;
      if (firstChild) {
        gsap.fromTo(
          firstChild,
          { opacity: 0, x: 40, scale: 0.8 },
          { opacity: 1, x: 0, scale: 1, duration: 0.4, ease: "back.out(1.3)" }
        );
      }
    }
    prevCountRef.current = entries.length;
  }, [entries.length]);

  const visible = entries.slice(0, MAX_ENTRIES);

  if (visible.length === 0) return null;

  return (
    <div className="dice-board">
      <div className="dice-board-title">Derniers lancers</div>
      <div ref={listRef}>
        {visible.map((entry) => {
          const color = getDiceColor(entry.data.tier);
          const imgSrc = getDiceImagePath(entry.data.faces, color, entry.data.result);
          const isNat20 = entry.data.isNat20;
          const isSquatt = entry.data.dieType === "squatt";

          let detail = `d${entry.data.faces}`;
          if (isSquatt) {
            detail += ` - ${entry.data.result} squatt${entry.data.result > 1 ? "s" : ""}`;
          } else if (isNat20) {
            detail += " - NAT 20 !";
          } else {
            detail += ` - ${entry.data.result}/${entry.data.faces}`;
          }

          return (
            <div
              key={entry.id}
              className={`dice-board-entry dice-board-entry--${isNat20 ? "nat20" : color}`}
            >
              <img
                className="dice-board-entry-img"
                src={imgSrc}
                alt={`d${entry.data.faces}`}
                draggable={false}
              />
              <div className="dice-board-entry-info">
                <span className="dice-board-entry-viewer">{entry.data.displayName}</span>
                <span className="dice-board-entry-detail">{detail}</span>
              </div>
              <span className="dice-board-entry-result">{entry.data.result}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
