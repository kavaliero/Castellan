/**
 * ViewerInfo : ce que StreamerBot connaît d'un viewer.
 * C'est le minimum envoyé avec chaque event.
 * Pourquoi séparé de Viewer ? Parce que StreamerBot ne connaît
 * pas le level, l'XP ou les stats agrégées — seule la BDD les a.
 */

export interface ViewerInfo {
    twitchId: string;
    username: string;
    displayName: string;
  }

/**
 * Viewer : la version complète stockée en BDD.
 * Contient l'identité + les compteurs agrégés.
 * Les overlays reçoivent ce type uniquement quand c'est pertinent
 * (crédits de fin, profil viewer...), pas à chaque message.
 */
export interface Viewer extends ViewerInfo {
    id: string;
    totalMessages: number;
    totalWatchTime: number;       // en minutes
    totalBitsDonated: number;
    totalChannelPointsUsed: number;
    isFollower: boolean;
    isSubscriber: boolean;
    // Enrichissement Twitch API
    isStreamer: boolean;
    broadcasterType?: string | null;  // "partner", "affiliate", "" ou null
    twitchFollowerCount?: number | null;
    twitchProfileImageUrl?: string | null;
    firstSeenAt: string;          // ISO date string (les Date ne passent pas en JSON via WebSocket)
  }


export type IncomingEventType = 'message' | 'follow' | 'sub' | 'raid' | 'bits' | 'join' | 'leave' | 'dice' | 'channel_point_redemption' | 'gift_sub' | 'hype_train' | 'first_word';

/**
 * Ce que StreamerBot POST au server.
 * Note : viewer est ViewerInfo (pas Viewer complet),
 * parce que StreamerBot n'a pas accès à notre BDD.
 * C'est le server qui enrichira avec les données BDD si besoin.
 */
export interface IncomingEvent {
    type: IncomingEventType;
    viewer: ViewerInfo;
    data?: IncomingEventData;
}

/**
 * Données spécifiques par type d'event.
 * Le ? sur chaque champ car seuls certains types les utilisent.
 * Alternative : on pourrait faire des types discriminés par event,
 * mais pour la reception HTTP c'est plus simple comme ça —
 * la validation se fait côté server.
 */
/**
 * Une emote (Twitch, BTTV, FFZ, 7TV, Twemoji...) dans un message chat.
 * StreamerBot fournit ces infos dans message.emotes[].
 */
export interface ChatEmote {
    id: string;
    type: string;         // "Twitch", "BetterTTV", "FrankerFaceZ", "Twemoji"...
    name: string;         // "kavali1Lol", "LUL"
    startIndex: number;
    endIndex: number;
    imageUrl: string;
}

export interface IncomingEventData {
    // message
    content?: string;
    emotes?: ChatEmote[];
    // sub
    tier?: number;        // 1, 2 ou 3
    months?: number;
    // raid
    viewers?: number;
    fromChannel?: string;
    game?: string;
    // bits
    amount?: number;
    // dice
    faces?: number;       // 6, 20, 100...
    result?: number;
    // channel point redemption
    rewardName?: string;
    rewardCost?: number;
    // gift_sub
    recipientName?: string;
    totalGifted?: number;
    anonymous?: boolean;
    // hype_train
    level?: number;
    totalPoints?: number;
    progress?: number;
  }


  export type WSEvent = {
    type: 'chat:message';
    payload: ChatMessagePayload;
} | {
    type: 'chat:clear';
} | {
    type: 'goal:update';
    payload: GoalPayload;
} | {
    type: 'alert:follow';
    payload: AlertFollowPayload 
} | {
    type: 'alert:sub';
    payload: AlertSubPayload
} | {
    type: 'goal:lastFollow';
    payload: GoalLastFollowPayload;
} | {
    type: 'goal:lastSub';
    payload: GoalLastSubPayload;
} | {
    type: 'alert:gift_sub';
    payload: AlertGiftSubPayload
} | {
    type: 'alert:raid';
    payload: AlertRaidPayload 
} | {
    type: 'alert:bits';
    payload: AlertBitsPayload
} | {
    type: 'alert:dice';
    payload: AlertDicePayload 
} | {
    type: 'alert:channel_point_redemption';
    payload: AlertChannelPointRedemptionPayload
} | {
    type: 'alert:hype_train';
    payload: AlertHypeTrainPayload;
} | {
    type: 'alert:first_word';
    payload: AlertFirstWordPayload;
} | {
    type: 'badge:earned';
    payload: BadgeEarnedPayload;
} | {
    type: 'stamp:incremented';
    payload: StampIncrementedPayload;
} | {
    type: 'stamp:max_reached';
    payload: StampMaxReachedPayload;
} | {
    type: 'dice:earned';
    payload: DiceEarnedPayload;
} | {
    type: 'dice:rolled';
    payload: DiceRolledPayload;
} | {
    type: 'dice:error';
    payload: DiceErrorPayload;
} | {
    type: 'challenge:list';
    payload: ChallengeListPayload;
} | {
    type: 'challenge:update';
    payload: ChallengePayload;
} | {
    type: 'challenge:completed';
    payload: ChallengeCompletedPayload;
} | {
    type: 'alert:challenge_roll';
    payload: AlertChallengeRollPayload;
} | {
    type: 'credits:data';
    payload: CreditsPayload;
} | {
    type: 'clips:synced';
    payload: ClipsSyncedPayload;
} | {
    type: 'stream:info';
    payload: StreamInfoPayload;
} | {
    type: 'stream:viewers';
    payload: StreamViewersPayload;
} | {
    type: 'alerts:config';
    payload: AlertsConfig;
}

