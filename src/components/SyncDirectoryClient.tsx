"use client";

import { useState, useMemo, useRef } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type TreeNode = {
    name: string;
    relativePath: string;
    kind: "file" | "directory";
    size?: number;
    handle: FileSystemHandle;
    children?: TreeNode[];
};

type SyncRecord = {
    status: "success" | "error";
    serverId?: string;
    errorMessage?: string;
    timestamp: number;
};

type UIStatus = {
    status: "pending" | "syncing" | "success" | "error";
    serverId?: string;
    errorMessage?: string;
};

export type SyncLabels = {
    syncDirectory: string;
    syncHint: string;
    selectFolder: string;
    startSync: string;
    syncing: string;
    syncName: string;
    syncSize: string;
    syncStatus: string;
    syncFilterNote: string;
    cancel: string;
    manageFiles: string;
};

type Props = {
    lang: string;
    parentId: string | null;
    labels: SyncLabels;
};

// ── IndexedDB ────────────────────────────────────────────────────────────────

const DB_NAME = "calieo-sync";
const STORE_NAME = "sync-records";

function openSyncDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            req.result.createObjectStore(STORE_NAME);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function getRecord(key: string): Promise<SyncRecord | undefined> {
    const db = await openSyncDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => {
            resolve(req.result as SyncRecord | undefined);
        };
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
    });
}

async function putRecord(key: string, record: SyncRecord): Promise<void> {
    const db = await openSyncDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const req = tx.objectStore(STORE_NAME).put(record, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
    });
}

async function getRecordsByUUID(uuid: string): Promise<Map<string, SyncRecord>> {
    const db = await openSyncDB();
    return new Promise((resolve, reject) => {
        const result = new Map<string, SyncRecord>();
        const prefix = `${uuid}::`;
        const range = IDBKeyRange.bound(prefix, prefix + "\uffff");
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).openCursor(range);
        req.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (cursor) {
                const path = (cursor.key as string).slice(prefix.length);
                result.set(path, cursor.value as SyncRecord);
                cursor.continue();
            } else {
                resolve(result);
            }
        };
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
    });
}

// ── Tree helpers ─────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

type DirHandle = FileSystemDirectoryHandle & {
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
};

async function buildTreeNodes(dirHandle: DirHandle, prefix: string): Promise<TreeNode[]> {
    const nodes: TreeNode[] = [];
    for await (const [name, handle] of dirHandle.entries()) {
        if (name.startsWith(".")) continue; // skip hidden files/directories
        const relPath = prefix ? `${prefix}/${name}` : name;
        if (handle.kind === "file") {
            const file = await (handle as FileSystemFileHandle).getFile();
            if (file.size > MAX_FILE_SIZE) continue; // skip files >5 MB
            nodes.push({ name, relativePath: relPath, kind: "file", size: file.size, handle });
        } else {
            const children = await buildTreeNodes(handle as DirHandle, relPath);
            nodes.push({ name, relativePath: relPath, kind: "directory", handle, children });
        }
    }
    // Sort: directories first, then alphabetically
    nodes.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
    return nodes;
}

function getAllPaths(nodes: TreeNode[]): string[] {
    return nodes.flatMap((n) => [n.relativePath, ...getAllPaths(n.children ?? [])]);
}

function flattenVisible(
    nodes: TreeNode[],
    expanded: Set<string>,
    depth = 0,
): Array<{ node: TreeNode; depth: number }> {
    return nodes.flatMap((node) => {
        const rows: Array<{ node: TreeNode; depth: number }> = [{ node, depth }];
        if (node.kind === "directory" && expanded.has(node.relativePath)) {
            rows.push(...flattenVisible(node.children ?? [], expanded, depth + 1));
        }
        return rows;
    });
}

