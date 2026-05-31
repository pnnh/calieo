"use client";

import { useState, useRef } from "react";

type Props = {
    userId: string;
    name: string;
    email: string;
    nickname: string | null;
    bio: string | null;
    labels: {
        avatar: string;
        uploadAvatar: string;
        nickname: string;
        username: string;
        email: string;
        bio: string;
        saveProfile: string;
        profileSaved: string;
        avatarHint: string;
    };
};

export default function UserProfileClient({ userId, name, email, nickname, bio, labels }: Props) {
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [avatarError, setAvatarError] = useState(false);
    const [saved, setSaved] = useState(false);
    const [nicknameVal, setNicknameVal] = useState(nickname ?? "");
    const [bioVal, setBioVal] = useState(bio ?? "");
    const fileRef = useRef<HTMLInputElement>(null);

    async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/user/avatar", { method: "POST", body: form });
        if (res.ok) {
            setAvatarPreview(URL.createObjectURL(file));
            setAvatarError(false);
        }
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setSaved(false);
        await fetch("/api/user/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nickname: nicknameVal, bio: bioVal }),
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }

    return (
        <div className="space-y-8">
            {/* Avatar */}
            <div>
                <h2 className="text-sm font-medium text-gray-700 mb-2">{labels.avatar}</h2>
                <div className="flex items-center gap-4">
                    {avatarPreview ? (
                        <img src={avatarPreview} alt="" className="w-16 h-16 rounded-full object-cover" />
                    ) : avatarError ? (
                        <span className="flex items-center justify-center w-16 h-16 rounded-full bg-gray-200 text-gray-600 font-medium text-xl">
                            {name.charAt(0).toUpperCase()}
                        </span>
                    ) : (
                        <img
                            src={`/api/user/avatar/${userId}`}
                            alt=""
                            className="w-16 h-16 rounded-full object-cover bg-gray-100"
                            onError={() => setAvatarError(true)}
                        />
                    )}
                    <div>
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="text-sm text-blue-600 hover:underline"
                        >
                            {labels.uploadAvatar}
                        </button>
                        <p className="text-xs text-gray-500 mt-0.5">{labels.avatarHint}</p>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarChange}
                            className="hidden"
                        />
                    </div>
                </div>
            </div>

            {/* Profile form */}
            <form onSubmit={handleSave} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{labels.username}</label>
                    <input type="text" value={name} disabled className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-500" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{labels.email}</label>
                    <input type="text" value={email} disabled className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-500" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{labels.nickname}</label>
                    <input
                        type="text"
                        value={nicknameVal}
                        onChange={(e) => setNicknameVal(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{labels.bio}</label>
                    <textarea
                        rows={4}
                        value={bioVal}
                        onChange={(e) => setBioVal(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="flex items-center gap-3">
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
                        {labels.saveProfile}
                    </button>
                    {saved && <span className="text-sm text-green-600">{labels.profileSaved}</span>}
                </div>
            </form>
        </div>
    );
}
