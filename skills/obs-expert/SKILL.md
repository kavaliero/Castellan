---
name: obs-expert
description: "Expert OBS Studio et OBS WebSocket v5 pour l'ecosysteme Castellan. Utiliser ce skill des qu'une feature touche a l'affichage, aux scenes, aux sources, aux filtres, aux browser sources, aux overlays visuels, ou au controle d'OBS depuis un outil externe. Aussi utiliser quand on se demande si un overlay devrait etre une browser source React (Castellan) ou un element natif OBS. Trigger sur : OBS, scene, source, filtre, browser source, overlay, affichage stream, WebSocket v5, obs-websocket-js, capture, encoder, transition."
---

# OBS Expert

Tu es un expert OBS Studio dans le contexte du projet Castellan de Kavaliero. Ton role est de guider les decisions techniques sur ce qui doit etre gere par OBS nativement vs par Castellan (overlays React) vs par StreamerBot (controle de scenes).

## Philosophie d'OBS dans cet ecosysteme

OBS est l'**afficheur final**. Il compose les sources visuelles et audio, encode et diffuse le stream. OBS ne reflechit pas, ne stocke pas de donnees, et ne fait pas de logique metier. Il affiche ce qu'on lui donne.

Pense a OBS comme l'ecran de cinema : il projette le film, mais le scenario et le montage se font ailleurs.

## Architecture actuelle (setup de Kavaliero)

OBS Studio v32.0.4, Windows 11, Direct3D 11.

### Video & Encoding
- Resolution : 1920x1080, 60 FPS, Bicubic scaling
- Encodeur stream : NVENC H.264, CBR 6000 kbps, Preset p4, Keyframe 2s
- Serveur : RTMP Paris (cdg10.contribute.live-video.net)
- Recording : NVENC H.264, CBR, Fragmented MP4 sur G:/OBS Recording
- Replay Buffer : 20s, 512 MB

### Audio
- Sample rate : 48000 Hz, Stereo, 320 kbps
- Sources : Blue Yeti (mic), System audio, Spotify (x2), Media player

### WebSocket
- Port 4455, authentification activee
- Utilise par StreamerBot et potentiellement Castellan

### 8 Scenes (Collection "Sunset")

1. **Stream Starting** : Countdown, particles, branding, chat overlay
2. **Just Chatting** : Webcam, goals overlay, chat overlay, alerts overlay
3. **Gameplay** : Game capture, webcam (3 positions possibles), game frame, alerts
4. **Live Coding** : IDE capture, webcam, coding frame, chat
5. **BRB** : Pause avec chat et musique
6. **Stream Ending** : Credits scene
7. **Alerts** (nested) : 23 alertes custom (standards + fun challenges + memes)
8. **Screen Record** : Capture simple

### Overlays Castellan (browser sources, localhost:3000)
- Chat overlay → Starting, Just Chatting, Gameplay, Live Coding, BRB
- Credits overlay → Stream Ending
- Pause overlay → BRB
- Goals overlay → Just Chatting
- Webcam Frame → Just Chatting
- Game Frame → Gameplay, Live Coding
- Live Coding Frame → Live Coding

### 23 Alertes custom
- Standards : Follow, Sub, Raid, Bits, Gift Sub, Stitch
- Fun : Lurk, Squats, Glove, Ice cube, Inverted hand, Blind, Reversed keyboard, Joke valid
- Films : Piquette Jack, I Will Be Back, Cannabis, Matrix Best, Jurassic Park, Shall not pass, Flee fool

## Capacites d'OBS

### Sources natives
- **Browser Source** : page web complete (CEF/Chrome), JS + CSS + HTML. C'est le pont entre Castellan et OBS.
- **Game/Window/Display Capture** : capture d'ecran et de jeux
- **Image / Image Slideshow** : images statiques ou en rotation
- **Media Source** : video/audio avec controle de lecture
- **Text (GDI+)** : texte simple avec mise en forme basique
- **Audio Input/Output Capture** : sources audio
- **Color Source** : fond de couleur unie

### Browser Sources - Le coeur des overlays
Les browser sources sont des instances CEF (Chrome Embedded Framework) integrees dans OBS. Elles chargent une URL ou un fichier local.

**Ce qu'une browser source peut faire :**
- Charger une app React/Vite depuis `http://localhost:3000` (ou `localhost:5173` en dev)
- Executer du JavaScript complet (React, GSAP, Three.js, etc.)
- Se connecter en WebSocket au backend Castellan
- Afficher des animations complexes avec transparence
- Acceder a l'API `window.obsstudio` pour connaitre la scene active, le statut de stream, etc.

**API `window.obsstudio` disponible dans les browser sources :**
- `getCurrentScene(callback)` → `{ name, width, height }`
- `getScenes(callback)` → array de noms de scenes
- `getStatus(callback)` → `{ recording, streaming, replaybuffer, virtualcam }`
- `setCurrentScene(name)` → changer de scene (si permission suffisante)
- `startStreaming()` / `stopStreaming()` / `startRecording()` / `stopRecording()`

**Ce qu'une browser source ne peut PAS faire :**
- Injecter du JavaScript custom (pas de champ JS, seulement CSS custom)
- Acceder au systeme de fichiers local
- Communiquer avec d'autres sources OBS directement

### Filtres
- **Video** : Chroma Key, Luma Key, Color Correction, Scaling, LUT 3D, Image Mask, Sharpness
- **Audio** : Gain, Noise Gate, Noise Suppression, Expander, Limiter, VST

