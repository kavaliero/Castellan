import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ChatPage } from "./pages/ChatPage";
import { GoalsPage } from "./pages/GoalsPage";
import { AlertsPage } from "./pages/AlertsPage";
import { CreditsPage } from "./pages/CreditsPage";
import { PausePage } from "./pages/PausePage";

/**
 * Le Router définit quelle page s'affiche selon l'URL.
 * Chaque overlay a sa propre route = sa propre Browser Source dans OBS.
 * 
 * /overlay/chat    → Chat stylisé
 * /overlay/alerts  → Alertes follow/sub/raid
 * /overlay/goals   → Barres d'objectifs
 * /overlay/credits → Crédits de fin
 * /overlay/pause   → Scène pause avec clips en boucle
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
      </Routes>
    </BrowserRouter>
  );
}