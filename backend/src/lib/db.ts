import { PrismaClient } from "@prisma/client";
import "./env";

// ponytail: single shared client; no pool config / no extra wrapper.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

export type DB = PrismaClient;
