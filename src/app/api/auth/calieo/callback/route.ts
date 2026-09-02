import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  handleAuthorizationCallback,
  OIDC_TXN_COOKIE_NAME,
  type AuthorizationTransaction,
} from "@/lib/oidc";
import { ensureUserRow, logSecurityEvent } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { defaultLanguage } from "@/lib/language";

export const dynamic = "force-dynamic";

function signinUrl(lang: string, error?: boolean): string {
  return `/${lang}/account/signin${error ? "?error=1" : ""}`;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const cookieStore = await cookies();

  // The transaction cookie is single-use: consume it regardless of outcome.
  const txnCookie = cookieStore.get(OIDC_TXN_COOKIE_NAME)?.value;
  cookieStore.delete(OIDC_TXN_COOKIE_NAME);

  let txn: AuthorizationTransaction | null = null;
  if (txnCookie) {
    try {
      txn = JSON.parse(txnCookie) as AuthorizationTransaction;
    } catch {
      txn = null;
    }
  }

  const lang = txn?.lang && txn.lang.length > 0 ? txn.lang : defaultLanguage;

  if (!txn) {
    logSecurityEvent("auth.oidc.state_mismatch", { reason: "missing_txn_cookie" });
    return NextResponse.redirect(new URL(signinUrl(lang, true), origin));
  }

  const result = await handleAuthorizationCallback(txn, searchParams);

  if (!result.ok) {
    const eventByReason = {
      state_mismatch: "auth.oidc.state_mismatch",
      pkce_failure: "auth.oidc.pkce_failure",
      token_invalid: "auth.oidc.token_invalid",
    } as const;
    logSecurityEvent(eventByReason[result.reason], { lang });
    logSecurityEvent("auth.signin.failure", { method: "calieo", reason: result.reason });
    return NextResponse.redirect(new URL(signinUrl(lang, true), origin));
  }

  const user = await ensureUserRow(result.email, result.name ?? result.email.split("@")[0]);
  await createSession(user.id);

  logSecurityEvent("auth.signin.success", { userId: user.id, method: "calieo" });
  logSecurityEvent("auth.session.created", { userId: user.id });

  return NextResponse.redirect(new URL(txn.returnTo, origin));
}

