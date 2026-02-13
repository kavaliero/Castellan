import { useState, useEffect, useRef, useCallback } from "react";
import type { TwitchClip } from "@castellan/shared";
import "./pause.css";

/**
 * PausePlayer — Joue les clips Twitch téléchargés localement.
 *
 * Les clips sont dans /clips/*.mp4 (dossier public/ de Vite).
 * Un <video muted autoPlay> fonctionne partout sans restriction :
 * - Navigateur classique : autoplay OK car muted
 * - OBS Browser Source : autoplay OK nativement
 *
 * Le son est muted par défaut. Dans OBS, on peut unmute via
 * les propriétés de la Browser Source ("Contrôler l'audio via OBS").
 */

const API_URL = "http://localhost:3001/api/clips";

export function PausePlayer() {
  const [clips, setClips] = useState<TwitchClip[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ─── Fetch clips depuis le server ──────────────────────────

  const fetchClips = useCallback(async () => {
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      if (data.ok && data.clips.length > 0) {
        // Filtrer uniquement les clips qui ont un videoUrl local
        const localClips = data.clips.filter((c: TwitchClip) => c.videoUrl);
        if (localClips.length > 0) {
          setClips(localClips);
          setCurrentIndex(0);
          setIsLoaded(true);
          setHasError(false);
          console.log(`[Pause] ${localClips.length} clips locaux chargés`);
        } else {
          console.warn("[Pause] Clips reçus mais aucun videoUrl local");
          setHasError(true);
        }
      } else {
        setHasError(true);
      }
    } catch (err) {
      console.error("[Pause] Erreur fetch clips:", err);
      setHasError(true);
    }
  }, []);

  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  // ─── Transition vers le clip suivant ──────────────────────

  const goToNext = useCallback(() => {
    if (clips.length === 0) return;

    setIsTransitioning(true);

    setTimeout(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= clips.length) {
          // Re-fetch pour un nouvel ordre shuffle
          fetchClips();
          return 0;
        }
        return next;
      });
      setIsTransitioning(false);
    }, 600);
  }, [clips.length, fetchClips]);

  // ─── Handlers vidéo ───────────────────────────────────────

  const handleVideoEnd = useCallback(() => {
    goToNext();
  }, [goToNext]);

  const handleVideoError = useCallback(() => {
    console.warn(`[Pause] Vidéo locale indisponible, passage au suivant`);
    setTimeout(() => goToNext(), 500);
  }, [goToNext]);

  // ─── Unmute après le démarrage (autoplay nécessite muted) ─

  const handleVideoPlay = useCallback(() => {
    if (videoRef.current && videoRef.current.muted) {
      try {
        videoRef.current.muted = false;
      } catch {
        // Si le navigateur refuse le unmute, on reste muted
        // Dans OBS Browser Source ça fonctionne toujours
      }
    }
  }, []);

  // ─── Clip actuel ──────────────────────────────────────────

  const currentClip = clips[currentIndex];

  // ─── Render : état d'attente ──────────────────────────────

  if (hasError || !isLoaded) {
    return (
      <div className="pause-container">
        <div className="pause-frame" />
        <div className="pause-banner">
          <div className="pause-banner-icon">&#9876;</div>
          <div className="pause-banner-text">On revient bientot</div>
          <div className="pause-banner-sub">Le seigneur est parti en quete...</div>
        </div>
        {hasError && (
          <div className="pause-status">Aucun clip disponible</div>
        )}
      </div>
    );
  }

  // ─── Render : lecture des clips ───────────────────────────

  return (
    <div className="pause-container">
      {/* Fond sombre derrière la vidéo */}
      <div className="pause-bg" />

      {/* Vidéo locale — muted autoplay fonctionne partout */}
      {currentClip && (
        <video
          ref={videoRef}
          className={`pause-video ${isTransitioning ? "pause-video--fading" : ""}`}
          src={currentClip.videoUrl}
          autoPlay
          muted
          playsInline
          onEnded={handleVideoEnd}
          onError={handleVideoError}
          onPlay={handleVideoPlay}
          key={`${currentClip.id}-${currentIndex}`}
        />
      )}

      {/* Vignette overlay (assombrit les bords) */}
      <div className="pause-vignette" />

      {/* Cadre médiéval */}
      <div className="pause-frame" />

      {/* Bandeau "On revient bientôt" */}
      <div className="pause-banner">
        <div className="pause-banner-icon">&#9876;</div>
        <div className="pause-banner-text">On revient bientot</div>
      </div>

      {/* Info du clip en cours */}
      {currentClip && (
        <div className={`pause-clip-info ${isTransitioning ? "pause-clip-info--fading" : ""}`}>
          <div className="pause-clip-title">{currentClip.title}</div>
          <div className="pause-clip-meta">
            <span className="pause-clip-creator">Clip par {currentClip.creatorName}</span>
            {currentClip.gameName && (
              <>
                <span className="pause-clip-separator">&#8226;</span>
                <span className="pause-clip-game">{currentClip.gameName}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Compteur de clips */}
      <div className="pause-counter">
        {currentIndex + 1} / {clips.length}
      </div>
    </div>
  );
}
