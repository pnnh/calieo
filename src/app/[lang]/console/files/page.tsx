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
import FilesPageSizeSelect from "./FilesPageSizeSelect";
import { buildPageWindow, PAGE_SIZE_OPTIONS, parsePage, parsePageSize } from "./pagination";

export const dynamic = "force-dynamic";

type Props = {
    params: Promise<{ lang: string }>;
    searchParams: Promise<{ parent?: string; q?: string; page?: string; pageSize?: string }>;
};

export default async function FilesListPage({ params, searchParams }: Props) {
    const { lang } = await params;
    if (!isValidLang(lang)) notFound();
    const l = lang as LangKey;

    const { parent, q, page, pageSize } = await searchParams;
    const parentId = parent ?? null;
    const query = q?.trim() ?? "";
    const requestedPage = parsePage(page);
    const currentPageSize = parsePageSize(pageSize);

    const user = await getCurrentUser();
    const db = getDb();

    // Resolve current directory info (for breadcrumb / upload link)
    let parentDir: { id: string; title: string; parentId: string | null } | null = null;
    if (parentId) {
        const [row] = await db
            .select()
            .from(files)
            .where(and(eq(files.id, parentId), eq(files.userId, user.id))!)
            .limit(1);
        if (!row || row.mimeType !== "directory") notFound();
        parentDir = { id: row.id, title: row.title, parentId: row.parentId };
    }

    const siblingFiles = await db
        .select()
        .from(files)
        .where(parentId ? and(eq(files.userId, user.id), eq(files.parentId, parentId))! : and(eq(files.userId, user.id), isNull(files.parentId))!)
        .orderBy(desc(files.updatedAt));

    const normalizedQuery = query.trim().toLowerCase();
    const filteredFiles = normalizedQuery
        ? siblingFiles.filter((file) => {
              const haystacks = [file.filename, file.title, file.description]
                  .filter(Boolean)
                  .map((value) => value.toLowerCase());
              return haystacks.some((value) => value.includes(normalizedQuery));
          })
        : siblingFiles;

    const totalCount = filteredFiles.length;
    const totalPages = totalCount > 0 ? Math.ceil(totalCount / currentPageSize) : 0;
    const currentPage = totalPages > 0 ? Math.min(requestedPage, totalPages) : 1;
    const pageStart = (currentPage - 1) * currentPageSize;
    const userFiles = filteredFiles.slice(pageStart, pageStart + currentPageSize);

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

    function buildHref(nextPage: number, nextPageSize = currentPageSize) {
        const params = new URLSearchParams();
        if (parentId) params.set("parent", parentId);
        if (query) params.set("q", query);
        params.set("page", String(nextPage));
        params.set("pageSize", String(nextPageSize));
        return `/${l}/console/files?${params.toString()}`;
    }

    const hasPagination = totalPages > 1;
    const paginationWindow = buildPageWindow(currentPage, totalPages);

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
        fileTitle: t(l, "fileTitle"),
        editFile: t(l, "editFile"),
        size: t(l, "size"),
        fileStatus: t(l, "fileStatus"),
        updated: t(l, "updated"),
        deleteSelected: t(l, "deleteSelected"),
        deleteSelectedConfirm: t(l, "deleteSelectedConfirm"),
        deleteDirectoryHasChildren: t(l, "deleteDirectoryHasChildren"),
        noFilesYet: t(l, "noFilesYet"),
    };

    const isSearchActive = query.length > 0;
    const isEmpty = sorted.length === 0;
    const emptyMessage = isSearchActive ? t(l, "noResults") : t(l, "noFilesYet");

    return (
        <>
            <SiteHeader lang={l} />
            <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Header row */}
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-2xl font-bold text-gray-900">{t(l, "manageFiles")}</h1>
                    <div className="flex gap-2">
                        <div id="files-header-delete-slot" className="contents" />
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

                <form method="get" className="mb-4 grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
                    {parentId && <input type="hidden" name="parent" value={parentId} />}
                    <input type="hidden" name="page" value="1" />
                    <input type="hidden" name="pageSize" value={String(currentPageSize)} />
                    <label className="block min-w-0">
                        <span className="mb-1 block text-xs font-medium text-gray-600">{t(l, "search")}</span>
                        <input
                            name="q"
                            defaultValue={query}
                            placeholder={t(l, "search")}
                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </label>
                    <button
                        type="submit"
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                        {t(l, "search")}
                    </button>
                </form>

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
                    <p className="text-gray-500">{emptyMessage}</p>
                ) : (
                    <FilesTreeTable lang={lang} initialRows={treeRows} labels={treeLabels} />
                )}

                {!isEmpty && (
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
                        <div className="flex flex-wrap items-center gap-3">
                            <FilesPageSizeSelect
                                label={t(l, "itemsPerPage")}
                                value={currentPageSize}
                                options={PAGE_SIZE_OPTIONS}
                            />
                            <div>
                                {currentPage} / {Math.max(1, totalPages)}
                            </div>
                        </div>
                        {hasPagination && (
                            <div className="flex items-center gap-1">
                                <Link
                                    href={buildHref(Math.max(1, currentPage - 1))}
                                    aria-disabled={currentPage === 1}
                                    className={`rounded-md border px-3 py-1.5 ${
                                        currentPage === 1
                                            ? "pointer-events-none border-gray-200 text-gray-400"
                                            : "border-gray-300 text-gray-700 hover:bg-gray-50"
                                    }`}
                                >
                                    {t(l, "prevPage")}
                                </Link>
                                {paginationWindow.map((pageItem, index) =>
                                    pageItem === "ellipsis" ? (
                                        <span key={`ellipsis-${index}`} className="px-2 text-gray-400">
                                            …
                                        </span>
                                    ) : (
                                        <Link
                                            key={pageItem}
                                            href={buildHref(pageItem)}
                                            aria-current={pageItem === currentPage ? "page" : undefined}
                                            className={`rounded-md border px-3 py-1.5 ${
                                                pageItem === currentPage
                                                    ? "border-blue-600 bg-blue-600 text-white"
                                                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                                            }`}
                                        >
                                            {pageItem}
                                        </Link>
                                    ),
                                )}
                                <Link
                                    href={buildHref(Math.min(totalPages, currentPage + 1))}
                                    aria-disabled={currentPage === totalPages}
                                    className={`rounded-md border px-3 py-1.5 ${
                                        currentPage === totalPages
                                            ? "pointer-events-none border-gray-200 text-gray-400"
                                            : "border-gray-300 text-gray-700 hover:bg-gray-50"
                                    }`}
                                >
                                    {t(l, "nextPage")}
                                </Link>
                            </div>
                        )}
                    </div>
                )}
            </main>
            <SiteFooter lang={l} />
        </>
    );
}
