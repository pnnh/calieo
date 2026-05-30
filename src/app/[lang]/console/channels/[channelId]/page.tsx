import { notFound, redirect } from "next/navigation";
import { isValidLang } from "@/lib/language";
import type { LangKey } from "@/lib/language";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db/index";
import { channels, createId } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ChannelAvatarUpload from "@/components/ChannelAvatarUpload";
import ChannelDeleteSection from "@/components/ChannelDeleteSection";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ lang: string; channelId: string }> };

export default async function ChannelEditorPage({ params }: Props) {
    const { lang, channelId } = await params;
    if (!isValidLang(lang)) notFound();
    const l = lang as LangKey;

    const user = await getCurrentUser();
    const db = getDb();
    const isNew = channelId === "new";

    let channel: { id: string; name: string; description: string | null; isPublic: boolean } | null = null;

    if (!isNew) {
        const [row] = await db
            .select()
            .from(channels)
            .where(and(eq(channels.id, channelId), eq(channels.userId, user.id)))
            .limit(1);
        if (!row) notFound();
        channel = row;
    }

    async function handleSave(formData: FormData) {
        "use server";

        const { getDb: getDatabase } = await import("@/db/index");
        const { channels, createId: makeId } = await import("@/db/schema");
        const { getCurrentUser: getUser } = await import("@/lib/auth");
        const { eq, and } = await import("drizzle-orm");

        const db2 = getDatabase();
        const user2 = await getUser();
        const name = ((formData.get("name") as string | null) ?? "").trim();
        const description = (formData.get("description") as string | null) ?? "";
        const isPublic = formData.get("isPublic") === "true";

        if (!name) throw new Error("Name is required");

        if (channelId === "new") {
            const id = makeId();
            await db2.insert(channels).values({
                id,
                userId: user2.id,
                name,
                description,
                isPublic,
            });
            const { redirect: redir } = await import("next/navigation");
            redir(`/${lang}/console/channels/${id}`);
        } else {
            await db2
                .update(channels)
                .set({ name, description, isPublic })
                .where(and(eq(channels.id, channelId), eq(channels.userId, user2.id)));
            const { redirect: redir } = await import("next/navigation");
            redir(`/${lang}/console/channels`);
        }
    }

    return (
        <>
            <SiteHeader lang={l} />
            <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-2xl font-bold text-gray-900 mb-8">
                    {isNew ? t(l, "newChannel") : t(l, "editChannel")}
                </h1>

                {!isNew && channel && (
                    <div className="mb-8">
                        <ChannelAvatarUpload
                            channelId={channel.id}
                            labels={{ uploadAvatar: t(l, "uploadAvatar"), avatarHint: t(l, "avatarHint") }}
                        />
                    </div>
                )}

                <form action={handleSave} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t(l, "channelName")}</label>
                        <input
                            name="name"
                            type="text"
                            defaultValue={channel?.name ?? ""}
                            required
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t(l, "channelDescription")}</label>
                        <textarea
                            name="description"
                            rows={4}
                            defaultValue={channel?.description ?? ""}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="isPublic"
                            name="isPublic"
                            value="true"
                            defaultChecked={channel?.isPublic ?? false}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600"
                        />
                        <label htmlFor="isPublic" className="text-sm font-medium text-gray-700">{t(l, "makeChannelPublic")}</label>
                    </div>
                    <div className="flex gap-3">
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
                            {t(l, "save")}
                        </button>
                        <a href={`/${lang}/console/channels`} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50">
                            {t(l, "cancel")}
                        </a>
                    </div>
                </form>

                {!isNew && channel && (
                    <ChannelDeleteSection
                        channelId={channel.id}
                        redirectTo={`/${lang}/console/channels`}
                        labels={{
                            deleteChannel: t(l, "deleteChannel"),
                            deleteChannelConfirm: t(l, "deleteChannelConfirm"),
                            deleteChannelHasFiles: t(l, "deleteChannelHasFiles"),
                        }}
                    />
                )}
            </main>
            <SiteFooter lang={l} />
        </>
    );
}
