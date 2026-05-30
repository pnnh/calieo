import { notFound } from "next/navigation";
import { isValidLang } from "@/lib/language";
import type { LangKey } from "@/lib/language";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db/index";
import { channels } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { t } from "@/lib/i18n";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ lang: string }> };

export default async function ChannelsListPage({ params }: Props) {
    const { lang } = await params;
    if (!isValidLang(lang)) notFound();
    const l = lang as LangKey;

    const user = await getCurrentUser();
    const db = getDb();

    const userChannels = await db
        .select()
        .from(channels)
        .where(eq(channels.userId, user.id))
        .orderBy(desc(channels.createdAt));

    return (
        <>
            <SiteHeader lang={l} />
            <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">{t(l, "manageChannels")}</h1>
                    <Link
                        href={`/${l}/console/channels/new`}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                    >
                        {t(l, "newChannel")}
                    </Link>
                </div>
                {userChannels.length === 0 ? (
                    <p className="text-gray-500">{t(l, "noChannelsYet")}</p>
                ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-left">
                                <tr>
                                    <th className="px-4 py-3 font-medium text-gray-700">{t(l, "channelName")}</th>
                                    <th className="px-4 py-3 font-medium text-gray-700">{t(l, "channelVisibility")}</th>
                                    <th className="px-4 py-3 font-medium text-gray-700">{t(l, "created")}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {userChannels.map((ch) => (
                                    <tr key={ch.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <Link href={`/${l}/console/channels/${ch.id}`} className="text-blue-600 hover:underline">
                                                {ch.name}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">
                                            {ch.isPublic ? t(l, "channelPublic") : t(l, "channelPrivate")}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">
                                            {new Date(ch.createdAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
            <SiteFooter lang={l} />
        </>
    );
}
