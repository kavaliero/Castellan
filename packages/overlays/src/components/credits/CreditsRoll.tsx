import type { CreditsPayload, ViewerInfo } from "@castellan/shared";
import "./credits.css";

/**
 * Le composant de défilement des crédits.
 * 
 * Structure : on construit une liste de "sections" (titre + noms),
 * le tout dans un conteneur qui défile vers le haut via CSS animation.
 * 
 * La durée de l'animation est calculée dynamiquement selon le nombre
 * de sections pour que la vitesse de défilement soit constante.
 */

interface CreditsRollProps {
  credits: CreditsPayload;
}

export function CreditsRoll({ credits }: CreditsRollProps) {
  // Compter le nombre total de lignes pour calculer la durée
  let lineCount = 0;

  // Construire les sections
  const sections: JSX.Element[] = [];

  // --- En-tête ---
  sections.push(
    <div key="header" className="credits-header">
      <h1 className="credits-title">Merci pour ce stream !</h1>
      <p className="credits-stream-title">{credits.stream.title}</p>
      <p className="credits-stream-info">
        Durée : {formatDuration(credits.stream.duration)}
      </p>
    </div>
  );
  lineCount += 4;

  // --- Stats du stream ---
  sections.push(
    <div key="stats" className="credits-section">
      <h2 className="credits-section-title">📊 Stats du stream</h2>
      <p className="credits-stat">{credits.stats.totalViewers} viewers</p>
      <p className="credits-stat">{credits.stats.totalMessages} messages</p>
      {credits.stats.topChatter && (
        <p className="credits-stat">
          💬 Top Chatteur : {credits.stats.topChatter.viewer.displayName} ({credits.stats.topChatter.messageCount} messages)
        </p>
      )}
      {credits.stats.longestWatchSeries && (
        <p className="credits-stat">
          ⏱️ Plus fidèle : {credits.stats.longestWatchSeries.viewer.displayName} ({credits.stats.longestWatchSeries.duration} min)
        </p>
      )}
      {credits.stats.topBitsDonator && (
        <p className="credits-stat">
          💎 Top Bits : {credits.stats.topBitsDonator.viewer.displayName} ({credits.stats.topBitsDonator.amount} bits)
        </p>
      )}
    </div>
  );
  lineCount += 6;

  // --- Sections dynamiques ---
  if (credits.firstMessage) {
    sections.push(buildSection("first", "✨ Premier message", [credits.firstMessage]));
    lineCount += 3;
  }

  if (credits.followers && credits.followers.length > 0) {
    sections.push(buildSection("followers", "❤️ Nouveaux Followers", credits.followers));
    lineCount += credits.followers.length + 2;
  }

  if (credits.subscribers && credits.subscribers.length > 0) {
    sections.push(
      <div key="subs" className="credits-section">
        <h2 className="credits-section-title">⭐ Subscribers</h2>
        {credits.subscribers.map((sub, i) => (
          <p key={i} className="credits-name">
            {sub.viewer.displayName} <span className="credits-detail">Tier {sub.tier}</span>
          </p>
        ))}
      </div>
    );
    lineCount += credits.subscribers.length + 2;
  }

  if (credits.raiders && credits.raiders.length > 0) {
    sections.push(
      <div key="raiders" className="credits-section">
        <h2 className="credits-section-title">🏰 Raiders</h2>
        {credits.raiders.map((raid, i) => (
          <p key={i} className="credits-name">
            {raid.fromChannel} <span className="credits-detail">avec {raid.viewers} viewers</span>
          </p>
        ))}
      </div>
    );
    lineCount += credits.raiders.length + 2;
  }

  if (credits.topChatters && credits.topChatters.length > 0) {
    sections.push(
      <div key="chatters" className="credits-section">
        <h2 className="credits-section-title">💬 Top Chatteurs</h2>
        {credits.topChatters.map((chatter, i) => (
          <p key={i} className="credits-name">
            {chatter.viewer.displayName} <span className="credits-detail">{chatter.messageCount} messages</span>
          </p>
        ))}
      </div>
    );
    lineCount += credits.topChatters.length + 2;
  }

  if (credits.lurkers && credits.lurkers.length > 0) {
    sections.push(buildSection("lurkers", "👻 Lurkers silencieux mais présents", credits.lurkers));
    lineCount += credits.lurkers.length + 2;
  }

  // --- Footer ---
  sections.push(
    <div key="footer" className="credits-footer">
      <p className="credits-thanks">À la prochaine sur La Kavalry ! 🏰</p>
      <p className="credits-links">twitch.tv/kavalierogamedev</p>
    </div>
  );
  lineCount += 3;

  // Durée : ~2 secondes par ligne, minimum 15 secondes
  const duration = Math.max(lineCount * 2, 15);

  return (
    <div className="credits-overlay">
      <div
        className="credits-scroll"
        style={{ animationDuration: `${duration}s` }}
      >
        {sections}
      </div>
    </div>
  );
}

// --- Helpers ---

function buildSection(key: string, title: string, viewers: ViewerInfo[]): JSX.Element {
  return (
    <div key={key} className="credits-section">
      <h2 className="credits-section-title">{title}</h2>
      {viewers.map((v, i) => (
        <p key={i} className="credits-name">{v.displayName}</p>
      ))}
    </div>
  );
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}`;
  return `${m} min`;
}