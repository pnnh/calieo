import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/index";
import { sessions } from "@/db/schema";

export const SESSION_COOKIE_NAME = "session_id";

const DEFAULT_SESSION_TTL_DAYS = 7;

function getSessionTtlDays(): number {
  const raw = process.env.SESSION_TTL_DAYS;
  if (!raw) return DEFAULT_SESSION_TTL_DAYS;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(`[session] Invalid SESSION_TTL_DAYS="${raw}", falling back to ${DEFAULT_SESSION_TTL_DAYS} days`);
    return DEFAULT_SESSION_TTL_DAYS;
  }

  return parsed;
}

function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

// The raw token is only ever sent to the browser as a cookie value;
// the database stores this hash so a leaked DB read cannot be replayed as a session.
async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Buffer.from(digest).toString("hex");
}

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export interface SessionUser {
  sessionId: string;
  userId: string;
}

export async function createSession(userId: string): Promise<void> {
  const token = generateSessionToken();
  const tokenHash = await hashToken(token);
  const ttlDays = getSessionTtlDays();
  const now = Date.now();
  const expiresAt = now + ttlDays * 24 * 60 * 60 * 1000;

  const db = getDb();
  await db.insert(sessions).values({ id: tokenHash, userId, createdAt: now, expiresAt }).run();

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, cookieOptions(ttlDays * 24 * 60 * 60));
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = await hashToken(token);
  const db = getDb();
  const rows = await db.select().from(sessions).where(eq(sessions.id, tokenHash)).limit(1);
  const session = rows[0];
  if (!session) return null;

  if (session.expiresAt <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, tokenHash)).run();
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  return { sessionId: session.id, userId: session.userId };
}

export async function revokeSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const tokenHash = await hashToken(token);
    const db = getDb();
    await db.delete(sessions).where(eq(sessions.id, tokenHash)).run();
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}
