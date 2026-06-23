import { notFound, redirect } from "next/navigation";
import { isValidLang } from "@/lib/language";
import type { LangKey } from "@/lib/language";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db/index";
import { channels, files, channelFiles, createId } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import FileDeleteSection from "@/components/FileDeleteSection";
import FileUploadForm from "@/components/FileUploadForm";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type Props = {
    params: Promise<{ lang: string; fileId: string }>;
    searchParams: Promise<{ parent?: string }>;
};

export default async function FileEditorPage({ params, searchParams }: Props) {
    const { lang, fileId } = await params;
    if (!isValidLang(lang)) notFound();
    const l = lang as LangKey;

    const user = await getCurrentUser();
    const db = getDb();
    const isNew = fileId === "new";

    if (isNew) {
        const { parent } = await searchParams;
        const parentId = parent ?? null;
        return (
            <>
                <SiteHeader lang={l} />
                <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <h1 className="text-2xl font-bold text-gray-900 mb-8">{t(l, "newFile")}</h1>
                    <FileUploadForm
                        lang={lang}
                        parentId={parentId}
                        labels={{
                            newFile: t(l, "newFile"),
                            fileTooLarge: t(l, "fileTooLarge"),
                            uploadError: t(l, "uploadError"),
                        }}
                    />
                </main>
                <SiteFooter lang={l} />
            </>
        );
    }

    const [existingFile] = await db
        .select()
        .from(files)
        .where(and(eq(files.id, fileId), eq(files.userId, user.id)))
        .limit(1);

    if (!existingFile) notFound();
    const isDirectory = existingFile.mimeType === "directory";

    // Look up the current channel association via channelFiles
    const [existingCf] = isDirectory
        ? []
        : await db
            .select({ channelId: channelFiles.channelId })
            .from(channelFiles)
            .where(eq(channelFiles.fileId, fileId))
            .limit(1);
    const currentChannelId = existingCf?.channelId ?? null;

    const userChannels = isDirectory
        ? []
        : await db
            .select()
            .from(channels)
            .where(eq(channels.userId, user.id));

    async function handleSave(formData: FormData) {
        "use server";

        const { getDb: getDatabase } = await import("@/db/index");
        const { files, channels, channelFiles } = await import("@/db/schema");
        const { getCurrentUser: getUser } = await import("@/lib/auth");
        const { eq, and } = await import("drizzle-orm");

        const db2 = getDatabase();
        const user2 = await getUser();
        const title = ((formData.get("title") as string | null) ?? "").trim();
        const description = (formData.get("description") as string | null) ?? "";
        const rawChannelId = isDirectory ? "" : ((formData.get("channelId") as string | null) ?? "");
        const isPublished = isDirectory ? false : formData.get("isPublished") === "true";
        const now = Date.now();

        if (!title) throw new Error("Title is required");

        const channelId = rawChannelId || null;
        if (!isDirectory && channelId) {
            const [ownedChannel] = await db2
                .select()
                .from(channels)
                .where(and(eq(channels.id, channelId), eq(channels.userId, user2.id)))
                .limit(1);
            if (!ownedChannel) throw new Error("Channel not found");
        }

        const updates: Record<string, string | number | boolean> = { title, description, updatedAt: now };
        if (!isDirectory) {
            updates.isPublished = isPublished;
        }

        await db2
            .update(files)
            .set(updates)
            .where(and(eq(files.id, fileId), eq(files.userId, user2.id)));

        // Upsert / delete the channelFiles association
        if (!isDirectory && channelId) {
            await db2
                .insert(channelFiles)
                .values({ channelId, fileId })
                .onConflictDoUpdate({ target: channelFiles.fileId, set: { channelId } });
        } else {
            await db2.delete(channelFiles).where(eq(channelFiles.fileId, fileId));
        }

        const { redirect: redir } = await import("next/navigation");
        redir(`/${lang}/console/files`);
    }

    return (
        <>
            <SiteHeader lang={l} />
            <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-2xl font-bold text-gray-900 mb-8">{t(l, "editFile")}</h1>

                <div className="mb-4 text-sm text-gray-500">
                    {existingFile.filename} · {existingFile.mimeType} · {(existingFile.size / 1024).toFixed(1)} KB
                </div>

                <form action={handleSave} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t(l, "fileTitle")}</label>
                        <input
                            name="title"
                            type="text"
                            defaultValue={existingFile.title}
                            required
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t(l, "fileDescription")}</label>
                        <textarea
                            name="description"
                            rows={8}
                            defaultValue={existingFile.description}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    {!isDirectory && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t(l, "fileChannel")}</label>
                                <select
                                    name="channelId"
                                    defaultValue={currentChannelId ?? ""}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">{t(l, "noChannel")}</option>
                                    {userChannels.map((ch) => (
                                        <option key={ch.id} value={ch.id}>
                                            {ch.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="isPublished"
                                    name="isPublished"
                                    value="true"
                                    defaultChecked={existingFile.isPublished}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                                />
                                <label htmlFor="isPublished" className="text-sm font-medium text-gray-700">{t(l, "publishFile")}</label>
                            </div>
                        </>
                    )}
                    <div className="flex gap-3">
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
                            {t(l, "save")}
                        </button>
                        <a href={`/${lang}/console/files`} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50">
                            {t(l, "cancel")}
                        </a>
                    </div>
                </form>

                <FileDeleteSection
                    lang={lang}
                    fileId={fileId}
                    redirectTo={`/${lang}/console/files`}
                    labels={{
                        deleteFile: t(l, "deleteFile"),
                        deleteFileConfirm: t(l, "deleteFileConfirm"),
                        deleteDirectoryHasChildren: t(l, "deleteDirectoryHasChildren"),
                    }}
                />
            </main>
            <SiteFooter lang={l} />
        </>
    );
}