export interface ChatMessagePayload {
    id: string;
    viewer: ViewerInfo;
    content: string;
    emotes?: ChatEmote[];
    timestamp: string;
}

export interface GoalPayload {
    type: "followers" | "subscribers";
    current: number;
    target: number;
}

/** Nom du dernier follower — envoyé pour mettre à jour l'affichage goals, PAS une alerte popup */
export interface GoalLastFollowPayload {
    displayName: string;
}

/** Nom du dernier sub — envoyé pour mettre à jour l'affichage goals, PAS une alerte popup */
export interface GoalLastSubPayload {
    displayName: string;
}

export interface AlertFollowPayload {
    viewer: ViewerInfo;
}

export interface AlertSubPayload  {
    viewer: ViewerInfo;
    tier: number;
    months: number;
}

export interface AlertGiftSubPayload {
    viewer: ViewerInfo;
    recipientName: string;
    tier: number;
    totalGifted: number;
    anonymous: boolean;
}

export interface AlertRaidPayload {
    fromChannel: string;   // Le raider principal
    viewers: number;
    game?: string;         // Ce qu'il streamait
}

export interface AlertBitsPayload {
    viewer: ViewerInfo;
    amount: number;
  }

export interface AlertDicePayload {
    viewer: ViewerInfo;
    faces: number;
    result: number;
}

export interface AlertChannelPointRedemptionPayload {
    viewer: ViewerInfo;
    rewardName: string;
    rewardCost: number;
}

export interface AlertHypeTrainPayload {
    level: number;
    totalPoints: number;
    progress: number;
}

/**
 * Payload pour l'animation de défi de channel points.
 * Contient tout le nécessaire pour l'animation : bannière + photo profil + dé + barre défi.
 */
export interface AlertChallengeRollPayload {
    viewer: { displayName: string };
    challengeName: string;
    challengeLabel: string;
    challengeType: ChallengeType;
    challengeIcon: string;
    challengeTitle: string;
    faces: number;
    result: number;
    amount: number;
    profileImageUrl: string | null;
    timings?: {
        bannerDelay: number;
        bannerDuration: number;
        viewerAppearDelay: number;
        viewerAppearDuration: number;
        diceAppearDelay: number;
        diceRollDelay: number;
        displayDuration: number;
        exitDuration: number;
    };
}

export interface AlertFirstWordPayload {
    viewer: ViewerInfo;
}

export interface BadgeEarnedPayload {
    viewer: { displayName: string };
    badge: ViewerBadge;
}

export interface StampIncrementedPayload {
    viewer: { displayName: string };
    stampCount: number;       // nouveau total apres increment
    stampTotal: number;       // toujours 10
}

export interface StampMaxReachedPayload {
    viewer: { displayName: string };
    stampCount: number;
}

// ============================================
// DICE — Systeme de des (squatt / roue de gains)
// ============================================

/** Tiers de de : follow (via carte fidelite), sub, raid */
export type DiceTier = "follow" | "sub" | "raid";
/** Type de de choisi : squatt (nombre d'exercices) ou wheel (roue de gains) */
export type DieType = "squatt" | "wheel";

export interface DiceEarnedPayload {
    viewer: { displayName: string };
    tier: DiceTier;
    source: "loyalty_card" | "subscription" | "raid";
}

export interface DiceRolledPayload {
    viewer: { displayName: string };
    tier: DiceTier;
    dieType: DieType;
    faces: number;       // 4, 6, 12, ou 20
    result: number;
    isNat20: boolean;    // true si d20 et resultat = 20 → roue de gains
    /** Titre contextuel du lancer (ex: "Combien de squatts ?") — optionnel pour rétro-compat */
    challengeTitle?: string;
    /** Type de défi associé (counter ou timer) — pour adapter le texte de résultat */
    challengeType?: "counter" | "timer";
    /** Label du défi (ex: "Voix de Stitch") — pour le texte de résultat */
    challengeLabel?: string;
}

