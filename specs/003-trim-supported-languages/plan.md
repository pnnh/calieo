# Implementation Plan: 精简支持语言（仅保留英/法/西/简中）

**Branch**: `003-trim-supported-languages` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-trim-supported-languages/spec.md`

## Summary

将 Calieo 支持的语言从 8 种（`en`/`es`/`fr`/`de-DE`/`pt-PT`/`ja`/`zh`/`zh-TW`）精简为 4 种
（`en`/`es`/`fr`/`zh`），完全移除德语、日语、葡萄牙语、繁体中文对应的本地化文件、语言切换器选项、
工具与隐私政策数据条目、静态生成页面（67 → 32 页），并同步更新提及语言数量的文案与
`README.md`。做法是从 `LangKey` 联合类型中直接移除已移除语言的字面量，借助 TypeScript 编译错误
定位所有仍引用这些语言键的位置，逐一清理；已移除语言路径继续沿用现有 `isValidLang` + `notFound()`
机制返回标准 404，无需新增代码路径。

## Technical Context

**Language/Version**: TypeScript 5，Next.js 16（App Router）（与现有仓库一致，无变化）

**Primary Dependencies**: 无新增依赖；沿用现有 `accept-language` 库与既有组件（`LanguageSelector`、
`SiteFooter` 等）

**Storage**: N/A — 本功能仅涉及前端静态内容、路由与静态生成配置，不涉及数据库 schema 或 API

**Testing**: Vitest（组件/单元测试 + 快照，沿用 `*.test.tsx`/`*.test.ts` 既有约定）；Playwright
（`e2e/home.spec.ts` 回归检查，验证不受语言精简影响）

**Target Platform**: Cloudflare Workers（OpenNext，生产）；`next dev`（本地开发），与现有一致

**Project Type**: Web 应用（沿用现有 Next.js App Router 单体结构，无拆分）

**Performance Goals**: 无新增性能指标；预期 SSG 构建页面数从 67 降至 32，构建耗时相应减少

**Constraints**: 保留语言（`en`/`es`/`fr`/`zh`）现有页面、文案、功能 MUST 100% 不受影响；移除语言的
路径 MUST 复用现有 `isValidLang`/`notFound()` 机制，不引入重定向或兼容层

**Scale/Scope**: 2 个核心库文件（`language.ts`、`i18n.ts`）、4 个本地化文件删除、2 个数据文件
（`tools.ts`、`privacy.ts`）瘦身、5 个测试文件更新、1 份快照文件更新、`README.md` 更新

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. 语言规范**：本 plan 及 research/data-model/quickstart 均使用简体中文撰写 ✅
- **II. 上下文优先**：已阅读 `src/lib/language.ts`、`src/lib/i18n.ts`、`src/data/tools.ts`、
  `src/data/privacy.ts`、相关测试文件（`language.test.ts`、`i18n.test.ts`、`LanguageSelector.test.tsx`、
  `SiteFooter.test.tsx` 及其快照、`ToolCard.test.tsx`）、`README.md`、`.specify/memory/constitution.md` ✅
- **III. 精准手术式修改**：变更范围严格限定于语言相关代码、数据与文档；不触碰 `002-account-signin-signout`
  等无关功能模块 ✅
- **IV. 简洁优先**：直接删除已移除语言的数据条目与文件，不引入迁移层、兼容重定向或特性开关等额外抽象 ✅
- **V. 质量门控**：本 plan 提供 research/quickstart 作为验证检查点；`/speckit.tasks` 阶段 MUST 包含
  `pnpm exec tsc --noEmit`（借助编译错误定位遗漏的语言引用）、`pnpm test`、`pnpm build`（核实页面数为 32）
  的执行步骤 ✅
- **VI. 需求诚实性与变更保护**：spec 已明确保留/移除的语言集合，无遗留假设需要确认 ✅
- **⚠️ 与宪法"技术规范"章节的一致性（需后续处理，非本计划阻塞项）**：`.specify/memory/constitution.md`
  当前"技术规范"章节写明"国际化：支持 `en`、`es`、`fr`、`zh`、`zh-TW`、`de-DE`、`pt-PT`、`ja`"共 8 种语言。
  本功能完成后代码将仅支持 4 种，与该行文字产生不一致。根据宪法 Governance 规则，宪法条款的增删/语义
  变更 MUST 通过 `/speckit.constitution` 命令提出，不属于 `/speckit.plan`/`/speckit.implement` 的修改
  范围，因此本计划 **不会** 直接编辑 `constitution.md`。**建议**：本功能实现并验收后，运行
  `/speckit.constitution` 将"国际化"一行更新为"支持 `en`、`es`、`fr`、`zh`"，按 PATCH 版本（措辞澄清，
  非新增/删除原则）记录。在此之前两者的暂时不一致已如实记录在案，不视为宪法违规。

无需 Complexity Tracking（无宪法原则级违规，仅存在上述待后续同步的文档一致性事项）。

## Project Structure

### Documentation (this feature)

```text
specs/003-trim-supported-languages/
├── plan.md              # 本文件（/speckit.plan 输出）
├── research.md          # Phase 0 输出
├── data-model.md        # Phase 1 输出
├── quickstart.md        # Phase 1 输出
└── tasks.md             # Phase 2 输出（/speckit.tasks 生成，本命令不创建）
```

未生成 `contracts/`：本功能不新增或变更任何对外 API/页面契约（`isValidLang` + `notFound()` 的既有
404 行为保持不变，仅收窄有效语言集合），纯属内部内容与配置调整，不适用契约文档。

### Source Code (repository root)

```text
src/
├── lib/
│   ├── language.ts          # 修改：LangKey 联合类型与 supportedLanguages 收窄为 4 项
│   ├── language.test.ts     # 检查/更新：确认无已移除语言的专属断言
│   ├── i18n.ts               # 修改：locales 映射与 import 收窄为 4 个文件
│   └── i18n.test.ts          # 修改：移除 de-DE 专属测试用例，改用保留语言
├── locales/
│   ├── en.json / es.json / fr.json / zh.json   # 修改：语言数量文案（如"8 种语言"→"4 种语言"）
│   └── de-DE.json / ja.json / pt-PT.json / zh-TW.json   # 删除
├── data/
│   ├── tools.ts               # 修改：6 个工具的 name/description/features/detail 移除 4 语言字段
│   └── privacy.ts             # 修改：privacyContent 移除 4 语言条目
└── components/
    ├── LanguageSelector.test.tsx        # 修改：将对已移除语言（如 ja）的断言改为保留语言
    ├── SiteFooter.test.tsx              # 修改：移除"German footer snapshot"用例
    ├── __snapshots__/SiteFooter.test.tsx.snap   # 修改：移除对应的 German 快照条目
    └── ToolCard.test.tsx                # 修改：测试夹具移除 4 语言字段

README.md                # 修改：语言列表与 SSG 页面数量说明（67 → 32）
```

**Structure Decision**：沿用仓库现有单体 Next.js App Router 结构，不新增目录或模块；变更集中在
既有的语言配置、数据文件与测试文件内部，无新文件产生（除本 feature 的 spec 文档外）。

## Complexity Tracking

> 无宪法原则级违规需要说明，本节留空（"技术规范"文档一致性事项已在 Constitution Check 中记录并给出
> 后续处理路径，不构成需要复杂度论证的架构违规）。
