import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db/index";
import { files, channelFiles } from "@/db/schema";
import { and, eq, count, isNull } from "drizzle-orm";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

type Props = { params: Promise<{ lang: string; fileId: string }> };

export async function DELETE(_req: NextRequest, { params }: Props) {
    const { fileId } = await params;

    if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
        return NextResponse.json({ error: "Invalid file ID" }, { status: 400 });
    }

    const user = await getCurrentUser();
    const db = getDb();

    const [file] = await db
        .select()
        .from(files)
        .where(and(eq(files.id, fileId), eq(files.userId, user.id)))
        .limit(1);

    if (!file) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (file.mimeType === "directory") {
        const [{ childCount }] = await db
            .select({ childCount: count() })
            .from(files)
            .where(and(eq(files.parentId, fileId), eq(files.userId, user.id)));

        if (childCount > 0) {
            return NextResponse.json(
                { error: "Cannot delete: this directory has children. Delete them first." },
                { status: 409 },
            );
        }

        await db.delete(files).where(and(eq(files.id, fileId), eq(files.userId, user.id)));
        return new NextResponse(null, { status: 204 });
    }

    const storage = getStorage();
    await storage.delete(fileId, file.filename).catch(() => undefined);

    await db.delete(files).where(and(eq(files.id, fileId), eq(files.userId, user.id)));

    return new NextResponse(null, { status: 204 });
}

export async function PATCH(req: NextRequest, { params }: Props) {
    const { fileId } = await params;

    if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
        return NextResponse.json({ error: "Invalid file ID" }, { status: 400 });
    }

    const user = await getCurrentUser();
    const db = getDb();

    const [file] = await db
        .select()
        .from(files)
        .where(and(eq(files.id, fileId), eq(files.userId, user.id)))
        .limit(1);

    if (!file) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;

    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if ("parentId" in body) {
        const rawParentId = body.parentId;
        const trimmedParentId = typeof rawParentId === "string" ? rawParentId.trim() : undefined;
        const newParentId = rawParentId === null ? null : trimmedParentId ? trimmedParentId : undefined;

        if (newParentId === undefined) {
            return NextResponse.json({ error: "Invalid parent ID" }, { status: 400 });
        }

        if (newParentId === file.parentId) {
            return NextResponse.json({ ok: true });
        }

        let cursorParentId = newParentId;
        while (cursorParentId) {
            const [cursor] = await db
                .select({ id: files.id, parentId: files.parentId, mimeType: files.mimeType })
                .from(files)
                .where(and(eq(files.id, cursorParentId), eq(files.userId, user.id)))
                .limit(1);

            if (!cursor || cursor.mimeType !== "directory") {
                return NextResponse.json({ error: "Parent directory not found" }, { status: 404 });
            }

            if (cursor.id === fileId) {
                return NextResponse.json({ error: "Cannot move a directory into itself or its descendants" }, { status: 400 });
            }

            cursorParentId = cursor.parentId;
        }

        const [conflict] = await db
            .select({ id: files.id })
            .from(files)
            .where(
                and(
                    eq(files.userId, user.id),
                    newParentId ? eq(files.parentId, newParentId) : isNull(files.parentId),
                    eq(files.filename, file.filename),
                ),
            )
            .limit(1);

        if (conflict) {
            return NextResponse.json({ error: "A file or folder with that name already exists in this folder." }, { status: 409 });
        }

        updates.parentId = newParentId;
    }

    if ("title" in body && typeof body.title === "string") {
        updates.title = body.title.trim();
    }
    if ("description" in body && typeof body.description === "string") {
        updates.description = body.description;
    }
    if ("channelId" in body) {
        const newChannelId = body.channelId === null ? null : String(body.channelId);
        if (newChannelId) {
            await db
                .insert(channelFiles)
                .values({ channelId: newChannelId, fileId })
                .onConflictDoUpdate({ target: channelFiles.fileId, set: { channelId: newChannelId } });
        } else {
            await db.delete(channelFiles).where(eq(channelFiles.fileId, fileId));
        }
    }
    if ("isPublished" in body && typeof body.isPublished === "boolean") {
        updates.isPublished = body.isPublished;
    }

    await db
        .update(files)
        .set(updates)
        .where(and(eq(files.id, fileId), eq(files.userId, user.id)));

    return NextResponse.json({ ok: true });
}
