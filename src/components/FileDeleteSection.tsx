"use client";

import { useState } from "react";

type Props = {
    lang: string;
    fileId: string;
    redirectTo: string;
    labels: {
        deleteFile: string;
        deleteFileConfirm: string;
    };
};

export default function FileDeleteSection({ lang, fileId, redirectTo, labels }: Props) {
    async function handleDelete() {
        if (!confirm(labels.deleteFileConfirm)) return;
        const res = await fetch(`/${lang}/console/files/${fileId}/actions`, { method: "DELETE" });
        if (res.ok) {
            window.location.href = redirectTo;
        }
    }

    return (
        <div className="mt-12 pt-8 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-red-700 mb-2">{labels.deleteFile}</h3>
            <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700"
            >
                {labels.deleteFile}
            </button>
        </div>
    );
}
