# 任务列表：批量文件上传与同目录自动重命名

**输入**：来自 `/specs/001-multi-file-upload/` 的设计文档（plan.md、spec.md、research.md、data-model.md、contracts/upload-api.md、quickstart.md）

**前置条件**：plan.md（必需）、spec.md（用户故事，必需）、research.md、data-model.md、contracts/

**测试说明**：规格未显式要求测试先行（TDD）。由于 `src/components/FileUploadForm.test.tsx` 已存在且与本次改动的组件强耦合，本列表将"同步更新既有测试以匹配新行为"作为各用户故事实现的一部分收尾任务，而非独立的测试先行阶段。

**组织方式**：任务按用户故事分组，以便每个故事可以独立实现与验证。

## 格式：`[编号] [P?] [Story?] 描述（含文件路径）`

- **[P]**：可并行执行（不同文件，且不依赖尚未完成的任务）
- **[Story]**：任务所属的用户故事（US1/US2/US3）
- 描述中包含明确的文件路径

## 路径约定

单一项目结构（Next.js 全栈应用），无独立 `frontend/`/`backend/` 目录；本次改动涉及的文件均在仓库现有的 `src/` 目录下（见 plan.md 的项目结构说明）。

---

## Phase 1：Setup（共享基础设施准备）

**目的**：为批量上传相关的限制值提供统一的常量定义，供后续所有阶段引用

- [X] T001 在 `src/app/[lang]/console/upload/route.ts` 中，将现有的单一 `MAX_SIZE = 50 * 1024 * 1024` 常量替换为三个常量：`MAX_FILE_SIZE = 20 * 1024 * 1024`（单文件 20MB）、`MAX_FILES_PER_BATCH = 20`（单批次最多 20 个文件）、`MAX_BATCH_TOTAL_SIZE = 300 * 1024 * 1024`（批次总大小 300MB）

---

## Phase 2：Foundational（阻塞性前置工作）

**目的**：搭建批量请求解析、批次级前置校验、文件名唯一性处理与逐文件 continue-on-error 主循环等核心机制，是后续任何用户故事得以实现的基础

**⚠️ 关键**：本阶段完成前，不能开始任何用户故事的具体工作

- [X] T002 调整 `src/app/[lang]/console/upload/route.ts` 的请求解析逻辑：使用 `formData.getAll("file")` 读取 1 至 `MAX_FILES_PER_BATCH` 个文件条目（替代原先仅通过 `formData.get("file")` 读取单个文件）；在文件顶部定义 `BatchUploadResultItem` 类型（字段：`originalFilename`、`status: "created" | "renamed" | "failed"`、`fileId?`、`finalFilename?`、`error?`），对应 [data-model.md](./data-model.md)（依赖 T001）
- [X] T003 在 `route.ts` 中实现批次级前置校验（all-or-nothing，任一不满足则整体返回对应错误状态码，不处理任何文件、不写入任何记录）：未提供任何文件 → 400、文件数量超过 `MAX_FILES_PER_BATCH` → 400、所有文件大小之和超过 `MAX_BATCH_TOTAL_SIZE` → 400，对应 [contracts/upload-api.md](./contracts/upload-api.md) 的批次级前置校验表（依赖 T002）
- [X] T004 在 `route.ts` 中新增文件名唯一性辅助函数（如 `resolveUniqueFilename`）：使用 `crypto.randomUUID()` 截取一段字符作为后缀，生成 `{原文件名（不含扩展名）}-{随机后缀}{扩展名}` 格式的新文件名；判断唯一性时需同时比对数据库中该 `parentId` 下已存在的文件名与本批次内已分配（占用）的文件名集合，若仍冲突则重新生成，对应 [research.md](./research.md) 决策 2（依赖 T002）
- [X] T005 在 `route.ts` 中实现批次处理主循环：对通过批次级校验的每个文件依次执行「校验单文件大小 ≤ `MAX_FILE_SIZE`（超限则记录 `status: "failed"` 并说明原因，继续下一个文件）→ 调用 T004 解析最终文件名 → 保存到 `storage`（`getStorage().save(...)`）→ 写入 `files` 表」；任一步骤抛出异常时清理已写入的存储文件（如有）、记录该文件为 `status: "failed"` 并继续处理批次中的其余文件，不中断整批（对应 FR-005、FR-009，不实现失败重试）（依赖 T003, T004）
- [X] T006 调整 `route.ts` 的成功响应体为 `{ results: BatchUploadResultItem[] }`（`results` 顺序与请求中文件条目一致），移除原先仅返回 `{ id }` 单值的逻辑；单文件请求场景下 `results` 数组长度为 1（依赖 T005）

