# Calieo 改进计划

> 目标：以 huable 项目为参照，将 calieo 从纯静态工具列表门户升级为具备完整 CRUD 功能的**文件管理与发布平台**。
>
> 核心数据结构：**文件（File）** — 支持上传任意类型文件、管理、Markdown 描述、发布至频道。
>
> 保留现有功能：工具列表页 (`/[lang]/tools/`) 及详情页 (`/[lang]/tools/[tool]/`) 保持不变。

---

## 阶段 1：基础设施搭建

### 1.1 添加依赖
- [ ] 添加 `drizzle-orm`、`better-sqlite3`（及 `@types/better-sqlite3`）
- [ ] 添加 `drizzle-kit`、`tsx`（dev）
- [ ] 添加 `bs58`、`uuidv7`（用于 ID 生成）
- [ ] 添加 `marked`、`sanitize-html`（及 `@types/sanitize-html`）用于 Markdown 渲染
- [ ] 添加 `react-icons`

### 1.2 数据库 Schema（`src/db/schema.ts`）
- [ ] 创建 `users` 表：`id`(text PK), `name`, `email`(unique), `nickname`, `bio`, `created_at`
- [ ] 创建 `channels` 表：`id`(text PK), `user_id`(FK→users), `name`, `description`, `is_public`, `created_at`
- [ ] 创建 `files` 表：`id`(text PK), `user_id`(FK→users), `channel_id`(FK→channels, nullable), `title`, `description`(Markdown 正文), `filename`(原始文件名), `mime_type`, `size`(int), `is_published`, `created_at`, `updated_at`
- [ ] 定义 Drizzle relations
- [ ] 导出 `createId()` 工具函数（UUIDv7 → Base58）

> 与 huable 不同：huable 核心是 `notes`（Markdown 正文）+ `note_attachments`（附件文件）；calieo 核心是 `files`（文件本身即内容，附带可选的 Markdown 描述）。

### 1.3 数据库连接（`src/db/index.ts`）
- [ ] 重构现有 `src/lib/db.ts`：实现基于 Drizzle ORM 的 `getDb()`
  - 开发环境使用 better-sqlite3 (`.data/calieo.db`)
  - 生产环境使用 D1
- [ ] 移除旧的 raw D1 接口（或保留 portal 使用，后续替换）

### 1.4 数据库迁移
- [ ] 创建 `migrations/0002_channels_files.sql`（channels, files 表）
- [ ] 创建 `migrations/0003_user_profile.sql`（为 users 表添加 nickname, bio 字段，或将 users 表重构为 Drizzle 管理的新 schema）
- [ ] 创建 `src/db/migrate.ts` 脚本
- [ ] 在 `package.json` 添加 `"db:migrate": "tsx src/db/migrate.ts"` script

> 注意：calieo 已有 `0001_create_users.sql` migration 和 raw D1 用户表。需决定是沿用现有 users 表结构并扩展，还是重建为 Drizzle 管理的 text PK schema。建议：创建新的 Drizzle users 表（text PK），迁移时重建。

### 1.5 Drizzle 配置（`drizzle.config.ts`）
- [ ] 创建 drizzle.config.ts（schema 路径、migrations 输出目录、dialect: sqlite）

### 1.6 Wrangler 配置更新（`wrangler.jsonc`）
- [ ] 保留现有 D1 绑定（或改名以统一风格）
- [ ] 添加 R2 存储桶绑定（`binding: "FILES_BUCKET"`, `bucket_name: "calieo-files"`）

### 1.7 环境变量
- [ ] 创建 `.env.local.example`：`DB_PATH`, `FILE_STORAGE_PATH`, `DEV_USER_ID`, `DEV_USER_NAME`

---

## 阶段 2：认证与存储

### 2.1 认证模块（`src/lib/auth.ts`）
- [ ] 实现 `getCurrentUser()`：开发环境读取 cookie `user_id`，回退到 DEV_USER 环境变量
- [ ] 自动确保 user 行存在于数据库
- [ ] 生产环境使用 Cloudflare Zero Trust headers

> 注意：calieo 已有 portal 的 CF Access JWT 解析逻辑，可参考并整合。

