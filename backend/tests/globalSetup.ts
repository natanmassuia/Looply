// Vitest global setup/teardown (Vitest 3 API: module exports setup/teardown).
// The teardown removes the sessions the DB-gated suites leave behind (they log
// in through the real auth service). Test infra only — it never touches
// application behavior. No-op when no DB is configured.
import { prisma } from "../src/lib/db";
import { teardownFixtureSessions } from "./fixtures";

export function setup(): void {
  // Nothing to prepare.
}

export async function teardown(): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await teardownFixtureSessions();
  } finally {
    await prisma.$disconnect();
  }
}