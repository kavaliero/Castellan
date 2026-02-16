import { useState, useEffect } from "react";
import type { StreamInfoPayload } from "@castellan/shared";
import "./live-coding-frame.css";

/**
 * LiveCodingFrame — cadre live coding médiéval dynamique.
 *
 * Structure :
 * - Bordure dorée avec coins ornementaux (CSS)
 * - Bannière catégorie en haut (game name)
 * - Barre info en bas (uptime + viewers)
 * - Centre transparent (le code est derrière dans OBS)
 *
 * L'uptime est calculé côté client à partir de startedAt.
 */


export function LiveCodingFrame() {

  return (
    <div className="live-coding-frame">

        {/* Bannière catégorie (haut) */}
      <div className="live-coding-frame-banner">
        <div className="live-coding-frame-banner-text">
          {"Live Coding : GRANITE NOIR"}
        </div>
      </div>
      {/* Bordure dorée principale */}
      <div className="live-coding-frame-border" />
      <div className="live-coding-frame-inner-border" />

      {/* Coins ornementaux */}
      <div className="live-coding-frame-corner live-coding-frame-corner--tl" />
      <div className="live-coding-frame-corner live-coding-frame-corner--tr" />
      <div className="live-coding-frame-corner live-coding-frame-corner--bl" />
      <div className="live-coding-frame-corner live-coding-frame-corner--br" />


    </div>
  );
}