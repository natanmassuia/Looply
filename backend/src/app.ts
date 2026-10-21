import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./lib/env";
import { errorHandler, notFoundHandler } from "./lib/errors";
import { requestId } from "./middleware/requestId";
import { requestLogger } from "./middleware/requestLogger";
import { requireAuth, requirePasswordChanged } from "./middleware/requireAuth";
import { requireWorkspaceActive } from "./middleware/requireWorkspaceActive";
import authRouter from "./routes/auth";
import onboardingRouter from "./routes/onboarding";
import membersRouter from "./routes/members";
import settingsRouter from "./routes/settings";
import invitationsRouter from "./routes/invitations";
import healthRouter from "./routes/health";
import dashboardRouter from "./routes/dashboard";
import clientsRouter from "./routes/clients";
import teamRouter from "./routes/team";
import contentsRouter from "./routes/contents";
import publicationsRouter from "./routes/publications";
import approvalsRouter from "./routes/approvals";
import jobsRouter from "./routes/jobs";
import workflowsRouter from "./routes/workflows";
import filesRouter from "./routes/files";
import approvalsInternalRouter from "./routes/approvalsInternal";
import calendarRouter from "./routes/calendar";
import appointmentsRouter from "./routes/appointments";
import assistantRouter from "./routes/assistant";
import whatsappIdentitiesRouter from "./routes/whatsappIdentities";
import whatsappWebhookRouter from "./routes/whatsappWebhook";
import mediaRouter from "./routes/media";
import conversationsRouter from "./routes/conversations";
import whatsappManagementRouter from "./routes/whatsappManagement";
import { csrfOriginGuard } from "./middleware/csrf";

const app = express();

// TODO(A1/CSP): o HTML do app é servido pelo nginx/vite, não por este backend
// (API-only), então a CSP vive no proxy. Diretiva sugerida no server do nginx:
//   add_header Content-Security-Policy "default-src 'self'; script-src 'self'; frame-ancestors 'none'; object-src 'none'" always;
app.use(helmet());
app.set("trust proxy", env.TRUST_PROXY);
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
// Provider webhook: needs the RAW body for signature verification, so it is
// mounted before the JSON parser and outside the session chain (A3.1).
app.use("/api/webhooks/whatsapp", whatsappWebhookRouter);
app.use(express.json({ limit: "1mb" }));
app.use(requestId);
app.use(requestLogger);
app.use(csrfOriginGuard);

app.use("/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/onboarding", onboardingRouter);
app.use("/api/invitations", invitationsRouter);
// Public approval is token-authenticated, not session-authenticated.
app.use("/api/public/approvals", approvalsRouter);

// Everything below requires: session → password changed → workspace ACTIVE.
// Public token endpoints (/api/public/*) stay open by design.
app.use("/api", requireAuth, requirePasswordChanged, requireWorkspaceActive);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/whatsapp", whatsappManagementRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/workflows", workflowsRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/assistant", assistantRouter);
app.use("/api/whatsapp-identities", whatsappIdentitiesRouter);
app.use("/api/team", teamRouter);
app.use("/api/members", membersRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/contents", contentsRouter);
app.use("/api/publications", publicationsRouter);
// Broad "/api" routers carry router-level requireCapability guards (e.g.
// APPROVAL on approvalsInternal, FILES on files). Keep them after all specific
// "/api/*" routers so they don't intercept and 403 unrelated routes in
// workspaces without those capabilities (e.g. LOCAL_BUSINESS).
app.use("/api", filesRouter);
app.use("/api", approvalsInternalRouter);
app.use("/api", mediaRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
