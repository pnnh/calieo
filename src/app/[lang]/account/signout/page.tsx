import { notFound, redirect } from "next/navigation";
import { isValidLang } from "@/lib/language";
import type { LangKey } from "@/lib/language";
import { getCurrentUser, logSecurityEvent } from "@/lib/auth";
import { getSessionUser, revokeSession } from "@/lib/session";
import { t } from "@/lib/i18n";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Props = {
    params: Promise<{ lang: string }>;
    searchParams: Promise<{ signed_out?: string }>;
};

export default async function AccountSignOutPage({ params, searchParams }: Props) {
    const { lang } = await params;
    if (!isValidLang(lang)) notFound();
    const l = lang as LangKey;

    const { signed_out } = await searchParams;
    const wasSignedOut = signed_out === "true";

    let currentUser: Awaited<ReturnType<typeof getCurrentUser>> | null = null;
    try {
        currentUser = await getCurrentUser();
    } catch {
        // Not signed in — render the "not logged in" state below.
    }

    async function handleSignOut() {
        "use server";
        const session = await getSessionUser();
        await revokeSession();
        if (session) {
            logSecurityEvent("auth.session.revoked", { userId: session.userId, reason: "signout" });
        }
        redirect(`/${lang}/account/signout?signed_out=true`);
    }

    return (
        <>
            <SiteHeader lang={l} />
            <main className="flex-1 w-full max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-xl font-bold text-gray-900 mb-6">{t(l, "accountSignOutHeading")}</h1>

                {wasSignedOut && (
                    <div className="mb-6 p-4 rounded-lg border border-green-200 bg-green-50 text-sm text-green-800">
                        {t(l, "devSignedOutMessage")}
                    </div>
                )}

                {currentUser ? (
                    <>
                        <div className="mb-6 p-4 rounded-lg border border-gray-200 bg-white text-sm text-gray-700">
                            <p className="font-medium text-gray-500 mb-1">{t(l, "devSignOutCurrentUser")}</p>
                            <p className="font-semibold text-gray-900">{currentUser.nickname || currentUser.name}</p>
                            <p className="text-gray-500">{currentUser.email}</p>
                        </div>

                        <form action={handleSignOut}>
                            <button
                                type="submit"
                                className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
                            >
                                {t(l, "devSignOutButton")}
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="text-center space-y-4">
                        <p className="text-gray-600 text-sm">{t(l, "devSignOutNotLoggedIn")}</p>
                        <Link
                            href={`/${lang}/account/signin`}
                            className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                        >
                            {t(l, "devSignOutGoToSignIn")}
                        </Link>
                    </div>
                )}

                <p className="mt-6 text-center text-sm">
                    <Link href={`/${lang}/account/signin`} className="text-gray-500 hover:text-gray-700 underline">
                        {t(l, "accountSignInHeading")}
                    </Link>
                </p>
            </main>
            <SiteFooter lang={l} />
        </>
    );
}
