---
name: castellan-expert
description: "Expert du monorepo Castellan (Express 5 + React 19 + Prisma/SQLite + WebSocket). Utiliser ce skill des qu'une feature touche a la BDD (schema Prisma, queries, viewer data), au dashboard admin, aux overlays React, au systeme d'animations GSAP, a l'API REST Express, ou aux events WebSocket de Castellan. Aussi utiliser pour toute question d'architecture du monorepo, de routing, de composants React, ou de services backend. Trigger sur : Castellan, Prisma, schema, BDD, SQLite, overlay React, animation GSAP, dashboard, fiche perso, API Express, WebSocket event, viewer data, badge, tampon, compteur, des, credits."
---

# Castellan Expert

Tu es un expert du monorepo Castellan, l'outil de stream custom de Kavaliero. Ton role est de guider les decisions d'implementation et d'architecture pour tout ce qui touche au backend, a la BDD, aux overlays React et au dashboard admin.

## Philosophie de Castellan

Castellan est le **cerveau** de l'ecosysteme de stream. Il recoit les events de StreamerBot, les traite, stocke les donnees en BDD, et affiche les resultats via des overlays React dans OBS. Il fournit aussi un dashboard admin pour controler le stream.

Tout ce qui necessite de la persistance, de la logique metier complexe, ou un affichage dynamique riche passe par Castellan.

## Architecture du monorepo

```
Castellan/
├── packages/
│   ├── server/          # Express 5 + WebSocket + Prisma
│   │   ├── src/
│   │   │   ├── index.ts              # Point d'entree, routes Express
│   │   │   ├── db/client.ts          # Export Prisma client
│   │   │   ├── services/
│   │   │   │   ├── streamerbot.service.ts  # Integration SB (900+ lignes)
│   │   │   │   ├── alerts.service.ts       # Config alertes
│   │   │   │   ├── credits.service.ts      # Aggregation credits
│   │   │   │   ├── goals.service.ts        # Tracking objectifs
│   │   │   │   ├── stream.service.ts       # Etat du stream
│   │   │   │   ├── viewer.service.ts       # Operations viewer BDD
│   │   │   │   └── clips.service.ts        # Cache clips
│   │   │   └── ws/
│   │   │       └── broadcaster.ts          # Serveur WS + broadcast
│   │   ├── prisma/schema.prisma
│   │   └── media/alerts/sounds/            # MP3 des alertes
│   │
│   ├── overlays/        # React 19 + Vite 7 + GSAP 3
│   │   └── src/
│   │       ├── App.tsx                     # Router
│   │       ├── pages/*Page.tsx             # 9 pages overlay + admin
│   │       ├── components/
│   │       │   ├── alerts/                 # ScrollAlert, AlertPopup
│   │       │   ├── chat/                   # ChatOverlay, ChatMessage
│   │       │   ├── credits/                # CreditsOverlay, CreditsRoll
│   │       │   ├── goals/                  # GuildPanel
│   │       │   ├── pause/                  # PausePlayer
│   │       │   ├── frame/                  # GameFrame, WebcamFrame, etc.
│   │       │   ├── admin/                  # AdminAlerts, AdminGoals, AdminStream
│   │       │   └── shared/                 # MedievalParticles
│   │       └── animations/
│   │           ├── types.ts                # Interface AnimationModule
│   │           ├── registry.ts             # Mapping type → module
│   │           ├── default.ts              # Fallback animations
│   │           └── medieval/               # Animations thematiques
│   │               ├── follow.ts
│   │               ├── sub.ts
│   │               ├── raid.ts
│   │               └── bits.ts
│   │
│   └── shared/          # Types TypeScript partages
│       └── src/index.ts                    # ViewerInfo, events, payloads
│
├── skills/              # Skills Claude pour decisions techniques
├── package.json         # pnpm workspace root
└── pnpm-workspace.yaml
```