function addSuffix(filename: string, n: number): string {
    const dotIdx = filename.lastIndexOf(".");
    if (dotIdx <= 0) return `${filename} (${n})`;
    return `${filename.slice(0, dotIdx)} (${n})${filename.slice(dotIdx)}`;
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SyncDirectoryClient({ lang, parentId, labels }: Props) {
    const [rootHandle, setRootHandle] = useState<DirHandle | null>(null);
    const [rootName, setRootName] = useState<string>("");
    const [tree, setTree] = useState<TreeNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [rootUUID, setRootUUID] = useState<string>("");
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [statuses, setStatuses] = useState<Map<string, UIStatus>>(new Map());
    const [syncing, setSyncing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // Keep a ref to rootHandle for use inside async sync closure
    const rootHandleRef = useRef<DirHandle | null>(null);
    const rootUUIDRef = useRef<string>("");

    const allPaths = useMemo(() => getAllPaths(tree), [tree]);
    const visibleRows = useMemo(() => flattenVisible(tree, expanded), [tree, expanded]);

    const allChecked = allPaths.length > 0 && allPaths.every((p) => checked.has(p));
    const someChecked = !allChecked && allPaths.some((p) => checked.has(p));

    // ── Directory loading ─────────────────────────────────────────────────

    async function loadDirectory(handle: DirHandle) {
        setLoading(true);
        try {
            const nodes = await buildTreeNodes(handle, "");

            // Read existing UUID from .calieo/dirinfo.json, or generate a new one
            let uuid = "";
            try {
                const calieoDir = await handle.getDirectoryHandle(".calieo");
                const fileHandle = await calieoDir.getFileHandle("dirinfo.json");
                const file = await fileHandle.getFile();
                const data = JSON.parse(await file.text()) as Record<string, unknown>;
                if (typeof data.uuid === "string") uuid = data.uuid;
            } catch {
                // .calieo/dirinfo.json doesn't exist yet — will be created on first sync
            }
            if (!uuid) uuid = crypto.randomUUID();

            // Load any previously saved sync statuses from IndexedDB
            const saved = await getRecordsByUUID(uuid);
            const statusMap = new Map<string, UIStatus>();
            for (const [path, record] of saved) {
                statusMap.set(path, {
                    status: record.status,
                    serverId: record.serverId,
                    errorMessage: record.errorMessage,
                });
            }

            const paths = getAllPaths(nodes);
            rootHandleRef.current = handle;
            rootUUIDRef.current = uuid;
            setRootHandle(handle);
            setRootName(handle.name);
            setTree(nodes);
            setRootUUID(uuid);
            setStatuses(statusMap);
            setChecked(new Set(paths));
            setExpanded(new Set());
        } catch (err) {
            console.error("Failed to load directory:", err);
        } finally {
            setLoading(false);
        }
    }

    async function handlePickDirectory() {
        if (!("showDirectoryPicker" in window)) {
            alert("Your browser does not support the File System Access API. Please use a modern Chromium-based browser.");
            return;
        }
        try {
            const handle = await (
                window as Window & { showDirectoryPicker: (opts?: { mode?: string }) => Promise<DirHandle> }
            ).showDirectoryPicker({ mode: "readwrite" });
            await loadDirectory(handle);
        } catch (err) {
            if ((err as DOMException).name !== "AbortError") console.error(err);
        }
    }

    async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
        e.preventDefault();
        setIsDragging(false);
        const items = Array.from(e.dataTransfer.items);
        for (const item of items) {
            if (item.kind !== "file") continue;
            try {
                const handle = await (
                    item as DataTransferItem & { getAsFileSystemHandle: () => Promise<FileSystemHandle> }
                ).getAsFileSystemHandle();
                if (!handle || handle.kind !== "directory") continue;
                const dirHandle = handle as DirHandle;
                try {
                    await (dirHandle as DirHandle & { requestPermission: (opts: { mode: string }) => Promise<string> })
                        .requestPermission({ mode: "readwrite" });
                } catch {
                    // Read-only access from DnD is still usable for reading the tree
                }
                await loadDirectory(dirHandle);
                break;
            } catch {
                // Ignore items that don't support getAsFileSystemHandle
            }
        }
    }

    // ── Checkbox logic ────────────────────────────────────────────────────

    function toggleCheck(node: TreeNode, isChecked: boolean) {
        const paths = [node.relativePath, ...getAllPaths(node.children ?? [])];
        setChecked((prev) => {
            const next = new Set(prev);
            if (isChecked) paths.forEach((p) => next.add(p));
            else paths.forEach((p) => next.delete(p));
            return next;
        });
    }

    function handleHeaderCheck() {
        if (allChecked) {
            setChecked(new Set());
        } else {
            setChecked(new Set(allPaths));
        }
    }

    function toggleExpand(path: string) {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    }

    // ── Status helpers ────────────────────────────────────────────────────

    function updateStatus(path: string, status: UIStatus) {
        setStatuses((prev) => new Map(prev).set(path, status));
    }

    // ── Sync logic ────────────────────────────────────────────────────────

    async function lookupDir(name: string, pid: string | null): Promise<string | null> {
        const params = new URLSearchParams({ name });
        if (pid) params.set("parentId", pid);
        try {
            const res = await fetch(`/${lang}/console/lookup?${params}`);
            if (res.ok) return ((await res.json()) as { id: string }).id;
        } catch {
            // ignore network errors
        }
        return null;
    }

    async function syncNodes(
        nodes: TreeNode[],
        serverParentId: string | null,
        uuid: string,
        checkedSnapshot: Set<string>,
    ): Promise<void> {
        for (const node of nodes) {
            if (!checkedSnapshot.has(node.relativePath)) continue;
            const key = `${uuid}::${node.relativePath}`;

            if (node.kind === "directory") {
                // Check if already synced (has a valid server ID)
                const saved = await getRecord(key);
                let serverId: string | null =
                    saved?.status === "success" && saved.serverId ? saved.serverId : null;

                if (!serverId) {
                    updateStatus(node.relativePath, { status: "syncing" });
                    const res = await fetch(`/${lang}/console/mkdir`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: node.name, parentId: serverParentId }),
                    });
                    if (res.ok) {
                        const { id } = (await res.json()) as { id: string };
                        serverId = id;
                        await putRecord(key, { status: "success", serverId: id, timestamp: Date.now() });
                        updateStatus(node.relativePath, { status: "success", serverId: id });
                    } else if (res.status === 409) {
                        // Directory already exists — look up its ID to use as parent
                        serverId = await lookupDir(node.name, serverParentId);
                        if (serverId) {
                            await putRecord(key, { status: "success", serverId, timestamp: Date.now() });
                            updateStatus(node.relativePath, { status: "success", serverId });
                        } else {
                            updateStatus(node.relativePath, {
                                status: "error",
                                errorMessage: "Directory conflict, could not resolve",
                            });
                        }
                    } else {
                        const data = (await res.json().catch(() => ({}))) as { error?: string };
                        const msg = data.error ?? "Failed to create folder";
                        await putRecord(key, { status: "error", errorMessage: msg, timestamp: Date.now() });
                        updateStatus(node.relativePath, { status: "error", errorMessage: msg });
                    }
                } else {
                    // Already synced — just show success state
                    updateStatus(node.relativePath, { status: "success", serverId });
                }

                // Recurse into children regardless (serverId may be null if dir failed)
                await syncNodes(node.children ?? [], serverId, uuid, checkedSnapshot);
            } else {
                // File
                const saved = await getRecord(key);
                if (saved?.status === "success") {
                    // Already successfully uploaded — skip
                    updateStatus(node.relativePath, { status: "success", serverId: saved.serverId });
                    continue;
                }

                updateStatus(node.relativePath, { status: "syncing" });
                const fileObj = await (node.handle as FileSystemFileHandle).getFile();
                let uploaded = false;

                for (let attempt = 0; attempt <= 99; attempt++) {
                    const uploadName = attempt === 0 ? node.name : addSuffix(node.name, attempt);
                    const fd = new FormData();
                    fd.append("file", new File([fileObj], uploadName, { type: fileObj.type }));
                    if (serverParentId) fd.append("parentId", serverParentId);

                    const res = await fetch(`/${lang}/console/upload`, { method: "POST", body: fd });
                    if (res.ok) {
                        const { id } = (await res.json()) as { id: string };
                        await putRecord(key, { status: "success", serverId: id, timestamp: Date.now() });
                        updateStatus(node.relativePath, { status: "success", serverId: id });
                        uploaded = true;
                        break;
                    } else if (res.status === 409) {
                        // Name conflict — try again with a numeric suffix
                        continue;
                    } else {
                        const data = (await res.json().catch(() => ({}))) as { error?: string };
                        const msg = data.error ?? "Upload failed";
                        await putRecord(key, { status: "error", errorMessage: msg, timestamp: Date.now() });
                        updateStatus(node.relativePath, { status: "error", errorMessage: msg });
                        break;
                    }
                }

                if (!uploaded) {
                    const msg = "Filename conflict: max retries exceeded";
                    await putRecord(key, { status: "error", errorMessage: msg, timestamp: Date.now() });
                    updateStatus(node.relativePath, { status: "error", errorMessage: msg });
                }
            }
        }
    }

    async function handleStartSync() {
        if (!rootHandleRef.current || syncing) return;
        const handle = rootHandleRef.current;
        const uuid = rootUUIDRef.current;
        // Capture checked set at sync start so mid-sync UI changes don't affect the run
        const checkedSnapshot = new Set(checked);

        setSyncing(true);
        try {
            // Write .calieo/dirinfo.json with the UUID (requires readwrite permission)
            try {
                const calieoDir = await handle.getDirectoryHandle(".calieo", { create: true });
                const fileHandle = await calieoDir.getFileHandle("dirinfo.json", { create: true });
                const writable = await (
                    fileHandle as FileSystemFileHandle & {
                        createWritable: () => Promise<FileSystemWritableFileStream>;
                    }
                ).createWritable();
                await writable.write(JSON.stringify({ uuid }));
                await writable.close();
            } catch {
                // Write permission unavailable (e.g., drag-and-drop without readwrite grant)
                // Sync continues but UUID won't be persisted to disk
            }

            await syncNodes(tree, parentId, uuid, checkedSnapshot);
        } finally {
            setSyncing(false);
        }
    }

    // ── Render ────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center h-48 text-gray-500">
                <span className="animate-pulse">Loading…</span>
            </div>
        );
    }

    if (!rootHandle) {
        return (
            <div
                className={`border-2 border-dashed rounded-xl p-16 flex flex-col items-center justify-center gap-4 text-center transition-colors cursor-pointer ${
                    isDragging ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"
                }`}
                onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={handlePickDirectory}
            >
                <div className="text-5xl select-none">📂</div>
                <p className="text-gray-500 text-sm max-w-xs">{labels.syncHint}</p>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        handlePickDirectory();
                    }}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                >
                    {labels.selectFolder}
                </button>
            </div>
        );
    }

    const checkedCount = allPaths.filter((p) => checked.has(p)).length;

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-gray-700 truncate">
                        📂 <span className="font-semibold">{rootName}</span>
                    </span>
                    <span className="text-xs text-gray-400 hidden sm:inline">—</span>
                    <span className="text-xs text-gray-400 hidden sm:inline">{labels.syncFilterNote}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        type="button"
                        onClick={handlePickDirectory}
                        className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-medium rounded-md hover:bg-gray-50"
                    >
                        {labels.selectFolder}
                    </button>
                    <button
                        type="button"
                        onClick={handleStartSync}
                        disabled={syncing || checkedCount === 0}
                        className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {syncing ? labels.syncing : labels.startSync}
                    </button>
                </div>
            </div>

            <p className="text-xs text-gray-400 sm:hidden">{labels.syncFilterNote}</p>

            {/* Tree table */}
            <div className="border border-gray-200 rounded-lg overflow-auto">
                <table className="w-full text-sm min-w-[480px]">
                    <thead className="bg-gray-50 text-left sticky top-0 z-10">
                        <tr>
                            <th className="px-3 py-3 w-10">
                                <input
                                    type="checkbox"
                                    checked={allChecked}
                                    ref={(el) => {
                                        if (el) el.indeterminate = someChecked;
                                    }}
                                    onChange={handleHeaderCheck}
                                    className="rounded cursor-pointer"
                                    aria-label="Select all"
                                />
                            </th>
                            <th className="px-3 py-3 font-medium text-gray-700">{labels.syncName}</th>
                            <th className="px-3 py-3 font-medium text-gray-700 w-24 text-right">{labels.syncSize}</th>
                            <th className="px-3 py-3 font-medium text-gray-700 w-40">{labels.syncStatus}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {visibleRows.map(({ node, depth }) => {
                            const status = statuses.get(node.relativePath);
                            const isChecked = checked.has(node.relativePath);
                            const isExpanded = expanded.has(node.relativePath);

                            return (
                                <tr key={node.relativePath} className="hover:bg-gray-50">
                                    <td className="px-3 py-2">
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={(e) => toggleCheck(node, e.target.checked)}
                                            className="rounded cursor-pointer"
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <div
                                            className="flex items-center gap-1.5"
                                            style={{ paddingLeft: `${depth * 20}px` }}
                                        >
                                            {node.kind === "directory" ? (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleExpand(node.relativePath)}
                                                    className="text-gray-400 hover:text-gray-700 w-4 flex-shrink-0 text-xs leading-none"
                                                    aria-label={isExpanded ? "Collapse" : "Expand"}
                                                >
                                                    {isExpanded ? "▼" : "▶"}
                                                </button>
                                            ) : (
                                                <span className="w-4 flex-shrink-0" />
                                            )}
                                            <span className="flex-shrink-0">
                                                {node.kind === "directory" ? "📁" : "📄"}
                                            </span>
                                            <span className="text-gray-800 truncate">{node.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-gray-500 text-xs text-right">
                                        {node.kind === "file" && node.size !== undefined
                                            ? formatSize(node.size)
                                            : "—"}
                                    </td>
                                    <td className="px-3 py-2">
                                        <StatusCell status={status} />
                                    </td>
                                </tr>
                            );
                        })}
                        {visibleRows.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                                    No items to display
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── StatusCell ────────────────────────────────────────────────────────────────

function StatusCell({ status }: { status: UIStatus | undefined }) {
    if (!status || status.status === "pending") {
        return <span className="text-gray-300 text-xs">—</span>;
    }
    if (status.status === "syncing") {
        return (
            <span className="inline-flex items-center gap-1 text-blue-500 text-xs">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                </svg>
            </span>
        );
    }
    if (status.status === "success") {
        return (
            <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                        clipRule="evenodd"
                    />
                </svg>
                OK
            </span>
        );
    }
    // error
    return (
        <span
            className="inline-flex items-start gap-1 text-red-500 text-xs"
            title={status.errorMessage}
        >
            <svg className="h-4 w-4 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                    clipRule="evenodd"
                />
            </svg>
            <span className="truncate max-w-[120px]">{status.errorMessage ?? "Error"}</span>
        </span>
    );
}
