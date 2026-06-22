import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db/index";
import { files } from "@/db/schema";
import { and, eq } from "drizzle-orm";
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

    if ("title" in body && typeof body.title === "string") {
        updates.title = body.title.trim();
    }
    if ("description" in body && typeof body.description === "string") {
        updates.description = body.description;
    }
    if ("channelId" in body) {
        updates.channelId = body.channelId === null ? null : String(body.channelId);
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