### Ports
- `localhost:3001` — Express HTTP API
- `localhost:3002` — WebSocket server (overlays)
- `localhost:3000` ou `5173` — Vite dev server (overlays React)
- `localhost:8080` — StreamerBot WS (Castellan s'y connecte en client)

### Commandes
- `pnpm dev` → lance server + overlays en parallele
- `pnpm dev:server` → Express + WS seulement
- `pnpm dev:overlays` → Vite dev seulement

## Schema Prisma (SQLite)

5 modeles existants :

### Viewer
```prisma
model Viewer {
  id                    Int       @id @default(autoincrement())
  twitchId              String    @unique
  username              String
  displayName           String
  totalMessages         Int       @default(0)
  totalWatchTime        Int       @default(0)  // en minutes
  totalBitsDonated      Int       @default(0)
  totalChannelPointsUsed Int      @default(0)
  isFollower            Boolean   @default(false)
  isSubscriber          Boolean   @default(false)
  firstSeenAt           DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  sessions              ViewerSession[]
  chatMessages          ChatMessage[]
  events                StreamEvent[]
}
```

### Stream
```prisma
model Stream {
  id            Int       @id @default(autoincrement())
  title         String?
  game          String?
  titleHistory  String    @default("[]")  // JSON array
  gameHistory   String    @default("[]")  // JSON array
  peakViewers   Int       @default(0)
  startedAt     DateTime  @default(now())
  endedAt       DateTime?
  sessions      ViewerSession[]
  messages      ChatMessage[]
  events        StreamEvent[]
}
```

### ViewerSession
```prisma
model ViewerSession {
  id           Int       @id @default(autoincrement())
  viewer       Viewer    @relation(fields: [viewerId], references: [id])
  viewerId     Int
  stream       Stream    @relation(fields: [streamId], references: [id])
  streamId     Int
  joinedAt     DateTime  @default(now())
  lastActiveAt DateTime  @default(now())
  leftAt       DateTime?
  messageCount Int       @default(0)
  watchTime    Int       @default(0)  // en minutes
  isActive     Boolean   @default(true)
  @@unique([viewerId, streamId])
}
```

### ChatMessage
```prisma
model ChatMessage {
  id        Int      @id @default(autoincrement())
  viewer    Viewer   @relation(fields: [viewerId], references: [id])
  viewerId  Int
  stream    Stream   @relation(fields: [streamId], references: [id])
  streamId  Int
  content   String
  emotes    String?  // JSON
  timestamp DateTime @default(now())
}
```

### StreamEvent
```prisma
model StreamEvent {
  id        Int      @id @default(autoincrement())
  stream    Stream   @relation(fields: [streamId], references: [id])
  streamId  Int
  viewer    Viewer?  @relation(fields: [viewerId], references: [id])
  viewerId  Int?
  type      String   // follow, sub, raid, bits, dice, channel_point_redemption, etc.
  data      String?  // JSON flexible
  timestamp DateTime @default(now())
  @@index([streamId, type])
}
```

**Pattern important** : `StreamEvent` est generique. Le `type` + `data` (JSON) permettent de stocker n'importe quel event sans migration. C'est un choix delibere pour la flexibilite.

## WebSocket Events (17+ types)

### Flux de connexion
1. Overlay se connecte a `ws://localhost:3002`
2. Serveur envoie `system:welcome` avec `{ name, version, uptime }`
3. Serveur envoie `alerts:config` avec la config complete des alertes
4. Ensuite : events en temps reel quand ils arrivent

### Events par categorie

**Chat :**
- `chat:message` → `{ id, viewer: ViewerInfo, content, emotes?, timestamp }`
- `chat:clear` → vide (clear le chat overlay)

**Alertes :**
- `alert:follow` → `{ viewer: ViewerInfo }`
- `alert:sub` → `{ viewer, tier, months }`
- `alert:gift_sub` → `{ viewer, recipientName, tier, totalGifted, anonymous }`
- `alert:raid` → `{ fromChannel, viewers, game? }`
- `alert:bits` → `{ viewer, amount }`
- `alert:dice` → `{ viewer, faces, result }`
- `alert:channel_point_redemption` → `{ viewer, rewardName, rewardCost }`
- `alert:hype_train` → `{ level, totalPoints, progress }`
- `alert:first_word` → `{ viewer }`

**Goals :**
- `goal:update` → `{ type: "followers"|"subscribers", current, target }`
- `goal:lastFollow` → `{ displayName }`
- `goal:lastSub` → `{ displayName }`

**Autres :**
- `credits:data` → payload complet pour les credits de fin
- `clips:synced` → `{ count, syncedAt }`
- `stream:info` → `{ game, title, startedAt }`
- `stream:viewers` → `{ count }`

### Broadcast
La fonction `broadcast(type, data)` dans `ws/broadcaster.ts` envoie a TOUS les clients connectes. Pas de filtrage par overlay — chaque overlay ignore les events qui ne le concernent pas.

## API REST Express

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/api/health` | Status serveur (uptime, stream actif, nb clients WS) |
| POST | `/api/stream/start` | Demarre un stream (cree un record Stream) |
| POST | `/api/stream/end` | Termine le stream, marque les sessions inactives |
| POST | `/api/event` | Recoit un event (type, viewer, data) — fallback HTTP |
| POST | `/api/chat/clear` | Clear le chat overlay |
| GET | `/api/credits` | Genere et broadcast les credits de fin |
| GET | `/api/goals` | Etat actuel des goals |
| POST | `/api/goals/config` | Met a jour les targets/current des goals |
| GET | `/api/alerts/config` | Config complete des alertes |
| PUT | `/api/alerts/config/global` | Update config globale alertes |
| PUT | `/api/alerts/config/:type` | Update config d'un type d'alerte |
| POST | `/api/alerts/test/:type` | Test une alerte (broadcast vers overlays) |
| POST | `/api/upload/sound/:type` | Upload un son d'alerte (multer) |
| POST | `/api/clips/sync` | Sync les clips depuis Twitch |
| GET | `/api/clips` | Recupere les clips (shuffled) |

## Systeme d'animations (GSAP)

### Architecture
Chaque type d'alerte a un module d'animation qui expose :
```typescript
interface AnimationModule {
  enter(elements: AnimationElements): gsap.core.Timeline;
  exit(elements: AnimationElements): gsap.core.Timeline;
}
```

Le `registry.ts` mappe les types d'alerte aux modules :
```typescript
const registry: Record<string, AnimationModule> = {
  follow: medievalFollow,
  sub: medievalSub,
  raid: medievalRaid,
  bits: medievalBits,
  // ...fallback: defaultAnimation
};
```

### Animations medievales existantes
- **Follow** : parchemin tombe avec rotation → sceau de cire s'imprime → sceau craque avec particules → parchemin se deroule (clipPath)
- **Sub** : pattern similaire avec epee plantee + eclair
- **Raid** : version "majeure" (plus grande, plus rapide, porte de chateau + chevaliers)
- **Bits** : coffre au tresor + pieces d'or

### Ajouter une nouvelle animation
1. Creer `animations/medieval/{type}.ts`
2. Exporter `enter()` et `exit()` retournant des `gsap.core.Timeline`
3. Enregistrer dans `registry.ts`
4. Les elements HTML sont dans le composant `ScrollAlert` ou `AlertPopup`

### Theme medieval
- Fonts : MedievalSharp, Cinzel, IM Fell English
- Couleurs : Gold (#D4A843), Parchment (#E8DCC8), Dark Brown (#3E2A08)
- Vibe : RPG/Medieval immersif (Naheulbeuk, Kaamelott, Monty Python)

## Integration StreamerBot

Le fichier `streamerbot.service.ts` (900+ lignes) gere toute l'integration :

### Connexion
```typescript
import { StreamerbotClient } from '@streamerbot/client';
const client = new StreamerbotClient({
  host: '127.0.0.1', port: 8080,
  autoReconnect: true, retries: -1 // infinite
});
```

### Dual-mode events
Le service gere deux modes :
1. **Events live Twitch** : `Twitch.ChatMessage`, `Twitch.Follow`, etc. (donnees reelles)
2. **Events test** : `Raw.Action` avec `isTest: true` (pour tester depuis le dashboard)

### Format viewer
Attention au format qui differe :
- Live : `{ id, login, name, type }`
- Test : `{ id, name, display, role, type }`
La fonction `extractViewer()` gere les deux transparentement.

### Polling
- Viewer count : poll `getActiveViewers()` toutes les 60s (premier poll a 5s)
- PresentViewers heartbeat (50s) : met a jour les sessions, le watch time, le peak viewers

## Conventions de code

### Generales
- TypeScript strict partout
- pnpm comme package manager (pas npm/yarn)
- Tirets courts (-) uniquement dans les noms de fichiers et contenus publics
- Pas de tirets longs (—)

### Backend
- Un service par domaine dans `services/`
- Le `index.ts` du serveur contient toutes les routes (pas de fichier router separe pour l'instant)
- Validation manuelle des inputs (pas de Zod/Joi pour l'instant)
- Config persistee en fichiers JSON (`alerts-config.json`, `goals-config.json`, `stream-state.json`)
- Debug : `DEBUG_EVENTS=true` dans `.env` active le log de tous les events

### Frontend (overlays)
- React 19 avec hooks (pas de classes)
- React Router v7 pour le routing
- GSAP pour toutes les animations (pas de CSS keyframes sauf les plus simples)
- Chaque overlay est une page independante dans `pages/`
- Les composants sont groupes par feature dans `components/`
- Fond transparent par defaut (pour les browser sources OBS)

### Types partages
- Tous les types partages dans `packages/shared/src/index.ts`
- `ViewerInfo` pour les references legeres (twitchId, username, displayName)
- `Viewer` pour les donnees completes avec stats
- Un type de payload par event WebSocket

## Quand ajouter quelque chose a Castellan

Castellan est le bon endroit quand :
1. Ca necessite de la **persistance en BDD** (stats viewer, badges, tampons, historique)
2. Ca necessite un **overlay anime** (fiche perso, alerte custom, compteur visuel)
3. Ca necessite un **dashboard admin** (gestion defis, config, reset)
4. Ca necessite de la **logique metier complexe** (systeme de des avec probabilites, evolution de statut, conditions de badge)
5. Ca necessite des **appels API externes** (Twitch API pour clips, detection streamer, etc.)
6. Ca necessite de la **coordination entre overlays** (le backend broadcast a tous)

Castellan n'est PAS le bon endroit quand :
1. C'est un **simple trigger → message chat** → StreamerBot
2. C'est un **changement de scene OBS** → StreamerBot sub-action
3. C'est un **element visuel statique** → Source OBS native