### 2.2 文件存储模块（`src/lib/storage.ts`）
- [ ] 定义 `StorageAdapter` 接口（`save`, `read`, `delete`）
- [ ] 实现 `LocalStorageAdapter`（开发环境，基于本地文件系统）
- [ ] 实现 `R2StorageAdapter`（生产环境）
- [ ] 导出 `getStorage()` 工厂函数
- [ ] 路径安全校验（防止路径遍历）

---

## 阶段 3：API 路由

### 3.1 文件上传（`src/app/api/upload/route.ts`）
- [ ] POST：接收文件（不限类型，可设置大小限制），存储到 storage，写入 `files` 表
- [ ] 返回新文件 ID

### 3.2 文件下载/预览（`src/app/api/files/[fileId]/download/route.ts`）
- [ ] GET：从 storage 读取文件，返回正确的 Content-Type + Content-Disposition

### 3.3 文件 CRUD（`src/app/api/files/[fileId]/route.ts`）
- [ ] PATCH：更新 title/description/channelId/isPublished
- [ ] DELETE：删除文件记录和存储文件

### 3.4 频道 CRUD（`src/app/api/channels/[channelId]/route.ts`）
- [ ] DELETE：删除频道（需检查无已发布文件关联）

### 3.5 频道头像（`src/app/api/channel/avatar/[channelId]/route.ts`）
- [ ] GET：提供频道头像
- [ ] POST：上传频道头像

### 3.6 用户头像（`src/app/api/user/avatar/route.ts` + `[userId]/route.ts`）
- [ ] POST：上传用户头像
- [ ] GET：提供用户头像

### 3.7 用户资料（`src/app/api/user/profile/route.ts`）
- [ ] PATCH：更新 nickname / bio

---

## 阶段 4：Console（管理后台）页面

### 4.1 Console 入口
- [ ] `src/app/console/page.tsx`：无语言前缀的 `/console` 重定向
- [ ] `src/app/[lang]/console/page.tsx`：仪表盘（显示频道数、文件数、快速链接）

> 注意：需清理现有 `src/app/portal/` 目录。portal 的 CF Access 验证功能可整合到 console 中或保留为独立调试页面。

### 4.2 频道管理
- [ ] `src/app/[lang]/console/channels/page.tsx`：频道列表页（表格 + 新建按钮）
- [ ] `src/app/[lang]/console/channels/[channelId]/page.tsx`：频道编辑页（名称、描述、公开/私有、头像上传、删除操作）

### 4.3 文件管理
- [ ] `src/app/[lang]/console/files/page.tsx`：文件列表页（表格，显示文件名、类型、大小、状态）
- [ ] `src/app/[lang]/console/files/[fileId]/page.tsx`：文件编辑页（标题、Markdown 描述、选择频道、发布/草稿状态）
- [ ] `src/app/[lang]/console/files/upload/page.tsx`：文件上传页（支持多文件批量上传）

### 4.4 用户资料
- [ ] `src/app/[lang]/console/profile/page.tsx`：编辑昵称、简介、头像

---

## 阶段 5：公共浏览页面

### 5.1 首页改造（`src/app/[lang]/page.tsx`）
- [ ] 保留现有工具列表作为页面的一个区块
- [ ] 新增"最新公开文件"区块（分页 + 搜索），展示已发布到公开频道的文件

### 5.2 公共频道列表（`src/app/[lang]/channels/page.tsx`）
- [ ] 展示所有公开频道（分页 + 搜索）
- [ ] 每个频道显示头像、名称、描述、文件数量

### 5.3 频道详情（`src/app/[lang]/channels/[id]/page.tsx`）
- [ ] 展示频道信息 + 该频道下所有已发布文件（文件列表 + 分页）

### 5.4 文件详情（`src/app/[lang]/files/[id]/page.tsx`）
- [ ] 展示文件信息：标题、Markdown 描述、所属频道链接、发布时间
- [ ] 提供文件下载链接
- [ ] 如果是图片/PDF 等可预览类型，提供内联预览

---

## 阶段 6：组件

### 6.1 新组件
- [ ] `ChannelAvatar.tsx`：频道头像（含首字母回退）
- [ ] `ChannelAvatarUpload.tsx`：频道头像上传小部件
- [ ] `ChannelSearch.tsx`：搜索输入组件（更新 URL ?q= 参数）
- [ ] `ChannelDeleteSection.tsx`：频道删除确认区域
- [ ] `FileDeleteSection.tsx`：文件删除确认区域
- [ ] `FileCard.tsx`：文件卡片（图标 + 标题 + 类型标签）
- [ ] `FileList.tsx`：文件列表/网格布局
- [ ] `FilePreview.tsx`：文件内联预览（图片显示缩略图，PDF 嵌入，其他显示图标）
- [ ] `MarkdownContent.tsx`：Markdown 渲染组件
- [ ] `UserProfileClient.tsx`：用户资料编辑表单（客户端组件）
- [ ] `RemoveFromChannelButton.tsx`：从频道移除文件按钮

