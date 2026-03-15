# Admin Dashboard — Design Spec

## Goal

Add an admin dashboard page (`/admin`) to the overlays package for managing alerts configuration, goals, and stream controls during a live stream. Local use only, no authentication.

## Architecture

The admin page lives in the existing `packages/overlays` React app as a new route. Unlike overlay routes (`/overlay/*` for OBS browser sources), the admin uses `/admin` directly since it's a standalone tool, not an OBS source. It uses a clean/dark UI (separate from the medieval overlay theme) with a sidebar + content layout. It communicates with the server via the existing REST API endpoints and receives real-time updates via WebSocket.

One new server endpoint is needed: `POST /api/alerts/test/:type` to send fake alert events for preview.

## Layout

**Sidebar** (fixed left, ~200px):
- Logo/title "Castellan Admin"
- Navigation items: Alerts, Goals, Stream
- Server connection indicator at the bottom (green dot = connected via WS)

**Main content area** (right of sidebar):
- Changes based on active nav item
- Each section has a header with title + description

## Section 1: Alerts

### Header
- Title: "Alerts Configuration"
- Global settings displayed inline: `defaultVolume` (slider displayed as 0-100%, stored as 0-1 on server — UI converts) and `defaultParchmentDuration` (input, ms). Changes saved via `PUT /api/alerts/config/global`.

### Alert Cards Grid
- 2-column grid of cards, one per alert type (10 total: follow, sub, resub, gift_sub, raid, bits, hype_train, first_word, dice, channel_point_redemption)
- Each **collapsed card** shows:
  - Icon (emoji from config)
  - Alert type name
  - Title template text (truncated)
  - ON/OFF toggle badge

### Inline Expand
- Clicking a card expands it to span 2 columns with a purple border highlight
- Only one card expanded at a time
- **Expanded form fields:**

| Field | Input Type | Maps to |
|-------|-----------|---------|
| enabled | Toggle | `AlertTypeConfig.enabled` |
| variant | Select (minor/major) | `AlertTypeConfig.variant` |
| icon | Text input (emoji) | `AlertTypeConfig.icon` |
| sealColor | Color picker + hex text input | `AlertTypeConfig.sealColor` |
| title | Text input | `AlertTypeConfig.title` |
| viewerName | Text input (nullable) | `AlertTypeConfig.viewerName` |
| subtitle | Text input (nullable) | `AlertTypeConfig.subtitle` |
| ribbon | Text input (nullable) | `AlertTypeConfig.ribbon` |
| parchmentDuration | Number input (ms) | `AlertTypeConfig.parchmentDuration` |
| sound.enabled | Toggle | `AlertSoundConfig.enabled` |
| sound.file | Text input | `AlertSoundConfig.file` |
| sound.volume | Slider (displayed 0-100%, stored 0-1 — UI converts) | `AlertSoundConfig.volume` |
| media.enabled | Toggle | `AlertMediaConfig.enabled` |
| media.file | Text input | `AlertMediaConfig.file` |
| media.type | Select (video/gif/null) | `AlertMediaConfig.type` |

- **Action buttons:**
  - **Save** — `PUT /api/alerts/config/:type` with changed fields only (partial update)
  - **Test Alert** — `POST /api/alerts/test/:type` sends a fake WS event with sample data
  - **Cancel** — collapses card, discards unsaved changes

### Template Variables Help
- Small helper text below text inputs showing available variables: `{viewer}`, `{amount}`, `{tier}`, `{months}`, `{recipient}`, `{totalGifted}`, `{level}`, `{totalPoints}`, `{progress}`, `{faces}`, `{result}`, `{rewardName}`, `{rewardCost}`

## Section 2: Goals

Two cards side by side:

### Followers Card
- Progress bar showing `current / target`
- Editable fields: `current` (number input), `target` (number input)
- Display: `lastFollow` name (read-only)

### Subscribers Card
- Progress bar showing `current / target`
- Editable fields: `current` (number input), `target` (number input)
- Display: `lastSub` name (read-only)

- One **Save** button shared for both cards — `POST /api/goals/config` (accepts partial: only changed fields)
- Real-time updates via WS `goal:update` events (counter increments during stream)
- Goals API response shape: `{ ok: true, goals: { followers: { current, target }, subscribers: { current, target }, lastFollow: "name", lastSub: "name" } }`

## Section 3: Stream Controls

Compact section with action buttons and status:

- **Stream status**: badge showing LIVE (green) or OFFLINE (gray), based on `GET /api/health` → `currentStream` field
- **Start Stream** button — `POST /api/stream/start` with fields: title (text), game (text), broadcasterId (text). Only enabled when offline.
- **End Stream** button — `POST /api/stream/end`. Only enabled when live.
- **Clear Chat** button — `POST /api/chat/clear`
- Server info: uptime, WS client count (from `/api/health`)

