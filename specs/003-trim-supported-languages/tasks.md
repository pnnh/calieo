# Tasks: 精简支持语言（仅保留英/法/西/简中）

**Input**: Design documents from `/specs/003-trim-supported-languages/`

**Prerequisites**: [plan.md](./plan.md)（必需）、[spec.md](./spec.md)（用户故事）、[research.md](./research.md)、
[data-model.md](./data-model.md)、[quickstart.md](./quickstart.md)

**Tests**: spec.md 未要求新增测试用例；本次改动是对现有测试的更新/精简（移除对已移除语言的断言与
快照），质量门控通过 Polish 阶段的 `tsc --noEmit` / `pnpm test` / `pnpm build` 保证（宪法 V）。

**Organization**: 任务按 spec.md 中的用户故事（US1/US2/US3）分组；Foundational 阶段完成后各故事均可
独立验证。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件、无依赖关系）
- **[Story]**: 所属用户故事（US1/US2/US3）
- 描述中均包含具体文件路径

## Path Conventions

单体 Next.js App Router 项目，源码位于仓库根目录 `src/`（详见 plan.md 的 Project Structure）。

---

## Phase 1: Foundational（阻塞性前置工作）

**Purpose**: 收窄语言类型系统与本地化基础设施，为后续所有清理工作提供编译期核对依据

**⚠️ CRITICAL**: 本阶段完成前不得开始任何用户故事的清理工作

- [X] T001 修改 `src/lib/language.ts`：移除 `langDe`（`de-DE`）、`langPt`（`pt-PT`）、`langJa`
      （`ja`）、`langZhTW`（`zh-TW`）四个常量及其在 `LangKey` 联合类型、`supportedLanguages` 数组
      中的对应条目，保留 `langEn`/`langEs`/`langFr`/`langZh`
- [X] T002 [P] 删除 `src/locales/de-DE.json`、`src/locales/ja.json`、`src/locales/pt-PT.json`、
      `src/locales/zh-TW.json` 四个本地化文件
- [X] T003 修改 `src/lib/i18n.ts`：移除对应 4 个 `import`（`deDe`/`ptPt`/`ja`/`zhTW`）及
      `locales` 映射中的 4 个条目，只保留 `en`/`es`/`fr`/`zh`（依赖 T001、T002）

**Checkpoint**：类型系统与本地化基础设施已收窄为 4 种语言；此时运行 `pnpm exec tsc --noEmit` 会因
`Record<LangKey, ...>` 字面量存在多余属性而报错，精确指出后续任务 T004-T012 需要清理的全部位置。

---

## Phase 2: User Story 1 - 保留语言用户不受影响地正常使用 (Priority: P1) 🎯 MVP

**Goal**: 保留的 4 种语言下所有页面内容（含语言数量描述文案）准确、完整，不受精简影响

**Independent Test**: 按 quickstart.md 场景 2，依次访问 `/en/`、`/es/`、`/fr/`、`/zh/` 及任一工具
详情页，验证内容完整且语言数量描述显示为"4"（Timeis 显示"4"且语言列表不含日语/葡萄牙语）

### Implementation for User Story 1

- [X] T004 [US1] 更新 `src/data/tools.ts` 中 BaseX、CryptoX、RandomX、WeJSON 四个工具的 `en`/
      `es`/`fr`/`zh` 版本 `features`/`detail` 文案，将"支持 8 种语言 / Available in 8 languages /
      Disponible en 8 idiomas / Disponible en 8 langues"类表述改为对应语言的"4"
- [X] T005 [US1] 更新 `src/data/tools.ts` 中 Timeis 工具的 `en`/`es`/`fr`/`zh` 版本 `features`/
      `detail` 文案，将"支持 6 种语言：中文、英语、西班牙语、法语、日语、葡萄牙语 / Available in 6
      languages"改为"支持 4 种语言：中文、英语、西班牙语、法语 / Available in 4 languages"（同时
      移除列表中的日语、葡萄牙语，而不仅是数字）

