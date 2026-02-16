import { readFileSync, writeFileSync, existsSync } from "fs";
import type { StreamInfoPayload, StreamViewersPayload } from "@castellan/shared";

/**
 * Service Stream — garde l'état du stream en cours.
 *
 * Utilisé par :
 * - streamerbot.service : met à jour game/title/startedAt/viewerCount
 * - broadcaster : envoie l'état initial quand un overlay se connecte
 *
 * L'état est persisté dans un fichier JSON pour survivre à un restart
 * serveur mid-stream (comme goals-config.json).
 */

const STATE_FILE = "./stream-state.json";

interface StreamState {
    game: string;
    title: string;
    startedAt: string | null; // ISO date
    viewerCount: number;
}

const DEFAULT_STATE: StreamState = {
    game: "Just Chatting",
    title: "",
    startedAt: null,
    viewerCount: 0,
};

let state: StreamState = { ...DEFAULT_STATE };

// ─── Persistence JSON ───────────────────────────────────────

function loadState(): void {
    try {
        if (existsSync(STATE_FILE)) {
            const raw = readFileSync(STATE_FILE, "utf-8");
            const saved = JSON.parse(raw) as Partial<StreamState>;
            state = {
                game: saved.game ?? DEFAULT_STATE.game,
                title: saved.title ?? DEFAULT_STATE.title,
                startedAt: saved.startedAt ?? DEFAULT_STATE.startedAt,
                viewerCount: saved.viewerCount ?? DEFAULT_STATE.viewerCount,
            };
            if (state.startedAt) {
                console.log(`[Stream] 📂 État restauré: "${state.title}" (${state.game}), démarré ${state.startedAt}`);
            }
        }
    } catch (err) {
        console.error("[Stream] Erreur lecture état:", err);
    }
}

function saveState(): void {
    try {
        writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (err) {
        console.error("[Stream] Erreur sauvegarde état:", err);
    }
}

/** Initialise le service (appeler au démarrage du server) */
export function initStreamState(): void {
    loadState();
}

// ─── Setters ────────────────────────────────────────────────

export function setStreamInfo(info: { game?: string; title?: string; startedAt?: string }): void {
    if (info.game !== undefined) state.game = info.game;
    if (info.title !== undefined) state.title = info.title;
    if (info.startedAt !== undefined) state.startedAt = info.startedAt;
    saveState();
}

export function setViewerCount(count: number): void {
    state.viewerCount = count;
    // Pas de saveState() ici — le viewerCount change trop souvent (heartbeat toutes les ~60s).
    // On le perd au restart, mais il sera recalculé au prochain PresentViewers.
}

export function clearStreamState(): void {
    state = { ...DEFAULT_STATE };
    saveState();
}

// ─── Getters (pour le broadcaster) ──────────────────────────

export function getStreamInfoPayload(): StreamInfoPayload | null {
    if (!state.startedAt) return null;
    return {
        game: state.game,
        title: state.title,
        startedAt: state.startedAt,
    };
}

export function getStreamViewersPayload(): StreamViewersPayload {
    return {
        count: state.viewerCount,
    };
}