export interface DiceErrorPayload {
    viewer: { displayName: string };
    error: string;       // "no_capacity", "not_follower", "not_subscriber", etc.
}

// ============================================
// CLIPS — Données des clips Twitch pour la scène pause
// ============================================

/**
 * Un clip Twitch tel que retourné par l'API Helix.
 * StreamerBot récupère les clips et les POST au server.
 * Le server les stocke en cache et les sert à l'overlay /pause.
 */
export interface TwitchClip {
    /** ID unique du clip (ex: "AwkwardHelplessSalamanderSwiftRage") */
    id: string;
    /** URL de la page du clip sur Twitch */
    url: string;
    /** URL d'embed pour iframe */
    embedUrl: string;
    /** Nom du créateur du clip */
    creatorName: string;
    /** Titre du clip */
    title: string;
    /** Nombre de vues */
    viewCount: number;
    /** Date de création ISO */
    createdAt: string;
    /** URL de la thumbnail */
    thumbnailUrl: string;
    /** Durée du clip en secondes */
    duration: number;
    /** Nom du jeu/catégorie (optionnel) */
    gameName?: string;
    /** URL locale du fichier vidéo (ex: "/clips/MonClip.mp4"), set par StreamerBot après download */
    videoUrl?: string;
}

/**
 * Ce que StreamerBot POST sur /api/clips/sync.
 * Contient la liste brute des clips récupérés depuis l'API Twitch.
 */
export interface ClipsSyncPayload {
    clips: TwitchClip[];
}

/**
 * Notification WS envoyée aux overlays quand les clips sont synchronisés.
 * L'overlay /pause peut alors fetch GET /api/clips pour les récupérer.
 */
export interface ClipsSyncedPayload {
    count: number;
    syncedAt: string;
}

// ============================================
// STREAM — Infos du stream en cours pour l'overlay frame
// ============================================

export interface StreamInfoPayload {
    game: string;
    title: string;
    startedAt: string; // ISO date
}

export interface StreamViewersPayload {
    count: number;
}

export interface CreditsPayload {
    stream: {
        title: string;
        game: string;
        duration: number;
        startedAt: string;
    };
    followers?: ViewerInfo[];
    subscribers?: Array<{ viewer: ViewerInfo, tier: number}>;
    raiders?: Array<{ raider: ViewerInfo, fromChannel: string; viewers: number }>;
    topChatters?: Array<{ viewer: ViewerInfo, messageCount: number }>;
    diceRolls?: Array<{ viewer: ViewerInfo, rollCount: number }>;
    topBitsDonator?: Array<{ viewer: ViewerInfo, amount: number }>;
    channelPointUsed?: Array<{ viewer: ViewerInfo, amount: number }>;
    lurkers?: ViewerInfo[];
    allViewers?: ViewerInfo[];
    firstMessage?: ViewerInfo;
    challenges?: ChallengeCreditsEntry[];
    stats: {
        totalMessages: number;
        totalViewers: number;
        peakViewers: number;
        topChatter?: { viewer: ViewerInfo, messageCount: number };
        topBitsDonator?: { viewer: ViewerInfo, amount: number };
        topChannelPointUsed?: { viewer: ViewerInfo, amount: number };
        longestWatchSeries?: { viewer: ViewerInfo, duration: number };
    };
}

// ============================================
// VIEWER DASHBOARD — Types pour l'API viewers
// ============================================

/**
 * Viewer enrichi avec les stats calculees (nombre de streams, derniere activite).
 * Retourne par GET /api/viewers et GET /api/viewers/:id
 */
export interface ViewerDetailed extends Viewer {
  totalStreams: number;           // Nombre de streams auxquels il a participe
  lastSeenAt: string;            // ISO date - derniere activite
  currentSessionActive: boolean; // Est-il present dans le stream en cours ?
  stampCount: number;            // Tampons accumules (0-10)
  badges: ViewerBadge[];         // Badges RP gagnes
  // Metriques computees depuis StreamEvent
  firstWordCount: number;        // Nombre de fois "premier a parler"
  subCount: number;              // Nombre de subs/resubs cumules
  raidCount: number;             // Nombre de raids donnes
  giftSubCount: number;          // Nombre de gift subs offerts
  lurkCount: number;             // Nombre de streams lurk (present, 0 messages)
  diceRollCount: number;         // Nombre de lances de des
  bestDiceRoll?: { faces: number; result: number } | null;  // Meilleur lancer
  worstDiceRoll?: { faces: number; result: number } | null; // Pire lancer
}

/**
 * Badge medieval attribue automatiquement selon l'activite.
 */
export interface ViewerBadge {
  id: string;           // "knight-of-chat", "gold-hoarder", etc.
  name: string;         // "Chevalier du Chat"
  icon: string;         // emoji ou icone
  description: string;  // "Plus de 1000 messages envoyes"
  earnedAt?: string;    // ISO date quand le badge a ete gagne (optionnel)
}

