import { notFound } from "next/navigation";
import { isValidLang } from "@/lib/language";
import type { LangKey } from "@/lib/language";
import { getDb } from "@/db/index";
import { channels, files } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ChannelAvatar from "@/components/ChannelAvatar";
import { t } from "@/lib/i18n";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

type Props = {
    params: Promise<{ lang: string; id: string }>;
    searchParams: Promise<{ page?: string }>;
};

export default async function ChannelDetailPage({ params, searchParams }: Props) {
    const { lang, id } = await params;
    if (!isValidLang(lang)) notFound();
    const l = lang as LangKey;

    const db = getDb();
    const [channel] = await db.select().from(channels).where(and(eq(channels.id, id), eq(channels.isPublic, true))).limit(1);
    if (!channel) notFound();

    const sp = await searchParams;
    const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    const allFiles = await db.select({ id: files.id }).from(files).where(and(eq(files.channelId, id), eq(files.isPublished, true)));
    const total = allFiles.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);

    const pageFiles = await db.select().from(files)
        .where(and(eq(files.channelId, id), eq(files.isPublished, true)))
        .orderBy(desc(files.updatedAt)).limit(PAGE_SIZE).offset(offset);

    function formatSize(bytes: number) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return (
        <>
            <SiteHeader lang={l} />
            <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="flex items-center gap-4 mb-8">
                    <ChannelAvatar channelId={channel.id} channelName={channel.name} size={64} />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{channel.name}</h1>
                        {channel.description && <p className="text-gray-500 mt-1">{channel.description}</p>}
                    </div>
                </div>

                {pageFiles.length === 0 ? (
                    <p className="text-gray-500">{t(l, "noFilesYet")}</p>
                ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-left">
                                <tr>
                                    <th className="px-4 py-3 font-medium text-gray-700">{t(l, "fileTitle")}</th>
                                    <th className="px-4 py-3 font-medium text-gray-700">Size</th>
                                    <th className="px-4 py-3 font-medium text-gray-700">{t(l, "updated")}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {pageFiles.map((f) => (
                                    <tr key={f.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <Link href={`/${l}/files/${f.id}`} className="text-blue-600 hover:underline">{f.title}</Link>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">{formatSize(f.size)}</td>
                                        <td className="px-4 py-3 text-gray-500">{new Date(f.updatedAt).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-8">
                        {currentPage > 1 && <Link href={`/${l}/channels/${id}?page=${currentPage - 1}`} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">←</Link>}
                        <span className="px-3 py-1 text-sm text-gray-500">{currentPage} / {totalPages}</span>
                        {currentPage < totalPages && <Link href={`/${l}/channels/${id}?page=${currentPage + 1}`} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">→</Link>}
                    </div>
                )}
            </main>
            <SiteFooter lang={l} />
        </>
    );
}
