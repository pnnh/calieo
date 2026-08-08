import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db/index";
import { files } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * GET /[lang]/console/lookup?name=<filename>&parentId=<id>
 * Returns the id and mimeType of an existing file/directory by name under a given parent.
 * Used by the sync feature to resolve directory IDs after a 409 conflict.
 */
export async function GET(req: NextRequest) {
    const user = await getCurrentUser();
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    const parentId = searchParams.get("parentId") || null;

    if (!name) {
        return NextResponse.json({ error: "Name required" }, { status: 400 });
    }

    const db = getDb();
    const [row] = await db
        .select({ id: files.id, mimeType: files.mimeType })
        .from(files)
        .where(
            and(
                eq(files.userId, user.id),
                parentId ? eq(files.parentId, parentId) : isNull(files.parentId),
                eq(files.filename, name),
            ),
        )
        .limit(1);

    if (!row) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ id: row.id, mimeType: row.mimeType });
}
