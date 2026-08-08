import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isValidLang } from "@/lib/language";
import type { LangKey } from "@/lib/language";
import { getDevEmail, getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ lang: string }> };

export default async function DevSignInPage({ params }: Props) {
    const { lang } = await params;
    if (!isValidLang(lang)) notFound();
    const l = lang as LangKey;

    // In production Cloudflare Zero Trust protects all /console/* routes.
    // Redirect to the console dashboard — the user is already authenticated.
    if (process.env.NODE_ENV !== "development") {
        redirect(`/${lang}/console`);
    }

    const devEmail = await getDevEmail();
    let currentUser: Awaited<ReturnType<typeof getCurrentUser>> | null = null;
    if (devEmail) {
        try {
            currentUser = await getCurrentUser();
        } catch {
            // DB may be unavailable; ignore
        }
    }

    async function handleSignIn(formData: FormData) {
        "use server";
        const email = (formData.get("email") as string | null)?.trim() ?? "";
        if (!email || !email.includes("@")) return;

        const cookieStore = await cookies();
        // Clear any existing dev session and set the new one
        cookieStore.set("dev_email", email, {
            httpOnly: true,
            path: "/",
            sameSite: "lax",
        });

        redirect(`/${lang}/console`);
    }

    return (
        <>
            <SiteHeader lang={l} />
            <main className="flex-1 w-full max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-6 text-sm text-amber-800">
                    {t(l, "devSignInTitle")}
                </div>

                {currentUser && (
                    <div className="mb-6 p-4 rounded-lg border border-gray-200 bg-white text-sm text-gray-700">
                        <p className="font-medium text-gray-500 mb-1">
                            {t(l, "devSignInCurrentUser")}
                        </p>
                        <p className="font-semibold text-gray-900">
                            {currentUser.nickname || currentUser.name}
                        </p>
                        <p className="text-gray-500">{currentUser.email}</p>
                    </div>
                )}

                <form action={handleSignIn} className="space-y-4">
                    <div>
                        <label
                            htmlFor="email"
                            className="block text-sm font-medium text-gray-700 mb-1"
                        >
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
                    <button
                        type="submit"
                        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                    >
                        {currentUser
                            ? t(l, "devSignInSwitchAccount")
                            : t(l, "devSignInButton")}
                    </button>
                </form>

                <p className="mt-6 text-center text-sm">
                    <Link
                        href={`/${lang}/console/signout`}
                        className="text-gray-500 hover:text-gray-700 underline"
                    >
                        {t(l, "devSignOutTitle")}
                    </Link>
                </p>
            </main>
            <SiteFooter lang={l} />
        </>
    );
}