**Checkpoint**：4 种保留语言下的全部工具详情页内容准确反映精简后的语言范围，可独立验收 User Story 1。

---

## Phase 3: User Story 2 - 已移除语言的入口被完整清除 (Priority: P1)

**Goal**: 语言切换器、工具/隐私政策数据、测试套件中不再存在已移除语言的任何文本、翻译条目或断言

**Independent Test**: 按 quickstart.md 场景 3，检查语言切换下拉框选项与 `src/locales/` 目录，确认
均只剩 4 个保留语言；检查 `tools.ts`/`privacy.ts` 数据结构不含已移除语言键

### Implementation for User Story 2

- [X] T006 [P] [US2] 从 `src/data/tools.ts` 的 6 个工具中移除 `de-DE`/`ja`/`pt-PT`/`zh-TW` 键
      （`name`/`description`/`features`/`detail` 四个字段均需清理）
- [X] T007 [P] [US2] 从 `src/data/privacy.ts` 的 `privacyContent` 移除 `de-DE`/`ja`/`pt-PT`/
      `zh-TW` 四个语言的完整 `PrivacyContent` 条目
- [X] T008 [P] [US2] 更新 `src/components/LanguageSelector.test.tsx`：将使用 `"ja"` 作为切换目标
      语言的断言改为使用保留语言（如 `"fr"`）
- [X] T009 [P] [US2] 更新 `src/components/SiteFooter.test.tsx`：移除"renders German footer
      snapshot"用例；同步从 `src/components/__snapshots__/SiteFooter.test.tsx.snap` 中删除对应
      的 German 快照条目
- [X] T010 [P] [US2] 更新 `src/components/ToolCard.test.tsx`：测试夹具（`TOOL_FIXTURE` 等）中的
      `name`/`description`/`features`/`detail` 字面量移除 `de-DE`/`ja`/`pt-PT`/`zh-TW` 键
- [X] T011 [P] [US2] 更新 `src/lib/i18n.test.ts`：移除或替换"returns German translation for
      de-DE"用例为使用保留语言（如 `fr`/`es`）
- [X] T012 [P] [US2] 更新 `src/lib/language.test.ts`：将`"contains at least 8 entries"`断言改为
      准确反映 4 种语言（如 `toBe(4)`），并更新涉及 `zh-TW`/`de-DE` 的注释使其如实反映当前语言范围

**Checkpoint**：语言切换器、工具与隐私政策内容、全部测试文件均不再包含已移除语言的任何痕迹，可独立
验收 User Story 2。

---

## Phase 4: User Story 3 - 访问已移除语言路径时优雅回退 (Priority: P2)

**Goal**: 已移除语言的路径返回标准 404；浏览器首选语言为已移除语言时自动回退到默认语言或次优保留语言

**Independent Test**: 按 quickstart.md 场景 4，直接访问已移除语言路径验证 404；模拟不同
`Accept-Language` 组合验证回退行为

### Implementation for User Story 3

- [X] T013 [US3] 按 quickstart.md 场景 4 验证：直接访问 `/de-DE/`、`/ja/tools/basex`、
      `/pt-PT/privacy`、`/zh-TW/` 均返回标准 404；分别以 `Accept-Language: de-DE` 与
      `Accept-Language: de-DE,fr;q=0.5` 请求根路径 `/`，验证分别回退到 `/en/`（默认语言）与
      `/fr/`（偏好列表中次优的保留语言）。此故事无需新增代码——`isValidLang`/`getTargetLang` 的
      既有实现在 Foundational 阶段收窄 `supportedKeys` 后自动生效，本任务仅做验证

**Checkpoint**：三个用户故事均已独立验证完成，登录闭环外的语言精简功能整体可用。

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 文档同步与整体质量门控

- [X] T014 [P] 更新根 [README.md](../../README.md)：语言列表由 8 种（`en`/`es`/`fr`/`de-DE`/
      `pt-PT`/`ja`/`zh`/`zh-TW`）改为 4 种（`en`/`es`/`fr`/`zh`），SSG 页面数量说明由 67 页改为
      32 页（主页 4 + 工具详情 6×4=24 + 隐私政策 4）
