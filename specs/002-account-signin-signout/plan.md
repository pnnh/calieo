# Implementation Plan: 账号登录/登出（Calieo OIDC 单点登录）

**Branch**: `002-account-signin-signout` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-account-signin-signout/spec.md`

## Summary

为 Calieo 新增 `/{lang}/account/signin`、`/{lang}/account/signout` 两个页面，作为全站统一登录/登出入口：
生产环境仅提供"通过 Calieo 登录"（基于 `oauth4webapi` 实现的 OAuth2 OIDC Authorization Code + PKCE，
Issuer 为 `https://portal.calieo.xyz`）；开发环境额外保留邮箱 + 用户名（可选）模拟登录表单。
登录成功后统一在服务器端创建会话记录（新增 `sessions` 表，SQLite/D1），向浏览器下发不透明会话 ID Cookie
（固定 7 天有效期，天数可经环境变量配置），会话之间互不踢出。同时移除 `src/lib/auth.ts` 及全站身份识别
代码对 Cloudflare Access（Zero Trust）请求头/Cookie 的依赖，生产环境身份识别完全改为基于本功能的会话
机制；移除现存的 `/{lang}/console/signin`、`/{lang}/console/signout` 页面。关键安全事件（登录成功/失败、
state/PKCE/令牌校验失败、会话创建与失效）记录到应用日志；不新增应用层限流（交由 Cloudflare 边缘层）。

## Technical Context

**Language/Version**: TypeScript 5，Next.js 16（App Router）、React 19（沿用现有仓库版本）

**Primary Dependencies**: Next.js、Drizzle ORM、`oauth4webapi`（新增，OIDC Authorization Code + PKCE 客户端，
无依赖且 Cloudflare Workers 原生兼容）

**Storage**: Cloudflare D1（SQLite，经 Drizzle ORM）；本地开发经 `better-sqlite3` 回退（沿用 `src/db/index.ts`
既有的 D1/本地 SQLite 双通道）。新增 `sessions` 表，沿用既有 `users` 表。

**Testing**: Vitest（组件/单元测试，沿用 `*.test.tsx` 既有约定）；Playwright（`e2e/*.spec.ts`，视需要补充登录流程用例）

**Target Platform**: Cloudflare Workers（OpenNext 适配器，生产部署）；`next dev` / `wrangler dev`（本地开发）

**Project Type**: Web 应用（Next.js App Router 单体项目，无独立前后端拆分）

**Performance Goals**: 与现有 SSR/动态路由页面保持一致，无本功能专属性能指标

**Constraints**: 所有登录/回调逻辑必须能在 Cloudflare Workers（`nodejs_compat`）运行时下工作，不得依赖仅
Node.js 可用而 Workers 不支持的 API；会话 Cookie 与 OIDC 临时状态 Cookie 均须 `httpOnly` + 生产环境 `Secure`

**Scale/Scope**: 2 个新页面（`/account/signin`、`/account/signout`）、1 个新增回调路由组、`auth.ts` 重写、
`sessions` 表迁移、移除 2 个旧页面（`/console/signin`、`/console/signout`）及其身份识别回退路径

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. 语言规范**：本 plan 及后续 research/data-model/quickstart 均使用简体中文撰写 ✅
- **II. 上下文优先**：已阅读根 `README.md`、`src/lib/auth.ts`、`src/db/schema.ts`、`src/db/index.ts`、
  `wrangler.jsonc`、`drizzle.config.ts`、现有 `/console/signin`、`/console/signout` 实现 ✅
- **III. 精准手术式修改**：变更范围严格对应 spec 的 FR-001～FR-017；`getCurrentUser()` 对外签名与抛错语义
  保持不变，仅替换内部身份来源，降低对现有调用方（`/console`、`/files`、`/channels`、API 路由）的影响面 ✅
- **IV. 简洁优先**：采用 `oauth4webapi` 而非自行实现 OIDC/PKCE 密码学细节，避免重造轮子；OIDC 临时
  state/PKCE 使用短生命周期 httpOnly Cookie 而非额外数据表，减少不必要的持久化设计 ✅
- **V. 质量门控**：本 plan 提供 research/data-model/quickstart 作为可验证检查点；`/speckit.tasks` 阶段
  MUST 包含迁移脚本执行、`pnpm test`、`pnpm test:e2e` 校验步骤 ✅
- **VI. 需求诚实性与变更保护**：范围性假设已在 `/speckit.clarify` 会话中确认（见 spec.md Clarifications），
  无遗留未澄清的破坏性变更 ✅
- **新增依赖评估**（技术规范"新增依赖 MUST 经过必要性评估"）：`oauth4webapi` 是用户在原始需求中明确指定
  的库；现有技术栈无 OIDC 客户端能力，自行实现 Authorization Code + PKCE 涉及安全敏感的密码学操作，属于
  不应重造的轮子，符合"优先使用已有技术栈能力"原则的例外情形 ✅

无宪法冲突，无需填写 Complexity Tracking。

## Project Structure

### Documentation (this feature)

```text
specs/002-account-signin-signout/
├── plan.md              # 本文件（/speckit.plan 输出）
├── research.md          # Phase 0 输出
├── data-model.md        # Phase 1 输出
├── quickstart.md        # Phase 1 输出
├── contracts/           # Phase 1 输出
│   └── auth-api.md
└── tasks.md              # Phase 2 输出（/speckit.tasks 生成，本命令不创建）
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── [lang]/
│   │   ├── account/
│   │   │   ├── signin/
│   │   │   │   └── page.tsx        # 新增：登录页（模拟登录表单 + Calieo 登录入口）
│   │   │   └── signout/
│   │   │       └── page.tsx        # 新增：登出页
│   │   └── console/
│   │       ├── signin/             # 移除（由 account/signin 取代）
│   │       └── signout/            # 移除（由 account/signout 取代）
│   └── api/
│       └── auth/
│           └── calieo/
│               ├── start/route.ts     # 新增：发起 OIDC 授权跳转
│               └── callback/route.ts  # 新增：OIDC 回调（校验 state/PKCE、建立会话）
├── db/
│   └── schema.ts            # 修改：新增 sessions 表定义
├── lib/
│   ├── auth.ts               # 重写：会话校验取代 Cloudflare Access 解析
│   ├── session.ts            # 新增：会话创建/校验/失效、Cookie 读写
│   └── oidc.ts                # 新增：oauth4webapi 客户端封装（发现文档、授权 URL、令牌交换）
└── locales/*.json             # 修改：新增登录/登出相关文案 key（8 语言）

migrations/
└── 000X_sessions_table.sql   # 新增：由 drizzle-kit 生成

tests/（沿用现有 *.test.tsx 与 e2e/*.spec.ts 约定，随 tasks.md 补充）
```

**Structure Decision**：沿用仓库现有单体 Next.js App Router 结构（无独立 backend/frontend 拆分）。新增
`src/app/api/auth/calieo/*` 作为 OIDC 授权/回调的服务端路由，`src/lib/session.ts` + `src/lib/oidc.ts` 承载
新逻辑，`src/lib/auth.ts` 原地重写但保留对外函数签名，最大限度减少对现有受保护页面调用方的改动面。

## Complexity Tracking

> 无宪法违规需要说明，本节留空。