**检查点**：路由已支持批量请求解析、批次级限制、单文件级 continue-on-error 处理与统一响应结构；此时可通过手动构造 `multipart/form-data` 请求验证服务端行为，前端尚未适配

---

## Phase 3：User Story 1 - 一次选择多个文件上传 (Priority: P1) 🎯 MVP

**目标**：用户在上传页面一次性选择 2-20 个文件并提交，全部成功创建为独立的文件记录；数量或总大小超限时提交前即被阻止

**独立测试**：在上传页面选择 5 个不同名称的文件并提交，验证这 5 个文件都被成功创建，且都出现在目标目录的文件列表中；分别尝试选择 21 个文件、以及总大小超过 300MB 的文件组合，验证均在提交前被阻止并提示

### User Story 1 的实现

- [X] T007 [US1] 在 `src/components/FileUploadForm.tsx` 中，为 `<input type="file">` 增加 `multiple` 属性，并调整 `handleSubmit` 读取 `fileInput.files`（`FileList`）而非仅第一个文件
- [X] T008 [US1] 在 `FileUploadForm.tsx` 提交前新增客户端校验：所选文件数量超过 20 时阻止提交、不发起 `fetch` 请求，并展示提示信息（依赖 T007）
- [X] T009 [US1] 在 `FileUploadForm.tsx` 提交前新增客户端校验：所选文件总大小之和超过 300MB 时阻止提交、不发起 `fetch` 请求，并展示提示信息（依赖 T007）
- [X] T010 [US1] 调整 `FileUploadForm.tsx` 中构建 `FormData` 的逻辑：对 `FileList` 中的每个文件执行 `formData.append("file", file)`，以匹配 [contracts/upload-api.md](./contracts/upload-api.md) 定义的批量请求格式（依赖 T007）
- [X] T011 [P] [US1] 在 `src/locales/en.json`、`zh.json`、`zh-TW.json`、`de-DE.json`、`es.json`、`fr.json`、`ja.json`、`pt-PT.json` 共 8 个文件中新增 `maxFilesExceeded`（数量超限提示）、`batchTooLarge`（总大小超限提示）文案 key，并将现有 `fileTooLarge` 文案中的 "50 MB" 更新为 "20 MB"
- [X] T012 [US1] 在 `src/app/[lang]/console/files/[fileId]/page.tsx` 中，向 `FileUploadForm` 的 `labels` prop 追加 `maxFilesExceeded`、`batchTooLarge`（依赖 T011）
- [X] T013 [US1] 更新 `src/components/FileUploadForm.test.tsx`：调整现有单文件超限用例的阈值/断言为 20MB，新增覆盖多文件选择成功提交、数量超限阻止提交、总大小超限阻止提交的测试用例（依赖 T007、T008、T009、T010、T012）

**检查点**：至此，User Story 1 应可独立运行与验证——批量选择上传成功、超限提前阻止、单文件上传行为保持不变（FR-008）

---

## Phase 4：User Story 2 - 同目录重名文件自动重命名 (Priority: P1)

**目标**：上传文件名与目标目录内已有文件（含同批次内其他文件）重名时，自动追加随机后缀重命名并成功创建，而非报错拒绝

