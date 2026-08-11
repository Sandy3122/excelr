/**
 * OTP + rate-limit storage.
 *
 * This project has no database or Redis of its own, so we expose a small
 * interface with two backends:
 *
 *  - InMemoryStore  (default) — a module-level Map with TTL. Fine for local
 *    dev and single-instance runs. NOT reliable on serverless/multi-instance
 *    hosting (each instance has its own memory), so OTPs may appear "not found"
 *    across cold starts. It is a safe default that never loses data locally.
 *
 *  - UpstashRedisStore (recommended for Vercel) — used automatically when
 *    UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set. Talks to
 *    Upstash's REST API with plain fetch, so it adds NO npm dependency and
 *    introduces no new local database.
 *
 * All values are namespaced and short-lived. We never store raw OTPs — only
 * the record produced by lib/whatsapp-otp/otp.ts (which holds an HMAC hash).
 */

export type OtpRecord = {
  otpHash: string;
  expiresAt: number; // epoch ms
  attemptCount: number;
  createdAt: number; // epoch ms
  lastSentAt: number; // epoch ms
};

export interface OtpStore {
  getRecord(phoneE164: string): Promise<OtpRecord | null>;
  setRecord(
    phoneE164: string,
    record: OtpRecord,
    ttlSeconds: number,
  ): Promise<void>;
  deleteRecord(phoneE164: string): Promise<void>;

  /** Increment a counter, setting TTL on first increment. Returns new value. */
  incrementCounter(key: string, ttlSeconds: number): Promise<number>;

  /** Verified-phone marker consumed by the registration route. */
  setVerified(phoneE164: string, ttlSeconds: number): Promise<void>;
  isVerified(phoneE164: string): Promise<boolean>;
  /** Atomically check-and-clear the verified marker. */
  consumeVerified(phoneE164: string): Promise<boolean>;
}

const nowMs = () => Date.now();

// ─── In-memory backend ────────────────────────────────────────────────────

type Entry = { value: string; expiresAt: number };

class InMemoryStore implements OtpStore {
  private map = new Map<string, Entry>();

  private get(key: string): string | null {
    const e = this.map.get(key);
    if (!e) return null;
    if (e.expiresAt <= nowMs()) {
      this.map.delete(key);
      return null;
    }
    return e.value;
  }

  private set(key: string, value: string, ttlSeconds: number) {
    this.map.set(key, { value, expiresAt: nowMs() + ttlSeconds * 1000 });
  }

  async getRecord(phone: string): Promise<OtpRecord | null> {
    const raw = this.get(`otp:${phone}`);
    return raw ? (JSON.parse(raw) as OtpRecord) : null;
  }

  async setRecord(phone: string, record: OtpRecord, ttlSeconds: number) {
    this.set(`otp:${phone}`, JSON.stringify(record), ttlSeconds);
  }

  async deleteRecord(phone: string) {
    this.map.delete(`otp:${phone}`);
  }

  async incrementCounter(key: string, ttlSeconds: number): Promise<number> {
    const current = this.get(key);
    const next = (current ? parseInt(current, 10) : 0) + 1;
    // Preserve remaining TTL on subsequent increments where possible.
    const existing = this.map.get(key);
    const ttl =
      existing && existing.expiresAt > nowMs()
        ? Math.ceil((existing.expiresAt - nowMs()) / 1000)
        : ttlSeconds;
    this.set(key, String(next), ttl);
    return next;
  }

  async setVerified(phone: string, ttlSeconds: number) {
    this.set(`verified:${phone}`, "1", ttlSeconds);
  }

  async isVerified(phone: string): Promise<boolean> {
    return this.get(`verified:${phone}`) === "1";
  }

  async consumeVerified(phone: string): Promise<boolean> {
    const ok = this.get(`verified:${phone}`) === "1";
    this.map.delete(`verified:${phone}`);
    return ok;
  }
}

// ─── Native Redis backend (ioredis, via REDIS_URL) ────────────────────────

// Imported lazily inside the class so the dependency only loads when a
// REDIS_URL is actually configured.
import type { Redis as IORedis } from "ioredis";

class RedisStore implements OtpStore {
  private client: IORedis;

  constructor(url: string) {
    // Require at call-time so environments without REDIS_URL never load ioredis.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Redis = require("ioredis") as typeof import("ioredis").default;
    this.client = new Redis(url, {
      // Fail fast instead of buffering commands forever if Redis is unreachable.
      maxRetriesPerRequest: 2,
      lazyConnect: false,
    });
    // Prevent unhandled 'error' events from crashing the process; the OTP
    // service already surfaces failures per-request.
    this.client.on("error", (err: Error) => {
      console.error(`[whatsapp-otp] Redis connection error: ${err.message}`);
    });
  }

  async getRecord(phone: string): Promise<OtpRecord | null> {
    const raw = await this.client.get(`otp:${phone}`);
    return raw ? (JSON.parse(raw) as OtpRecord) : null;
  }

