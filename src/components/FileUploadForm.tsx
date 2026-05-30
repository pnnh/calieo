"use client";

import { useState, useRef } from "react";

type Props = {
    lang: string;
    labels: { newFile: string; fileTooLarge: string; uploadError: string };
};

export default function FileUploadForm({ lang, labels }: Props) {
    const [error, setError] = useState("");
    const [uploading, setUploading] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");

        const form = formRef.current;
        if (!form) return;

        const fileInput = form.querySelector<HTMLInputElement>('input[type="file"]');
        const file = fileInput?.files?.[0];
        if (!file) return;

        // Client-side size check (50 MB)
        if (file.size > 50 * 1024 * 1024) {
            setError(labels.fileTooLarge);
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/upload", { method: "POST", body: formData });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.error ?? labels.uploadError);
                return;
            }

            const { id } = await res.json();
            window.location.href = `/${lang}/console/files/${id}`;
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
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Max 50 MB</p>
            </div>
            <button
                type="submit"
                disabled={uploading}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
                {uploading ? "…" : labels.newFile}
            </button>
        </form>
    );
}
