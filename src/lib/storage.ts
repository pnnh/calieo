export interface StorageAdapter {
  save(fileId: string, filename: string, data: Buffer): Promise<void>;
  read(fileId: string, filename: string): Promise<Buffer | null>;
  delete(fileId: string, filename: string): Promise<void>;
}

function assertSafeSegment(value: string, field: string): void {
  if (
    !value ||
    value === "." ||
    value === ".." ||
    value.includes("/") ||
    value.includes("\\")
  ) {
    throw new Error(`Invalid ${field}`);
  }
}

async function resolveStoragePath(storageRoot: string, fileId: string, filename: string) {
  assertSafeSegment(fileId, "fileId");
  assertSafeSegment(filename, "filename");

  const path = await import("node:path");
  return path.join(storageRoot, fileId, filename);
}

export class LocalStorageAdapter implements StorageAdapter {
  constructor(
    private readonly storageRoot = process.env.FILE_STORAGE_PATH || "./.data/uploads"
  ) {}

  async save(fileId: string, filename: string, data: Buffer): Promise<void> {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const filePath = await resolveStoragePath(this.storageRoot, fileId, filename);

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
  }

  async read(fileId: string, filename: string): Promise<Buffer | null> {
    const fs = await import("node:fs/promises");
    const filePath = await resolveStoragePath(this.storageRoot, fileId, filename);

    try {
      return await fs.readFile(filePath);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return null;
      }

      throw error;
    }
  }

  async delete(fileId: string, filename: string): Promise<void> {
    const fs = await import("node:fs/promises");
    const filePath = await resolveStoragePath(this.storageRoot, fileId, filename);

    try {
      await fs.rm(filePath);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return;
      }

      throw error;
    }
  }
}

let storageInstance: StorageAdapter | undefined;

export function getStorage(): StorageAdapter {
  if (!storageInstance) {
    storageInstance = new LocalStorageAdapter();
  }
  return storageInstance;
}
