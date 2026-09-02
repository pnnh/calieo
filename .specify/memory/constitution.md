<!--
Sync Impact Report
- Version change: 1.0.0 → 1.0.1 (PATCH — wording clarification, no principle added/removed)
- Modified principles: n/a
- Modified sections:
  - 技术规范 > 国际化：支持语言从 8 种（`en`/`es`/`fr`/`zh`/`zh-TW`/`de-DE`/`pt-PT`/`ja`）收窄为 4 种
    （`en`/`es`/`fr`/`zh`），以同步 002/003 功能实施后的实际代码支持范围（见
    specs/003-trim-supported-languages）
- Added sections: none
- Removed sections: none
- Deferred TODOs: none
-->

# Calieo Constitution

## Core Principles

### I. 语言规范（NON-NEGOTIABLE）

所有规格（spec.md）、计划（plan.md）、任务（tasks.md）、检查清单、评估报告、修复记录等治理产物
MUST 使用简体中文撰写。技术标识符（API 名称、类名、文件路径、库名、命令等）MAY 保留英文原文。
说明性文字、用户故事、验收标准、任务描述 MUST 使用中文。与用户的所有 AI 代理回复 MUST 使用中文。

**理由**：统一语言降低沟通歧义，确保团队成员可无障碍阅读所有治理文档。

### II. 上下文优先

执行任何操作前 MUST 先阅读根目录 `README.md` 及与任务相关的目录 `README.md`。
源代码是最终真相；若文档与代码冲突，MUST 明确指出差异（文件/行号），以代码为准，并建议更新文档（未被明确要求时不得直接修改文档）。
每次回复开头 MUST 用 1–2 句话总结当前上下文。工具调用应尽量精简，只使用最少必要的工具。

**理由**：在缺乏上下文的情况下操作容易产生错误假设，增加返工成本。

### III. 精准手术式修改

只改动解决所请求问题的必要部分。MUST NOT 重构、改进或触碰相邻代码、注释、格式。
每一行被修改的代码 MUST 能直接追溯到用户的请求。严格匹配现有代码风格。
只清理因本次修改而变得无用的内容。若用户明确要求更广泛的重构，MUST 先确认范围再执行。

**理由**：过度修改会引入非预期变更，增加 code review 负担，破坏代码可追溯性。

### IV. 简洁优先

只实现解决所请求问题的最少代码。MUST NOT 添加不必要的抽象、额外功能或防御性错误处理。
若 200 行可简化为 50 行，SHOULD 重写并遵循 YAGNI 原则。
执行前 MUST 对设计不合理（安全风险、架构违规、存在更简方案）的请求提出反对意见。

**理由**：过度工程化增加维护成本，降低代码可读性，背离项目长期健康目标。

### V. 质量门控

多步骤任务 MUST 先给出简要计划与可验证的检查点，再开始执行。
在工具允许的情况下，SHOULD 在最终输出前运行 linter / 类型检查 / 测试。
MUST 明确陈述假设；若存在多种解释，MUST 先提问或列出选项，不得默默假设。

**理由**：清晰的检查点减少中途返工，早期发现问题比事后修复成本更低。

### VI. 需求诚实性与变更保护（NON-NEGOTIABLE）

本项目禁止静默发明需求。用户未明确的行为 MUST NOT 写成已决定的功能需求，必须列为 Assumptions 或
`[NEEDS CLARIFICATION]`。进入 `/speckit.plan` 前，Assumptions MUST 经用户确认或被 clarify 消除。
未经明确授权，MUST NOT 改变现有公共 API、数据模型、权限与错误语义。
提出可能影响存量行为的需求时，MUST 先对照现有实现与测试并记录冲突。
安全、隐私、金钱、数据删除、权限提升类决策没有默认值，MUST 提问，不得代替用户决定。

**理由**：治理产物一旦包含臆造需求或未经授权的破坏性变更，将导致实现偏离用户真实意图，且难以事后纠正。

## 技术规范

本项目（Calieo）采用以下技术栈，所有实现决策 MUST 与此保持一致：

- **框架**：Next.js App Router（TypeScript）
- **部署**：Cloudflare Workers（open-next + wrangler）
- **数据库 ORM**：Drizzle ORM
- **包管理**：pnpm（workspace 模式）
- **国际化**：支持 `en`、`es`、`fr`、`zh`

新增依赖 MUST 经过必要性评估，优先使用已有技术栈中的能力。

## 沟通规范

- 禁止废话：删除所有填充词（"当然！"、"我理解了"、"没问题！"等）
- 代码优先；只有在逻辑不明显或涉及权衡时才解释原因（简要列出优缺点）
- 对安全问题、架构违规或存在更简单方案的请求，MUST 在执行前提出反对意见
- 回复目标：简洁、技术性强、可直接执行

## Governance

本宪法（Constitution）优先于其他一切实践与惯例约定；如有冲突，以本文件为准。

- **修订流程**：任何原则新增、删除或语义变更 MUST 通过 `/speckit.constitution` 提出，并在提交信息中说明修订类型（MAJOR/MINOR/PATCH）及理由。
- **版本策略**：遵循语义化版本 —— MAJOR 用于不兼容的治理/原则删除或重新定义；MINOR 用于新增原则或实质性扩展指导；PATCH 用于措辞澄清、错别字修正等非语义性修订。
- **合规审查**：所有 spec、plan、tasks 及代码变更在评审时 MUST 核对是否符合本宪法各项原则；发现冲突时以本宪法为准并要求整改。
- 依赖本宪法的模板与命令（`.specify/templates/*`、`speckit.*` 系列命令）在运行时读取本文件内容，不在本文件内维护其副本。

**Version**: 1.0.1 | **Ratified**: 2026-09-01 | **Last Amended**: 2026-09-02
