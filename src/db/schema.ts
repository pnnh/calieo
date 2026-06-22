import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import bs58 from "bs58";
import { uuidv7 } from "uuidv7";

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(hex.length / 2);

  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }

  return bytes;
}

export function encodeUuidToBase58(uuid: string): string {
  return bs58.encode(uuidToBytes(uuid));
}

export function createId(): string {
  return encodeUuidToBase58(uuidv7());
}

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(createId),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  nickname: text("nickname"),
  bio: text("bio"),
  createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
});

export const channels = sqliteTable("channels", {
  id: text("id").primaryKey().$defaultFn(createId),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
});

export const files = sqliteTable("files", {
  id: text("id").primaryKey().$defaultFn(createId),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  isPublished: integer("is_published", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at").notNull().$defaultFn(() => Date.now()),
});

export const channelFiles = sqliteTable("channel_files", {
  channelId: text("channel_id")
    .notNull()
    .references(() => channels.id, { onDelete: "cascade" }),
  fileId: text("file_id")
    .notNull()
    .references(() => files.id, { onDelete: "cascade" }),
});

export const usersRelations = relations(users, ({ many }) => ({
  channels: many(channels),
  files: many(files),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  user: one(users, {
    fields: [channels.userId],
    references: [users.id],
  }),
  channelFiles: many(channelFiles),
}));

export const filesRelations = relations(files, ({ one, many }) => ({
  user: one(users, {
    fields: [files.userId],
    references: [users.id],
  }),
  channelFiles: many(channelFiles),
}));

export const channelFilesRelations = relations(channelFiles, ({ one }) => ({
  channel: one(channels, {
    fields: [channelFiles.channelId],
    references: [channels.id],
  }),
  file: one(files, {
    fields: [channelFiles.fileId],
    references: [files.id],
  }),
}));
