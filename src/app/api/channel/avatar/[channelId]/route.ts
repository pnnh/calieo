import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

const AVATAR_PREFIX = "__avatar__";

type Props = { params: Promise<{ channelId: string }> };

export async function GET(_req: NextRequest, { params }: Props) {
    const { channelId } = await params;

    if (!channelId || !/^[a-zA-Z0-9_-]+$/.test(channelId)) {
        return NextResponse.json({ error: "Invalid channel ID" }, { status: 400 });
    }

    const storage = getStorage();
    const data = await storage.read(AVATAR_PREFIX, `channel_${channelId}`);

    if (!data) {
        return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(new Uint8Array(data), {
        headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=3600",
        },
    });
}

