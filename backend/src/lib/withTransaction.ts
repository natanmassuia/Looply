import type { DB } from "./db";

// Runs `fn` in a Prisma interactive transaction. Lightweight test doubles
// without `$transaction` run the callback directly against the db object.
export async function withTransaction<T>(db: DB, fn: (tx: DB) => Promise<T>): Promise<T> {
  const maybe = db as unknown as { $transaction?: (cb: (tx: DB) => Promise<T>) => Promise<T> };
  return typeof maybe.$transaction === "function" ? maybe.$transaction(fn) : fn(db);
}
