"use client";

import { useState, useRef } from "react";

type Props = {
    channelId: string;
    channelName: string;
    labels: { uploadAvatar: string; avatarHint: string };
};

export default function ChannelAvatarUpload({ channelId, channelName, labels }: Props) {
    const [preview, setPreview] = useState<string | null>(null);
    const [avatarError, setAvatarError] = useState(false);
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
            setAvatarError(false);
        }
        setUploading(false);
    }

    const initial = channelName.charAt(0).toUpperCase();

    return (
        <div className="flex items-center gap-4">
            {preview ? (
                <img src={preview} alt={channelName} className="w-12 h-12 rounded-full object-cover" />
            ) : avatarError ? (
                <span className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-200 text-gray-600 font-medium text-lg">
                    {initial}
                </span>
            ) : (
                <img
                    src={`/api/channel/avatar/${channelId}`}
                    alt={channelName}
                    className="w-12 h-12 rounded-full object-cover bg-gray-100"
                    onError={() => setAvatarError(true)}
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