/**
 * Un event dans la timeline d'un viewer.
 * Retourne par GET /api/viewers/:id/timeline
 */
export interface ViewerTimelineEvent {
  id: string;
  type: string;          // "follow", "sub", "bits", "message", "raid", "dice", etc.
  timestamp: string;     // ISO date
  streamTitle?: string;  // Titre du stream pendant lequel c'est arrive
  streamGame?: string;   // Jeu du stream
  data?: Record<string, unknown>; // Donnees specifiques (amount, tier, content, etc.)
}

/**
 * Reponse paginee pour la liste des viewers.
 */
export interface ViewerListResponse {
  viewers: ViewerDetailed[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Stats live du stream en cours.
 * Retourne par GET /api/stream/live-stats
 */
export interface LiveStreamStats {
  streamId: string;
  title: string;
  game: string;
  startedAt: string;
  duration: number;         // en minutes
  currentViewers: number;
  peakViewers: number;
  totalMessages: number;
  totalViewers: number;     // viewers uniques de cette session
  newFollowers: number;
  newSubs: number;
  bitsReceived: number;
  topChatters: Array<{ viewer: ViewerInfo; messageCount: number }>;
  activeViewers: Array<{ viewer: ViewerInfo; watchTime: number; messageCount: number }>;
  recentEvents: ViewerTimelineEvent[];
}

// ---- Alert Config Types ----

export interface AlertSoundConfig {
  enabled: boolean;
  file: string | null;
  volume: number;
}

export interface AlertMediaConfig {
  enabled: boolean;
  file: string | null;
  type: 'video' | 'gif' | null;
}

/** Config des rangees de trompettes (animation follow trumpet) */
export interface TrumpetRowsConfig {
  bottom: boolean;
  middle: boolean;
  top: boolean;
}

/** Config de timing et visuel des trompettes (animation follow trumpet) */
export interface TrumpetConfig {
  rows: TrumpetRowsConfig;
  /** Taille des trompettes (px largeur) */
  size: number;
  /** Angle d'inclinaison vers le haut (degres, ex: 15) */
  angle: number;
  /** Delai entre chaque rangee (secondes, ex: 0.8) */
  pairStagger: number;
  /** Duree du slide-in d'une trompette (secondes, ex: 0.7) */
  slideDuration: number;
  /** Delai avant l'apparition de la banderole apres la derniere rangee (secondes, ex: 0.3) */
  bannerDelay: number;
  /** Duree d'affichage de la banderole (secondes, ex: 6). Remplace parchmentDuration pour cette anim. */
  bannerStayDuration: number;
}

export interface AlertTypeConfig {
  enabled: boolean;
  variant: 'minor' | 'major';
  icon: string;
  sealColor: string;
  title: string;
  subtitle: string | null;
  viewerName: string | null;
  ribbon: string | null;
  parchmentDuration: number;
  sound: AlertSoundConfig;
  media: AlertMediaConfig;
  /** Optionnel — config specifique a l'animation trompettes (follow) */
  trumpet?: TrumpetConfig;
}

export interface AlertGlobalConfig {
  defaultParchmentDuration: number;
  defaultVolume: number;
}

export interface AlertsConfig {
  global: AlertGlobalConfig;
  alerts: Record<string, AlertTypeConfig>;
}

// ============================================
// CHALLENGES — Systeme de defis (squatts, timers, etc.)
// ============================================

/** Type de defi : compteur (squatts) ou timer (voix de Stitch, clavier inverse) */
export type ChallengeType = "counter" | "timer";

/** Un defi tel que vu par les overlays et l'admin */
export interface ChallengePayload {
  id: string;
  type: ChallengeType;
  name: string;           // "squatts", "voix-stitch", "clavier-inverse"
  label: string;          // "Squatts", "Voix de Stitch"
  icon?: string | null;   // emoji optionnel
  current: number;        // counter: progression | timer: secondes restantes
  target: number;         // counter: objectif | timer: total secondes attribuees
  isActive: boolean;
  isRunning: boolean;     // timer: decompte en cours ?
  startedAt?: string | null;  // ISO date, timer: quand le decompte a demarre
}

/** Liste des defis actifs (envoye a la connexion WS) */
export interface ChallengeListPayload {
  challenges: ChallengePayload[];
}

/** Notification quand un defi est termine */
export interface ChallengeCompletedPayload {
  id: string;
  name: string;
  label: string;
  type: ChallengeType;
  finalValue: number;     // counter: target atteint | timer: total temps ecoule
}

/** Stats des defis pour les credits de fin de stream */
export interface ChallengeCreditsEntry {
  name: string;
  label: string;
  icon?: string | null;
  type: ChallengeType;
  totalValue: number;     // counter: somme des targets | timer: somme des temps en secondes
}

