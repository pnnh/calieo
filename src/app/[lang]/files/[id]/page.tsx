import { notFound } from "next/navigation";
import { isValidLang } from "@/lib/language";
import type { LangKey } from "@/lib/language";
import { getDb } from "@/db/index";
import { channels, files } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import MarkdownContent from "@/components/MarkdownContent";
import { t } from "@/lib/i18n";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ lang: string; id: string }> };

export default async function FileDetailPage({ params }: Props) {
    const { lang, id } = await params;
    if (!isValidLang(lang)) notFound();
    const l = lang as LangKey;

    const db = getDb();
    const [result] = await db
        .select()
        .from(files)
        .innerJoin(channels, eq(files.channelId, channels.id))
        .where(and(eq(files.id, id), eq(files.isPublished, true), eq(channels.isPublic, true)))
        .limit(1);

    if (!result) notFound();

    const { files: file, channels: channel } = result;

    function formatSize(bytes: number) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return (
        <>
            <SiteHeader lang={l} />
            <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="mb-4 text-sm text-gray-500">
                    <Link href={`/${l}/channels/${channel.id}`} className="hover:underline text-blue-600">{channel.name}</Link>
                    <span className="mx-2">·</span>
                    <time>{new Date(file.updatedAt).toLocaleDateString()}</time>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">{file.title}</h1>
                <div className="flex items-center gap-4 mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-sm text-gray-600">
                        <p>{file.filename} · {formatSize(file.size)}</p>
                        <p className="text-gray-400">{file.mimeType}</p>
                    </div>
                    <a
                        href={`/api/files/${file.id}/download`}
                        className="ml-auto px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                    >
                        {t(l, "download")}
                    </a>
                </div>
                {file.description && (
                    <article>
                        <MarkdownContent content={file.description} />
                    </article>
                )}
            </main>
            <SiteFooter lang={l} />
        </>
    );
}
