import app from "./app";
import { env, validateEnv } from "./lib/env";
import { logger } from "./lib/logger";
import { reportError } from "./lib/errorReporter";
import { prisma } from "./lib/db";

validateEnv();

// ── Global process-failure visibility (R2.2) ─────────────────────────────
// An uncaught exception or unhandled rejection means the process may be in an
// unsafe state. Log with useful context (never secrets — only error name,
// message, stack), surface it through the error-reporting seam, then exit so
// PM2 can restart a clean process. We do NOT silently keep running after an
// unsafe exception. Existing graceful shutdown on SIGINT/SIGTERM is untouched.

const exitWithFailure = (kind: string, err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error("process_unhandled_" + kind, {
    errorName: err instanceof Error ? err.name : undefined,
    error: message,
    stack: err instanceof Error ? err.stack : undefined,
  });
  reportError({
    message: `process_${kind}: ${message}`,
    errorName: err instanceof Error ? err.name : undefined,
    error: err,
    component: "process",
  });
  process.exit(1);
};

process.on("unhandledRejection", (reason) => {
  exitWithFailure("rejection", reason);
});

process.on("uncaughtException", (err) => {
  exitWithFailure("exception", err);
});

const server = app.listen(env.PORT, env.HOST, () => {
  logger.info("server_started", { host: env.HOST, port: env.PORT, nodeEnv: env.NODE_ENV });
});

// Graceful shutdown: stop accepting connections, close HTTP, disconnect Prisma.
const SHUTDOWN_TIMEOUT_MS = 10_000;
let shuttingDown = false;

const shutdown = (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("shutdown_started", { signal });
  const forceTimer = setTimeout(() => {
    logger.error("shutdown_timeout_exceeded", { timeoutMs: SHUTDOWN_TIMEOUT_MS });
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceTimer.unref();
  server.close(async () => {
    try {
      await prisma.$disconnect();
    } catch (err) {
      logger.error("prisma_disconnect_failed", {
        detail: err instanceof Error ? err.message : String(err),
      });
    }
    clearTimeout(forceTimer);
    logger.info("shutdown_complete");
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export default server;
