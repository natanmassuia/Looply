import app from "./app";
import { env, validateEnv } from "./lib/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/db";

validateEnv();

const server = app.listen(env.PORT, () => {
  logger.info("server_started", { port: env.PORT, nodeEnv: env.NODE_ENV });
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
