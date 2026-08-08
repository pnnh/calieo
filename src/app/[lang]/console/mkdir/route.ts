import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db/index";
import { files, createId } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export const runtime = "nodejs";

const VALID_NAME = /^[^\\/:*?"<>|]+$/;

export async function POST(req: NextRequest) {
    const user = await getCurrentUser();

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const parentId = typeof body.parentId === "string" && body.parentId ? body.parentId : null;

    if (!name) {
        return NextResponse.json({ error: "Folder name cannot be empty." }, { status: 400 });
    }
    if (!VALID_NAME.test(name)) {
        return NextResponse.json({ error: "Folder name contains invalid characters." }, { status: 400 });
    }

    // If parentId given, verify it belongs to this user and is a directory
    if (parentId) {
        const db = getDb();
        const [parent] = await db
            .select()
            .from(files)
            .where(and(eq(files.id, parentId), eq(files.userId, user.id)))
            .limit(1);
        if (!parent || parent.mimeType !== "directory") {
            return NextResponse.json({ error: "Parent directory not found." }, { status: 404 });
        }
    }

    const db = getDb();
    const [conflict] = await db
        .select({ id: files.id })
        .from(files)
        .where(
            and(
                eq(files.userId, user.id),
                parentId ? eq(files.parentId, parentId) : isNull(files.parentId),
                eq(files.filename, name),
            )
        )
        .limit(1);

    if (conflict) {
        return NextResponse.json({ error: "A file or folder with that name already exists in this folder." }, { status: 409 });
    }

    const id = createId();
    const now = Date.now();
    try {
        await db.insert(files).values({
            id,
            userId: user.id,
            parentId,
            title: name,
            filename: name,
            mimeType: "directory",
            description: "",
            size: 0,
            isPublished: false,
            createdAt: now,
            updatedAt: now,
        });
    } catch (error) {
        if (error instanceof Error && error.message.includes("UNIQUE constraint failed: files.parent_id, files.filename")) {
            return NextResponse.json({ error: "A file or folder with that name already exists in this folder." }, { status: 409 });
        }

        throw error;
    }

    return NextResponse.json({ id }, { status: 201 });
}
