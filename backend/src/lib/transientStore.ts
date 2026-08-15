// Minimal shared transient state contract (A3.0).
// Backed by Redis so state survives restarts and is shared across processes.
// Production code MUST NOT fall back to a process-global Map: if the store is
// unavailable, callers fail closed (errors propagate).

export interface TransientStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  // Atomic claim: true only when the key was absent.
  setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  // Atomic single-use read: returns and removes the value in one step.
  // Implementations that cannot guarantee atomicity MUST throw, never fall
  // back to get-then-delete.
  getAndDelete(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
}

import Redis from "ioredis";

export class RedisTransientStore implements TransientStore {
  private readonly client: Redis;

  constructor(url: string) {
    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      // Never log the URL or credentials.
    });
    this.client.on("error", () => undefined); // surfaced per-request, not to logs
  }

  async get(key: string) {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number) {
    await this.client.set(key, value, "EX", Math.max(1, Math.floor(ttlSeconds)));
  }

  async setIfAbsent(key: string, value: string, ttlSeconds: number) {
    const result = await this.client.set(key, value, "EX", Math.max(1, Math.floor(ttlSeconds)), "NX");
    return result === "OK";
  }

  async getAndDelete(key: string) {
    // Redis >= 6.2 atomic GETDEL.
    return this.client.getdel(key);
  }

  async delete(key: string) {
    await this.client.del(key);
  }
}

// Returns null when no REDIS_URL is configured — callers must treat that as
// "state layer unavailable" and fail closed. No in-memory fallback exists.
export function transientStoreFromEnv(url: string | undefined): TransientStore | null {
  return url && url.length > 0 ? new RedisTransientStore(url) : null;
}