- [X] T015 运行 `pnpm exec tsc --noEmit`，确认零编译错误，即无任何文件仍引用已移除语言键
- [X] T016 运行 `pnpm test`，确认全部测试通过，且不包含针对已移除语言的过时断言或快照
- [X] T017 运行 `pnpm build`，确认静态生成页面数量为 32（而非 67）
- [X] T018 按 [quickstart.md](./quickstart.md) 场景 1、2、3、5 完成剩余手动验证（场景 4 已在
      T013 中完成）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**：无外部依赖，可立即开始；**阻塞**所有用户故事
- **User Stories (Phase 2-4)**：均依赖 Foundational 完成
  - US1（T004-T005）与 US2（T006-T012）可并行进行（不同文件，互不依赖）
  - US3（T013）依赖 Foundational 即可验证，与 US1/US2 无代码依赖，可并行进行
- **Polish (Phase 5)**：T014 可随时进行；T015-T018 依赖期望交付的用户故事全部完成

### User Story Dependencies

- **US1 (P1)**：仅依赖 Foundational，与 US2/US3 无直接依赖
- **US2 (P1)**：仅依赖 Foundational，与 US1/US3 无直接依赖
- **US3 (P2)**：仅依赖 Foundational（无需额外代码修改），与 US1/US2 无直接依赖

### Parallel Opportunities

- Foundational 阶段：T002 可与 T001 并行（不同文件）；T003 依赖 T001+T002
- T004-T005（US1）与 T006-T012（US2）可整体并行（不同文件集合）
- T006-T012 内部除均标记 `[P]` 外互相独立，可全部并行
- Polish 阶段 T014 可与 T004-T013 并行；T015-T018 需等待前序全部任务完成后串行执行（质量门控）

---

## Parallel Example: User Story 2

```bash
Task: "从 src/data/tools.ts 移除 de-DE/ja/pt-PT/zh-TW 键"
Task: "从 src/data/privacy.ts 移除 de-DE/ja/pt-PT/zh-TW 语言条目"
Task: "更新 src/components/LanguageSelector.test.tsx 的语言断言"
Task: "更新 src/components/SiteFooter.test.tsx 与其快照文件"
Task: "更新 src/components/ToolCard.test.tsx 测试夹具"
Task: "更新 src/lib/i18n.test.ts 的语言相关用例"
Task: "更新 src/lib/language.test.ts 的语言数量断言"
```

---

## Implementation Strategy

### MVP First（仅 Foundational + User Story 2）

1. 完成 Phase 1: Foundational（关键阻塞项，收窄类型系统）
2. 完成 Phase 3: User Story 2（完整清除已移除语言入口——用户描述的核心诉求）
3. **停下并验证**：按 quickstart.md 场景 3 独立测试语言切换器与数据结构不含已移除语言
4. 视情况继续 US1（文案数字更新）与 US3（回退行为验证）

### Incremental Delivery

1. Foundational → 类型系统就绪，`tsc` 开始暴露待清理位置
2. 加入 US2（清除入口）→ 独立验证 → 核心诉求达成
3. 加入 US1（文案数字更新）→ 独立验证 → 内容准确性达成
4. 加入 US3（回退验证）→ 独立验证 → 收尾体验确认
5. Polish：README 同步、全量质量门控

---

## Notes

- [P] 任务 = 不同文件、无依赖关系
- [Story] 标签用于将任务追溯到具体用户故事
- 每个用户故事完成后均可独立验证（见各 Checkpoint）
- 严格按 FR-001～FR-010 对应实现，不引入 spec 未要求的额外能力（如重定向兼容层）
- 宪法"技术规范"章节的国际化语言列表更新 **不在本 tasks 范围内**，需在本功能验收后另行运行
  `/speckit.constitution`（见 plan.md Constitution Check 中的说明）
- 每完成一个任务或一组逻辑相关任务后提交一次
