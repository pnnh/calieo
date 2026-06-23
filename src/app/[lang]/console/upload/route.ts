import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db/index";
import { files, createId } from "@/db/schema";
import { getStorage } from "@/lib/storage";
import { and, eq, isNull } from "drizzle-orm";

export const runtime = "nodejs";

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(req: NextRequest) {
    const user = await getCurrentUser();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: "File too large (max 50 MB)" }, { status: 400 });
    }

    const id = createId();
    const buffer = Buffer.from(await file.arrayBuffer());

    const storage = getStorage();
    const db = getDb();
    const parentId = (formData.get("parentId") as string | null) || null;

    if (parentId) {
        const [parent] = await db
            .select()
            .from(files)
            .where(and(eq(files.id, parentId), eq(files.userId, user.id)))
            .limit(1);

        if (!parent || parent.mimeType !== "directory") {
            return NextResponse.json({ error: "Parent directory not found." }, { status: 404 });
        }
    }

    const [conflict] = await db
        .select({ id: files.id })
        .from(files)
        .where(
            and(
                eq(files.userId, user.id),
                parentId ? eq(files.parentId, parentId) : isNull(files.parentId),
                eq(files.filename, file.name),
            )
        )
        .limit(1);

    if (conflict) {
        return NextResponse.json({ error: "A file or folder with that name already exists in this folder." }, { status: 409 });
    }

    await storage.save(id, file.name, buffer);

    try {
        await db.insert(files).values({
            id,
            userId: user.id,
            parentId,
            title: file.name.replace(/\.[^.]+$/, ""),
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
        });
    } catch (error) {
        await storage.delete(id, file.name).catch(() => undefined);

        if (error instanceof Error && error.message.includes("UNIQUE constraint failed: files.parent_id, files.filename")) {
            return NextResponse.json({ error: "A file or folder with that name already exists in this folder." }, { status: 409 });
        }

        throw error;
    }

    return NextResponse.json({ id }, { status: 201 });
}
