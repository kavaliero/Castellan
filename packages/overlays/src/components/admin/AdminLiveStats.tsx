import { useState, useEffect, useCallback } from "react";
import { apiGet } from "../../hooks/useAdminApi";
import type { LiveStreamStats } from "@castellan/shared";

export function AdminLiveStats() {
  const [stats, setStats] = useState<LiveStreamStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    const res = await apiGet<{ ok: boolean; stats: LiveStreamStats }>("/api/stream/live-stats");
    if (res.error) {
      setError(res.error);
      setStats(null);
    } else if (res.data?.stats) {
      setStats(res.data.stats);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
    // Poll toutes les 15 secondes
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (loading) {
    return (
      <div>
        <div className="admin-header">
          <h2>Live Stats</h2>
          <p>Stats en temps reel du stream</p>
        </div>
        <div className="admin-viewer-loading">Chargement...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div>
        <div className="admin-header">
          <h2>Live Stats</h2>
          <p>Stats en temps reel du stream</p>
        </div>
        <div className="admin-livestats-offline">
          <div className="admin-livestats-offline-icon">📡</div>
          <div className="admin-livestats-offline-text">
            {error === "Aucun stream en cours"
              ? "Aucun stream en cours - les stats apparaitront au prochain stream"
              : error ?? "Impossible de recuperer les stats"
            }
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="admin-header">
        <h2>Live Stats</h2>
        <p>{stats.game} - {stats.title} · {formatDuration(stats.duration)}</p>
      </div>

      {/* Counters row */}
      <div className="admin-livestats-counters">
        <div className="admin-livestats-counter">
          <div className="admin-livestats-counter-value">{stats.currentViewers}</div>
          <div className="admin-livestats-counter-label">Viewers</div>
        </div>
        <div className="admin-livestats-counter">
          <div className="admin-livestats-counter-value">{stats.peakViewers}</div>
          <div className="admin-livestats-counter-label">Peak</div>
        </div>
        <div className="admin-livestats-counter">
          <div className="admin-livestats-counter-value">{stats.totalMessages}</div>
          <div className="admin-livestats-counter-label">Messages</div>
        </div>
        <div className="admin-livestats-counter">
          <div className="admin-livestats-counter-value">{stats.totalViewers}</div>
          <div className="admin-livestats-counter-label">Uniques</div>
        </div>
        <div className="admin-livestats-counter">
          <div className="admin-livestats-counter-value">{stats.newFollowers}</div>
          <div className="admin-livestats-counter-label">Follows</div>
        </div>
        <div className="admin-livestats-counter">
          <div className="admin-livestats-counter-value">{stats.newSubs}</div>
          <div className="admin-livestats-counter-label">Subs</div>
        </div>
        {stats.bitsReceived > 0 && (
          <div className="admin-livestats-counter">
            <div className="admin-livestats-counter-value">{stats.bitsReceived}</div>
            <div className="admin-livestats-counter-label">Bits</div>
          </div>
        )}
      </div>

      <div className="admin-livestats-columns">
        {/* Top Chatters */}
        <div className="admin-card">
          <h3 className="admin-livestats-section-title">Top Chatters</h3>
          {stats.topChatters.length === 0 ? (
            <div className="admin-viewer-empty">Aucun message encore</div>
          ) : (
            <div className="admin-livestats-list">
              {stats.topChatters.map((tc, i) => (
                <div key={tc.viewer.twitchId} className="admin-livestats-list-item">
                  <span className="admin-livestats-rank">#{i + 1}</span>
                  <span className="admin-livestats-name">{tc.viewer.displayName}</span>
                  <span className="admin-livestats-value">{tc.messageCount} msg</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Viewers */}
        <div className="admin-card">
          <h3 className="admin-livestats-section-title">Viewers actifs</h3>
          {stats.activeViewers.length === 0 ? (
            <div className="admin-viewer-empty">Aucun viewer actif</div>
          ) : (
            <div className="admin-livestats-list">
              {stats.activeViewers.slice(0, 15).map((av) => (
                <div key={av.viewer.twitchId} className="admin-livestats-list-item">
                  <span className="admin-viewer-live-dot" />
                  <span className="admin-livestats-name">{av.viewer.displayName}</span>
                  <span className="admin-livestats-value">
                    {av.watchTime > 0 ? `${av.watchTime}m` : "now"}
                    {av.messageCount > 0 ? ` · ${av.messageCount} msg` : ""}
                  </span>
                </div>
              ))}
              {stats.activeViewers.length > 15 && (
                <div className="admin-livestats-more">
                  +{stats.activeViewers.length - 15} autres
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recent Events */}
        <div className="admin-card">
          <h3 className="admin-livestats-section-title">Events recents</h3>
          {stats.recentEvents.length === 0 ? (
            <div className="admin-viewer-empty">Aucun event</div>
          ) : (
            <div className="admin-livestats-list">
              {stats.recentEvents.slice(0, 10).map((evt) => {
                const ICONS: Record<string, string> = {
                  follow: "❤️", sub: "⭐", gift_sub: "🎁", raid: "🏰",
                  bits: "💎", dice: "🎲", channel_point_redemption: "🏆",
                  hype_train: "🔥", first_word: "🪶",
                };
                const time = new Date(evt.timestamp).toLocaleTimeString("fr-FR", {
                  hour: "2-digit", minute: "2-digit",
                });
                return (
                  <div key={`${evt.type}-${evt.id}`} className="admin-livestats-list-item">
                    <span className="admin-livestats-icon">{ICONS[evt.type] ?? "📌"}</span>
                    <span className="admin-livestats-name">{evt.type}</span>
                    <span className="admin-livestats-value">{time}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