  async setRecord(phone: string, record: OtpRecord, ttlSeconds: number) {
    await this.client.set(
      `otp:${phone}`,
      JSON.stringify(record),
      "EX",
      ttlSeconds,
    );
  }

  async deleteRecord(phone: string) {
    await this.client.del(`otp:${phone}`);
  }

  async incrementCounter(key: string, ttlSeconds: number): Promise<number> {
    const value = await this.client.incr(key);
    if (value === 1) await this.client.expire(key, ttlSeconds);
    return value;
  }

  async setVerified(phone: string, ttlSeconds: number) {
    await this.client.set(`verified:${phone}`, "1", "EX", ttlSeconds);
  }

  async isVerified(phone: string): Promise<boolean> {
    return (await this.client.get(`verified:${phone}`)) === "1";
  }

  async consumeVerified(phone: string): Promise<boolean> {
    // GETDEL is atomic on Redis >= 6.2.
    const v = await this.client.getdel(`verified:${phone}`);
    return v === "1";
  }
}

// ─── Upstash Redis REST backend ───────────────────────────────────────────

class UpstashRedisStore implements OtpStore {
  constructor(
    private url: string,
    private token: string,
  ) {}

  /** Run a single Redis command via Upstash REST. Returns the `result`. */
  private async cmd(args: (string | number)[]): Promise<unknown> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Upstash Redis error: HTTP ${res.status}`);
    }
    const data = (await res.json()) as { result?: unknown; error?: string };
    if (data.error) throw new Error(`Upstash Redis error: ${data.error}`);
    return data.result ?? null;
  }

  async getRecord(phone: string): Promise<OtpRecord | null> {
    const raw = (await this.cmd(["GET", `otp:${phone}`])) as string | null;
    return raw ? (JSON.parse(raw) as OtpRecord) : null;
  }

  async setRecord(phone: string, record: OtpRecord, ttlSeconds: number) {
    await this.cmd([
      "SET",
      `otp:${phone}`,
      JSON.stringify(record),
      "EX",
      ttlSeconds,
    ]);
  }

  async deleteRecord(phone: string) {
    await this.cmd(["DEL", `otp:${phone}`]);
  }

  async incrementCounter(key: string, ttlSeconds: number): Promise<number> {
    const value = Number(await this.cmd(["INCR", key]));
    if (value === 1) {
      await this.cmd(["EXPIRE", key, ttlSeconds]);
    }
    return value;
  }

  async setVerified(phone: string, ttlSeconds: number) {
    await this.cmd(["SET", `verified:${phone}`, "1", "EX", ttlSeconds]);
  }

  async isVerified(phone: string): Promise<boolean> {
    const v = (await this.cmd(["GET", `verified:${phone}`])) as string | null;
    return v === "1";
  }

  async consumeVerified(phone: string): Promise<boolean> {
    // GETDEL is atomic on Redis >= 6.2 (Upstash supports it).
    const v = (await this.cmd(["GETDEL", `verified:${phone}`])) as
      | string
      | null;
    return v === "1";
  }
}

// ─── Singleton selection ──────────────────────────────────────────────────

let store: OtpStore | null = null;
let warnedBadUpstashUrl = false;

/**
 * Upstash's REST backend needs the HTTPS *REST* URL + REST token (from the
 * console's "REST API" section) — NOT the native `rediss://…:6379` connection
 * string, whose password is a different secret and which `fetch` cannot use.
 * When the URL isn't http(s) we ignore it and fall back to in-memory so a
 * misconfigured value never crashes the OTP endpoints.
 */
function upstashRestConfigured(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;
  if (!/^https?:\/\//i.test(url)) {
    if (!warnedBadUpstashUrl) {
      warnedBadUpstashUrl = true;
      console.warn(
        "[whatsapp-otp] UPSTASH_REDIS_REST_URL is not an https:// REST URL " +
          "(looks like a native rediss:// connection string). Falling back to " +
          "the in-memory store. Use the REST URL + REST token from the Upstash console.",
      );
    }
    return false;
  }
  return true;
}

export function getOtpStore(): OtpStore {
  if (store) return store;

  // 1) Native Redis via REDIS_URL (rediss://… or redis://…) — the primary
  //    durable backend.
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl && /^rediss?:\/\//i.test(redisUrl)) {
    store = new RedisStore(redisUrl);
    return store;
  }

  // 2) Upstash REST (https:// URL + REST token) — optional alternative.
  if (upstashRestConfigured()) {
    store = new UpstashRedisStore(
      process.env.UPSTASH_REDIS_REST_URL as string,
      process.env.UPSTASH_REDIS_REST_TOKEN as string,
    );
    return store;
  }

  // 3) In-memory — local dev / single instance only.
  store = new InMemoryStore();
  return store;
}

/** True when a durable (Redis) backend is active. */
export function isDurableStore(): boolean {
  const redisUrl = process.env.REDIS_URL;
  return Boolean(redisUrl && /^rediss?:\/\//i.test(redisUrl)) || upstashRestConfigured();
}

/** Test-only: reset the singleton so a fresh backend is selected. */
export function __resetStoreForTests() {
  store = null;
}
