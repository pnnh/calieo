import { notFound } from "next/navigation";
import { isValidLang } from "@/lib/language";
import type { LangKey } from "@/lib/language";
import { tools } from "@/data/tools";
import ToolGrid from "@/components/ToolGrid";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { t } from "@/lib/i18n";
import { getDb } from "@/db/index";
import { files, channels } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ lang: string }> };

export default async function HomePage({ params }: Props) {
    const { lang } = await params;
    if (!isValidLang(lang)) notFound();
    const l = lang as LangKey;

    const db = getDb();
    const latestFiles = await db
        .select({ id: files.id, title: files.title, filename: files.filename, size: files.size })
        .from(files)
        .innerJoin(channels, eq(files.channelId, channels.id))
        .where(and(eq(files.isPublished, true), eq(channels.isPublic, true)))
        .orderBy(desc(files.updatedAt))
        .limit(8);

    return (
        <>
            <SiteHeader lang={l} />
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="mb-10 text-center">
                    <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-3">
                        {t(l, "siteName")}
                    </h1>
                    <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                        {t(l, "siteTagline")}
                    </p>
                </div>
                <ToolGrid tools={tools} lang={l} />

                {latestFiles.length > 0 && (
                    <section className="mt-16">
                        <h2 className="text-xl font-bold text-gray-900 mb-6">{t(l, "latestFiles")}</h2>
                        <div className="grid gap-3">
                            {latestFiles.map((f) => (
                                <Link
                                    key={f.id}
                                    href={`/${l}/files/${f.id}`}
                                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition"
                                >
                                    <div>
                                        <p className="font-medium text-gray-900">{f.title}</p>
                                        <p className="text-xs text-gray-500">{f.filename}</p>
                                    </div>
                                    <span className="text-sm text-gray-400">{f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(1)} KB` : `${(f.size / (1024 * 1024)).toFixed(1)} MB`}</span>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </main>
            <SiteFooter lang={l} />
        </>
    );
}
