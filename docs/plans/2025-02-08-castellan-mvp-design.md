# Castellan MVP - Design Document

## Vue d'ensemble

**Castellan** est un outil local de gestion de stream qui complète StreamerBot. Il gère la persistance des données viewers et fournit des overlays OBS immersifs avec une ambiance JDR/médiévale (Naheulbeuk, Kaamelott, Monty Python).

## Scope MVP

- Tracking des viewers (messages, présence, events)
- Overlay Chat stylisé médiéval pour OBS
- Overlay Alerts (follow/sub) avec possibilité de lancer un dé via commande
- Overlay Goals (objectif followers/subs)
- Overlay Crédits de fin de stream

## Architecture

```
┌─────────────────┐         HTTP POST          ┌─────────────────────────────────┐
│   StreamerBot   │ ────────────────────────▶  │          Castellan              │
│  (Event Source) │                            │                                 │
└─────────────────┘                            │  ┌─────────────┐  ┌──────────┐  │
                                               │  │   Express   │  │  SQLite  │  │
                                               │  │   + tRPC    │  │ (Prisma) │  │
                                               │  └─────────────┘  └──────────┘  │
                                               │         │                       │
                                               │         │ WebSocket             │
                                               │         ▼                       │
                                               │  ┌─────────────┐                │
                                               │  │   WS Server │                │
                                               │  └─────────────┘                │
                                               └────────────┬────────────────────┘
                                                            │
                              ┌──────────────────┬──────────┴───────┬─────────────────┐
                              ▼                  ▼                  ▼                 ▼
                       ┌────────────┐     ┌────────────┐     ┌────────────┐    ┌────────────┐
                       │ OBS: Chat  │     │ OBS: Goals │     │ OBS: Alerts│    │ OBS: Crédits│
                       │  Overlay   │     │  Overlay   │     │  Overlay   │    │   de Fin   │
                       └────────────┘     └────────────┘     └────────────┘    └────────────┘
```

### Stack technique

- **Backend** : Node.js + Express + tRPC
- **Database** : SQLite + Prisma
- **WebSocket** : ws ou Socket.io
- **Frontend overlays** : React + Vite + PixiJS + Framer Motion
- **Monorepo** : pnpm workspaces + Turbo

## Modèle de données

```prisma
model Viewer {
  id              String          @id @default(cuid())
  twitchId        String          @unique
  username        String
  displayName     String
  sessions        ViewerSession[]
  chatMessages    ChatMessage[]
  totalMessages   Int             @default(0)
  totalWatchTime  Int             @default(0)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}

model Stream {
  id            String          @id @default(cuid())
  startedAt     DateTime
  endedAt       DateTime?
  title         String?
  sessions      ViewerSession[]
  messages      ChatMessage[]
  events        StreamEvent[]
}

model ViewerSession {
  id         String   @id @default(cuid())
  viewerId   String
  streamId   String
  joinedAt   DateTime @default(now())
  leftAt     DateTime?
  viewer     Viewer   @relation(fields: [viewerId], references: [id])
  stream     Stream   @relation(fields: [streamId], references: [id])
}

model ChatMessage {
  id        String   @id @default(cuid())
  viewerId  String
  streamId  String
  content   String
  emotes    Json?
  timestamp DateTime @default(now())
  viewer    Viewer   @relation(fields: [viewerId], references: [id])
  stream    Stream   @relation(fields: [streamId], references: [id])
}

model StreamEvent {
  id        String   @id @default(cuid())
  streamId  String
  type      String   // "follow", "sub", "raid", "bits", "dice"
  data      Json
  timestamp DateTime @default(now())
  stream    Stream   @relation(fields: [streamId], references: [id])
}
```

## API

### Endpoints HTTP (StreamerBot → Castellan)

```
POST /api/stream/start    { title?: string }
POST /api/stream/end
POST /api/event           { type, viewer, data? }
```

### Types d'events

