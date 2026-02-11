import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ChatPage } from "./pages/ChatPage";
import { GoalsPage } from "./pages/GoalsPage";
import { AlertsPage } from "./pages/AlertsPage";
import { CreditsPage } from "./pages/CreditsPage";

/**
 * Le Router définit quelle page s'affiche selon l'URL.
 * Chaque overlay a sa propre route = sa propre Browser Source dans OBS.
 * 
 * /overlay/chat    → Chat stylisé
 * /overlay/alerts  → Alertes follow/sub/raid (à venir)
 * /overlay/goals   → Barres d'objectifs (à venir)
 * /overlay/credits → Crédits de fin (à venir)
 */

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/overlay/chat" element={<ChatPage />} />
        <Route path="/overlay/goals" element={<GoalsPage />} />
        <Route path="/overlay/alerts" element={<AlertsPage />} />
        <Route path="/overlay/credits" element={<CreditsPage />} />
      </Routes>
    </BrowserRouter>
  );
}