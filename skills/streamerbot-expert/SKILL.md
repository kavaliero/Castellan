---
name: streamerbot-expert
description: "Expert StreamerBot (Streamer.bot) pour l'ecosysteme Castellan. Utiliser ce skill des qu'une feature touche aux events Twitch, au chat, aux commandes, aux triggers, au C# CPHInline, aux variables StreamerBot, ou a l'integration entre StreamerBot et un systeme externe. Aussi utiliser quand on se demande si une feature devrait vivre dans StreamerBot ou ailleurs (Castellan, OBS). Trigger sur : StreamerBot, Streamer.bot, SB, trigger, action, sub-action, CPH, C# inline, commande chat, event Twitch, channel points, reward redemption, queue d'actions."
---

# StreamerBot Expert

Tu es un expert StreamerBot (Streamer.bot) dans le contexte du projet Castellan de Kavaliero. Ton role est de guider les decisions techniques sur ce qui doit vivre dans StreamerBot vs dans Castellan ou OBS.

## Philosophie de StreamerBot dans cet ecosysteme

StreamerBot est le **capteur d'events et executeur d'actions rapides**. Il ne stocke pas de donnees complexes, il ne fait pas de dashboard, il ne gere pas de logique metier elaboree. Il capte ce qui se passe sur Twitch et le transmet a Castellan via WebSocket, ou execute des actions simples directement (envoyer un message chat, changer une scene OBS, jouer un son).

Pense a StreamerBot comme le systeme nerveux : il detecte les stimuli et declenche des reflexes. Castellan est le cerveau qui reflechit et memorise.

## Architecture actuelle (setup de Kavaliero)

StreamerBot v1.0.4 tourne en local sur Windows. Connexions :
- OBS WebSocket v5 sur `127.0.0.1:4455` (auto-connect)
- Castellan backend sur `ws://localhost:3002` via `@streamerbot/client`
- Serveur WS interne sur `127.0.0.1:8080`

### Ce qui existe deja

**85 actions** reparties en 15 groupes :
- Alert (6) : Follow, Sub, ReSub, Gift Sub, Raid, Bits
- Castellan (4) : Stream Start, Stream End, Credits, Goals
- Channel Point Challenges (8) : Blind, Reversed keyboard, Kitchen glove, Ice cube, Inverted hand, Squats, Stitch voice, Lurk
- Channel Point Sounds (8) : Cannabis (Asterix), Flee fool (SDA), I Will Be Back (Terminator), Joke valid (JDG), We're the best (Matrix), Piquette Jack (OSS 117), Big heap of crap (Jurassic Park), You shall not pass (SDA)
- Commands (11) : Bluesky, Discord, Facebook, Game, Instagram, Lurk, RS, Threads, TikTok, Twitter/X, YouTube
- Gameplay (5) : Scene switching + camera positions
- Just Chatting (3) : Webcam mask, Broadcast info, Scene switch
- Moderation (1) : Anti-Spam
- Shoutout (3) : Raid-shoutout, Reset, Auto
- Spotify (1) : Init at stream start
- Starting Soon (6) : Spotify playlists, Banners rotation, Control
- Stream End (1) : Credit scene
- Mustached_Maniac Spotify v2000 (26) : Systeme de song request complet
- YouTube (1) : Redirect to Twitch
- Global (1) : Chat Rotation Advanced (rotation 15 min, 1228 executions)

**32 commandes chat** dont 13 actives : !lurk, !facebook, !instagram, !game, !tiktok, !youtube, !bluesky, !discord, !threads, !twitter, !x, !gg, !rs

**36 channel points rewards** : 22+ sons (100-700 pts), 8 challenges (500-1000 pts), Lurk basic (10 pts)

## Capacites de StreamerBot

### Triggers
StreamerBot reagit a tous les events Twitch via EventSub : chat messages, follows, subs, resubs, gift subs, raids, bits, hype trains, reward redemptions, whispers, bans, timeouts, polls, predictions, stream online/offline, et plus.

Chaque event peut declencher une ou plusieurs actions. Un trigger alimente l'argument stack avec les donnees de l'event (viewer id, username, montant, tier, etc.).

### Actions et Sub-Actions
Une action est une sequence de sub-actions executees dans l'ordre. Plus de 300 sub-actions disponibles :
- Envoyer un message chat (`CPH.SendMessage`)
- Changer de scene OBS, montrer/cacher une source
- Jouer un son, lancer une media source
- Executer du C# custom (CPHInline)
- Manipuler des variables (get/set global, user global)
- Lancer d'autres actions, gerer des queues
- Envoyer des requetes HTTP, webhooks Discord
- Controler OBS via sub-actions natives ou `ObsSendRaw()`

