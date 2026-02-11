import { prisma } from "../db/client";
import type { ViewerInfo } from "@castellan/shared";

/**
 * Service Viewer — gère la logique métier autour des viewers.
 * 
 * Pourquoi un "service" séparé des routes ?
 * Parce que la même logique (trouver ou créer un viewer) sera utilisée
 * par plusieurs routes et handlers. Si on la met directement dans la route,
 * on va la dupliquer partout. Le service centralise la logique.
 * 
 * C'est le pattern "Service Layer" :
 * - Routes → reçoivent les requêtes HTTP, valident, répondent
 * - Services → contiennent la logique métier
 * - Prisma → accède à la BDD
 */

/**
 * Trouve un viewer par son twitchId, ou le crée s'il n'existe pas.
 * 
 * C'est un "upsert" (update + insert). On l'utilise à chaque event
 * parce qu'on ne sait jamais si c'est la première fois qu'on voit ce viewer.
 * 
 * Exemple : un viewer envoie son premier message. StreamerBot nous envoie
 * { twitchId: "12345", username: "toto", displayName: "Toto" }.
 * → S'il n'existe pas en BDD → on le crée
 * → S'il existe déjà → on met à jour son displayName (il a pu le changer)
 */

export async function findOrCreateViewer(viewerInfo: ViewerInfo) {
    const viewer = await prisma.viewer.upsert({
      where: { twitchId: viewerInfo.twitchId },
      // Si le viewer existe déjà, on met à jour le displayName
      // (les gens changent de pseudo parfois)
      update: {
        displayName: viewerInfo.displayName,
        username: viewerInfo.username,
      },
      // Si le viewer n'existe pas, on le crée avec les valeurs par défaut
      create: {
        twitchId: viewerInfo.twitchId,
        username: viewerInfo.username,
        displayName: viewerInfo.displayName,
      },
    });
  
    return viewer;
  }

  /**
 * Trouve ou crée une session viewer pour le stream en cours.
 * 
 * Appelé quand un viewer fait une action (message, bits, etc.).
 * Si le viewer n'avait pas encore de session pour ce stream, on en crée une.
 * Si il en avait une (il a déjà parlé plus tôt), on la récupère
 * et on met à jour lastActiveAt.
 */

  export async function findOrCreateSession(viewerId: string, streamId: string) {
    const session = await prisma.viewerSession.upsert({
      where: {
        // On utilise la contrainte @@unique([viewerId, streamId])
        viewerId_streamId: { viewerId, streamId },
      },
      update: {
        lastActiveAt: new Date(),
        isActive: true,
      },
      create: {
        viewerId,
        streamId,
      },
    });
  
    return session;
  }