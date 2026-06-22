import { notFound } from "next/navigation";
import { isValidLang } from "@/lib/language";
import type { LangKey } from "@/lib/language";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ChannelSearch from "@/components/ChannelSearch";
import { t } from "@/lib/i18n";
import { getDb } from "@/db/index";
import { files, channels, channelFiles } from "@/db/schema";
import { eq, and, desc, like, or, sql } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type Props = {
    params: Promise<{ lang: string }>;
    searchParams: Promise<{ q?: string; page?: string }>;
};

export default async function HomePage({ params, searchParams }: Props) {
    const { lang } = await params;
    if (!isValidLang(lang)) notFound();
    const l = lang as LangKey;

    const sp = await searchParams;
    const query = sp.q?.trim() ?? "";
    const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    const db = getDb();

    const baseCondition = and(eq(files.isPublished, true), eq(channels.isPublic, true));
    const condition = query
        ? and(
              baseCondition,
              or(
                  like(files.title, `%${query}%`),
                  like(files.description, `%${query}%`),
                  like(files.filename, `%${query}%`)
              )
          )
        : baseCondition;

    const [countRows, pageRows] = await Promise.all([
        db
            .select({ count: sql<number>`count(*)` })
            .from(files)
            .innerJoin(channelFiles, eq(channelFiles.fileId, files.id))
            .innerJoin(channels, eq(channelFiles.channelId, channels.id))
            .where(condition),
        db
            .select({
                id: files.id,
                title: files.title,
                description: files.description,
                filename: files.filename,
                size: files.size,
                updatedAt: files.updatedAt,
                channelId: channels.id,
                channelName: channels.name,
            })
            .from(files)
            .innerJoin(channelFiles, eq(channelFiles.fileId, files.id))
            .innerJoin(channels, eq(channelFiles.channelId, channels.id))
            .where(condition)
            .orderBy(desc(files.updatedAt))
            .limit(PAGE_SIZE)
            .offset(offset),
    ]);

    const total = Number(countRows[0]?.count ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);

    const buildUrl = (p: number) => {
        const ps = new URLSearchParams();
        if (query) ps.set("q", query);
        if (p > 1) ps.set("page", String(p));
        const qs = ps.toString();
        return `/${l}/${qs ? `?${qs}` : ""}`;
    };

    function formatSize(bytes: number) {
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return (
        <>
            <SiteHeader lang={l} />
            <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">{t(l, "publicFiles")}</h1>
                <div className="mb-8">
                    <Suspense>
                        <ChannelSearch placeholder={t(l, "search")} />
                    </Suspense>
                </div>
                {pageRows.length === 0 ? (
                    <p className="text-gray-500">{t(l, "noResults")}</p>
                ) : (
                    <div className="grid gap-3">
                        {pageRows.map((f) => (
                            <Link
                                key={f.id}
                                href={`/${l}/files/${f.id}`}
                                className="flex items-center justify-between gap-4 p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-gray-900 truncate">{f.title}</p>
                                    {f.description && (
                                        <p className="text-sm text-gray-500 truncate">{f.description}</p>
                                    )}
                                    <p className="text-xs text-gray-400 truncate mt-0.5">
                                        {f.filename}
                                        {" · "}
                                        {f.channelName}
                                    </p>
                                </div>
                                <span className="text-sm text-gray-400 whitespace-nowrap shrink-0">
                                    {formatSize(f.size)}
                                </span>
                            </Link>
                        ))}
                    </div>
                )}
                {totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-8">
                        {currentPage > 1 && (
                            <Link
                                href={buildUrl(currentPage - 1)}
                                className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                            >
                                {t(l, "prevPage")}
                            </Link>
                        )}
                        <span className="px-3 py-1 text-sm text-gray-500">
                            {currentPage} / {totalPages}
                        </span>
                        {currentPage < totalPages && (
                            <Link
                                href={buildUrl(currentPage + 1)}
                                className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                            >
                                {t(l, "nextPage")}
                            </Link>
                        )}
                    </div>
                )}
            </main>
            <SiteFooter lang={l} />
        </>
    );
}

