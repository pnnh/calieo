import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";

import * as schema from "./schema";

type DbInstance = ReturnType<typeof drizzleSqlite>;

let sqliteDb: DbInstance | undefined;

function ensureLocalDbDirectory(dbPath: string): void {
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const directory = path.dirname(path.resolve(dbPath));

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

function getLocalDb(): DbInstance {
  if (!sqliteDb) {
    const dbPath = process.env.DB_PATH || "./.data/calieo.db";
    ensureLocalDbDirectory(dbPath);
    sqliteDb = drizzleSqlite({ connection: { source: dbPath }, schema });
  }

  return sqliteDb;
}

export function getDb(): DbInstance {
  try {
    const { env } = getCloudflareContext();
    if (env.DB) {
      return drizzleD1(env.DB, { schema }) as unknown as DbInstance;
    }
  } catch {
    // Not running inside a Cloudflare Worker — fall through to local SQLite.
  }

  return getLocalDb();
}
