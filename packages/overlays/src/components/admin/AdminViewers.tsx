import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost } from "../../hooks/useAdminApi";
import type {
  ViewerDetailed,
  ViewerListResponse,
  ViewerTimelineEvent,
} from "@castellan/shared";

// ─── Sous-composant : badge RP ─────────────────────────────

function BadgePill({ icon, name }: { icon: string; name: string }) {
  return (
    <span className="admin-viewer-badge" title={name}>
      {icon}
    </span>
  );
}

// ─── Sous-composant : timeline event ────────────────────────

const EVENT_ICONS: Record<string, string> = {
  follow: "❤️",
  sub: "⭐",
  gift_sub: "🎁",
  raid: "🏰",
  bits: "💎",
  dice: "🎲",
  channel_point_redemption: "🏆",
  hype_train: "🔥",
  first_word: "🪶",
  message: "💬",
};

const EVENT_LABELS: Record<string, string> = {
  follow: "Follow",
  sub: "Sub",
  gift_sub: "Gift Sub",
  raid: "Raid",
  bits: "Bits",
  dice: "Lance de des",
  channel_point_redemption: "Channel Points",
  hype_train: "Hype Train",
  first_word: "Premiere parole",
  message: "Message",
};

function TimelineItem({ event }: { event: ViewerTimelineEvent }) {
  const icon = EVENT_ICONS[event.type] ?? "📌";
  const label = EVENT_LABELS[event.type] ?? event.type;
  const date = new Date(event.timestamp);
  const dateStr = date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  let detail = "";
  if (event.data) {
    if (event.type === "bits") detail = `${event.data.amount} bits`;
    else if (event.type === "sub") detail = `Tier ${event.data.tier}${(event.data.months as number) > 1 ? ` - ${event.data.months} mois` : ""}`;
    else if (event.type === "gift_sub") detail = `→ ${event.data.recipientName}`;
    else if (event.type === "raid") detail = `${event.data.viewers} viewers`;
    else if (event.type === "dice") detail = `d${event.data.faces} → ${event.data.result}`;
    else if (event.type === "channel_point_redemption") detail = `${event.data.rewardName} (${event.data.rewardCost})`;
    else if (event.type === "message") detail = String(event.data.content ?? "").slice(0, 80);
  }

  return (
    <div className="admin-timeline-item">
      <div className="admin-timeline-icon">{icon}</div>
      <div className="admin-timeline-content">
        <div className="admin-timeline-header">
          <span className="admin-timeline-label">{label}</span>
          <span className="admin-timeline-date">{dateStr} {timeStr}</span>
        </div>
        {detail && <div className="admin-timeline-detail">{detail}</div>}
        {event.streamTitle && (
          <div className="admin-timeline-stream">{event.streamGame} - {event.streamTitle}</div>
        )}
      </div>
    </div>
  );
}

// ─── Sous-composant : fiche viewer ──────────────────────────

