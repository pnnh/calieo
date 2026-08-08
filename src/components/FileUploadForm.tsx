"use client";

import { useState, useRef } from "react";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB per file
const MAX_FILES_PER_BATCH = 20;
const MAX_BATCH_TOTAL_SIZE = 300 * 1024 * 1024; // 300 MB per batch

type UploadResultItem = {
    originalFilename: string;
    status: "created" | "renamed" | "failed";
    fileId?: string;
    finalFilename?: string;
    error?: string;
};

type Props = {
    lang: string;
    parentId?: string | null;
    labels: {
        newFile: string;
        fileTooLarge: string;
        uploadError: string;
        maxFilesExceeded: string;
        batchTooLarge: string;
        uploadResultCreated: string;
        uploadResultRenamed: string;
        uploadResultFailed: string;
    };
};

export default function FileUploadForm({ lang, parentId, labels }: Props) {
    const [error, setError] = useState("");
    const [results, setResults] = useState<UploadResultItem[] | null>(null);
    const [uploading, setUploading] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);

    function statusLabel(item: UploadResultItem): string {
        if (item.status === "created") return labels.uploadResultCreated;
        if (item.status === "renamed") return labels.uploadResultRenamed;
        return labels.uploadResultFailed;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setResults(null);

        const form = formRef.current;
        if (!form) return;

        const fileInput = form.querySelector<HTMLInputElement>('input[type="file"]');
        const selectedFiles = fileInput?.files ? Array.from(fileInput.files) : [];
        if (selectedFiles.length === 0) return;

        if (selectedFiles.length > MAX_FILES_PER_BATCH) {
            setError(labels.maxFilesExceeded);
            return;
        }

        const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
        if (totalSize > MAX_BATCH_TOTAL_SIZE) {
            setError(labels.batchTooLarge);
            return;
        }

        // Oversized files are rejected client-side (no upload attempt); the
        // remaining valid files are still submitted (continue-on-error).
        const validFiles = selectedFiles.filter((f) => f.size <= MAX_FILE_SIZE);
        const localResults: UploadResultItem[] = selectedFiles
            .filter((f) => f.size > MAX_FILE_SIZE)
            .map((f) => ({ originalFilename: f.name, status: "failed", error: labels.fileTooLarge }));

        if (validFiles.length === 0) {
            setResults(localResults);
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            validFiles.forEach((f) => formData.append("file", f));
            if (parentId) formData.append("parentId", parentId);

            const res = await fetch(`/${lang}/console/upload`, { method: "POST", body: formData });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.error ?? labels.uploadError);
                return;
            }

            const { results: serverResults } = (await res.json()) as { results: UploadResultItem[] };
            const allResults = [...localResults, ...serverResults];
            const hasFailure = allResults.some((r) => r.status === "failed");

            if (selectedFiles.length === 1 && !hasFailure) {
                window.location.href = `/${lang}/console/files/${serverResults[0].fileId}`;
                return;
            }

            if (!hasFailure) {
                // Whole batch succeeded — go back to the file list instead of showing a trivial results screen.
                window.location.href = parentId
                    ? `/${lang}/console/files?parent=${parentId}`
                    : `/${lang}/console/files`;
                return;
            }

            setResults(allResults);
        } catch {
            setError(labels.uploadError);
        } finally {
            setUploading(false);
        }
    }

    return (
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            {error && (
                <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
                    {error}
                </div>
            )}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    {labels.newFile}
                </label>
                <input
                    name="file"
                    type="file"
                    multiple
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Max 20 MB per file, up to 20 files, 300 MB total.</p>
            </div>
            <button
                type="submit"
                disabled={uploading}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
                {uploading ? "…" : labels.newFile}
            </button>
            {results && (
                <div className="space-y-2">
                    <ul className="text-sm divide-y divide-gray-200 border border-gray-200 rounded-md">
                        {results.map((item, i) => (
                            <li key={`${item.originalFilename}-${i}`} className="px-3 py-2 flex justify-between gap-4">
                                <span>{item.finalFilename ?? item.originalFilename}</span>
                                <span className={item.status === "failed" ? "text-red-700" : "text-gray-600"}>
                                    {item.status === "failed" ? (item.error ?? statusLabel(item)) : statusLabel(item)}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </form>
    );
}
