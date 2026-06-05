// Cloudflare Worker binding types for this project.
// Declared locally to avoid importing @cloudflare/workers-types, which conflicts
// with the DOM lib types already present in tsconfig.json.

interface R2Object {
  arrayBuffer(): Promise<ArrayBuffer>;
}

interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | ReadableStream
  ): Promise<void>;
  get(key: string): Promise<R2Object | null>;
  delete(key: string | string[]): Promise<void>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
  all<T = unknown>(): Promise<{ results: T[]; success: boolean }>;
  first<T = unknown>(colName?: string): Promise<T | null>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(
    statements: D1PreparedStatement[]
  ): Promise<{ results: T[] }[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

interface CloudflareEnv {
  DB: D1Database;
  FILES_BUCKET: R2Bucket;
}
