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
    firstSeenAt: string;          // ISO date string (les Date ne passent pas en JSON via WebSocket)
  }


export type IncomingEventType = 'message' | 'follow' | 'sub' | 'raid' | 'bits' | 'join' | 'leave' | 'dice' | 'channel_point_redemption';

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
    type: 'credits:data';
    payload: CreditsPayload;
} | {
    type: 'clips:synced';
    payload: ClipsSyncedPayload;
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

export interface CreditsPayload {
    stream: {
        title: string;
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
    firstMessage?: ViewerInfo;
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

