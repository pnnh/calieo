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

function toErrorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const errWithCause = error as Error & { cause?: unknown };
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: errWithCause.cause,
    };
  }

  return { value: error };
}

async function ensureUserRow(id: string, name: string, email: string): Promise<CurrentUser> {
  const db = getDb();
  try {
    await db.insert(users)
      .values({ id, name, email })
      .onConflictDoNothing()
      .run();
  } catch (error) {
    console.error('[auth.ensureUserRow] failed to upsert user row', {
      user: { id, name, email },
      error: toErrorDetails(error),
    });
    throw error;
  }
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (rows.length > 0) {
    return { id: rows[0].id, name: rows[0].name, email: rows[0].email, nickname: rows[0].nickname ?? null, bio: rows[0].bio ?? null };
  }
  return { id, name, email, nickname: null, bio: null };
}

async function getAccessUserBase(): Promise<{ id: string; name: string; email: string } | null> {
  const headerMap = await headers();
  const jwtToken = headerMap.get('cf-access-jwt-assertion');
  const directEmail = headerMap.get('cf-access-authenticated-user-email');
  const payload = jwtToken ? parseJwtPayload(jwtToken) : null;

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
