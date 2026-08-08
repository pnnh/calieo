import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db/index";
import { channels, files, channelFiles } from "@/db/schema";
import { and, count, eq } from "drizzle-orm";

export const runtime = "nodejs";

type Props = { params: Promise<{ lang: string; channelId: string }> };

export async function DELETE(_req: NextRequest, { params }: Props) {
    const { channelId } = await params;

    if (!channelId || !/^[a-zA-Z0-9_-]+$/.test(channelId)) {
        return NextResponse.json({ error: "Invalid channel ID" }, { status: 400 });
    }

    const user = await getCurrentUser();
    const db = getDb();

    const [channel] = await db
        .select()
        .from(channels)
        .where(and(eq(channels.id, channelId), eq(channels.userId, user.id)))
        .limit(1);

    if (!channel) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [{ cnt }] = await db
        .select({ cnt: count() })
        .from(channelFiles)
        .innerJoin(files, eq(channelFiles.fileId, files.id))
        .where(and(eq(channelFiles.channelId, channelId), eq(files.isPublished, true)));

    if (cnt > 0) {
        return NextResponse.json({ error: "Channel has published files" }, { status: 409 });
    }

    await db.delete(channels).where(and(eq(channels.id, channelId), eq(channels.userId, user.id)));

    return new NextResponse(null, { status: 204 });
}
