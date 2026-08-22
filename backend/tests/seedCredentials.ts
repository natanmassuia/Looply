// Shared seed/test credentials — read from the environment with NO hardcoded
// fallback, matching the contract of backend/src/seed.ts (SEED_ADMIN_EMAIL /
// SEED_ADMIN_PASSWORD). Importing this module never throws: the value is
// resolved lazily, so DB-gated suites that are skipped (no DATABASE_URL) are
// not affected by a missing seed credential.
let cached: { email: string; password: string } | undefined;

export function seedCredentials(): { email: string; password: string } {
  if (!cached) {
    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error(
        "Tests refused: SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required (no hardcoded fallback credentials).",
      );
    }
    cached = { email, password };
  }
  return cached;
}