import { notFound } from "next/navigation";
import { isValidLang } from "@/lib/language";
import type { LangKey } from "@/lib/language";
import { getCurrentUser } from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SyncDirectoryClient from "@/components/SyncDirectoryClient";
import { t } from "@/lib/i18n";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Props = {
    params: Promise<{ lang: string }>;
    searchParams: Promise<{ parent?: string }>;
};

export default async function SyncDirectoryPage({ params, searchParams }: Props) {
    const { lang } = await params;
    if (!isValidLang(lang)) notFound();
    const l = lang as LangKey;

    await getCurrentUser();

    const { parent } = await searchParams;
    const parentId = parent ?? null;

    const labels = {
        syncDirectory: t(l, "syncDirectory"),
        syncHint: t(l, "syncHint"),
        selectFolder: t(l, "selectFolder"),
        startSync: t(l, "startSync"),
        syncing: t(l, "syncing"),
        syncName: t(l, "syncName"),
        syncSize: t(l, "syncSize"),
        syncStatus: t(l, "fileStatus"),
        syncFilterNote: t(l, "syncFilterNote"),
        cancel: t(l, "cancel"),
        manageFiles: t(l, "manageFiles"),
    };

    return (
        <>
            <SiteHeader lang={l} />
            <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">{t(l, "syncDirectory")}</h1>
                    <Link
                        href={`/${l}/console/files${parentId ? `?parent=${parentId}` : ""}`}
                        className="text-sm text-blue-600 hover:underline"
                    >
                        ← {t(l, "manageFiles")}
                    </Link>
                </div>
                <SyncDirectoryClient lang={lang} parentId={parentId} labels={labels} />
            </main>
            <SiteFooter lang={l} />
        </>
    );
}
