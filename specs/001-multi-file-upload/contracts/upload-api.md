# 接口契约：批量文件上传

**功能**: [../spec.md](../spec.md) | **日期**: 2026-08-02

## `POST /{lang}/console/upload`

复用现有单文件上传路由（`src/app/[lang]/console/upload/route.ts`），调整为同时支持单文件与批量文件上传。

### 鉴权

沿用现有逻辑：需已登录用户（`getCurrentUser()`），未登录按现有行为处理（不在本次变更范围内）。

### 请求

`Content-Type: multipart/form-data`

| 字段 | 是否必填 | 说明 |
|---|---|---|
| `file` | 是（1-20 个，可重复出现） | 待上传的文件条目 |
| `parentId` | 否 | 目标目录的文件 `id`；省略或空字符串表示上传到根目录 |

### 批次级前置校验（all-or-nothing，任一不满足则整体拒绝，不创建任何记录）

| 条件 | HTTP 状态码 | 响应体 `error` 示例 |
|---|---|---|
| 未提供任何 `file` 字段 | 400 | `"No file provided"` |
| `file` 条目数量 > 20 | 400 | `"Too many files (max 20 per batch)"` |
| 所有 `file` 大小之和 > 300 MB | 400 | `"Batch total size exceeds 300 MB"` |
| `parentId` 指定但目录不存在或不属于当前用户，或目标不是目录 | 404 | `"Parent directory not found."` |

以上任一情况下，响应体固定为 `{ "error": string }`，不包含 `results` 字段。

### 单文件级处理（批次级前置校验通过后，按 continue-on-error 逐个处理）

对 `file` 中的每个条目，按提交顺序依次执行：

1. 若该文件大小 > 20 MB → 该条目标记为 `failed`，`error` 说明超过大小限制，继续处理下一个文件（不中断批次）。
2. 计算目标文件名：若与目标目录下已有文件（含数据库中已存在的记录，以及本批次中在其之前已成功处理/占用的文件名）冲突，则自动生成 `{原文件名（不含扩展名）}-{随机后缀}{扩展名}` 形式的新文件名；否则使用原文件名。
3. 写入存储（`getStorage().save(...)`）与数据库记录（`files` 表）；若写入过程中发生错误（如唯一约束冲突、存储异常）→ 回滚已写入的存储文件（如有），该条目标记为 `failed` 并说明原因，继续处理下一个文件。
4. 成功时，若第 2 步发生了重命名，条目标记为 `renamed` 并包含 `finalFilename`；否则标记为 `created`。

### 成功响应（批次级前置校验通过，至少完成对所有文件的处理尝试）

`201 Created`

```json
{
  "results": [
    { "originalFilename": "report.pdf", "status": "created", "fileId": "..." },
    { "originalFilename": "report.pdf", "status": "renamed", "fileId": "...", "finalFilename": "report-a1b2c3d4.pdf" },
    { "originalFilename": "huge.zip", "status": "failed", "error": "File is too large (max 20 MB)." }
  ]
}
```

`results` 数组与请求中 `file` 条目的顺序一一对应；即使批次中全部或部分文件失败，只要批次级前置校验通过，HTTP 状态码固定为 `201`（批次已被接受并处理，具体每个文件的结果需查看 `results`）。

### 单文件上传兼容性

当请求中只包含 1 个 `file` 条目时，行为是本契约的特例：`results` 数组长度为 1；客户端现有的"上传成功后跳转到 `/{lang}/console/files/{fileId}`"体验可依据 `results[0]` 的 `status` 与 `fileId` 实现，具体跳转 vs. 停留在结果页的界面策略由实现阶段决定，不改变本契约的响应结构。
