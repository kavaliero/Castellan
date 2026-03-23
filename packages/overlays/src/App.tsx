import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ChatPage } from "./pages/ChatPage";
import { GoalsPage } from "./pages/GoalsPage";
import { AlertsPage } from "./pages/AlertsPage";
import { CreditsPage } from "./pages/CreditsPage";
import { PausePage } from "./pages/PausePage";
import { FramePage } from "./pages/FramePage";
import { GameFramePage } from "./pages/GameFramePage";
import { LiveCodinfFramePage } from "./pages/LiveCodingFramePage";
import { AdminPage } from "./pages/AdminPage";
import { LoyaltyCardPage } from "./pages/LoyaltyCardPage";
import { DiceRollPage } from "./pages/DiceRollPage";
import { DiceBoardPage } from "./pages/DiceBoardPage";
import { ChallengePage } from "./pages/ChallengePage";

/**
 * Le Router définit quelle page s'affiche selon l'URL.
 * Chaque overlay a sa propre route = sa propre Browser Source dans OBS.
 *
 * /overlay/chat       → Chat stylisé
 * /overlay/alerts     → Alertes follow/sub/raid
 * /overlay/goals      → Barres d'objectifs
 * /overlay/credits    → Crédits de fin
 * /overlay/pause      → Scène pause avec clips en boucle
 * /overlay/frame      → Cadre webcam Just Chatting (catégorie, uptime, viewers)
 * /overlay/game-frame → Cadre webcam in-game avec parchemin (pseudo, uptime, viewers)
 * /overlay/loyalty-card → Carte de fidelite (tampons) qui s'affiche quand un viewer parle
 * /overlay/dice        → Lancer de de (squatt ou roue de gains)
 * /overlay/dice-board  → Widget persistant des derniers lancers
 */

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/overlay/chat" element={<ChatPage />} />
        <Route path="/overlay/goals" element={<GoalsPage />} />
        <Route path="/overlay/alerts" element={<AlertsPage />} />
        <Route path="/overlay/credits" element={<CreditsPage />} />
        <Route path="/overlay/pause" element={<PausePage />} />
        <Route path="/overlay/frame" element={<FramePage />} />
        <Route path="/overlay/game-frame" element={<GameFramePage />} />
        <Route path="/overlay/live-coding-frame" element={<LiveCodinfFramePage />} />
        <Route path="/overlay/loyalty-card" element={<LoyaltyCardPage />} />
        <Route path="/overlay/dice" element={<DiceRollPage />} />
        <Route path="/overlay/dice-board" element={<DiceBoardPage />} />
        <Route path="/overlay/challenges" element={<ChallengePage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}