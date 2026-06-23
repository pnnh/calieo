import { notFound } from "next/navigation";
import { isValidLang } from "@/lib/language";
import type { LangKey } from "@/lib/language";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db/index";
import { channels, channelFiles, files } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { t } from "@/lib/i18n";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Props = {
    params: Promise<{ lang: string; channelId: string }>;
};

export default async function ChannelFilesPage({ params }: Props) {
    const { lang, channelId } = await params;
    if (!isValidLang(lang)) notFound();
    const l = lang as LangKey;

    const user = await getCurrentUser();
    const db = getDb();

    // Verify the channel exists and belongs to the current user
    const [channel] = await db
        .select()
        .from(channels)
        .where(and(eq(channels.id, channelId), eq(channels.userId, user.id)))
        .limit(1);

    if (!channel) notFound();

    // Fetch files linked to this channel via channel_files join
    const rows = await db
        .select({
            id: files.id,
            title: files.title,
            filename: files.filename,
            mimeType: files.mimeType,
            size: files.size,
            isPublished: files.isPublished,
            updatedAt: files.updatedAt,
        })
        .from(channelFiles)
        .innerJoin(files, eq(channelFiles.fileId, files.id))
        .where(eq(channelFiles.channelId, channelId))
        .orderBy(desc(files.updatedAt));

    function formatSize(bytes: number) {
        if (bytes === 0) return "—";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return (
        <>
            <SiteHeader lang={l} />
            <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-2xl font-bold text-gray-900">
                        {channel.name} — {t(l, "manageChannelFiles")}
                    </h1>
                </div>

                {/* Breadcrumb */}
                <div className="mb-6 text-sm text-gray-500 flex items-center gap-1">
                    <Link href={`/${l}/console/channels`} className="hover:underline text-blue-600">
                        {t(l, "manageChannels")}
                    </Link>
                    <span>/</span>
                    <Link href={`/${l}/console/channels/${channelId}`} className="hover:underline text-blue-600">
                        {channel.name}
                    </Link>
                    <span>/</span>
                    <span className="text-gray-700 font-medium">{t(l, "manageChannelFiles")}</span>
                </div>

                {rows.length === 0 ? (
                    <p className="text-gray-500">{t(l, "noFilesYet")}</p>
                ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-left">
                                <tr>
                                    <th className="px-4 py-3 font-medium text-gray-700">{t(l, "fileTitle")}</th>
                                    <th className="px-4 py-3 font-medium text-gray-700">Size</th>
                                    <th className="px-4 py-3 font-medium text-gray-700">{t(l, "fileStatus")}</th>
                                    <th className="px-4 py-3 font-medium text-gray-700">{t(l, "updated")}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {rows.map((f) => (
                                    <tr key={f.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <Link
                                                href={`/${l}/console/files/${f.id}`}
                                                className="text-blue-600 hover:underline"
                                            >
                                                {f.title}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">{formatSize(f.size)}</td>
                                        <td className="px-4 py-3 text-gray-500">
                                            {f.isPublished ? t(l, "filePublished") : t(l, "fileDraft")}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">
                                            {new Date(f.updatedAt).toLocaleDateString()}
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
