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