| Type | Description | Data |
|------|-------------|------|
| `message` | Message chat | `{ content, emotes }` |
| `follow` | Nouveau follower | `{}` |
| `sub` | Nouveau sub | `{ tier, months }` |
| `raid` | Raid entrant | `{ viewers, fromChannel }` |
| `bits` | Bits donnés | `{ amount }` |
| `join` | Viewer rejoint | `{}` |
| `leave` | Viewer quitte | `{}` |
| `dice` | Lancer de dé | `{ faces, result }` |

### WebSocket Events (Castellan → Overlays)

```typescript
type WSEvent =
  | { type: "chat:message", payload: ChatMessage }
  | { type: "chat:clear" }
  | { type: "goal:update", payload: { current: number, target: number } }
  | { type: "alert:follow", payload: { viewer: Viewer } }
  | { type: "alert:sub", payload: { viewer: Viewer, tier: number } }
  | { type: "alert:dice", payload: { viewer: Viewer, faces: number, result: number } }
  | { type: "credits:data", payload: CreditsData }
```

## Overlays

| Overlay | URL | Description |
|---------|-----|-------------|
| Chat | `localhost:3333/overlay/chat` | Messages style parchemin, particules dorées |
| Alerts | `localhost:3333/overlay/alerts` | Popup follow/sub, animation dé 3D |
| Goals | `localhost:3333/overlay/goals` | Barre de vie RPG |
| Crédits | `localhost:3333/overlay/credits` | Défilement fin de stream |

### Style visuel

- **Ambiance** : Full immersif RPG/médiéval
- **Effets** : Particules (poussière dorée, lucioles), animations élaborées
- **Fonts** : Médiévales (MedievinRegular, Enchanted Land)
- **Containers** : Textures parchemin/bois

## Structure du projet

```
castellan/
  package.json
  pnpm-workspace.yaml

  packages/
    server/
      src/
        index.ts
        db/
          schema.prisma
          client.ts
        api/
          routes/
            stream.ts
            event.ts
          trpc/
            router.ts
        ws/
          server.ts
          broadcaster.ts
        services/
          viewer.service.ts
          stream.service.ts
          credits.service.ts

    overlays/
      src/
        main.tsx
        pages/
          chat.tsx
          alerts.tsx
          goals.tsx
          credits.tsx
        components/
          shared/
            ParticleBackground.tsx
            MedievalText.tsx
            ParchmentBox.tsx
          chat/
            ChatOverlay.tsx
            ChatMessage.tsx
          alerts/
            AlertOverlay.tsx
            DiceRoll3D.tsx
          goals/
            GoalBar.tsx
          credits/
            CreditsRoll.tsx
        hooks/
          useWebSocket.ts
          useStreamEvents.ts

    shared/
      src/
        types/
          events.ts
          api.ts
          viewer.ts
```

## Plan d'implémentation

### Phase 1 - Fondations
1. Init monorepo pnpm + Turbo
2. Setup server Express + Prisma + SQLite
3. Créer le schéma BDD + première migration
4. Endpoint `/api/event` basique qui log en BDD
5. WebSocket server qui broadcast les events

### Phase 2 - Overlays de base
1. Setup Vite + React pour les overlays
2. Hook `useWebSocket` avec reconnexion auto
3. Overlay Chat : affichage simple des messages (sans style)
4. Overlay Goals : barre de progression basique
5. Tester le flow complet : StreamerBot → Server → Overlay

### Phase 3 - Style médiéval
1. Intégrer PixiJS pour le fond de particules
2. Créer les composants stylisés (ParchmentBox, MedievalText)
3. Appliquer le style au Chat
4. Appliquer le style aux Goals
5. Overlay Alerts avec animation follow/sub

### Phase 4 - Crédits de fin
1. Service qui agrège les données du stream
2. Overlay Crédits avec défilement
3. Endpoint pour déclencher les crédits

### Phase 5 - Polish
1. Animations Framer Motion peaufinées
2. Configuration (durée messages, couleurs, tailles)
3. Tests end-to-end

## Évolutions futures (hors MVP)

- Système de classes RPG (barde, guerrier, etc.)
- Niveaux et XP par classe
- Système de tampons de présence
- Gestion des raids avec clips + résumé IA
- Commandes vocales (prédictions, clips)
- Personnages animés des viewers à l'écran
