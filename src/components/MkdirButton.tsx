"use client";

import { useState } from "react";

type Props = {
    lang: string;
    parentId: string | null;
    labels: {
        newDirectory: string;
        directoryName: string;
        directoryNamePlaceholder: string;
        createDirectory: string;
        directoryNameEmpty: string;
        directoryNameInvalid: string;
        cancel: string;
    };
};

const VALID_NAME = /^[^\\/:*?"<>|]+$/;

export default function MkdirButton({ lang, parentId, labels }: Props) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [creating, setCreating] = useState(false);

    async function handleCreate() {
        const trimmed = name.trim();
        if (!trimmed) { setError(labels.directoryNameEmpty); return; }
        if (!VALID_NAME.test(trimmed)) { setError(labels.directoryNameInvalid); return; }

        setCreating(true);
        setError("");
        try {
            const res = await fetch(`/${lang}/console/mkdir`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: trimmed, parentId }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.error ?? "Failed to create folder.");
                return;
            }
            // Refresh the current page to show the new directory
            window.location.reload();
        } catch {
            setError("Failed to create folder.");
        } finally {
            setCreating(false);
        }
    }

    function handleClose() {
        setOpen(false);
        setName("");
        setError("");
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
            >
                {labels.newDirectory}
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
                        <h2 className="text-base font-semibold text-gray-900">{labels.newDirectory}</h2>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {labels.directoryName}
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") handleClose(); }}
                                placeholder={labels.directoryNamePlaceholder}
                                autoFocus
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
                            >
                                {labels.cancel}
                            </button>
                            <button
                                type="button"
                                onClick={handleCreate}
                                disabled={creating}
                                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                            >
                                {creating ? "…" : labels.createDirectory}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
