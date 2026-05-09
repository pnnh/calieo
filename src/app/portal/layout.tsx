import { headers } from "next/headers";
import { parseJwtPayload } from "@/lib/jwt";
import { upsertUser } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
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
        } catch {
            // D1 not available in local `next dev` — silently ignore.
            // Use `pnpm preview` / `wrangler dev` to test with D1.
        }
    }

    return <>{children}</>;
}
