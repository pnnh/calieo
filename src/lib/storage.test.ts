import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as os from "node:os";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { LocalStorageAdapter } from "@/lib/storage";

// ---------------------------------------------------------------------------
// assertSafeSegment is tested indirectly via LocalStorageAdapter public API
// ---------------------------------------------------------------------------

describe("LocalStorageAdapter — path safety validation", () => {
    const adapter = new LocalStorageAdapter("/tmp/test-storage-root");

    const invalidSegments = ["", ".", "..", "a/b", "a\\b", "/abs"];

    for (const bad of invalidSegments) {
        it(`save() rejects fileId "${bad}"`, async () => {
            await expect(
                adapter.save(bad, "file.txt", Buffer.from("x"))
            ).rejects.toThrow("Invalid");
        });

        it(`save() rejects filename "${bad}"`, async () => {
            await expect(
                adapter.save("valid-id", bad, Buffer.from("x"))
            ).rejects.toThrow("Invalid");
        });

        it(`read() rejects fileId "${bad}"`, async () => {
            await expect(adapter.read(bad, "file.txt")).rejects.toThrow("Invalid");
        });

        it(`read() rejects filename "${bad}"`, async () => {
            await expect(adapter.read("valid-id", bad)).rejects.toThrow("Invalid");
        });

        it(`delete() rejects fileId "${bad}"`, async () => {
            await expect(adapter.delete(bad, "file.txt")).rejects.toThrow("Invalid");
        });

        it(`delete() rejects filename "${bad}"`, async () => {
            await expect(adapter.delete("valid-id", bad)).rejects.toThrow("Invalid");
        });
    }
});

describe("LocalStorageAdapter — save / read / delete round-trip", () => {
    let tmpDir: string;
    let adapter: LocalStorageAdapter;

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "calieo-storage-test-"));
        adapter = new LocalStorageAdapter(tmpDir);
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it("saves a file and reads it back correctly", async () => {
        const data = Buffer.from("hello world");
        await adapter.save("file-001", "test.txt", data);
        const result = await adapter.read("file-001", "test.txt");
        expect(result).not.toBeNull();
        expect(result!.toString()).toBe("hello world");
    });

    it("read returns null for a non-existent file", async () => {
        const result = await adapter.read("no-such-id", "missing.txt");
        expect(result).toBeNull();
    });

    it("saves binary data and reads it back without corruption", async () => {
        const data = Buffer.from([0x00, 0xff, 0x80, 0x7f, 0x01]);
        await adapter.save("bin-001", "data.bin", data);
        const result = await adapter.read("bin-001", "data.bin");
        expect(result).toEqual(data);
    });

    it("delete removes an existing file", async () => {
        await adapter.save("del-001", "to-delete.txt", Buffer.from("bye"));
        await adapter.delete("del-001", "to-delete.txt");
        const result = await adapter.read("del-001", "to-delete.txt");
        expect(result).toBeNull();
    });

    it("delete is a no-op for a non-existent file (does not throw)", async () => {
        await expect(
            adapter.delete("no-such-id", "ghost.txt")
        ).resolves.toBeUndefined();
    });

    it("overwrites an existing file with new content", async () => {
        await adapter.save("ow-001", "file.txt", Buffer.from("first"));
        await adapter.save("ow-001", "file.txt", Buffer.from("second"));
        const result = await adapter.read("ow-001", "file.txt");
        expect(result!.toString()).toBe("second");
    });

    it("saves files with distinct ids independently", async () => {
        await adapter.save("id-a", "note.txt", Buffer.from("alpha"));
        await adapter.save("id-b", "note.txt", Buffer.from("beta"));
        expect((await adapter.read("id-a", "note.txt"))!.toString()).toBe("alpha");
        expect((await adapter.read("id-b", "note.txt"))!.toString()).toBe("beta");
    });
});