## New Server Endpoint

### `POST /api/alerts/test/:type`

Broadcasts a fake alert event via WebSocket with sample data for preview purposes.

**Behavior:**
- Looks up the alert type from the `:type` param
- Does NOT require an active stream (unlike `/api/event`)
- Does NOT persist to database
- Broadcasts a WS event matching the alert type with hardcoded sample data

**Sample data per type:**

| Type | WS Event | Sample Payload |
|------|----------|---------------|
| follow | `alert:follow` | `{ viewer: { displayName: "TestViewer" } }` |
| sub | `alert:sub` | `{ viewer: { displayName: "TestViewer" }, tier: 1, months: 1 }` |
| resub | `alert:sub` (overlay uses `months > 1` to pick resub config) | `{ viewer: { displayName: "TestViewer" }, tier: 1, months: 6 }` |
| gift_sub | `alert:gift_sub` | `{ viewer: { displayName: "TestViewer" }, recipientName: "LuckyViewer", tier: 1, totalGifted: 5, anonymous: false }` |
| raid | `alert:raid` | `{ fromChannel: "TestRaider", viewers: 42, game: "Just Chatting" }` |
| bits | `alert:bits` | `{ viewer: { displayName: "TestViewer" }, amount: 100 }` |
| hype_train | `alert:hype_train` | `{ level: 2, totalPoints: 5000, progress: 75 }` |
| first_word | `alert:first_word` | `{ viewer: { displayName: "TestViewer" } }` |
| dice | `alert:dice` | `{ viewer: { displayName: "TestViewer" }, faces: 20, result: 17 }` |
| channel_point_redemption | `alert:channel_point_redemption` | `{ viewer: { displayName: "TestViewer" }, rewardName: "Test Reward", rewardCost: 500 }` |

**Response:** `{ ok: true, type: "<alert_type>" }`
**Error:** `{ ok: false, error: "Unknown alert type" }` (404)

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `packages/overlays/src/pages/AdminPage.tsx` | Admin page with sidebar layout + tab routing |
| `packages/overlays/src/components/admin/AdminAlerts.tsx` | Alerts section: global config + alert card grid |
| `packages/overlays/src/components/admin/AlertCard.tsx` | Single alert card (collapsed + expanded states) |
| `packages/overlays/src/components/admin/AdminGoals.tsx` | Goals section: 2 goal cards with progress bars |
| `packages/overlays/src/components/admin/AdminStream.tsx` | Stream controls section |
| `packages/overlays/src/components/admin/admin.css` | All admin styles (dark theme, scoped with `admin-` prefix) |
| `packages/overlays/src/hooks/useAdminApi.ts` | Thin wrapper around `fetch` for REST calls. Base URL: `http://localhost:3001`. Exports `apiGet(path)`, `apiPut(path, body)`, `apiPost(path, body)`. Returns `{ data, error }`. |

### Modified files
| File | Changes |
|------|---------|
| `packages/overlays/src/App.tsx` | Add `/admin` route |
| `packages/server/src/index.ts` | Add `POST /api/alerts/test/:type` endpoint |

## Styling

- All CSS classes prefixed with `admin-` to avoid collisions with overlay styles
- Dark theme: background `#0f0f1a`, cards `#1e1e32`, surfaces `#2d2d44`, accent `#a78bfa` (purple)
- System font stack (`system-ui, -apple-system, sans-serif`) — no medieval fonts
- No CSS variables shared with overlay theme — fully independent

## Data Flow

1. **Page load**: `GET /api/alerts/config` + `GET /api/goals` + `GET /api/health` to populate initial state. The WS connection also sends `alerts:config` and `goal:update` events on connect, but the admin page uses REST for initial load (more reliable, includes `ok` wrapper).
2. **Real-time**: WS connection receives `alerts:config` and `goal:update` events to keep UI in sync (if config is changed externally)
3. **User edits**: REST calls (PUT/POST) to save changes. Server broadcasts updated config via WS, which updates the admin UI too. All form changes require explicit **Save** click — no auto-save on input change.
4. **Test alert**: `POST /api/alerts/test/:type` → server broadcasts fake WS event → overlay displays alert

## Error Handling

- If a REST call fails, show an inline error message below the save button (red text, disappears after 5s)
- If the server is unreachable on page load, show a centered "Cannot connect to server" message with a retry button
- WS connection indicator in sidebar reflects real-time connection state

## State Management

- React `useState` for local form state (expanded card, dirty fields)
- Config loaded via REST on mount, stored in component state
- WS updates merge into state (same `useWebSocket` hook as overlays)
- No global state library needed — props drilling is fine for this scope
