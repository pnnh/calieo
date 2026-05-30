import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db/index";
import { files } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

type Props = { params: Promise<{ fileId: string }> };

export async function GET(_req: NextRequest, { params }: Props) {
    const { fileId } = await params;

    if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
        return NextResponse.json({ error: "Invalid file ID" }, { status: 400 });
    }

    const db = getDb();
    const [file] = await db
        .select()
        .from(files)
        .where(eq(files.id, fileId))
        .limit(1);

    if (!file) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const storage = getStorage();
    const data = await storage.read(fileId, file.filename);

    if (!data) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return new NextResponse(data, {
        headers: {
            "Content-Type": file.mimeType,
            "Content-Disposition": `attachment; filename="${encodeURIComponent(file.filename)}"`,
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    });
}
