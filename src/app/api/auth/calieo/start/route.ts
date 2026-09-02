import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizationRequest, OIDC_TXN_COOKIE_NAME, OIDC_TXN_MAX_AGE_SECONDS } from "@/lib/oidc";
import { isValidLang, defaultLanguage } from "@/lib/language";
import { sanitizeReturnTo } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawLang = searchParams.get("lang") ?? "";
  const lang = isValidLang(rawLang) ? rawLang : defaultLanguage;
  const returnTo = sanitizeReturnTo(searchParams.get("return_to"), `/${lang}/console`);

  const { url, txn } = await buildAuthorizationRequest({ lang, returnTo });

  const response = NextResponse.redirect(url);
  response.cookies.set(OIDC_TXN_COOKIE_NAME, JSON.stringify(txn), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_TXN_MAX_AGE_SECONDS,
  });
  return response;
}
