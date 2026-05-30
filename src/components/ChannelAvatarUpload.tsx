"use client";

import { useState, useRef } from "react";

type Props = {
    channelId: string;
    labels: { uploadAvatar: string; avatarHint: string };
};

export default function ChannelAvatarUpload({ channelId, labels }: Props) {
    const [preview, setPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/api/channel/avatar/${channelId}`, { method: "POST", body: form });
        if (res.ok) {
            setPreview(URL.createObjectURL(file));
        }
        setUploading(false);
    }

    return (
        <div className="flex items-center gap-4">
            {preview ? (
                <img src={preview} alt="" className="w-12 h-12 rounded-full object-cover" />
            ) : (
                <img
                    src={`/api/channel/avatar/${channelId}`}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover bg-gray-100"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
            )}
            <div>
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                    className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                >
                    {labels.uploadAvatar}
                </button>
                <p className="text-xs text-gray-500 mt-0.5">{labels.avatarHint}</p>
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleChange}
                    className="hidden"
                />
            </div>
        </div>
    );
}