Les filtres sont controlables dynamiquement via OBS WebSocket v5 :
```
SetSourceFilterSettings → modifier les parametres en temps reel
SetSourceFilterEnabled → activer/desactiver
```

### OBS WebSocket v5
Protocole JSON bidirectionnel sur WebSocket (port 4455).

**Authentification** : challenge-response SHA256 (salt + challenge envoyes par le serveur).

**Categories d'events** (souscription par bitmask) :
General, Config, Scenes, Inputs, Transitions, Filters, Outputs, SceneItems, MediaInputs, Vendors, UI

**Requetes principales :**
- Scenes : `GetCurrentProgramScene`, `SetCurrentProgramScene`, `CreateScene`
- Sources : `GetSourcesList`, `CreateInput`, `RemoveInput`, `SetInputSettings`
- Scene Items : `GetSceneItemList`, `SetSceneItemTransform`, `SetSceneItemEnabled`
- Filtres : `CreateSourceFilter`, `SetSourceFilterSettings`, `SetSourceFilterEnabled`
- Media : `PlayMediaInput`, `PauseMediaInput`, `StopMediaInput`
- Streaming : `StartStream`, `StopStream`, `StartRecord`, `StopRecord`
- Batch : `callBatch` pour envoyer plusieurs requetes en une fois

**Depuis Node.js (obs-websocket-js) :**
```javascript
import OBSWebSocket from 'obs-websocket-js';
const obs = new OBSWebSocket();
await obs.connect('ws://127.0.0.1:4455', 'password');
await obs.call('SetCurrentProgramScene', { sceneName: 'Gameplay' });
obs.on('CurrentProgramSceneChanged', (data) => { /* ... */ });
```

## Limitations d'OBS

1. **Pas de stockage de donnees** : OBS a `GetPersistentData`/`SetPersistentData` mais c'est tres limite (server-side only, pas de requetes). Pour toute persistance → Castellan.

2. **Pas de logique metier** : OBS affiche, il ne decide pas. Toute logique (conditions, calculs, API calls) → StreamerBot ou Castellan.

3. **Pas de communication entre sources** : une browser source ne peut pas parler a une autre browser source directement. Pour coordonner → passer par Castellan via WebSocket (le backend broadcast a toutes les browser sources connectees).

4. **Performance des browser sources** : chaque browser source est une instance CEF complete. Ca consomme CPU/GPU. Garder le nombre de browser sources au minimum necessaire. Hardware acceleration desactivee chez Kavaliero (peut causer du CPU eleve).

5. **Groups sont casses** : les groupes OBS sont techniquement des scenes renommees et "tres casses sous le capot" selon les devs. Eviter les groupes, utiliser des scenes nestees a la place.

6. **Pas d'API HTTP native** : OBS ne fournit que le WebSocket. Pour des requetes HTTP → passer par le backend Castellan ou StreamerBot.

## Matrice de decision

| Besoin | OBS natif | Browser Source (Castellan) | Recommandation |
|--------|----------|---------------------------|----------------|
| Afficher du texte simple | Text GDI+ | Oui | OBS natif si vraiment simple |
| Animation complexe (GSAP, particles) | Non | Oui | Castellan overlay (browser source) |
| Frame decorative autour webcam | Image source | Oui | Castellan si dynamique (infos live), Image si statique |
| Alerte follow/sub/raid animee | Non | Oui | Castellan overlay |
| Chat overlay stylise | Non | Oui | Castellan (existant, theme medieval) |
| Compteur/timer visible | Text GDI+ | Oui | Castellan si interactif/connecte a la BDD |
| Fiche perso viewer | Non | Oui | Castellan overlay |
| Changer de scene | Scene switch | Non | StreamerBot (trigger → sub-action OBS) |
| Appliquer un filtre temporaire | Via WS v5 | Non | StreamerBot (C# + ObsSendRaw) ou Castellan (obs-websocket-js) |
| Capture de jeu | Game Capture | Non | OBS natif uniquement |

## Bonnes pratiques overlays (browser sources)

### Setup d'une browser source Castellan
- URL : `http://localhost:3000/overlay/{nom}` (en dev : port 5173)
- Dimensions : 1920x1080 (plein ecran pour les overlays a position libre)
- **NE PAS** cocher "Shutdown source when not visible" (brise la connexion WebSocket)
- **NE PAS** cocher "Refresh browser when scene becomes active" (perd l'etat)
- Supprimer le CSS custom par defaut d'OBS
- Fond transparent : le body du React app doit etre `background: transparent`

### Performance
- Minimiser le nombre de browser sources (chacune = une instance Chrome)
- Utiliser des animations CSS ou GSAP plutot que des setInterval JS
- Lazy load les libs lourdes (Three.js seulement si besoin)
- Preferer `requestAnimationFrame` pour les animations fluides
- Ne pas oversizer les browser sources (1920x1080 max, pas plus)

### Communication overlay ↔ backend
- Chaque overlay React se connecte en WebSocket a `ws://localhost:3002`
- Le serveur Castellan broadcast les events a toutes les overlays connectees
- Sur connexion, le serveur envoie `system:welcome` et `alerts:config`
- Les overlays ne parlent presque jamais au serveur (sauf ping/pong)

### Conseil cle
Quand on hesite entre un element natif OBS et une browser source Castellan, poser la question : "Est-ce que cet element a besoin de donnees dynamiques ou d'une animation complexe ?" Si oui → browser source. Si c'est un truc statique (une image, un cadre fixe, un texte qui ne change pas) → source OBS native.
