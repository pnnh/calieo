# 实施计划：批量文件上传与同目录自动重命名

**分支**: `001-multi-file-upload` | **日期**: 2026-08-02 | **规格**: [spec.md](./spec.md)

**输入**: 功能规格来自 `/specs/001-multi-file-upload/spec.md`

## 概述

在 `/en/console/files/new` 页面的现有单文件上传基础上，调整为支持一次选择 2-20 个文件的批量上传（复用现有的 `POST /{lang}/console/upload` 路由，改为一次请求处理整批文件）；批次总大小不超过 300 MB、单文件大小限制由 50 MB 调整为 20 MB；数量与总大小超限时在提交前整体拒绝（all-or-nothing 前置校验），单文件处理失败（超限、存储错误等）采用「尽量多成功」（continue-on-error）策略且不做失败重试；当上传文件名与目标目录下已有文件（含同批次内的其他文件）重名时，系统自动为文件名追加随机后缀（保留扩展名）以避免冲突；处理完成后向用户展示每个文件的最终结果（成功/重命名/失败）。

## 技术背景

**Language/Version**: TypeScript 5、Next.js 16（App Router）、React 19

**Primary Dependencies**: drizzle-orm（`drizzle-orm/better-sqlite3` 与 `drizzle-orm/d1`）、`@opennextjs/cloudflare`、现有存储抽象 `src/lib/storage.ts`（`LocalStorageAdapter` / `R2StorageAdapter`）

**Storage**: 开发环境为本地 SQLite（`better-sqlite3`）+ 本地文件系统；生产环境为 Cloudflare D1 + R2 对象存储；均通过既有的 `getDb()` / `getStorage()` 自动按运行环境切换，本功能不引入新的存储机制或数据库迁移

**Testing**: Vitest（组件/单元测试，`@vitest-environment jsdom`）+ Playwright（端到端测试，`e2e/`）

**Target Platform**: 生产环境为 Cloudflare Workers（通过 OpenNext 部署）；开发环境为本地 Node.js（`pnpm dev`）

**Project Type**: Web 应用（Next.js 全栈单一项目结构，无独立前后端目录）

**Performance Goals**: 无新增量化性能指标；批量上传（≤20 个文件、总大小 ≤300 MB）的处理时延应与现有单文件上传路径量级相当，不引入额外的排队或异步任务机制

**Constraints**: 单文件大小 ≤20 MB；单批次文件数量 ≤20 个；单批次总大小 ≤300 MB；批次数量/总大小超限时必须在提交前整体拒绝且不发起上传请求；不实现失败重试机制；沿用现有鉴权（`getCurrentUser`）与父目录校验逻辑；同一 `parent_id` 下文件名唯一约束保持不变

**Scale/Scope**: 面向已登录用户的个人文件管理场景，单次批量上传的规模上限已由需求明确（≤20 文件 / ≤300 MB），非高并发批处理系统

## 章程检查

*GATE：必须在 Phase 0 研究前通过；Phase 1 设计后需重新检查。*

项目章程文件（`.specify/memory/constitution.md`）仍为初始模板占位符，未定义任何具体原则或强制性门禁条款。因此本阶段无可执行的章程门禁需要校验，本次计划遵循仓库现有的最小改动、外科手术式修改等约定（见 `AGENTS.md`）。

## 项目结构

### 文档（本功能）

```text
specs/001-multi-file-upload/
├── plan.md              # 本文件（/speckit.plan 命令输出）
├── research.md          # Phase 0 输出（/speckit.plan 命令）
├── data-model.md        # Phase 1 输出（/speckit.plan 命令）
├── quickstart.md        # Phase 1 输出（/speckit.plan 命令）
├── contracts/           # Phase 1 输出（/speckit.plan 命令）
│   └── upload-api.md
└── tasks.md             # Phase 2 输出（/speckit.tasks 命令 —— 不由 /speckit.plan 创建）
```

### 源代码（仓库根目录）

```text
src/
├── app/
│   └── [lang]/
│       └── console/
│           ├── upload/
│           │   └── route.ts          # 调整：接收多文件表单字段，执行批次级校验与逐文件 continue-on-error 处理
│           └── files/
│               └── [fileId]/
│                   └── page.tsx        # 复用：new 态渲染 FileUploadForm，无结构性调整
├── components/
│   ├── FileUploadForm.tsx              # 调整：file input 增加 multiple、数量/大小前置校验、批次结果展示
│   └── FileUploadForm.test.tsx         # 调整：覆盖多文件选择、超限提示、逐文件结果展示等场景
├── db/
│   └── schema.ts                        # 不变：复用现有 files 表结构与 (parent_id, filename) 唯一索引
├── lib/
│   └── storage.ts                       # 不变：复用现有 LocalStorageAdapter / R2StorageAdapter
└── locales/
    └── *.json                           # 调整：新增数量超限、总大小超限、批次结果相关文案 key
```

**结构决策**: 沿用仓库现有的 Next.js 全栈单一项目结构（无 backend/frontend 分离），本功能仅在既有目录内做定向修改（上传路由、上传表单组件及其测试、多语言文案），不新增顶级目录，不涉及数据库迁移。

## 复杂度追踪

*本节留空 —— 章程检查阶段未发现任何违规项，无需填写。*

