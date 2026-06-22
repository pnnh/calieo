import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db/index";
import { files, createId } from "@/db/schema";
import { and, eq } from "drizzle-orm";

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
    const id = createId();
    const now = Date.now();
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

    return NextResponse.json({ id }, { status: 201 });
}
