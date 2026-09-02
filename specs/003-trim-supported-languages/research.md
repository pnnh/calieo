# Research: 精简支持语言（仅保留英/法/西/简中）

## 1. 语言集合收窄的实现方式

**Decision**：直接从 `src/lib/language.ts` 的 `LangKey` 联合类型与 `supportedLanguages` 数组中移除
`langDe`（`de-DE`）、`langPt`（`pt-PT`）、`langJa`（`ja`）、`langZhTW`（`zh-TW`）四个字面量/条目，
保留 `langEn`/`langEs`/`langFr`/`langZh`。

**Rationale**：

- `src/lib/i18n.ts` 的 `locales: Record<LangKey, LocaleMessages>` 与 `src/data/tools.ts`/
  `src/data/privacy.ts` 中的 `Record<LangKey, ...>` 字面量在 `LangKey` 收窄后会因多余属性/属性个数不匹配
  产生 TypeScript 编译错误，天然地把所有仍引用已移除语言键的位置暴露出来，作为变更范围的编译期核对
  清单，避免遗漏（符合宪法"质量门控"——`/speckit.tasks` 阶段应包含 `pnpm exec tsc --noEmit` 作为验证
  步骤）。
- `isValidLang`/`getTargetLang` 无需改动实现逻辑，收窄 `supportedKeys` 后行为自动生效（已移除语言的
  路径自动变为无效语言，触发既有 `notFound()`；`accept-language` 库的匹配范围也随 `supportedKeys`
  自动收窄）。

**Alternatives considered**：

- 保留 `LangKey` 中的 8 个字面量、仅从 `supportedLanguages` 数组中移除已移除语言：会导致
  `isValidLang`/`i18n.ts` 等处仍需手写额外的"排除已移除语言"判断，且失去编译器强制核对的收益，
  增加不必要的双重来源（类型 vs 运行时数组），予以否决。

## 2. 本地化文件与数据条目清理范围

**Decision**：

- 删除 `src/locales/de-DE.json`、`ja.json`、`pt-PT.json`、`zh-TW.json` 四个文件；`en.json`/
  `es.json`/`fr.json`/`zh.json` 保留并更新其中提及语言数量的文案。
- `src/data/tools.ts`（6 个工具的 `name`/`description`/`features`/`detail` 四个 `LangMap`/
  `LangMapArray` 字段）与 `src/data/privacy.ts`（`privacyContent`）中，`de-DE`/`ja`/`pt-PT`/
  `zh-TW` 对应的键值对整体删除。

**Rationale**：TypeScript 的 `Record<LangKey, T>` 字面量赋值受"多余属性检查"约束，`LangKey` 收窄后
这些文件中残留的已移除语言键会直接报错，实现阶段可据此逐一清理，无需额外的静态分析工具。

**已发现的特殊内容（需在 tasks 中单独处理，非本 research 的新增假设，而是现有内容审查发现）**：

- `tools.ts` 中 BaseX、CryptoX、RandomX、WeJSON 四个工具的 `features`/`detail` 文案（`en`/`es`/`fr`/
  `zh` 四个保留语言版本）均硬编码提及"支持 8 种语言 / Available in 8 languages / Disponible en 8
  idiomas / Disponible en 8 langues"，需同步改为"4 种语言 / 4 languages / 4 idiomas / 4 langues"。
- `Timeis` 工具的 `features`/`detail` 文案措辞不同，明确列出"支持 6 种语言：中文、英语、西班牙语、
  法语、日语、葡萄牙语 / Available in 6 languages"，其中列举的语言列表本身就包含即将移除的日语、
  葡萄牙语；此处需改为"支持 4 种语言：中文、英语、西班牙语、法语 / Available in 4 languages"（同时
  修正列表内容，而不仅是数字）。
- `HashX` 工具的文案未提及语言数量，无需改动。

## 3. 测试与快照更新策略

**Decision**：

- `src/lib/language.test.ts`：将 `"contains at least 8 entries"` 断言改为准确反映 4 种语言的数量
  （如 `toBe(4)`），并更新涉及 `zh-TW`/`de-DE` 的注释说明（逻辑本身仍可通过，因为断言的是
  `isValidLang(result)` 为真，但注释文字应如实反映已移除语言不再存在）。
- `src/lib/i18n.test.ts`：将"returns German translation for de-DE"用例移除或替换为其余保留语言
  （如改用 `fr`/`es`）。
- `src/components/LanguageSelector.test.tsx`：将测试中使用 `"ja"` 作为切换目标语言的用例改为使用
  保留语言（如 `"fr"`），避免断言一个不再存在的语言键。
- `src/components/SiteFooter.test.tsx`：移除"renders German footer snapshot"用例；对应地从
  `src/components/__snapshots__/SiteFooter.test.tsx.snap` 中删除该快照条目（而不是运行
  `vitest -u` 生成新快照，因为该语言已不存在，不应保留任何形式的快照）。
- `src/components/ToolCard.test.tsx`：测试夹具（`TOOL_FIXTURE`/`TOOL_FIXTURE_2` 等）中的
  `LangMap`/`LangMapArray` 字面量同样受 `Record<LangKey, ...>` 类型收窄影响，移除已移除语言键。

**Rationale**：优先"替换断言的语言"而非"直接删除测试用例"，以保持测试覆盖率不因语言收窄而下降
（除非该用例的唯一目的就是验证已移除语言本身，如 German 快照测试，此时删除该用例是正确做法）。

## 4. 与宪法"技术规范"章节的一致性

**Decision**：本次 `/speckit.plan`/`/speckit.implement` 范围 **不** 修改
`.specify/memory/constitution.md`；变更实现完成后，另行运行 `/speckit.constitution` 将"技术规范 >
国际化"一行从 8 种语言更新为 4 种语言（`en`/`es`/`fr`/`zh`），按 PATCH 版本记录。

**Rationale**：宪法 Governance 规则要求宪法条款的增删/语义变更必须通过专门的 `/speckit.constitution`
命令提出，不应作为某个功能实现的副作用被顺带修改，以保持宪法修订历史的可追溯性与独立评审。

## 5. README.md 更新范围

**Decision**：更新 `README.md` 中"8 languages"语言列表、67 页 SSG 页面数说明为准确的 4 语言与
32 页（主页 4 + 工具详情 6×4=24 + 隐私政策 4）。

**Rationale**：README 是项目对外的事实描述，语言支持范围变更后必须同步，否则与实际实现不符
（宪法原则 II："若文档与代码冲突，MUST 明确指出差异...建议更新文档"，本次是文档需主动跟随代码
变更，而非相反）。
