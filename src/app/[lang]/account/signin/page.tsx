import { notFound, redirect } from "next/navigation";
import { isValidLang } from "@/lib/language";
import type { LangKey } from "@/lib/language";
import { getCurrentUser, ensureUserRow, sanitizeReturnTo, logSecurityEvent } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { t } from "@/lib/i18n";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Props = {
    params: Promise<{ lang: string }>;
    searchParams: Promise<{ return_to?: string; error?: string }>;
};

export default async function AccountSignInPage({ params, searchParams }: Props) {
    const { lang } = await params;
    if (!isValidLang(lang)) notFound();
    const l = lang as LangKey;

    const { return_to, error } = await searchParams;
    const returnTo = sanitizeReturnTo(return_to, `/${lang}/console`);
    const isDev = process.env.NODE_ENV !== "production";

    let currentUser: Awaited<ReturnType<typeof getCurrentUser>> | null = null;
    try {
        currentUser = await getCurrentUser();
    } catch {
        // Not signed in — render the sign-in form/entry points below.
    }

    async function handleDevSignIn(formData: FormData) {
        "use server";

        if (process.env.NODE_ENV === "production") {
            logSecurityEvent("auth.signin.failure", { method: "dev", reason: "disabled_in_production" });
            return;
        }

        const email = (formData.get("email") as string | null)?.trim() ?? "";
        if (!email || !email.includes("@")) {
            logSecurityEvent("auth.signin.failure", { method: "dev", reason: "invalid_email" });
            return;
        }
        const username = (formData.get("username") as string | null)?.trim() ?? "";
        const formReturnTo = sanitizeReturnTo(formData.get("return_to") as string | null, `/${lang}/console`);

        const user = await ensureUserRow(email, username || email.split("@")[0]);
        await createSession(user.id);
        logSecurityEvent("auth.signin.success", { userId: user.id, method: "dev" });
        logSecurityEvent("auth.session.created", { userId: user.id });

        redirect(formReturnTo);
    }

    const calieoStartUrl = `/api/auth/calieo/start?lang=${encodeURIComponent(lang)}&return_to=${encodeURIComponent(returnTo)}`;

    return (
        <>
            <SiteHeader lang={l} />
            <main className="flex-1 w-full max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-xl font-bold text-gray-900 mb-6">{t(l, "accountSignInHeading")}</h1>

                {error === "1" && (
                    <div className="mb-6 p-4 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800">
                        {t(l, "accountSignInError")}
                    </div>
                )}

                {currentUser && (
                    <div className="mb-6 p-4 rounded-lg border border-gray-200 bg-white text-sm text-gray-700">
                        <p className="font-medium text-gray-500 mb-1">{t(l, "devSignInCurrentUser")}</p>
                        <p className="font-semibold text-gray-900">{currentUser.nickname || currentUser.name}</p>
                        <p className="text-gray-500">{currentUser.email}</p>
                    </div>
                )}

                {isDev && (
                    <>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-4 text-sm text-amber-800">
                            {t(l, "devSignInTitle")}
                        </div>
                        <form action={handleDevSignIn} className="space-y-4 mb-8">
                            <input type="hidden" name="return_to" value={returnTo} />
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                    {t(l, "devSignInEmail")}
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoComplete="email"
                                    placeholder="you@example.com"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                                    {t(l, "devSignInUsername")}
                                </label>
                                <input
                                    id="username"
                                    type="text"
                                    name="username"
                                    autoComplete="nickname"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                            >
                                {currentUser ? t(l, "devSignInSwitchAccount") : t(l, "devSignInButton")}
                            </button>
                        </form>
                    </>
                )}

                <Link
                    href={calieoStartUrl}
                    className="block w-full text-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                >
                    {t(l, "calieoSignInButton")}
                </Link>

                <p className="mt-6 text-center text-sm">
                    <Link href={`/${lang}/account/signout`} className="text-gray-500 hover:text-gray-700 underline">
                        {t(l, "accountSignOutHeading")}
                    </Link>
                </p>
            </main>
            <SiteFooter lang={l} />
        </>
    );
}
