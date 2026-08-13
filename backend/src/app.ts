import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./lib/env";
import { errorHandler, notFoundHandler } from "./lib/errors";
import healthRouter from "./routes/health";
import dashboardRouter from "./routes/dashboard";
import clientsRouter from "./routes/clients";
import teamRouter from "./routes/team";
import contentsRouter from "./routes/contents";
import publicationsRouter from "./routes/publications";
import approvalsRouter from "./routes/approvals";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: "1mb" }));

app.use("/health", healthRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/team", teamRouter);
app.use("/api/contents", contentsRouter);
app.use("/api/publications", publicationsRouter);
app.use("/api/public/approvals", approvalsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
