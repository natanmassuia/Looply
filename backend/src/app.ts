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

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: "1mb" }));
app.use(requestId);
app.use(requestLogger);

app.use("/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/onboarding", onboardingRouter);
app.use("/api/invitations", invitationsRouter);

// Everything below requires: session → password changed → workspace ACTIVE.
// Public token endpoints (/api/public/*) stay open by design.
app.use("/api", requireAuth, requirePasswordChanged, requireWorkspaceActive);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/workflows", workflowsRouter);
app.use("/api/team", teamRouter);
app.use("/api/members", membersRouter);
app.use("/api/contents", contentsRouter);
app.use("/api/publications", publicationsRouter);
app.use("/api/public/approvals", approvalsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
