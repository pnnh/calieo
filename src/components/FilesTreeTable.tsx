"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
    fileTitle: string;
    editFile: string;
    size: string;
    fileStatus: string;
    updated: string;
    deleteSelected: string;
    deleteSelectedConfirm: string;
    deleteDirectoryHasChildren: string;
    noFilesYet: string;
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
    hiddenIds: Set<string>,
): VisibleRow[] {
    const result: VisibleRow[] = [];
    for (const f of rows) {
        if (hiddenIds.has(f.id)) continue;
        result.push({ file: f, depth });
        if (f.mimeType === "directory" && expanded.has(f.id) && childMap[f.id]) {
            result.push(...buildVisible(childMap[f.id], depth + 1, expanded, childMap, hiddenIds));
        }
    }
    return result;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FilesTreeTable({ lang, initialRows, labels }: Props) {
    const router = useRouter();
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [childMap, setChildMap] = useState<Record<string, FileRow[]>>({});
    const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
    const [deleting, setDeleting] = useState(false);
    const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);
    const [movingId, setMovingId] = useState<string | null>(null);
    const [deletePortalTarget, setDeletePortalTarget] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setDeletePortalTarget(document.getElementById("files-header-delete-slot"));
    }, []);

    const visibleRows = useMemo(
        () => buildVisible(initialRows, 0, expanded, childMap, hiddenIds),
        [initialRows, expanded, childMap, hiddenIds],
    );

    const allVisibleIds = useMemo(() => visibleRows.map((r) => r.file.id), [visibleRows]);
    const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));
    const someSelected = allVisibleIds.some((id) => selected.has(id));

    const headerCheckboxRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (headerCheckboxRef.current) {
            headerCheckboxRef.current.indeterminate = someSelected && !allSelected;
        }
    }, [someSelected, allSelected]);

    function toggleSelectAll() {
        if (allSelected) {
            setSelected(new Set());
        } else {
            setSelected(new Set(allVisibleIds));
        }
    }

    function toggleSelect(id: string) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    async function toggleDir(dirId: string) {
        if (expanded.has(dirId)) {
            setExpanded((prev) => {
                const next = new Set(prev);
                next.delete(dirId);
                return next;
            });
            return;
        }
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

    async function handleBulkDelete() {
        if (!confirm(labels.deleteSelectedConfirm)) return;
        setDeleting(true);
        setRowErrors({});

        const toDelete = visibleRows
            .filter(({ file }) => selected.has(file.id))
            .sort((a, b) => b.depth - a.depth)
            .map(({ file }) => file.id);
        const newErrors: Record<string, string> = {};

        for (const id of toDelete) {
            const res = await fetch(`/${lang}/console/files/${id}/actions`, { method: "DELETE" });
            if (res.ok) {
                setHiddenIds((prev) => new Set(prev).add(id));
                setSelected((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            } else {
                const data = await res.json().catch(() => ({})) as Record<string, unknown>;
                newErrors[id] = typeof data.error === "string" ? data.error : labels.deleteDirectoryHasChildren;
            }
        }

        setRowErrors(newErrors);
        setDeleting(false);
    }

    async function handleMove(sourceId: string, targetDirId: string, dataTransfer: DataTransfer | null) {
        const draggedSourceId = dataTransfer?.getData("text/plain") || draggedId || sourceId;

        setDraggedId(null);
        setDropTargetId(null);

        if (!draggedSourceId || draggedSourceId === targetDirId) {
            return;
        }

        setMovingId(draggedSourceId);
        setRowErrors((prev) => {
            const next = { ...prev };
            delete next[draggedSourceId];
            return next;
        });

        try {
            const res = await fetch(`/${lang}/console/files/${draggedSourceId}/actions`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ parentId: targetDirId }),
            });

            if (res.ok) {
                router.refresh();
                return;
            }

            let message = "Failed to move item.";
            try {
                const data = (await res.json()) as { error?: string };
                if (typeof data.error === "string" && data.error.trim()) {
                    message = data.error;
                }
            } catch {
                // ignore response parsing issues
            }

            setRowErrors((prev) => ({ ...prev, [draggedSourceId]: message }));
        } finally {
            setMovingId((prev) => (prev === draggedSourceId ? null : prev));
        }
    }

    if (visibleRows.length === 0) {
        return <p className="text-gray-500">{labels.noFilesYet}</p>;
    }

    const deleteButton = (
        <button
            type="button"
            disabled={selected.size === 0 || deleting}
            onClick={handleBulkDelete}
            className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
            {deleting ? "…" : labels.deleteSelected}
        </button>
    );

    return (
        <div>
            {deletePortalTarget ? createPortal(deleteButton, deletePortalTarget) : (
                <div className="flex items-center justify-end mb-2">{deleteButton}</div>
            )}

            {/* Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left">
                        <tr>
                            <th className="px-4 py-3 w-10">
                                <input
                                    ref={headerCheckboxRef}
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={toggleSelectAll}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                            </th>
                            <th className="px-4 py-3 font-medium text-gray-700">{labels.fileTitle}</th>
                            <th className="px-4 py-3 font-medium text-gray-700">{labels.size}</th>
                            <th className="px-4 py-3 font-medium text-gray-700">{labels.fileStatus}</th>
                            <th className="px-4 py-3 font-medium text-gray-700">{labels.updated}</th>
                            <th className="px-2 py-3 w-8" />
                            <th className="px-2 py-3 w-10 text-right font-medium text-gray-700">{labels.editFile}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {visibleRows.map(({ file: f, depth }) => {
                            const isDir = f.mimeType === "directory";
                            const isExpanded = expanded.has(f.id);
                            const isLoading = loadingIds.has(f.id);
                            const isSelected = selected.has(f.id);
                            const rowError = rowErrors[f.id];
                            const isDropTarget = dropTargetId === f.id;
                            const isMoving = movingId === f.id;

                            return (
                                <tr
                                    key={f.id}
                                    className={`hover:bg-gray-50 ${isDropTarget ? "bg-blue-50" : ""} ${
                                        isMoving ? "opacity-60" : ""
                                    }`}
                                    onDragEnter={() => {
                                        if (draggedId && isDir && draggedId !== f.id) {
                                            setDropTargetId(f.id);
                                        }
                                    }}
                                    onDragOver={(e) => {
                                        if (!draggedId || !isDir || draggedId === f.id) return;
                                        e.preventDefault();
                                        setDropTargetId(f.id);
                                    }}
                                    onDragLeave={() => {
                                        if (dropTargetId === f.id) {
                                            setDropTargetId(null);
                                        }
                                    }}
                                    onDrop={(e) => {
                                        if (!isDir) return;
                                        e.preventDefault();
                                        void handleMove(f.id, f.id, e.dataTransfer);
                                    }}
                                >
                                    {/* Checkbox */}
                                    <td className="px-4 py-3 w-10">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleSelect(f.id)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                    </td>
                                    {/* Title */}
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
                                                    <span
                                                        className="truncate cursor-move"
                                                        draggable
                                                        onDragStart={(e) => {
                                                            e.dataTransfer.effectAllowed = "move";
                                                            e.dataTransfer.setData("text/plain", f.id);
                                                            setDraggedId(f.id);
                                                        }}
                                                        onDragEnd={() => {
                                                            setDraggedId(null);
                                                            setDropTargetId(null);
                                                        }}
                                                    >
                                                        {f.title}
                                                    </span>
                                                </Link>
                                            ) : (
                                                <Link
                                                    href={`/${lang}/console/files/${f.id}`}
                                                    className="text-blue-600 hover:underline flex items-center gap-1 min-w-0"
                                                >
                                                    <span className="flex-shrink-0">{fileIcon(f.mimeType)}</span>
                                                    <span
                                                        className="truncate cursor-move"
                                                        draggable
                                                        onDragStart={(e) => {
                                                            e.dataTransfer.effectAllowed = "move";
                                                            e.dataTransfer.setData("text/plain", f.id);
                                                            setDraggedId(f.id);
                                                        }}
                                                        onDragEnd={() => {
                                                            setDraggedId(null);
                                                            setDropTargetId(null);
                                                        }}
                                                    >
                                                        {f.title}
                                                    </span>
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
                                        {new Date(f.updatedAt).toLocaleDateString(lang)}
                                    </td>
                                    {/* Error cell */}
                                    <td className="px-2 py-3 w-8 text-right">
                                        {rowError && (
                                            <div className="group relative inline-flex items-center">
                                                <button
                                                    type="button"
                                                    className="text-red-500 hover:text-red-700 focus:outline-none"
                                                    aria-label={rowError}
                                                >
                                                    <svg
                                                        className="h-4 w-4"
                                                        viewBox="0 0 20 20"
                                                        fill="currentColor"
                                                        aria-hidden="true"
                                                    >
                                                        <path
                                                            fillRule="evenodd"
                                                            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                                                            clipRule="evenodd"
                                                        />
                                                    </svg>
                                                </button>
                                                <div className="pointer-events-none absolute right-0 bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 max-w-xs">
                                                    {rowError}
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-2 py-3 w-10 text-right">
                                        <Link
                                            href={`/${lang}/console/files/${f.id}`}
                                            aria-label={`${labels.editFile}: ${f.title}`}
                                            className="inline-flex items-center rounded p-1 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                                        >
                                            <svg
                                                className="h-4 w-4"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                                aria-hidden="true"
                                            >
                                                <path d="M13.586 3a2 2 0 012.828 2.828l-8.08 8.08a2 2 0 01-.878.497l-2.92.834a.5.5 0 01-.617-.617l.834-2.92a2 2 0 01.497-.878L13.586 3zm1.414 1.414a1 1 0 10-1.414-1.414l-.793.793 1.414 1.414.793-.793z" />
                                            </svg>
                                        </Link>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
