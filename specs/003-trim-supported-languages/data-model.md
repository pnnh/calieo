# Data Model: 精简支持语言（仅保留英/法/西/简中）

本功能不涉及数据库 schema 或后端持久化实体；"数据"specifically 指前端语言配置与静态内容结构。

## 语言（Language）

| 属性 | 说明 |
|------|------|
| `key` | 语言标识（`LangKey` 联合类型的字面量），变更后仅剩 `en`、`es`、`fr`、`zh` 四个取值 |
| `name` | 语言切换器中展示的人类可读名称（如 "English"、"简体中文"） |

**变更前后对比**：

| 状态 | 语言集合 |
|------|----------|
| 变更前（8 种） | `en`、`es`、`fr`、`de-DE`、`pt-PT`、`ja`、`zh`、`zh-TW` |
| 变更后（4 种） | `en`、`es`、`fr`、`zh` |

**约束**：`defaultLanguage` 保持为 `en`（FR-007 / Assumptions）；`zh` 与 `zh-TW` 是两个独立条目，
移除 `zh-TW` 不影响 `zh` 的内容与匹配逻辑。

## 本地化内容（Localized Content）

以下结构均以 `LangKey` 为键，收窄后其类型定义会自动要求移除已移除语言对应的键（由 TypeScript
编译器强制核对，见 research.md 第 1 节）：

- **UI 文案**（`src/lib/i18n.ts` 的 `locales: Record<LangKey, LocaleMessages>`）：每种语言一个
  JSON 文件，删除 4 个已移除语言的文件。
- **工具内容**（`src/data/tools.ts` 的 `ToolData.name`/`description`/`features`/`detail`，类型为
  `LangMap`/`LangMapArray`，即 `Record<LangKey, string>`/`Record<LangKey, string[]>`）：6 个工具
  各自的这四个字段需移除已移除语言键。
- **隐私政策内容**（`src/data/privacy.ts` 的 `privacyContent: Record<LangKey, PrivacyContent>`）：
  移除已移除语言的完整 `PrivacyContent` 条目。

## 静态生成路由参数

`generateStaticParams()`（`src/app/[lang]/layout.tsx`、`src/app/[lang]/privacy/page.tsx`、
`src/app/[lang]/tools/[tool]/page.tsx`）均基于 `supportedLanguages` 生成 `{ lang }` 参数列表，
`supportedLanguages` 收窄后这些函数无需修改实现即可自动只生成 4 种语言 × 对应页面的组合
（32 页，见 spec SC-003）。