function ViewerDetail({
  viewer: initialViewer,
  onBack,
}: {
  viewer: ViewerDetailed;
  onBack: () => void;
}) {
  const [viewer, setViewer] = useState<ViewerDetailed>(initialViewer);
  const [timeline, setTimeline] = useState<ViewerTimelineEvent[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoadingTimeline(true);
    apiGet<{ ok: boolean; timeline: ViewerTimelineEvent[] }>(
      `/api/viewers/${viewer.twitchId}/timeline?limit=100`
    ).then((res) => {
      if (res.data?.timeline) setTimeline(res.data.timeline);
      setLoadingTimeline(false);
    });
  }, [viewer.twitchId]);

  const handleEnrich = async () => {
    setEnriching(true);
    setEnrichMsg(null);
    const res = await apiPost<{ ok: boolean; viewer?: ViewerDetailed; error?: string }>(
      `/api/viewers/${viewer.id}/enrich`
    );
    if (res.data?.ok && res.data.viewer) {
      setViewer(res.data.viewer);
      setEnrichMsg("Donnees Twitch mises a jour !");
    } else {
      setEnrichMsg(res.data?.error ?? res.error ?? "Erreur lors de l'enrichissement");
    }
    setEnriching(false);
    setTimeout(() => setEnrichMsg(null), 4000);
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div>
      <button className="admin-btn admin-btn--secondary" onClick={onBack} style={{ marginBottom: 16 }}>
        ← Retour a la liste
      </button>

      {/* Header viewer */}
      <div className="admin-viewer-detail-header">
        <div className="admin-viewer-detail-name">
          <h2>
            {viewer.twitchProfileImageUrl && (
              <img
                src={viewer.twitchProfileImageUrl}
                alt={viewer.displayName}
                className="admin-viewer-avatar"
              />
            )}
            {viewer.currentSessionActive && (
              <span className="admin-viewer-live-dot" title="En ligne maintenant" />
            )}
            {viewer.displayName}
            {viewer.isStreamer && <span className="admin-viewer-streamer-tag">📺 Streamer</span>}
          </h2>
          <span className="admin-viewer-username">
            @{viewer.username}
            {viewer.isFollower && " · ❤️ Follower"}
            {viewer.isSubscriber && " · ⭐ Abonne"}
            {viewer.broadcasterType === "partner" && " · Partner"}
            {viewer.broadcasterType === "affiliate" && " · Affiliate"}
          </span>
          <button
            className="admin-btn admin-btn--secondary admin-btn--small"
            onClick={handleEnrich}
            disabled={enriching}
            style={{ marginLeft: 12 }}
          >
            {enriching ? "⏳ Chargement..." : "🔄 Rafraichir Twitch"}
          </button>
          {enrichMsg && <span className="admin-viewer-enrich-msg">{enrichMsg}</span>}
        </div>
        {/* Tampons */}
        <div className="admin-viewer-stamps">
          <span className="admin-viewer-stamps-label">Tampons :</span>
          <span className="admin-viewer-stamps-dots">
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className={`admin-stamp-dot ${i < (viewer.stampCount ?? 0) ? "admin-stamp-dot--filled" : ""}`}
                title={`Tampon ${i + 1}`}
              />
            ))}
          </span>
          <span className="admin-viewer-stamps-count">
            {viewer.stampCount ?? 0}/10
            {(viewer.stampCount ?? 0) >= 10 && " — Relance de de deverrouillee !"}
          </span>
        </div>

        {/* Badges */}
        <div className="admin-viewer-detail-badges">
          {viewer.badges.map((b) => (
            <span key={b.id} className="admin-viewer-badge-full" title={`${b.description}${b.earnedAt ? ` — Obtenu le ${new Date(b.earnedAt).toLocaleDateString("fr-FR")}` : ""}`}>
              {b.icon} {b.name}
              {b.earnedAt && <span className="admin-badge-date">{new Date(b.earnedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>}
            </span>
          ))}
          {viewer.badges.length === 0 && (
            <span style={{ color: "#666", fontSize: 12 }}>Aucun badge encore</span>
          )}
        </div>
      </div>

      {/* Stats grid - principales */}
      <div className="admin-viewer-stats-grid">
        <div className="admin-viewer-stat">
          <div className="admin-viewer-stat-value">{viewer.totalMessages.toLocaleString()}</div>
          <div className="admin-viewer-stat-label">Messages</div>
        </div>
        <div className="admin-viewer-stat">
          <div className="admin-viewer-stat-value">{viewer.totalStreams}</div>
          <div className="admin-viewer-stat-label">Streams</div>
        </div>
        <div className="admin-viewer-stat">
          <div className="admin-viewer-stat-value">{viewer.firstWordCount}</div>
          <div className="admin-viewer-stat-label">FIRST!</div>
        </div>
        <div className="admin-viewer-stat">
          <div className="admin-viewer-stat-value">{viewer.subCount}</div>
          <div className="admin-viewer-stat-label">Subs cumules</div>
        </div>
        <div className="admin-viewer-stat">
          <div className="admin-viewer-stat-value">{viewer.totalBitsDonated.toLocaleString()}</div>
          <div className="admin-viewer-stat-label">Bits donnes</div>
        </div>
        <div className="admin-viewer-stat">
          <div className="admin-viewer-stat-value">{viewer.totalChannelPointsUsed.toLocaleString()}</div>
          <div className="admin-viewer-stat-label">Channel Points</div>
        </div>
        <div className="admin-viewer-stat">
          <div className="admin-viewer-stat-value">{viewer.raidCount}</div>
          <div className="admin-viewer-stat-label">Raids donnes</div>
        </div>
        <div className="admin-viewer-stat">
          <div className="admin-viewer-stat-value">{viewer.giftSubCount}</div>
          <div className="admin-viewer-stat-label">Gift Subs</div>
        </div>
        <div className="admin-viewer-stat">
          <div className="admin-viewer-stat-value">{viewer.lurkCount}</div>
          <div className="admin-viewer-stat-label">Lurks</div>
        </div>
        <div className="admin-viewer-stat">
          <div className="admin-viewer-stat-value">{viewer.diceRollCount}</div>
          <div className="admin-viewer-stat-label">Lances de des</div>
        </div>
        {viewer.bestDiceRoll && (
          <div className="admin-viewer-stat">
            <div className="admin-viewer-stat-value">
              {viewer.bestDiceRoll.result}/{viewer.bestDiceRoll.faces}
            </div>
            <div className="admin-viewer-stat-label">Meilleur lancer</div>
          </div>
        )}
        {viewer.worstDiceRoll && (
          <div className="admin-viewer-stat">
            <div className="admin-viewer-stat-value">
              {viewer.worstDiceRoll.result}/{viewer.worstDiceRoll.faces}
            </div>
            <div className="admin-viewer-stat-label">Pire lancer</div>
          </div>
        )}
        {viewer.twitchFollowerCount != null && (
          <div className="admin-viewer-stat">
            <div className="admin-viewer-stat-value">{viewer.twitchFollowerCount.toLocaleString()}</div>
            <div className="admin-viewer-stat-label">Ses followers</div>
          </div>
        )}
      </div>

      {/* Dates */}
      <div className="admin-viewer-dates">
        <span>Vu pour la premiere fois : {new Date(viewer.firstSeenAt).toLocaleDateString("fr-FR")}</span>
        <span>Derniere activite : {new Date(viewer.lastSeenAt).toLocaleDateString("fr-FR")}</span>
      </div>

      {/* Timeline */}
      <div className="admin-viewer-timeline-section">
        <h3>Timeline d'activite</h3>
        {loadingTimeline ? (
          <div className="admin-viewer-loading">Chargement...</div>
        ) : timeline.length === 0 ? (
          <div className="admin-viewer-empty">Aucune activite enregistree</div>
        ) : (
          <div className="admin-timeline">
            {timeline.map((evt) => (
              <TimelineItem key={`${evt.type}-${evt.id}`} event={evt} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Composant principal : AdminViewers ─────────────────────

type SortField = "totalMessages" | "totalWatchTime" | "totalBitsDonated" | "totalChannelPointsUsed" | "firstSeenAt" | "totalStreams" | "displayName";

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "totalMessages", label: "Messages" },
  { value: "totalWatchTime", label: "Watch Time" },
  { value: "totalBitsDonated", label: "Bits" },
  { value: "totalChannelPointsUsed", label: "Channel Points" },
  { value: "totalStreams", label: "Streams" },
  { value: "firstSeenAt", label: "Anciennete" },
  { value: "displayName", label: "Nom" },
];

export function AdminViewers() {
  const [viewers, setViewers] = useState<ViewerDetailed[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>("totalMessages");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterFollower, setFilterFollower] = useState<string>("");
  const [filterSub, setFilterSub] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedViewer, setSelectedViewer] = useState<ViewerDetailed | null>(null);
  const [twitchAuth, setTwitchAuth] = useState<{ configured: boolean; hasUserToken: boolean } | null>(null);
  const [batchEnriching, setBatchEnriching] = useState(false);
  const [batchMsg, setBatchMsg] = useState<string | null>(null);
  const [showPurge, setShowPurge] = useState(false);
  const [purgeData, setPurgeData] = useState<{
    deleted: { id: string; username: string; displayName: string; twitchId: string; totalMessages: number; reason: string }[];
    testData: { id: string; username: string; displayName: string; twitchId: string; totalMessages: number; reason: string }[];
    totalPurgeable: number;
  } | null>(null);
  const [purging, setPurging] = useState(false);
  const [purgeMsg, setPurgeMsg] = useState<string | null>(null);

  const loadPurgeData = async () => {
    const res = await apiGet<{
      ok: boolean;
      deleted: { id: string; username: string; displayName: string; twitchId: string; totalMessages: number; reason: string }[];
      testData: { id: string; username: string; displayName: string; twitchId: string; totalMessages: number; reason: string }[];
      totalPurgeable: number;
    }>("/api/viewers/purgeable");
    if (res.data) setPurgeData(res.data);
  };

  const handlePurge = async (ids: string[]) => {
    if (ids.length === 0) return;
    setPurging(true);
    setPurgeMsg(null);
    const res = await apiPost<{ ok: boolean; purged?: number; error?: string }>(
      "/api/viewers/purge",
      { ids }
    );
    if (res.data?.ok) {
      setPurgeMsg(`${res.data.purged} viewer(s) supprime(s)`);
      loadPurgeData(); // Refresh la liste purgeable
      fetchViewers();  // Refresh la liste principale
    } else {
      setPurgeMsg(res.data?.error ?? res.error ?? "Erreur purge");
    }
    setPurging(false);
    setTimeout(() => setPurgeMsg(null), 5000);
  };

  const handlePurgeAll = () => {
    if (!purgeData) return;
    const allIds = [
      ...purgeData.deleted.map((v) => v.id),
      ...purgeData.testData.map((v) => v.id),
    ];
    handlePurge(allIds);
  };

  const handleBatchEnrich = async () => {
    setBatchEnriching(true);
    setBatchMsg(null);
    const res = await apiPost<{ ok: boolean; enriched?: number; failed?: number; error?: string }>(
      "/api/twitch/enrich-batch",
      { forceAll: true }
    );
    if (res.data?.ok) {
      setBatchMsg(`${res.data.enriched} enrichis, ${res.data.failed} echoues`);
      // Refresh la liste apres enrichissement
      fetchViewers();
    } else {
      setBatchMsg(res.data?.error ?? res.error ?? "Erreur batch");
    }
    setBatchEnriching(false);
    setTimeout(() => setBatchMsg(null), 6000);
  };

  const fetchViewers = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);
    if (search) params.set("search", search);
    if (filterFollower) params.set("follower", filterFollower);
    if (filterSub) params.set("subscriber", filterSub);

    const res = await apiGet<ViewerListResponse & { ok: boolean }>(
      `/api/viewers?${params.toString()}`
    );

    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    if (res.data) {
      setViewers(res.data.viewers);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    }
    setLoading(false);
  }, [page, pageSize, sortBy, sortOrder, search, filterFollower, filterSub]);

  useEffect(() => {
    fetchViewers();
  }, [fetchViewers]);

  // Charger le statut OAuth Twitch
  useEffect(() => {
    apiGet<{ ok: boolean; configured: boolean; hasUserToken: boolean }>("/api/twitch/auth-status")
      .then((res) => {
        if (res.data) setTwitchAuth({ configured: res.data.configured, hasUserToken: res.data.hasUserToken });
      });
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [sortBy, sortOrder, search, filterFollower, filterSub]);

  const handleSearch = () => {
    setSearch(searchInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${m}m` : `${h}h`;
  };

  // ── Fiche viewer ──────────────────────────────────────
  if (selectedViewer) {
    return (
      <div>
        <div className="admin-header">
          <h2>Viewers</h2>
          <p>Fiche viewer detaillee</p>
        </div>
        <ViewerDetail viewer={selectedViewer} onBack={() => setSelectedViewer(null)} />
      </div>
    );
  }

  // ── Liste viewers ─────────────────────────────────────
  return (
    <div>
      <div className="admin-header">
        <h2>Viewers</h2>
        <p>{total} viewer{total > 1 ? "s" : ""} au total</p>
      </div>

      {/* Twitch OAuth banner */}
      {twitchAuth && twitchAuth.configured && !twitchAuth.hasUserToken && (
        <div className="admin-twitch-oauth-banner">
          <span>Connecte ton compte Twitch pour detecter automatiquement les followers</span>
          <a
            href="http://localhost:3001/api/twitch/auth"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-btn admin-btn--primary admin-btn--small"
          >
            Connecter Twitch
          </a>
        </div>
      )}

      {twitchAuth && twitchAuth.hasUserToken && (
        <div className="admin-twitch-oauth-banner admin-twitch-oauth-banner--ok">
          <span>Twitch connecte — detection des followers active</span>
        </div>
      )}

      {/* Toolbar : search + filters + sort */}
      <div className="admin-viewers-toolbar">
        <div className="admin-viewers-search">
          <input
            className="admin-input"
            placeholder="Rechercher un viewer..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="admin-btn admin-btn--primary" onClick={handleSearch}>
            Chercher
          </button>
          {search && (
            <button
              className="admin-btn admin-btn--secondary"
              onClick={() => { setSearch(""); setSearchInput(""); }}
            >
              ✕
            </button>
          )}
        </div>

        <div className="admin-viewers-filters">
          <select
            className="admin-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortField)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            className="admin-btn admin-btn--secondary"
            onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
            title={sortOrder === "desc" ? "Decroissant" : "Croissant"}
          >
            {sortOrder === "desc" ? "↓" : "↑"}
          </button>
          <select
            className="admin-select"
            value={filterFollower}
            onChange={(e) => setFilterFollower(e.target.value)}
          >
            <option value="">Tous</option>
            <option value="true">Followers</option>
            <option value="false">Non-followers</option>
          </select>
          <select
            className="admin-select"
            value={filterSub}
            onChange={(e) => setFilterSub(e.target.value)}
          >
            <option value="">Tous</option>
            <option value="true">Abonnes</option>
            <option value="false">Non-abonnes</option>
          </select>

          {twitchAuth?.configured && (
            <button
              className="admin-btn admin-btn--primary admin-btn--small"
              onClick={handleBatchEnrich}
              disabled={batchEnriching}
              title="Enrichir tous les viewers via l'API Twitch"
            >
              {batchEnriching ? "⏳ Enrichissement..." : "🔄 Refresh All Twitch"}
            </button>
          )}
          <button
            className="admin-btn admin-btn--secondary admin-btn--small"
            onClick={() => { setShowPurge(!showPurge); if (!showPurge) loadPurgeData(); }}
            title="Nettoyer les bots et donnees de test"
          >
            🗑️ Nettoyer
          </button>
          {batchMsg && <span className="admin-viewer-enrich-msg">{batchMsg}</span>}
        </div>
      </div>

      {/* Panneau de purge */}
      {showPurge && (
        <div className="admin-purge-panel">
          <div className="admin-purge-header">
            <h3>Nettoyage des viewers</h3>
            <button className="admin-btn admin-btn--secondary admin-btn--small" onClick={() => setShowPurge(false)}>✕</button>
          </div>
          {!purgeData ? (
            <div className="admin-viewer-loading">Chargement...</div>
          ) : purgeData.totalPurgeable === 0 ? (
            <div className="admin-viewer-empty">Rien a nettoyer, tout est propre !</div>
          ) : (
            <>
              <p style={{ margin: "8px 0", fontSize: 13, color: "#aaa" }}>
                {purgeData.totalPurgeable} viewer(s) supprimable(s).
                La suppression est definitive (sessions, messages, events inclus).
              </p>

              {purgeData.deleted.length > 0 && (
                <div className="admin-purge-section">
                  <div className="admin-purge-section-header">
                    <span>Comptes Twitch supprimes ({purgeData.deleted.length})</span>
                    <button
                      className="admin-btn admin-btn--secondary admin-btn--small"
                      onClick={() => handlePurge(purgeData.deleted.map((v) => v.id))}
                      disabled={purging}
                    >
                      Supprimer tous
                    </button>
                  </div>
                  <div className="admin-purge-list">
                    {purgeData.deleted.map((v) => (
                      <div key={v.id} className="admin-purge-item">
                        <span className="admin-purge-name">{v.displayName} <span style={{ color: "#666" }}>({v.totalMessages} msg)</span></span>
                        <button
                          className="admin-btn admin-btn--secondary admin-btn--small"
                          onClick={() => handlePurge([v.id])}
                          disabled={purging}
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {purgeData.testData.length > 0 && (
                <div className="admin-purge-section">
                  <div className="admin-purge-section-header">
                    <span>Donnees de test ({purgeData.testData.length})</span>
                    <button
                      className="admin-btn admin-btn--secondary admin-btn--small"
                      onClick={() => handlePurge(purgeData.testData.map((v) => v.id))}
                      disabled={purging}
                    >
                      Supprimer tous
                    </button>
                  </div>
                  <div className="admin-purge-list">
                    {purgeData.testData.map((v) => (
                      <div key={v.id} className="admin-purge-item">
                        <span className="admin-purge-name">{v.displayName} <span style={{ color: "#666" }}>(@{v.username}, id:{v.twitchId})</span></span>
                        <button
                          className="admin-btn admin-btn--secondary admin-btn--small"
                          onClick={() => handlePurge([v.id])}
                          disabled={purging}
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  className="admin-btn admin-btn--primary"
                  onClick={handlePurgeAll}
                  disabled={purging}
                >
                  {purging ? "⏳ Suppression..." : `🗑️ Tout supprimer (${purgeData.totalPurgeable})`}
                </button>
                {purgeMsg && <span className="admin-viewer-enrich-msg">{purgeMsg}</span>}
              </div>
            </>
          )}
        </div>
      )}

      {error && <div className="admin-error">{error}</div>}

      {/* Table */}
      {loading ? (
        <div className="admin-viewer-loading">Chargement...</div>
      ) : viewers.length === 0 ? (
        <div className="admin-viewer-empty">Aucun viewer trouve</div>
      ) : (
        <div className="admin-viewers-table-wrap">
          <table className="admin-viewers-table">
            <thead>
              <tr>
                <th>Viewer</th>
                <th>Messages</th>
                <th>Streams</th>
                <th>FIRST</th>
                <th>Subs</th>
                <th>Bits</th>
                <th>Raids</th>
                <th>Badges</th>
              </tr>
            </thead>
            <tbody>
              {viewers.map((v) => (
                <tr
                  key={v.twitchId}
                  className="admin-viewers-row"
                  onClick={() => setSelectedViewer(v)}
                >
                  <td className="admin-viewers-cell-name">
                    <span className="admin-viewers-displayname">
                      {v.currentSessionActive && (
                        <span className="admin-viewer-live-dot" title="En ligne" />
                      )}
                      {v.displayName}
                      {v.isStreamer && <span title="Streamer">📺</span>}
                    </span>
                    <span className="admin-viewers-status">
                      {v.isFollower && "❤️"}
                      {v.isSubscriber && "⭐"}
                    </span>
                  </td>
                  <td>{v.totalMessages.toLocaleString()}</td>
                  <td>{v.totalStreams}</td>
                  <td>{v.firstWordCount > 0 ? v.firstWordCount : "—"}</td>
                  <td>{v.subCount > 0 ? v.subCount : "—"}</td>
                  <td>{v.totalBitsDonated > 0 ? v.totalBitsDonated.toLocaleString() : "—"}</td>
                  <td>{v.raidCount > 0 ? v.raidCount : "—"}</td>
                  <td className="admin-viewers-cell-badges">
                    {v.badges.slice(0, 5).map((b) => (
                      <BadgePill key={b.id} icon={b.icon} name={b.name} />
                    ))}
                    {v.badges.length > 5 && (
                      <span className="admin-viewer-badge-more">+{v.badges.length - 5}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="admin-viewers-pagination">
          <button
            className="admin-btn admin-btn--secondary"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            ← Precedent
          </button>
          <span className="admin-viewers-page-info">
            Page {page} / {totalPages}
          </span>
          <button
            className="admin-btn admin-btn--secondary"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
}
