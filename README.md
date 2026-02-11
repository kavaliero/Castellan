# Castellan

Outil local de gestion de stream Twitch. Castellan se connecte a [Streamer.bot](https://streamer.bot/) pour collecter les evenements du stream (messages, follows, subs, raids, bits...) et les redistribuer en temps reel vers des overlays OBS via WebSocket.

## Architecture

Monorepo pnpm avec 3 packages :

```
packages/
  server/     — Backend Express + WebSocket + Prisma (SQLite)
  overlays/   — Frontend React + Vite (overlays OBS)
  shared/     — Types TypeScript partages
```

### Server (`@castellan/server`)

- **Express** sur `http://localhost:3001` — API REST pour les events, les credits de fin et la config des objectifs
- **WebSocket** sur `ws://localhost:3002` — Broadcast temps reel vers les overlays
- **Prisma + SQLite** — Stockage local des viewers, sessions, messages et events
- **Streamer.bot** — Connexion WebSocket pour recevoir les events Twitch

### Overlays (`@castellan/overlays`)

- **React 19 + Vite** — App SPA avec React Router
- **Chat** — Affichage du chat avec emotes et animations (`/chat`)
- **Credits** — Ecran de fin de stream style generique de film (`/credits`)
- **Goals** — Objectifs de followers/subscribers (`/goals`)

### Shared (`@castellan/shared`)

Types et interfaces partages entre le server et les overlays (events, payloads, viewer info...).

## Prerequis

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 10
- [Streamer.bot](https://streamer.bot/) (optionnel, le server fonctionne en mode HTTP seul)

## Installation

```bash
pnpm install
```

Creer le fichier d'environnement pour le server :

```bash
cp packages/server/.env.example packages/server/.env
```

> Le `.env` doit contenir au minimum `DATABASE_URL="file:./dev.db"` pour Prisma/SQLite.

Initialiser la base de donnees :

```bash
pnpm --filter @castellan/server exec prisma migrate dev
```

## Lancement

Demarrer le server et les overlays en parallele :

```bash
pnpm dev
```

Ou separement :

```bash
pnpm dev:server    # Express + WS sur :3001 / :3002
pnpm dev:overlays  # Vite dev server sur :5173
```

## Utilisation avec OBS

Ajouter des sources **Navigateur** dans OBS pointant vers :

| Overlay  | URL                          |
|----------|------------------------------|
| Chat     | `http://localhost:5173/chat`  |
| Credits  | `http://localhost:5173/credits` |
| Goals    | `http://localhost:5173/goals` |

## API

| Methode | Endpoint              | Description                        |
|---------|-----------------------|------------------------------------|
| GET     | `/api/health`         | Statut du serveur                  |
| POST    | `/api/stream/start`   | Demarre un stream                  |
| POST    | `/api/stream/end`     | Termine le stream en cours         |
| POST    | `/api/event`          | Envoie un event manuellement       |
| GET     | `/api/credits`        | Genere et broadcast les credits    |
| GET     | `/api/goals`          | Etat actuel des objectifs          |
| POST    | `/api/goals/config`   | Met a jour la config des objectifs |

## Licence

[MIT](LICENSE) — Kavaliero