**独立测试**：目标目录下已存在 `report.pdf`，上传另一个同名 `report.pdf`，验证新文件被成功创建且文件名带随机后缀、扩展名仍为 `.pdf`；同一批次内包含两个同名文件时，验证其中一个保留原名、另一个自动重命名

### User Story 2 的实现

- [X] T014 [US2] 在 `route.ts` 的批次处理主循环（T005）中，将解析最终文件名的步骤接入 T004 的唯一性辅助函数：写入前检查目标目录下已存在的文件名与本批次内已分配的文件名，冲突时生成重命名后的新文件名（依赖 T004, T005）
- [X] T015 [US2] 移除 `route.ts` 中原有"文件名冲突直接返回 409 错误"的分支，改为始终通过 T014 的重命名机制处理冲突；保留对数据库唯一约束异常的兜底捕获（作为极端并发场景下的最后防线），捕获后将该文件标记为 `status: "failed"`（依赖 T014）
- [X] T016 [US2] 在 `route.ts` 的结果记录中，将未发生重命名的文件标记为 `status: "created"`，将因冲突而重命名的文件标记为 `status: "renamed"` 并填充 `finalFilename`（依赖 T014）
- [X] T017 [P] [US2] 更新 `src/components/FileUploadForm.test.tsx`（或在其中新增用例），通过 mock `fetch` 返回包含 `renamed` 状态的 `results`，验证前端能正确识别并展示重命名结果；目录内重名与批次内重名两种服务端场景按 [quickstart.md](./quickstart.md) 场景 5、6 手动验证（依赖 T015, T016）

**检查点**：至此，User Story 1 与 User Story 2 应可共同独立运行——批量上传时，重名文件自动重命名而不是报错中断

---

## Phase 5：User Story 3 - 批量上传结果反馈 (Priority: P2)

**目标**：批次提交完成后，用户能看到每个文件的最终处理结果（成功创建、已重命名、或失败及原因）

**独立测试**：提交一批包含 1 个超大文件和 4 个正常文件，验证 4 个正常文件成功上传，且界面明确指出哪个文件失败及失败原因

### User Story 3 的实现

- [X] T018 [US3] 调整 `FileUploadForm.tsx` 提交成功后的处理逻辑：解析响应中的 `results` 数组并渲染逐文件结果列表（文件名、状态、失败原因）；仅当批次中只有 1 个文件且状态为 `created`/`renamed` 时，保留原有"跳转到 `/{lang}/console/files/{id}`"体验，以维持 FR-008 的单文件兼容性（依赖 T006）
- [X] T019 [P] [US3] 在 8 个语言文件（`src/locales/*.json`）中新增结果展示相关文案 key：`uploadResultCreated`、`uploadResultRenamed`、`uploadResultFailed`、`uploadAllSucceeded`
- [X] T020 [US3] 在 `src/app/[lang]/console/files/[fileId]/page.tsx` 中，向 `FileUploadForm` 的 `labels` prop 追加 T019 新增的文案 key（依赖 T019）
- [X] T021 [US3] 更新 `src/components/FileUploadForm.test.tsx`，新增覆盖"成功/重命名/失败混合结果"展示的测试用例，对应 [quickstart.md](./quickstart.md) 场景 4（依赖 T018, T020）

**检查点**：所有用户故事均可独立验证；批量上传的处理结果对用户完全可见

---

## Phase 6：Polish & Cross-Cutting Concerns

**目的**：跨故事的收尾验证，确保改动质量与既有功能不被破坏

- [X] T022 [P] 运行 `pnpm test`，确认全部单元/组件测试通过（含 T013、T017、T021 新增/调整的用例）
- [X] T023 [P] 按 [quickstart.md](./quickstart.md) 完整执行 7 个手动验证场景（本地开发环境：`pnpm dev` + `pnpm run db:migrate`）
- [X] T024 复查 `src/app/[lang]/console/upload/route.ts`：确认无遗留的旧单文件专属逻辑（如原 409 冲突分支、原 `{ id }` 单值响应）或死代码，改动保持最小化（依赖 T006, T015, T016）

