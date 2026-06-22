import { cookies } from 'next/headers';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { users } from '@/db/schema';
import { parseJwtPayload } from '@/lib/jwt';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  nickname: string | null;
  bio: string | null;
}

const DEV_USER_BASE = {
  id: process.env.DEV_USER_ID ?? 'dev-user-001',
  name: process.env.DEV_USER_NAME ?? 'Dev User',
  email: process.env.DEV_USER_EMAIL ?? 'dev@local',
};

function serializeCause(cause: unknown): unknown {
  if (cause == null) return cause;
  if (cause instanceof Error) return toErrorDetails(cause);
  if (typeof cause === 'object') {
    // D1 errors often have non-enumerable properties; use getOwnPropertyNames to capture them.
    const names = Object.getOwnPropertyNames(cause);
    if (names.length > 0) {
      const result: Record<string, unknown> = {};
      for (const key of names) {
        try { result[key] = (cause as Record<string, unknown>)[key]; } catch { result[key] = '[unreadable]'; }
      }
      return result;
    }
  }
  return String(cause);
}

function toErrorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const errWithCause = error as Error & { cause?: unknown };
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: serializeCause(errWithCause.cause),
    };
  }

  return { value: String(error) };
}

async function ensureUserRow(id: string, name: string, email: string): Promise<CurrentUser> {
  const db = getDb();

  try {
    await db.insert(users)
      .values({ id, name, email })
      .onConflictDoNothing()
      .run();
  } catch (error) {
    // D1 may throw even with ON CONFLICT DO NOTHING when a UNIQUE constraint
    // (e.g. email) conflicts with an existing row that has a different primary key.
    // Log the failure and fall through to the SELECT-based lookup below.
    console.warn('[auth.ensureUserRow] insert failed, falling back to SELECT', {
      user: { id, email },
      error: toErrorDetails(error),
    });
  }

  // 1. Try to find the row by the primary key supplied by the auth provider.
  const rowsById = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (rowsById.length > 0) {
    const u = rowsById[0];
    return { id: u.id, name: u.name, email: u.email, nickname: u.nickname ?? null, bio: u.bio ?? null };
  }

  // 2. The INSERT may have been silently skipped (or failed) because the same email
  //    already exists under a different id.  Return that existing row instead.
  const rowsByEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (rowsByEmail.length > 0) {
    const u = rowsByEmail[0];
    // Guard against legacy rows that have a null/empty name (pre-NOT NULL constraint data).
    const safeName = u.name || name;
    if (!u.name) {
      // Best-effort: back-fill the name so future reads are clean.
      try {
        await db.update(users).set({ name: safeName }).where(eq(users.id, u.id)).run();
      } catch (updateErr) {
        console.warn('[auth.ensureUserRow] failed to back-fill null name', { id: u.id, error: toErrorDetails(updateErr) });
      }
    }
    return { id: u.id, name: safeName, email: u.email, nickname: u.nickname ?? null, bio: u.bio ?? null };
  }

  throw new Error(`[auth.ensureUserRow] user not found after insert attempt: id=${id}, email=${email}`);
}

async function getAccessUserBase(): Promise<{ id: string; name: string; email: string } | null> {
  const headerMap = await headers();
  const jwtToken = headerMap.get('cf-access-jwt-assertion');
  const directEmail = headerMap.get('cf-access-authenticated-user-email');
  let payload = jwtToken ? parseJwtPayload(jwtToken) : null;

  // Fallback: API routes that are not covered by the Zero Trust policy do not
  // receive the injected cf-access-* headers.  However, the browser still sends
  // the CF_Authorization cookie (set by Cloudflare Access for this domain after
  // a successful login), which contains the same JWT.  Parse it so that
  // authenticated users can call API endpoints without being rejected.
  if (!payload && !directEmail) {
    const cookieStore = await cookies();
    const cfAuthToken = cookieStore.get('CF_Authorization')?.value;
    if (cfAuthToken) {
      payload = parseJwtPayload(cfAuthToken);
    }
  }

  const id = payload?.sub ?? directEmail ?? payload?.email;
  if (!id) return null;

  const email = directEmail ?? payload?.email ?? `${id}@access.local`;
  const name = payload?.name ?? email;

  return { id, name, email };
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const accessBase = await getAccessUserBase();
  if (accessBase) {
    return ensureUserRow(accessBase.id, accessBase.name, accessBase.email);
  }

  const cookieStore = await cookies();
  const userId = cookieStore.get('user_id')?.value;
  const base = userId
    ? { id: userId, name: userId, email: `${userId}@local` }
    : (process.env.NODE_ENV !== 'production' ? DEV_USER_BASE : null);

  if (!base) {
    throw new Error('Unauthenticated request: missing Cloudflare Access identity and user_id cookie.');
  }

  return ensureUserRow(base.id, base.name, base.email);
}
