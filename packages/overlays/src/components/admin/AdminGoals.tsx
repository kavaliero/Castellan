import { useState, useEffect } from "react";
import { apiPost } from "../../hooks/useAdminApi";

interface GoalsState {
  followers: { current: number; target: number };
  subscribers: { current: number; target: number };
  lastFollow: string | null;
  lastSub: string | null;
}

interface AdminGoalsProps {
  goals: GoalsState;
}

export function AdminGoals({ goals }: AdminGoalsProps) {
  const [followersCurrent, setFollowersCurrent] = useState(goals.followers.current);
  const [followersTarget, setFollowersTarget] = useState(goals.followers.target);
  const [subsCurrent, setSubsCurrent] = useState(goals.subscribers.current);
  const [subsTarget, setSubsTarget] = useState(goals.subscribers.target);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Sync from props when WS updates arrive
  useEffect(() => {
    setFollowersCurrent(goals.followers.current);
    setFollowersTarget(goals.followers.target);
    setSubsCurrent(goals.subscribers.current);
    setSubsTarget(goals.subscribers.target);
  }, [goals]);

  async function handleSave() {
    setError(null);
    setSaved(false);
    const res = await apiPost("/api/goals/config", {
      followers: { current: followersCurrent, target: followersTarget },
      subscribers: { current: subsCurrent, target: subsTarget },
    });
    if (res.error) {
      setError(res.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  const pct = (current: number, target: number) =>
    target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  return (
    <div>
      <div className="admin-header">
        <h2>Goals</h2>
        <p>Manage follower and subscriber objectives</p>
      </div>

      <div className="admin-goals-grid">
        {/* Followers */}
        <div className="admin-goal-card">
          <h3>🎯 Followers</h3>
          <div className="admin-progress-bar">
            <div
              className="admin-progress-fill"
              style={{ width: `${pct(followersCurrent, followersTarget)}%` }}
            />
          </div>
          <div className="admin-goal-fields">
            <div className="admin-field">
              <label className="admin-label">Current</label>
              <input
                className="admin-input"
                type="number"
                value={followersCurrent}
                onChange={e => setFollowersCurrent(Number(e.target.value))}
              />
            </div>
            <div className="admin-field">
              <label className="admin-label">Target</label>
              <input
                className="admin-input"
                type="number"
                value={followersTarget}
                onChange={e => setFollowersTarget(Number(e.target.value))}
              />
            </div>
          </div>
          {goals.lastFollow && (
            <div className="admin-goal-last">Last follow: {goals.lastFollow}</div>
          )}
        </div>

        {/* Subscribers */}
        <div className="admin-goal-card">
          <h3>👑 Subscribers</h3>
          <div className="admin-progress-bar">
            <div
              className="admin-progress-fill"
              style={{ width: `${pct(subsCurrent, subsTarget)}%` }}
            />
          </div>
          <div className="admin-goal-fields">
            <div className="admin-field">
              <label className="admin-label">Current</label>
              <input
                className="admin-input"
                type="number"
                value={subsCurrent}
                onChange={e => setSubsCurrent(Number(e.target.value))}
              />
            </div>
            <div className="admin-field">
              <label className="admin-label">Target</label>
              <input
                className="admin-input"
                type="number"
                value={subsTarget}
                onChange={e => setSubsTarget(Number(e.target.value))}
              />
            </div>
          </div>
          {goals.lastSub && (
            <div className="admin-goal-last">Last sub: {goals.lastSub}</div>
          )}
        </div>
      </div>

      <div className="admin-btn-row" style={{ marginTop: "16px" }}>
        <button className="admin-btn admin-btn--primary" onClick={handleSave}>
          Save Goals
        </button>
        {saved && <span style={{ color: "#4ade80", fontSize: "13px", alignSelf: "center" }}>Saved!</span>}
      </div>
      {error && <div className="admin-error">{error}</div>}
    </div>
  );
}