---

## 依赖关系与执行顺序

### 阶段依赖

- **Setup（Phase 1）**：无依赖，可立即开始
- **Foundational（Phase 2）**：依赖 Setup 完成 —— 阻塞所有用户故事
- **用户故事（Phase 3+）**：均依赖 Foundational 阶段完成
  - User Story 1（P1）与 User Story 2（P1）可并行安排（不同开发者），但两者都会修改 `route.ts` 的同一处理循环，需注意合并顺序（建议先完成 US1 的客户端改动 + US2 的路由重命名逻辑，再进入 US3）
  - User Story 3（P2）依赖 Foundational 的响应结构（T006），建议在 US1/US2 之后进行，以便同时验证成功、重命名、失败三种结果的展示
- **Polish（最终阶段）**：依赖所有期望交付的用户故事完成

### 用户故事依赖

- **User Story 1 (P1)**：可在 Foundational 完成后开始，不依赖其他故事
- **User Story 2 (P1)**：可在 Foundational 完成后开始；与 US1 修改同一 `route.ts` 处理循环，建议按顺序合并而非严格并行编码
- **User Story 3 (P2)**：可在 Foundational 完成后开始；其"逐文件结果展示"依赖 US1（多文件请求）与 US2（renamed 状态）产生的真实场景才能完整验证，建议在 US1、US2 之后交付

### 每个用户故事内部

- 客户端改动（表单、校验、结果展示）与服务端改动（路由处理循环）分工明确；表单文案（locale）任务可与逻辑改动并行
- 现有测试文件的更新任务放在每个故事的最后一步，确保先完成行为调整、再同步测试断言

### 并行机会

- Foundational 阶段内的任务均修改同一文件（`route.ts`），按顺序执行，不标记 `[P]`
- User Story 1 中的 T011（8 个 locale 文件）与 T007-T010（`FileUploadForm.tsx`）可并行
- User Story 3 中的 T019（locale 文件）可与 T018（`FileUploadForm.tsx`）并行
- Polish 阶段的 T022（自动化测试）与 T023（手动验证）可并行

---

## 并行执行示例：User Story 1

```bash
# 可并行执行：
任务: "在 src/components/FileUploadForm.tsx 中添加 multiple 属性与客户端校验（T007-T010）"
任务: "在 8 个 src/locales/*.json 文件中新增 maxFilesExceeded、batchTooLarge 文案（T011）"
```

---

## 实施策略

### 优先交付 MVP（仅 User Story 1）

1. 完成 Phase 1：Setup
2. 完成 Phase 2：Foundational（关键 —— 阻塞所有故事）
3. 完成 Phase 3：User Story 1
4. **停止并验证**：按 quickstart.md 场景 1-3、7 独立测试 User Story 1
5. 视情况部署/演示

### 增量交付

1. 完成 Setup + Foundational → 基础就绪
2. 增加 User Story 1 → 独立测试 → 部署/演示（MVP！）
3. 增加 User Story 2 → 独立测试 → 部署/演示
4. 增加 User Story 3 → 独立测试 → 部署/演示
5. 每个故事都在不破坏此前故事的前提下增加价值

### 多人协作策略

由于 US1 与 US2 都会修改 `route.ts` 中的同一处理循环，建议：

1. 由同一开发者或经过明确协调的两位开发者顺序完成 Foundational → US1 的服务端部分 → US2 的服务端部分，避免同文件的合并冲突
2. US1 的客户端改动（`FileUploadForm.tsx` 前置校验）可由另一开发者与服务端改动并行进行
3. US3 在 US1、US2 的服务端与客户端改动稳定后再开始，以便一次性验证三种结果状态的展示

---

## 备注

- `[P]` 任务 = 不同文件且无未完成依赖
- `[Story]` 标签将任务映射到具体用户故事，便于追溯
- 每个用户故事都应可独立完成与验证
- 提交建议：每完成一个任务或一组逻辑相关的任务后提交一次
