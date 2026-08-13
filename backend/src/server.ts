import app from "./app";
import { env } from "./lib/env";

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[looply-backend] listening on :${env.PORT} (${env.NODE_ENV})`);
  if (env.DEV_DEMO_USER) {
    // eslint-disable-next-line no-console
    console.log("[looply-backend] DEV_DEMO_USER=true — internal auth disabled (dev only)");
  }
});

const shutdown = (signal: string) => {
  console.log(`[looply-backend] ${signal} received, shutting down`);
  server.close(() => process.exit(0));
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export default server;
