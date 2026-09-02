import { eq } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { users } from '@/db/schema';
import { getSessionUser } from '@/lib/session';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  nickname: string | null;
  bio: string | null;
}

// Only allow same-origin relative paths as a post-signin redirect target, since
// `return_to` values originate from attacker-influenceable query parameters/form fields.
export function sanitizeReturnTo(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('://')) {
    return fallback;
  }
  return value;
}

export type SecurityEvent =
  | 'auth.signin.success'
  | 'auth.signin.failure'
  | 'auth.oidc.state_mismatch'
  | 'auth.oidc.pkce_failure'
  | 'auth.oidc.token_invalid'
  | 'auth.session.created'
  | 'auth.session.revoked';

// Structured log for security-relevant auth events (spec FR-013); not persisted to the DB.
export function logSecurityEvent(event: SecurityEvent, details: Record<string, unknown> = {}): void {
  console.log('[security]', event, details);
}

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

// Finds a user by email (spec FR-015: email is the sole matching key for both
// dev mock login and Calieo login); creates a new row when no match exists.
// An existing user's `name` is never overwritten by a later login.
export async function ensureUserRow(email: string, name: string): Promise<CurrentUser> {
  const db = getDb();

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    const u = existing[0];
    return { id: u.id, name: u.name, email: u.email, nickname: u.nickname ?? null, bio: u.bio ?? null };
  }

  try {
    await db.insert(users)
      .values({ name, email })
      .onConflictDoNothing()
      .run();
  } catch (error) {
    // D1 may throw even with ON CONFLICT DO NOTHING under a concurrent insert
    // racing on the unique email constraint. Log and fall through to SELECT.
    console.warn('[auth.ensureUserRow] insert failed, falling back to SELECT', {
      user: { email },
      error: toErrorDetails(error),
    });
  }

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (rows.length > 0) {
    const u = rows[0];
    return { id: u.id, name: u.name, email: u.email, nickname: u.nickname ?? null, bio: u.bio ?? null };
  }

  throw new Error(`[auth.ensureUserRow] user not found after insert attempt: email=${email}`);
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const session = await getSessionUser();
  if (!session) {
    throw new Error('Unauthenticated request: no valid session.');
  }

  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  const u = rows[0];
  if (!u) {
    throw new Error(`Unauthenticated request: session references missing user id=${session.userId}`);
  }

  return { id: u.id, name: u.name, email: u.email, nickname: u.nickname ?? null, bio: u.bio ?? null };
}
