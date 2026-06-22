import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db/index";
import { users as usersTable } from "@/db/schema";
import { desc } from "drizzle-orm";

// Minimal D1 type definitions — compatible with @cloudflare/workers-types D1Database
interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
}

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<{ success: boolean }>;
  all<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(colName?: string): Promise<T | null>;
}

interface D1Database {
  prepare(query: string): D1Statement;
}

interface CloudflareEnv {
  DB: D1Database;
}

export interface User {
  id: number;
  email: string;
  sub: string | null;
  name: string | null;
  /** JSON-encoded string array */
  groups: string | null;
  country: string | null;
  iss: string | null;
  /** JSON-encoded string or string array */
  aud: string | null;
  /** Unix timestamp */
  created_at: number;
  /** Unix timestamp */
  last_seen_at: number;
  /** Unix timestamp */
  token_exp: number | null;
}

export interface UpsertUserData {
  email: string;
  sub?: string;
  name?: string;
  groups?: string[];
  country?: string;
  iss?: string;
  aud?: string | string[];
  token_exp?: number;
}

function getDB(): D1Database {
  const env = getCloudflareContext().env as unknown as Record<string, unknown>;
  const db = env.DB;
  if (!db) throw new Error("D1 binding 'DB' not found in environment");
  return db as D1Database;
}

export async function upsertUser(data: UpsertUserData): Promise<void> {
  const db = getDB();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `INSERT INTO users (email, sub, name, groups, country, iss, aud, created_at, last_seen_at, token_exp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         sub          = excluded.sub,
         name         = excluded.name,
         groups       = excluded.groups,
         country      = excluded.country,
         iss          = excluded.iss,
         aud          = excluded.aud,
         last_seen_at = excluded.last_seen_at,
         token_exp    = excluded.token_exp`
    )
    .bind(
      data.email,
      data.sub ?? null,
      data.name ?? null,
      data.groups ? JSON.stringify(data.groups) : null,
      data.country ?? null,
      data.iss ?? null,
      data.aud !== undefined ? JSON.stringify(data.aud) : null,
      now,
      now,
      data.token_exp ?? null
    )
    .run();
}

export async function listUsers(): Promise<User[]> {
  try {
    const db = getDB();
    const result = await db
      .prepare("SELECT * FROM users ORDER BY last_seen_at DESC")
      .all<User>();
    return result.results;
  } catch {
    // D1 unavailable in local `next dev` — fall back to SQLite via Drizzle
    const drizzleDb = getDb();
    const rows = await drizzleDb
      .select()
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt));
    return rows.map((u) => ({
      id: u.id as unknown as number,
      email: u.email,
      name: u.name,
      sub: null,
      groups: null,
      country: null,
      iss: null,
      aud: null,
      created_at: Math.floor(u.createdAt / 1000),
      last_seen_at: Math.floor(u.createdAt / 1000),
      token_exp: null,
    }));
  }
}