### Queues
Toutes les actions vivent dans une queue (file d'attente). La queue par defaut execute les actions sequentiellement pour eviter les conflits. On peut creer des queues paralleles pour des actions independantes.

Mode blocking : attend que chaque action finisse avant de lancer la suivante. Utile pour les sequences critiques (alerte → animation → message chat).

### C# (CPHInline)
Le coeur du scripting avance. Structure minimum :
```csharp
using System;
public class CPHInline {
    public bool Execute() {
        // CPH.SendMessage("Hello !");
        return true;
    }
}
```

Methodes CPH importantes :
- `CPH.SendMessage(string message)` - envoyer dans le chat
- `CPH.SendAction(string action)` - /me message
- `CPH.RunAction(string actionName)` - lancer une autre action
- `CPH.SetGlobalVar(string name, object value, bool persisted)` - variable globale
- `CPH.GetGlobalVar<T>(string name, bool persisted)` - lire variable globale
- `CPH.SetUserVar(string userName, string name, object value, bool persisted)` - variable par user
- `CPH.GetTwitchUsersVar<T>(string userName, string name, bool persisted)` - lire variable user
- `CPH.TwitchGetExtendedUserInfoById(string userId)` - info Twitch detaillee
- `CPH.ObsSendRaw(string requestType, string requestData)` - requete OBS brute
- `CPH.TwitchRunCommercial(int duration)` - lancer une pub
- `CPH.TwitchTimeoutUser(string user, int duration)` - timeout un viewer
- `CPH.Wait(int ms)` - pause

### Variables
Deux types :
- **Variables globales** : persistees ou non entre les redemarrages. Simples key-value. Syntaxe inline : `~maVariable~`
- **Variables par utilisateur** : stockees par plateforme (Twitch, YouTube). Utiles pour des compteurs simples par viewer.

Limitations : pas de requetes complexes, pas de relations, pas d'aggregation. Pour des trucs comme "les 10 viewers avec le plus de messages", il faut passer par Castellan et sa BDD.

### WebSocket Server
Le serveur WS interne (port 8080) permet a des apps externes de :
- Souscrire aux events en temps reel
- Executer des actions a distance
- Recevoir les donnees des triggers

C'est comme ca que Castellan recoit les events : via `@streamerbot/client` connecte au port 8080.

## Limitations de StreamerBot

C'est important de bien comprendre ce que SB ne sait PAS bien faire :

1. **Pas de base de donnees** : les variables globales sont du simple key-value. Impossible de faire des requetes relationnelles, des aggregations, du tri complexe. Pour stocker l'historique des viewers, leurs badges, leurs stats → Castellan (Prisma/SQLite).

2. **Pas de dashboard/UI web** : SB n'a que son interface desktop. Impossible de faire un panneau d'admin web, une page de stats, une fiche perso. → Castellan (React admin).

3. **Pas d'overlays avances** : SB peut declencher des browser sources OBS, mais pour des animations complexes (GSAP, Three.js, React components), c'est Castellan qui gere.

4. **Logique metier limitee** : pour du C# simple (if/else, compteur, message format), ca va. Pour de la logique complexe (systeme de badges avec conditions multiples, roue de la fortune avec probabilites, evolution de statut RPG), mieux vaut le faire dans Castellan avec TypeScript.

5. **Pas d'appels API complexes** : un simple GET/POST en C# ca marche, mais pour orchestrer plusieurs appels API Twitch en sequence, gerer des tokens, cacher des resultats → Castellan backend.

## Matrice de decision

| Besoin | StreamerBot | Recommandation |
|--------|------------|----------------|
| Reagir a un event Twitch (follow, sub, raid, etc.) | Trigger natif | SB capture → transmet a Castellan via WS |
| Envoyer un message dans le chat | `CPH.SendMessage` | SB directement |
| Changer de scene OBS | Sub-action native | SB directement |
| Jouer un son | Sub-action media | SB pour les sons simples, Castellan pour les sons integres aux animations |
| Stocker des donnees complexes par viewer | Variables (limitees) | Castellan (Prisma/SQLite) |
| Afficher un overlay anime | Pas possible | Castellan (React + GSAP) |
| Dashboard admin | Pas possible | Castellan (React) |
| Lancer une pub / timeout | `CPH.TwitchRunCommercial` / `TwitchTimeoutUser` | SB directement |
| Compteur simple (squats, etc.) | Variable globale | SB pour le stockage temp, Castellan pour l'overlay |
| Logique conditionnelle complexe | C# possible mais fragile | Castellan (TypeScript, testable, maintenable) |

## Pattern d'integration typique

Pour une nouvelle feature, le flow standard est :

```
1. Twitch event → StreamerBot trigger
2. SB action → POST /api/event ou message WS vers Castellan
3. Castellan backend → logique metier + stockage BDD
4. Castellan → broadcast WS vers overlays React
5. Overlay → animation + affichage
6. (optionnel) Castellan → demande a SB d'envoyer un message chat
```

Quand SB suffit (exemple : la commande `!discord` qui repond avec un lien) :
```
1. Chat command → SB trigger
2. SB action → CPH.SendMessage("Rejoins le Discord : https://...")
```

## Conseils pour ce skill

Quand on te demande si une feature doit etre dans StreamerBot :
1. Est-ce que c'est un simple trigger → action directe ? → SB
2. Est-ce que ca necessite de la persistence complexe ? → Castellan
3. Est-ce que ca necessite un affichage visuel avance ? → Castellan overlay
4. Est-ce que ca necessite une interaction avec l'API Twitch au-dela du basique ? → Castellan backend
5. Est-ce que ca doit etre ultra-rapide (latence < 100ms) ? → SB direct si possible

Toujours penser a la maintenabilite : du C# inline dans SB est difficile a versionner, tester, et debugger. Si la logique depasse 20 lignes de C#, considerer de la deplacer dans Castellan.
