import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import Dashboard from "./features/Dashboard";
import ContentsList from "./features/ContentsList";
import NewContent from "./features/NewContent";
import ContentDetail from "./features/ContentDetail";
import Calendar from "./features/Calendar";
import Clients from "./features/Clients";
import ClientDetail from "./features/ClientDetail";
import Team from "./features/Team";
import Settings from "./features/Settings";
import PublicApproval from "./features/PublicApproval";
import Login, { ProtectedRoute } from "./features/Login";
import Recovery from "./features/Recovery";
import ResetPassword from "./features/ResetPassword";
import Onboarding, { AccessGate, ChangePassword } from "./features/Onboarding";
import { ThemeProvider } from "./theme/react";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<Recovery />} />
      <Route path="/recovery" element={<Recovery />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Authenticated area. ProtectedRoute gates the session; AccessGate is
          the canonical first-access guard (password change → onboarding →
          app). ThemeProvider sits inside ProtectedRoute: public pages (Login,
          PublicApproval) keep the static AURA/LIGHT startup state. */}
      <Route
        element={
          <ProtectedRoute>
            <ThemeProvider>
              <AccessGate />
            </ThemeProvider>
          </ProtectedRoute>
        }
      >
        {/* First-access screens — full page, outside the app shell */}
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/onboarding" element={<Onboarding />} />

        {/* Internal application shell (sidebar + layout) */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/contents" element={<ContentsList />} />
          <Route path="/contents/new" element={<NewContent />} />
          <Route path="/contents/:id" element={<ContentDetail />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/team" element={<Team />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>

      {/* Public client approval — NO internal sidebar */}
      <Route path="/approve/:token" element={<PublicApproval />} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
