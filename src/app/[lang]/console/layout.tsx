import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { isValidLang } from "@/lib/language";
import { parseJwtPayload } from "@/lib/jwt";
import { upsertUser } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Props = {
    params: Promise<{ lang: string }>;
    children: React.ReactNode;
};

export default async function ConsoleLayout({ params, children }: Props) {
    const { lang } = await params;
    if (!isValidLang(lang)) notFound();

    // Enforce authentication for all console pages.
    // Throws if the request carries no CF Access identity.
    await getCurrentUser();

    // Track user access in the portal users table (CF Access identity).
    // Merged from the former src/app/portal/layout.tsx.
    const headerMap = await headers();
    const jwtToken = headerMap.get("cf-access-jwt-assertion");
    const directEmail = headerMap.get("cf-access-authenticated-user-email");
    const payload = jwtToken ? parseJwtPayload(jwtToken) : null;
    const email = directEmail ?? payload?.email;

    if (email) {
        try {
            await upsertUser({
                email,
                sub: payload?.sub,
                name: payload?.name,
                groups: payload?.groups,
                country: payload?.country,
                iss: payload?.iss,
                aud: payload?.aud,
                token_exp: payload?.exp,
            });
        } catch (error) {
            // D1 not available in local `next dev` — silently ignore.
            // Use `pnpm preview` / `wrangler dev` to test with D1.
            console.error("Failed to upsert user:", error);
        }
    }

    return <>{children}</>;
}
