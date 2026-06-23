"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { fileIcon } from "@/lib/fileIcon";

// ── Types ─────────────────────────────────────────────────────────────────────

export type FileRow = {
    id: string;
    title: string;
    mimeType: string;
    size: number;
    isPublished: boolean;
    updatedAt: number;
};

type Labels = {
    directory: string;
    filePublished: string;
    fileDraft: string;
};

type Props = {
    lang: string;
    initialRows: FileRow[];
    labels: Labels;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
    if (bytes === 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type VisibleRow = { file: FileRow; depth: number };

function buildVisible(
    rows: FileRow[],
    depth: number,
    expanded: Set<string>,
    childMap: Record<string, FileRow[]>,
): VisibleRow[] {
    const result: VisibleRow[] = [];
    for (const f of rows) {
        result.push({ file: f, depth });
        if (f.mimeType === "directory" && expanded.has(f.id) && childMap[f.id]) {
            result.push(...buildVisible(childMap[f.id], depth + 1, expanded, childMap));
        }
    }
    return result;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FilesTreeTable({ lang, initialRows, labels }: Props) {
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [childMap, setChildMap] = useState<Record<string, FileRow[]>>({});
    const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

    const visibleRows = useMemo(
        () => buildVisible(initialRows, 0, expanded, childMap),
        [initialRows, expanded, childMap],
    );

    async function toggleDir(dirId: string) {
        if (expanded.has(dirId)) {
            setExpanded((prev) => {
                const next = new Set(prev);
                next.delete(dirId);
                return next;
            });
            return;
        }
        // Fetch children lazily on first expand
        if (!childMap[dirId]) {
            setLoadingIds((prev) => new Set(prev).add(dirId));
            try {
                const res = await fetch(`/${lang}/console/files-children?parentId=${dirId}`);
                if (res.ok) {
                    const data = (await res.json()) as { files: FileRow[] };
                    setChildMap((prev) => ({ ...prev, [dirId]: data.files }));
                }
            } finally {
                setLoadingIds((prev) => {
                    const next = new Set(prev);
                    next.delete(dirId);
                    return next;
                });
            }
        }
        setExpanded((prev) => new Set(prev).add(dirId));
    }

    return (
        <tbody className="divide-y divide-gray-100">
            {visibleRows.map(({ file: f, depth }) => {
                const isDir = f.mimeType === "directory";
                const isExpanded = expanded.has(f.id);
                const isLoading = loadingIds.has(f.id);

                return (
                    <tr key={f.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                            <div
                                className="flex items-center gap-1"
                                style={{ paddingLeft: `${depth * 20}px` }}
                            >
                                {isDir ? (
                                    <button
                                        type="button"
                                        onClick={() => toggleDir(f.id)}
                                        className="w-4 h-4 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-gray-700"
                                        aria-label={isExpanded ? "Collapse" : "Expand"}
                                    >
                                        {isLoading ? (
                                            <svg
                                                className="animate-spin h-3 w-3"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                            >
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                />
                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                                />
                                            </svg>
                                        ) : (
                                            <svg
                                                className="h-3 w-3 transition-transform"
                                                style={{
                                                    transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                                                }}
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        )}
                                    </button>
                                ) : (
                                    <span className="w-4 flex-shrink-0" />
                                )}
                                {isDir ? (
                                    <Link
                                        href={`/${lang}/console/files?parent=${f.id}`}
                                        className="text-blue-600 hover:underline flex items-center gap-1 min-w-0"
                                    >
                                        <span className="flex-shrink-0">📁</span>
                                        <span className="truncate">{f.title}</span>
                                    </Link>
                                ) : (
                                    <Link
                                        href={`/${lang}/console/files/${f.id}`}
                                        className="text-blue-600 hover:underline flex items-center gap-1 min-w-0"
                                    >
                                        <span className="flex-shrink-0">{fileIcon(f.mimeType)}</span>
                                        <span className="truncate">{f.title}</span>
                                    </Link>
                                )}
                            </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                            {isDir ? "—" : formatSize(f.size)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                            {isDir
                                ? labels.directory
                                : f.isPublished
                                  ? labels.filePublished
                                  : labels.fileDraft}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                            {new Date(f.updatedAt).toLocaleDateString()}
                        </td>
                    </tr>
                );
            })}
        </tbody>
    );
}
