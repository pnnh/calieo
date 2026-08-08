import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db/index";
import { files, createId } from "@/db/schema";
import { getStorage } from "@/lib/storage";
import { and, eq, isNull } from "drizzle-orm";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB per file
const MAX_FILES_PER_BATCH = 20;
const MAX_BATCH_TOTAL_SIZE = 300 * 1024 * 1024; // 300 MB per batch

type BatchUploadResultItem = {
    originalFilename: string;
    status: "created" | "renamed" | "failed";
    fileId?: string;
    finalFilename?: string;
    error?: string;
};

function splitExtension(filename: string): { base: string; ext: string } {
    const dotIndex = filename.lastIndexOf(".");
    if (dotIndex <= 0) return { base: filename, ext: "" };
    return { base: filename.slice(0, dotIndex), ext: filename.slice(dotIndex) };
}

/** Generates a filename that isn't in `takenNames`, preserving the extension. */
function resolveUniqueFilename(originalFilename: string, takenNames: Set<string>): string {
    if (!takenNames.has(originalFilename)) return originalFilename;

    const { base, ext } = splitExtension(originalFilename);
    let candidate: string;
    do {
        const suffix = randomUUID().replace(/-/g, "").slice(0, 8);
        candidate = `${base}-${suffix}${ext}`;
    } while (takenNames.has(candidate));

    return candidate;
}

export async function POST(req: NextRequest) {
    const user = await getCurrentUser();
    const formData = await req.formData();
    const fileEntries = formData.getAll("file").filter((entry): entry is File => entry instanceof File);

    if (fileEntries.length === 0) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (fileEntries.length > MAX_FILES_PER_BATCH) {
        return NextResponse.json(
            { error: `Too many files (max ${MAX_FILES_PER_BATCH} per batch)` },
            { status: 400 }
        );
    }

    const totalSize = fileEntries.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_BATCH_TOTAL_SIZE) {
        return NextResponse.json({ error: "Batch total size exceeds 300 MB" }, { status: 400 });
    }

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

    const existingSiblings = await db
        .select({ filename: files.filename })
        .from(files)
        .where(
            and(
                eq(files.userId, user.id),
                parentId ? eq(files.parentId, parentId) : isNull(files.parentId),
            )
        );
    const takenNames = new Set(existingSiblings.map((row) => row.filename));

    const results: BatchUploadResultItem[] = [];

    for (const file of fileEntries) {
        if (file.size > MAX_FILE_SIZE) {
            results.push({
                originalFilename: file.name,
                status: "failed",
                error: "File is too large (max 20 MB).",
            });
            continue;
        }

        const finalFilename = resolveUniqueFilename(file.name, takenNames);
        const id = createId();
        const buffer = Buffer.from(await file.arrayBuffer());

        try {
            await storage.save(id, finalFilename, buffer);

            await db.insert(files).values({
                id,
                userId: user.id,
                parentId,
                title: finalFilename.replace(/\.[^.]+$/, ""),
                filename: finalFilename,
                mimeType: file.type || "application/octet-stream",
                size: file.size,
            });

            takenNames.add(finalFilename);

            const result: BatchUploadResultItem = {
                originalFilename: file.name,
                status: finalFilename === file.name ? "created" : "renamed",
                fileId: id,
            };
            if (finalFilename !== file.name) result.finalFilename = finalFilename;
            results.push(result);
        } catch (error) {
            await storage.delete(id, finalFilename).catch(() => undefined);

            const message =
                error instanceof Error && error.message.includes("UNIQUE constraint failed: files.parent_id, files.filename")
                    ? "A file or folder with that name already exists in this folder."
                    : "Upload failed. Please try again.";
            results.push({ originalFilename: file.name, status: "failed", error: message });
        }
    }

    return NextResponse.json({ results }, { status: 201 });
}

