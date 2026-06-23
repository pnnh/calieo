import { notFound } from "next/navigation";
import { isValidLang } from "@/lib/language";
import type { LangKey } from "@/lib/language";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db/index";
import { files } from "@/db/schema";
import { eq, desc, and, isNull } from "drizzle-orm";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import MkdirButton from "@/components/MkdirButton";
import FilesTreeTable from "@/components/FilesTreeTable";
import { t } from "@/lib/i18n";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Props = {
    params: Promise<{ lang: string }>;
    searchParams: Promise<{ parent?: string }>;
};

export default async function FilesListPage({ params, searchParams }: Props) {
    const { lang } = await params;
    if (!isValidLang(lang)) notFound();
    const l = lang as LangKey;

    const { parent } = await searchParams;
    const parentId = parent ?? null;

    const user = await getCurrentUser();
    const db = getDb();

    // Resolve current directory info (for breadcrumb / upload link)
    let parentDir: { id: string; title: string; parentId: string | null } | null = null;
    if (parentId) {
        const [row] = await db
            .select()
            .from(files)
            .where(and(eq(files.id, parentId), eq(files.userId, user.id)))
            .limit(1);
        if (!row || row.mimeType !== "directory") notFound();
        parentDir = { id: row.id, title: row.title, parentId: row.parentId };
    }

    const condition = parentId
        ? and(eq(files.userId, user.id), eq(files.parentId, parentId))
        : and(eq(files.userId, user.id), isNull(files.parentId));

    const userFiles = await db
        .select()
        .from(files)
        .where(condition)
        .orderBy(desc(files.updatedAt));

    // Separate directories and files for display
    const dirs = userFiles.filter((f) => f.mimeType === "directory");
    const nonDirs = userFiles.filter((f) => f.mimeType !== "directory");
    const sorted = [...dirs, ...nonDirs];

    const mkdirLabels = {
        newDirectory: t(l, "newDirectory"),
        directoryName: t(l, "directoryName"),
        directoryNamePlaceholder: t(l, "directoryNamePlaceholder"),
        createDirectory: t(l, "createDirectory"),
        directoryNameEmpty: t(l, "directoryNameEmpty"),
        directoryNameInvalid: t(l, "directoryNameInvalid"),
        cancel: t(l, "cancel"),
    };

    const uploadHref = parentId
        ? `/${l}/console/files/new?parent=${parentId}`
        : `/${l}/console/files/new`;

    const syncHref = parentId
        ? `/${l}/console/sync?parent=${parentId}`
        : `/${l}/console/sync`;

    const treeRows = sorted.map((f) => ({
        id: f.id,
        title: f.title,
        mimeType: f.mimeType,
        size: f.size,
        isPublished: f.isPublished,
        updatedAt: f.updatedAt,
    }));

    const treeLabels = {
        directory: t(l, "directory"),
        filePublished: t(l, "filePublished"),
        fileDraft: t(l, "fileDraft"),
    };

    const isEmpty = sorted.length === 0;

    return (
        <>
            <SiteHeader lang={l} />
            <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Header row */}
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-2xl font-bold text-gray-900">{t(l, "manageFiles")}</h1>
                    <div className="flex gap-2">
                        <MkdirButton lang={lang} parentId={parentId} labels={mkdirLabels} />
                        <Link
                            href={syncHref}
                            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
                        >
                            {t(l, "syncDirectory")}
                        </Link>
                        <Link
                            href={uploadHref}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                        >
                            {t(l, "newFile")}
                        </Link>
                    </div>
                </div>

                {/* Breadcrumb / back link */}
                {parentDir && (
                    <div className="mb-4 text-sm text-gray-500 flex items-center gap-1">
                        <Link href={`/${l}/console/files`} className="hover:underline text-blue-600">
                            {t(l, "manageFiles")}
                        </Link>
                        {parentDir.parentId && (
                            <>
                                <span>/</span>
                                <Link
                                    href={`/${l}/console/files?parent=${parentDir.parentId}`}
                                    className="hover:underline text-blue-600"
                                >
                                    …
                                </Link>
                            </>
                        )}
                        <span>/</span>
                        <span className="text-gray-700 font-medium">{parentDir.title}</span>
                    </div>
                )}

                {isEmpty ? (
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
                            <FilesTreeTable lang={lang} initialRows={treeRows} labels={treeLabels} />
                        </table>
                    </div>
                )}
            </main>
            <SiteFooter lang={l} />
        </>
    );
}
