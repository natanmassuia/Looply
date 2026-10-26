import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { validateEnv } from "../src/lib/env";

const save = { ...process.env };

afterEach(() => {
  process.env = { ...save };
});

describe("validateEnv", () => {
  it("throws when DATABASE_URL is missing", () => {
    delete process.env.DATABASE_URL;
    expect(() => validateEnv()).toThrow(/DATABASE_URL/);
  });

  it("throws on invalid PORT", () => {
    process.env.DATABASE_URL = "postgresql://x";
    process.env.PORT = "not-a-port";
    expect(() => validateEnv()).toThrow(/PORT/);
  });

  it("passes with valid env", () => {
    process.env.DATABASE_URL = "postgresql://x";
    process.env.PORT = "4000";
    expect(() => validateEnv()).not.toThrow();
  });

  describe("A4 placeholder secret validation in production", () => {
    beforeEach(() => {
      delete process.env.MOCK_PROVIDER;
      delete process.env.DEMO_MODE;
    });

    it("aborts when secret contains placeholder in production", () => {
      process.env.DATABASE_URL = "postgresql://x";
      process.env.PORT = "4000";
      process.env.NODE_ENV = "production";
      process.env.SEED_ADMIN_PASSWORD = "CHANGE_ME_SEED_ADMIN_PASSWORD";

      expect(() => validateEnv()).toThrow(
        "[env] SEED_ADMIN_PASSWORD contém valor placeholder em produção",
      );
    });

    it("aborts when WHATSAPP_APP_SECRET contains dummy/example placeholder in production", () => {
      process.env.DATABASE_URL = "postgresql://x";
      process.env.PORT = "4000";
      process.env.NODE_ENV = "production";
      process.env.WHATSAPP_APP_SECRET = "example_secret_123";

      expect(() => validateEnv()).toThrow(
        "[env] WHATSAPP_APP_SECRET contém valor placeholder em produção",
      );
    });

    it("aborts when DATABASE_URL contains CHANGE_ME template placeholder in production", () => {
      process.env.DATABASE_URL = "postgresql://looply:CHANGE_ME@localhost:5432/looply?schema=public";
      process.env.PORT = "4000";
      process.env.NODE_ENV = "production";

      expect(() => validateEnv()).toThrow(
        "[env] DATABASE_URL contém valor placeholder em produção",
      );
    });

    it("aborts when REDIS_URL contains dummy placeholder in production", () => {
      process.env.DATABASE_URL = "postgresql://looply:prod_secret_pass@localhost:5432/looply?schema=public";
      process.env.PORT = "4000";
      process.env.NODE_ENV = "production";
      process.env.REDIS_URL = "redis://:dummy_pass@localhost:6379";

      expect(() => validateEnv()).toThrow(
        "[env] REDIS_URL contém valor placeholder em produção",
      );
    });

    it("allows valid strong secret in production", () => {
      process.env.DATABASE_URL = "postgresql://looply:RealComplexDbPass9928!@localhost:5432/looply?schema=public";
      process.env.PORT = "4000";
      process.env.NODE_ENV = "production";
      process.env.SEED_ADMIN_PASSWORD = "StrongRandomPass_83bA#918!";
      process.env.WHATSAPP_APP_SECRET = "f8a7e3d2c1b0a9f8e7d6c5b4a3210987";
      process.env.REDIS_URL = "redis://:RealRedisPass8812@localhost:6379";

      expect(() => validateEnv()).not.toThrow();
    });

    it("does not abort on placeholder values when NODE_ENV is development or test", () => {
      process.env.DATABASE_URL = "postgresql://x";
      process.env.PORT = "4000";
      process.env.NODE_ENV = "development";
      process.env.SEED_ADMIN_PASSWORD = "CHANGE_ME_SEED_ADMIN_PASSWORD";
      process.env.WHATSAPP_APP_SECRET = "placeholder";

      expect(() => validateEnv()).not.toThrow();
    });
  });

  describe("demo/mock flags in production", () => {
    it("aborts when DEMO_MODE=true in production", () => {
      process.env.DATABASE_URL = "postgresql://x";
      process.env.PORT = "4000";
      process.env.NODE_ENV = "production";
      process.env.DEMO_MODE = "true";

      expect(() => validateEnv()).toThrow(
        "[env] DEMO_MODE não é permitido em produção",
      );
    });

    it("aborts when MOCK_PROVIDER=true in production", () => {
      process.env.DATABASE_URL = "postgresql://x";
      process.env.PORT = "4000";
      process.env.NODE_ENV = "production";
      process.env.MOCK_PROVIDER = "true";

      expect(() => validateEnv()).toThrow(
        "[env] MOCK_PROVIDER não é permitido em produção",
      );
    });

    it("allows flags outside production", () => {
      process.env.DATABASE_URL = "postgresql://x";
      process.env.PORT = "4000";
      process.env.NODE_ENV = "development";
      process.env.DEMO_MODE = "true";
      process.env.MOCK_PROVIDER = "true";

      expect(() => validateEnv()).not.toThrow();
    });
  });
});
