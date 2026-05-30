"use client";

import { useState } from "react";

type Props = {
    channelId: string;
    redirectTo: string;
    labels: {
        deleteChannel: string;
        deleteChannelConfirm: string;
        deleteChannelHasFiles: string;
    };
};

export default function ChannelDeleteSection({ channelId, redirectTo, labels }: Props) {
    const [error, setError] = useState("");

    async function handleDelete() {
        if (!confirm(labels.deleteChannelConfirm)) return;
        setError("");
        const res = await fetch(`/api/channels/${channelId}`, { method: "DELETE" });
        if (res.ok) {
            window.location.href = redirectTo;
        } else {
            const data = await res.json().catch(() => ({}));
            setError(data.error ?? labels.deleteChannelHasFiles);
        }
    }

    return (
        <div className="mt-12 pt-8 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-red-700 mb-2">{labels.deleteChannel}</h3>
            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
            <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700"
            >
                {labels.deleteChannel}
            </button>
        </div>
    );
}
