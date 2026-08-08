import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db/index";
import { files } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * GET /[lang]/console/files-children?parentId=<id>
 * Returns the direct children of a directory, sorted dirs-first then by updatedAt desc.
 * Used by the tree table client component for lazy expansion.
 */
export async function GET(req: NextRequest) {
    const user = await getCurrentUser();
    const { searchParams } = new URL(req.url);
    const parentId = searchParams.get("parentId");

    if (!parentId) {
        return NextResponse.json({ error: "parentId required" }, { status: 400 });
    }

    const db = getDb();

    // Verify the parent directory exists and belongs to the user
    const [parent] = await db
        .select({ id: files.id })
        .from(files)
        .where(
            and(
                eq(files.id, parentId),
                eq(files.userId, user.id),
                eq(files.mimeType, "directory"),
            ),
        )
        .limit(1);

    if (!parent) {
        return NextResponse.json({ error: "Directory not found" }, { status: 404 });
    }

    const rows = await db
        .select({
            id: files.id,
            title: files.title,
            mimeType: files.mimeType,
            size: files.size,
            isPublished: files.isPublished,
            updatedAt: files.updatedAt,
        })
        .from(files)
        .where(and(eq(files.userId, user.id), eq(files.parentId, parentId)))
        .orderBy(desc(files.updatedAt));

    const dirs = rows.filter((r) => r.mimeType === "directory");
    const nonDirs = rows.filter((r) => r.mimeType !== "directory");

    return NextResponse.json({ files: [...dirs, ...nonDirs] });
}