### 6.2 保留/更新组件
- [ ] `ToolCard.tsx`、`ToolGrid.tsx`：保持不变
- [ ] `CookieBanner.tsx`：确保 domain 为 `.calieo.xyz`
- [ ] `SiteHeader.tsx`：添加"Console"导航入口
- [ ] `SiteFooter.tsx`、`LanguageSelector.tsx`：保持不变

---

## 阶段 7：国际化

### 7.1 更新 locale 文件
- [ ] 为所有 8 种语言添加新的翻译 key：
  - console, welcomeUser, channels, files, manageChannels, manageFiles
  - newChannel, editChannel, channelName, channelDescription, channelVisibility, channelPublic, channelPrivate, makeChannelPublic
  - noChannelsYet, deleteChannel, deleteChannelConfirm, deleteChannelHasFiles
  - newFile, editFile, fileTitle, fileDescription, fileChannel, fileStatus, filePublished, fileDraft
  - noFilesYet, deleteFile, deleteFileConfirm, noChannel, removeFromChannel
  - uploadFile, uploadFiles, fileType, fileSize, download
  - avatar, uploadAvatar, avatarHint
  - nickname, username, bio, profileTitle, saveProfile, profileSaved
  - search, noResults, page, of
  - save, cancel, updated, created

---

## 阶段 8：隐私政策与 Cookie

### 8.1 隐私政策
- [ ] 保留现有 `src/data/privacy.ts`（已有 8 种语言）
- [ ] 保留 `src/app/[lang]/privacy/page.tsx`

### 8.2 Cookie Banner
- [ ] 确保 CookieBanner 在 layout 中正确引用

---

## 阶段 9：清理与部署配置

### 9.1 清理旧代码
- [ ] 评估 `src/app/portal/` 目录：
  - 如果 portal 功能需要保留（CF Access 调试页），则保持独立
  - 否则移除，将用户管理相关功能整合到 console
- [ ] 清理旧的 `src/lib/db.ts`（raw D1 接口），迁移到 Drizzle ORM

### 9.2 README 更新
- [ ] 重写 README.md，描述完整功能、数据库 schema、开发步骤、部署步骤

### 9.3 Cloudflare 资源创建文档
- [ ] 记录 R2 存储桶创建命令
- [ ] 记录 migration 应用命令（D1 已存在）

---

## 依赖关系

```
阶段 1（基础设施）
  └── 阶段 2（认证 & 存储）
        └── 阶段 3（API 路由）
              └── 阶段 4（Console 页面）
              └── 阶段 5（公共页面）
        └── 阶段 6（组件）—— 被阶段 4、5 引用
阶段 7（国际化）—— 可与阶段 4-6 并行，但需在 UI 完成前就绪
阶段 8（隐私 & Cookie）—— 已部分完成，检查即可
阶段 9（清理 & 部署）—— 最后执行
```

---

## 注意事项

1. **核心差异**：huable 的核心是"笔记"（Markdown 正文 + 可选附件）；calieo 的核心是"文件"（任意类型文件 + 可选 Markdown 描述），文件本身即内容。
2. **存储策略**：文件存储在 R2（生产）/ 本地文件系统（开发），数据库只存元数据。
3. **文件预览**：对于图片类型可提供缩略图预览，PDF 提供内嵌查看器，其他类型仅提供下载。
4. **工具列表**：现有的 `/[lang]/tools/` 功能完全保留，不受影响。
5. **URL 结构**：公共文件页面使用 `/[lang]/files/[id]`，频道使用 `/[lang]/channels/[id]`。
6. **Console 路径**：管理后台统一在 `/[lang]/console/` 下，与 huable 保持一致。
7. **现有 Portal**：`/portal/` 页面是 CF Access 调试工具，决定是保留还是整合到 console。
8. **现有 Users 表**：已有整数 PK 的 users 表，需做 schema 迁移决策（建议重建为 text PK 以与 huable 统一）。
