import { Suspense, lazy } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import { PageSkeleton } from "./components/common";
import Login, { ProtectedRoute } from "./features/Login";
import { useMe } from "./lib/api";
import {
  CHANGE_PASSWORD_PATH,
  DEFAULT_HOME_PATH,
  ONBOARDING_PATH,
  isWorkspaceActive,
} from "./lib/workspace";
import { ThemeProvider } from "./theme/react";

const Dashboard = lazy(() => import("./features/Dashboard"));
const ContentsList = lazy(() => import("./features/ContentsList"));
const NewContent = lazy(() => import("./features/NewContent"));
const ContentDetail = lazy(() => import("./features/ContentDetail"));
const Calendar = lazy(() => import("./features/Calendar"));
const Clients = lazy(() => import("./features/Clients"));
const ClientDetail = lazy(() => import("./features/ClientDetail"));
const Team = lazy(() => import("./features/Team"));
const Settings = lazy(() => import("./features/Settings"));
const Inbox = lazy(() => import("./features/Inbox"));
const WhatsAppManagement = lazy(() => import("./features/WhatsAppManagement"));
const PublicApproval = lazy(() => import("./features/PublicApproval"));
const Recovery = lazy(() => import("./features/Recovery"));
const ResetPassword = lazy(() => import("./features/ResetPassword"));
const Onboarding = lazy(() => import("./features/Onboarding"));
const ChangePassword = lazy(() =>
  import("./features/Onboarding").then((m) => ({ default: m.ChangePassword })),
);

function AccessGate() {
  const { data: session } = useMe();
  const { pathname } = useLocation();

  if (!session) return <Outlet />;

  if (session.mustChangePassword) {
    return pathname === CHANGE_PASSWORD_PATH ? (
      <Outlet />
    ) : (
      <Navigate to={CHANGE_PASSWORD_PATH} replace />
    );
  }
  if (!isWorkspaceActive(session)) {
    return pathname === ONBOARDING_PATH ? <Outlet /> : <Navigate to={ONBOARDING_PATH} replace />;
  }
  if (pathname === ONBOARDING_PATH) {
    return <Navigate to={DEFAULT_HOME_PATH} replace />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
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
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/inbox/:id" element={<Inbox />} />
            <Route path="/conversations" element={<Inbox />} />
            <Route path="/conversations/:id" element={<Inbox />} />
            <Route path="/whatsapp" element={<WhatsAppManagement />} />
          </Route>
        </Route>

        {/* Public client approval — NO internal sidebar */}
        <Route path="/approve/:token" element={<PublicApproval />} />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
