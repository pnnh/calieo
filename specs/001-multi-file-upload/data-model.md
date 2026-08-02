# Phase 1 数据模型：批量文件上传与同目录自动重命名

**功能**: [spec.md](./spec.md) | **日期**: 2026-08-02

## 持久化实体

### 文件（`files` 表，`src/db/schema.ts`）

本功能**不修改**现有 `files` 表结构，仅复用其字段与约束：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | text（主键） | 由 `createId()` 生成 |
| `userId` | text | 所属用户，外键关联 `users.id` |
| `parentId` | text（可空） | 所属目录的文件 ID；为空表示根目录 |
| `title` | text | 文件标题（默认取文件名去除扩展名） |
| `filename` | text | 实际文件名；**批量上传时若发生命名冲突，此处写入的是自动重命名后的最终文件名，而非用户选择的原始文件名** |
| `mimeType` | text | MIME 类型 |
| `size` | integer | 文件大小（字节） |
| `isPublished` | integer（布尔） | 是否发布，默认 `false` |
| `createdAt` / `updatedAt` | integer | 时间戳 |

**关键约束（不变）**：`uniqueIndex("files_parent_id_filename_unique").on(table.parentId, table.filename)` —— 同一 `parentId` 下 `filename` 唯一。本功能通过自动重命名规避该约束导致的插入失败，而不是修改或放宽约束本身。

**校验规则（新增/调整，均在应用层实现，非数据库层）**：

- 单文件大小 ≤ 20 MB（原 50 MB）。
- 单批次文件数量 ≤ 20 个。
- 单批次所有文件大小之和 ≤ 300 MB。
- 文件名与目标目录下已存在文件（或同批次内先处理的文件）冲突时，自动生成 `{原文件名（不含扩展名）}-{随机后缀}{扩展名}` 形式的新文件名，直至在目标目录下唯一。

无需新增数据库迁移文件。

## 非持久化实体（请求/响应 DTO）

### `BatchUploadRequest`（服务端解析自 `multipart/form-data`，非独立 TS 类型，仅描述结构）

| 字段 | 说明 |
|---|---|
| `file`（可重复） | 1-20 个文件条目，通过 `formData.getAll("file")` 读取 |
| `parentId`（可选） | 目标目录的文件 ID；省略或为空表示上传到根目录 |

### `BatchUploadResultItem`

批次处理完成后，服务端为每个原始文件条目返回一条结果，用于驱动 User Story 3 的结果展示：

| 字段 | 类型 | 说明 |
|---|---|---|
| `originalFilename` | string | 用户选择的原始文件名，用于前端展示与结果匹配 |
| `status` | `"created" \| "renamed" \| "failed"` | `created`：无冲突直接创建；`renamed`：因命名冲突自动重命名后创建；`failed`：处理失败（超限、存储错误等） |
| `fileId` | string（可空） | 成功（`created` 或 `renamed`）时对应新建文件记录的 `id` |
| `finalFilename` | string（可空） | 成功时实际写入的文件名；仅当 `status === "renamed"` 时与 `originalFilename` 不同 |
| `error` | string（可空） | `status === "failed"` 时的失败原因（如「文件大小超过 20 MB 限制」） |

### `BatchUploadResponse`

| 字段 | 类型 | 说明 |
|---|---|---|
| `results` | `BatchUploadResultItem[]` | 与请求中文件条目一一对应，顺序保持一致 |

批次级前置校验失败（数量超限 / 总大小超限 / 未选择文件 / 父目录无效或无权限）时，不返回 `BatchUploadResponse`，而是返回单一错误对象 `{ error: string }`，具体状态码与错误码见 [contracts/upload-api.md](./contracts/upload-api.md)。

## 状态转换

单个文件条目的处理状态是一次性求值，不存在多步状态机：

```text
待处理 → （命名不冲突）───────────────→ created
待处理 → （命名冲突，重命名后写入成功）→ renamed
待处理 → （超过 20MB / 存储写入失败 / 其他错误）→ failed
```

批次整体不设持久化状态；批次级前置校验（数量/总大小）失败时，整个请求在任何单文件处理开始前即被拒绝。
