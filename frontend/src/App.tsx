import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import Dashboard from "./features/Dashboard";
import ContentsList from "./features/ContentsList";
import NewContent from "./features/NewContent";
import ContentDetail from "./features/ContentDetail";
import Calendar from "./features/Calendar";
import Clients from "./features/Clients";
import Team from "./features/Team";
import PublicApproval from "./features/PublicApproval";
import Login, { ProtectedRoute } from "./features/Login";
import { ThemeProvider } from "./theme/react";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Internal application shell (sidebar + layout), session required.
          ThemeProvider sits inside ProtectedRoute: public pages (Login,
          PublicApproval) keep the static AURA/LIGHT startup state. */}
      <Route
        element={
          <ProtectedRoute>
            <ThemeProvider>
              <AppLayout />
            </ThemeProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/contents" element={<ContentsList />} />
        <Route path="/contents/new" element={<NewContent />} />
        <Route path="/contents/:id" element={<ContentDetail />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/team" element={<Team />} />
      </Route>

      {/* Public client approval — NO internal sidebar */}
      <Route path="/approve/:token" element={<PublicApproval />} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
