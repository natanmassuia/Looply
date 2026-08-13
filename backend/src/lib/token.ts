import { randomBytes } from "node:crypto";

// Public approval token: random, non-sequential, 256 bits. Does NOT encode any
// internal/db id — it only maps to an Approval row via the unique column.
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}
