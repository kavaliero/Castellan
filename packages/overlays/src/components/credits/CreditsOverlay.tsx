import { useEffect, useRef, useState } from "react";
import { CreditsParticles } from "./CreditsParticles";
import { Divider } from "./Divider";
import { NameEntry } from "./NameEntry";
import "./credits.css";

interface CreditsData {
  stream: {
    title: string;
    game: string;
    duration: string;
  };
  stats: {
    viewers: number;
    messages: number;
    topChatter: { name: string; count: number } | null;
  };
  firstMessage: string | null;
  followers: string[];
  subscribers: Array<{ name: string; type: string }>;
  raiders: Array<{ name: string; viewers: number }>;
  cheers: Array<{ name: string; bits: number }>;
}

interface CreditsOverlayProps {
  data: CreditsData;
  scrollDuration?: number; // secondes, défaut 45
}

export function CreditsOverlay({ data, scrollDuration = 45 }: CreditsOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showPromo, setShowPromo] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const content = scrollRef.current;
    if (!container || !content) return;

    setShowPromo(false);

    // Position initiale : sous le viewport
    content.style.transition = "none";
    content.style.transform = `translateY(${container.offsetHeight}px)`;

    // Force reflow
    content.offsetHeight;

    // Position finale : le bas du contenu s'aligne avec le bas du container
    // → le closing ("Gloire à La Kavalry / Black Potion Studio") reste visible à l'écran
    const finalY = content.scrollHeight - container.offsetHeight;

    content.style.transition = `transform ${scrollDuration}s linear`;
    content.style.transform = `translateY(-${finalY}px)`;

    // Quand le scroll se termine, attendre 5s puis afficher la promo
    // IMPORTANT : on filtre sur target === content && propertyName === "transform"
    // sinon les transitions des enfants (NameEntry fade-in) déclenchent l'event trop tôt
    let timer: ReturnType<typeof setTimeout>;
    const onEnd = (e: TransitionEvent) => {
      if (e.target !== content || e.propertyName !== "transform") return;
      timer = setTimeout(() => setShowPromo(true), 5000);
    };
    content.addEventListener("transitionend", onEnd);
    return () => {
      content.removeEventListener("transitionend", onEnd);
      clearTimeout(timer);
    };
  }, [data, scrollDuration]);

  return (
    <div ref={containerRef} className="credits-container">
      <div className="credits-frame" />
      <div className="credits-fade-top" />
      <div className="credits-fade-bottom" />
      <CreditsParticles />

      {/* Promo finale — apparaît après le défilement */}
      <div className={`credits-promo ${showPromo ? "credits-promo--visible" : ""}`}>
        <div className="credits-promo-text">
          Merci à tous ! ❤️
        </div>
        <div className="credits-promo-subtitle">
          N'oubliez pas d'aller regarder notre dernier jeu
        </div>
        <a
          href="https://store.steampowered.com/app/4078640/Granite_Noir_The_Social_Experiment/"
          target="_blank"
          rel="noopener noreferrer"
          className="credits-promo-link"
        >
          🪨 Granite Noir: The Social Experiment
        </a>
        <div className="credits-promo-widget">
          <iframe
            src="https://store.steampowered.com/widget/4078640/?t=Un%20souhait%20pour%20fa%C3%A7onner%20le%20jeu%20%C3%A0%20jamais"
            frameBorder="0"
            width="646"
            height="190"
            title="Granite Noir on Steam"
          />
        </div>
      </div>

      <div ref={scrollRef} className={`credits-scroll ${showPromo ? "credits-scroll--hidden" : ""}`}>
        {/* Grand titre */}
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div className="credits-title">Merci pour ce stream !</div>
          <div className="credits-subtitle">{data.stream.game}</div>
          <div className="credits-duration">Durée : {data.stream.duration}</div>
        </div>

        <Divider />

        {/* Stats */}
        <div className="credits-section-title">
          <span className="credits-section-emoji">📊</span>
          Stats du stream
        </div>
        <div className="credits-stat">
          <span className="credits-stat-icon">👥</span>
          {data.stats.viewers} viewers
        </div>
        <div className="credits-stat">
          <span className="credits-stat-icon">💬</span>
          {data.stats.messages} messages
        </div>
        {data.stats.topChatter && (
          <div className="credits-stat">
            <span className="credits-stat-icon">🏆</span>
            Top Chatteur : {data.stats.topChatter.name} ({data.stats.topChatter.count} messages)
          </div>
        )}

        <Divider />

        {/* Premier message */}
        {data.firstMessage && (
          <>
            <div className="credits-section-title">
              <span className="credits-section-emoji">✨</span>
              Premier message
            </div>
            <NameEntry name={data.firstMessage} />
            <Divider />
          </>
        )}

        {/* Followers */}
        {data.followers.length > 0 && (
          <>
            <div className="credits-section-title">
              <span className="credits-section-emoji">❤️</span>
              Nouveaux Followers
            </div>
            {data.followers.map((name, i) => (
              <NameEntry key={name} name={name} delay={i} />
            ))}
            <Divider />
          </>
        )}

        {/* Subscribers */}
        {data.subscribers.length > 0 && (
          <>
            <div className="credits-section-title">
              <span className="credits-section-emoji">⭐</span>
              Subscribers
            </div>
            {data.subscribers.map((sub, i) => (
              <NameEntry key={sub.name} name={sub.name} detail={sub.type} delay={i} />
            ))}
            <Divider />
          </>
        )}

        {/* Cheers */}
        {data.cheers.length > 0 && (
          <>
            <div className="credits-section-title">
              <span className="credits-section-emoji">💎</span>
              Cheers
            </div>
            {data.cheers.map((cheer, i) => (
              <NameEntry key={cheer.name} name={cheer.name} detail={`${cheer.bits} bits`} delay={i} />
            ))}
            <Divider />
          </>
        )}

        {/* Raiders */}
        {data.raiders.length > 0 && (
          <>
            <div className="credits-section-title">
              <span className="credits-section-emoji">🏰</span>
              Raiders
            </div>
            {data.raiders.map((raider, i) => (
              <NameEntry key={raider.name} name={raider.name} detail={`avec ${raider.viewers} viewers`} delay={i} />
            ))}
            <Divider />
          </>
        )}

        {/* Closing */}
        <div className="credits-closing">
          <div className="credits-closing-title">⚔️ Gloire à La Kavalry ! ⚔️</div>
          <div className="credits-closing-subtitle">
            Propulsé par Castellan
            <br />
            <span className="credits-closing-studio">Black Potion Studio</span>
          </div>
        </div>
      </div>
    </div>
  );
}
