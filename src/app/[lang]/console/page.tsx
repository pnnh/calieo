import { notFound } from "next/navigation";
import { isValidLang } from "@/lib/language";
import type { LangKey } from "@/lib/language";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db/index";
import { channels, files } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { t } from "@/lib/i18n";
import Link from "next/link";


export const dynamic = "force-dynamic";

type Props = { params: Promise<{ lang: string }> };

export default async function ConsoleDashboard({ params }: Props) {
    const { lang } = await params;
    if (!isValidLang(lang)) notFound();
    const l = lang as LangKey;

    const user = await getCurrentUser();
    const db = getDb();

    const [channelCount] = await db
        .select({ count: count() })
        .from(channels)
        .where(eq(channels.userId, user.id));

    const [fileCount] = await db
        .select({ count: count() })
        .from(files)
        .where(eq(files.userId, user.id));

    return (
        <>
            <SiteHeader lang={l} />
            <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="flex items-baseline justify-between mb-2">
                    <h1 className="text-2xl font-bold text-gray-900">{t(l, "console")}</h1>
                    <Link href={`/${l}/console/users`} className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
                        {t(l, "manageUsers")}
                    </Link>
                </div>
                <p className="text-gray-500 mb-8">
                    {t(l, "welcomeUser")},{" "}
                    <Link href={`/${l}/console/profile`} className="font-medium text-gray-900 hover:text-blue-600 transition-colors">
                        {user.nickname || user.name}
                    </Link>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <Link href={`/${l}/console/channels`} className="p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition">
                        <p className="text-3xl font-bold text-gray-900">{channelCount.count}</p>
                        <p className="text-sm text-gray-500">{t(l, "channels")}</p>
                    </Link>
                    <Link href={`/${l}/console/files`} className="p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition">
                        <p className="text-3xl font-bold text-gray-900">{fileCount.count}</p>
                        <p className="text-sm text-gray-500">{t(l, "files")}</p>
                    </Link>
                    <Link href={`/${l}/console/profile`} className="p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition">
                        <p className="text-3xl font-bold text-gray-900">→</p>
                        <p className="text-sm text-gray-500">{t(l, "profileTitle")}</p>
                    </Link>
                </div>
            </main>
            <SiteFooter lang={l} />
        </>
    );
}
