# Tasks: 账号登录/登出（Calieo OIDC 单点登录）

**Input**: Design documents from `/specs/002-account-signin-signout/`

**Prerequisites**: [plan.md](./plan.md)（必需）、[spec.md](./spec.md)（用户故事）、[research.md](./research.md)、
[data-model.md](./data-model.md)、[contracts/auth-api.md](./contracts/auth-api.md)、[quickstart.md](./quickstart.md)

**Tests**: spec.md 未显式要求 TDD 或额外测试用例，本任务列表不新增独立测试任务；质量门控通过
Polish 阶段运行既有 `pnpm test` / `pnpm test:e2e` 回归检查 + `quickstart.md` 手动验证场景保证（宪法 V）。

**Organization**: 任务按 spec.md 中的用户故事（US1/US2/US3）分组，Foundational 阶段完成后各故事
均可独立验证。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件、无依赖关系）
- **[Story]**: 所属用户故事（US1/US2/US3）
- 描述中均包含具体文件路径

## Path Conventions

单体 Next.js App Router 项目，源码位于仓库根目录 `src/`（详见 plan.md 的 Project Structure）。

---

## Phase 1: Setup（共享基础设施）

**Purpose**: 引入本功能所需的新依赖

- [X] T001 安装 `oauth4webapi` 依赖：在仓库根目录执行 `pnpm add oauth4webapi`

---

## Phase 2: Foundational（阻塞性前置工作）

**Purpose**: 所有用户故事共同依赖的会话机制、身份识别改造、文案基础设施

**⚠️ CRITICAL**: 本阶段完成前不得开始任何用户故事的实现

- [X] T002 [P] 在 `src/db/schema.ts` 新增 `sessions` 表定义（字段：`id` 文本主键存会话令牌 SHA-256
      哈希、`userId` 外键关联 `users.id` 且 `onDelete: cascade`、`createdAt`、`expiresAt`，均为
      `integer` 毫秒时间戳），并补充 `sessionsRelations`（`session.user` 多对一）与
      `usersRelations` 中新增 `sessions: many(sessions)`
- [X] T003 基于 T002 的 schema 变更，执行 `pnpm drizzle-kit generate` 生成 `sessions` 表迁移文件到
      `migrations/`，并在本地执行 `pnpm db:migrate` 验证迁移可正确应用（依赖 T002）
- [X] T004 [P] 新增 `src/lib/session.ts`：
      - 生成高熵随机会话令牌（`crypto.getRandomValues`，Base64URL 编码）与其 SHA-256 哈希
      - 从环境变量读取 `SESSION_TTL_DAYS`（默认 `7`，无法解析时按默认值处理并记录警告）
      - `createSession(userId)`：写入 `sessions` 行，返回原始令牌供设置 Cookie
      - `getSessionUser(cookies)`：读取会话 Cookie → 计算哈希 → 查表 → 校验未过期 → 返回
        `{ sessionId, userId }` 或 `null`
      - `revokeSession(cookies)`：删除当前会话 Cookie 对应的 `sessions` 行并清除 Cookie
      - Cookie 读写辅助：`httpOnly`、生产环境 `Secure`、`SameSite=Lax`、`Path=/`，
        `Max-Age` 按 `SESSION_TTL_DAYS` 计算
- [X] T005 [P] 在 `src/lib/auth.ts` 新增 `logSecurityEvent(event, details)` 辅助函数，按
      data-model.md「应用安全日志事件」表输出结构化 `console.log`/`console.warn`（沿用文件内既有
      `toErrorDetails` 风格），供后续任务复用
- [X] T006 重写 `src/lib/auth.ts` 的 `getCurrentUser()`：
      - 移除 `getAccessUserBase()` 及其对 `cf-access-jwt-assertion`、
        `cf-access-authenticated-user-email` 请求头与 `CF_Authorization` Cookie 的解析
      - 移除 `getDevEmail()`、`DEV_USER_BASE` 兜底逻辑与 `dev_email` Cookie 读取
      - 改为调用 T004 的 `getSessionUser()` 获取 `userId`，无有效会话时抛出与既有契约一致的
        "Unauthenticated request" 错误（保持函数导出签名、`CurrentUser` 返回类型不变）
      - 保留并复用既有 `ensureUserRow()` 按邮箱创建/复用用户的逻辑（供后续会话创建流程调用）
      （依赖 T004、T005）
- [X] T007 更新 `src/app/[lang]/console/layout.tsx`：
      - 移除基于 `cf-access-jwt-assertion`/`cf-access-authenticated-user-email` 请求头调用
        `upsertUser`（`@/lib/db`）的追踪逻辑（该逻辑仅服务于即将移除的 Cloudflare Access 识别路径）
      - 将 `await getCurrentUser()` 包裹在 `try/catch` 中，捕获未认证异常后
        `redirect(`/${lang}/account/signin?return_to=${encodeURIComponent(当前请求路径)}`)`
      （依赖 T006）
- [X] T008 [P] 在 `src/locales/{en,es,fr,de-DE,pt-PT,ja,zh,zh-TW}.json` 新增登录/登出相关文案 key
      （沿用既有 `devSignIn*`/`devSignOut*` 系列命名风格新增，如登录页标题、邮箱/用户名字段标签、
      "通过 Calieo 登录"按钮文案、登录失败提示、退出登录按钮与提示等）

**Checkpoint**: 会话机制与全站身份识别改造就绪，可开始并行实现各用户故事

---

## Phase 3: User Story 1 - 通过 Calieo 登录 (Priority: P1) 🎯 MVP

**Goal**: 用户可通过 Calieo（OIDC Authorization Code + PKCE）完成登录并建立会话

**Independent Test**: 按 quickstart.md 场景 2，从 `/account/signin` 点击"通过 Calieo 登录"，
在 Calieo 完成认证后跳回本站并建立会话

### Implementation for User Story 1

- [X] T009 [P] [US1] 新增 `src/lib/oidc.ts`：封装 `oauth4webapi`
      - 缓存 `https://{CALIEO_OIDC_ISSUER}/.well-known/openid-configuration` 发现结果
      - `buildAuthorizationRequest({ lang, returnTo })`：生成 `state`/PKCE `code_verifier`/
        `code_challenge`，返回授权 URL 与待写入 `oidc_txn` Cookie 的载荷
      - `handleAuthorizationCallback({ txn, code, state })`：校验 `state` 一致性，调用
        `authorizationCodeGrant` 完成令牌交换与 ID Token 校验（签名/`iss`/`aud`/`exp`），返回
        `email`/`name` 声明或标准化的失败原因（`state_mismatch`/`pkce_failure`/`token_invalid`）
- [X] T010 [US1] 新增 `src/app/api/auth/calieo/start/route.ts`：读取 `lang`/`return_to` 查询参数，
      调用 T009 的 `buildAuthorizationRequest`，写入 `oidc_txn` httpOnly Cookie（5 分钟有效），
      302 重定向至 Calieo 授权端点（依赖 T009）
- [X] T011 [US1] 新增 `src/app/api/auth/calieo/callback/route.ts`：读取 `oidc_txn` Cookie 与回调
      查询参数，调用 T009 的 `handleAuthorizationCallback`；失败时按 data-model.md 事件表调用
      `logSecurityEvent`（`auth.oidc.state_mismatch`/`pkce_failure`/`token_invalid`），清除
      `oidc_txn`，302 跳转 `/{lang}/account/signin?error=1`；成功时复用 `ensureUserRow()` 按邮箱
      创建/复用用户、调用 `createSession()` 建立会话并设置会话 Cookie、记录
      `auth.signin.success`（`method=calieo`）与 `auth.session.created`，清除 `oidc_txn`，
      302 跳转 `oidc_txn` 中的 `returnTo`（缺省 `/{lang}/console`）（依赖 T009、T004、T006）
- [X] T012 [US1] 新增 `src/app/[lang]/account/signin/page.tsx`：渲染"通过 Calieo 登录"入口（始终
      展示，链接至 `/api/auth/calieo/start?lang={lang}&return_to={return_to}`）；已登录时展示当前
      用户信息（复用 `getCurrentUser()`，沿用现有 `/console/signin` 的展示模式）（依赖 T008、T010）
- [X] T013 [US1] 在 `src/app/[lang]/account/signin/page.tsx` 处理 `?error=1` 查询参数，展示统一的
      "登录失败，请重试"提示，不暴露内部错误细节（依赖 T012、T011）

**Checkpoint**: 生产环境下唯一登录路径（Calieo OIDC）已可独立完成登录与建会话验证

---

## Phase 4: User Story 2 - 开发环境模拟登录 (Priority: P2)

**Goal**: 开发环境下可通过邮箱 + 可选用户名直接登录，无需真实 Calieo 认证

**Independent Test**: 按 quickstart.md 场景 1，在开发环境下用新邮箱提交模拟登录表单，验证登录成功
且创建了对应用户；重复提交同一邮箱验证不产生重复用户

### Implementation for User Story 2

- [X] T014 [US2] 在 `src/app/[lang]/account/signin/page.tsx` 页面上方新增邮箱（必填）+ 用户名
      （可选）模拟登录表单：仅当 `process.env.NODE_ENV !== "production"` 时渲染表单 DOM
      （生产环境不渲染，对应 FR-004）（依赖 T012）
- [X] T015 [US2] 实现模拟登录 Server Action（`"use server"`，与 T014 同文件或拆分至同目录下的
      `actions.ts`）：生产环境下直接拒绝执行并调用 `logSecurityEvent("auth.signin.failure", ...)`；
      开发环境下校验邮箱格式 → 复用 `ensureUserRow()` 按邮箱+用户名创建/复用用户 → 调用
      `createSession()` 建立会话并设置会话 Cookie → 记录 `auth.signin.success`
      （`method=dev`）与 `auth.session.created` → 重定向至 `return_to` 或 `/{lang}/console`
      （依赖 T014、T004、T006）

**Checkpoint**: US1 与 US2 均可独立验证，登录闭环在开发环境下完全可用

---

## Phase 5: User Story 3 - 退出登录 (Priority: P3)

**Goal**: 已登录用户可在当前浏览器结束会话，且不影响其他浏览器的会话

**Independent Test**: 按 quickstart.md 场景 3，登录后访问 `/account/signout` 并退出，验证当前浏览器
无法再访问受保护页面，另一浏览器会话不受影响

### Implementation for User Story 3

- [X] T016 [US3] 新增 `src/app/[lang]/account/signout/page.tsx`：已登录时展示当前用户信息 + 退出
      登录按钮；未登录时提示未登录状态并提供指向 `/{lang}/account/signin` 的链接；支持
      `?signed_out=true` 查询参数展示已退出提示（沿用现有 `/console/signout` 的展示模式）
      （依赖 T006、T008）
- [X] T017 [US3] 实现退出登录 Server Action（同文件内 `"use server"`）：调用 T004 的
      `revokeSession()` 删除当前会话记录并清除 Cookie，记录
      `auth.session.revoked`（`reason=signout`），重定向至
      `/{lang}/account/signout?signed_out=true`（依赖 T016、T004）

**Checkpoint**: 三个用户故事均已独立可用，登录/登出闭环完整

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 收尾清理、文档与回归验证

- [X] T018 [P] 移除 `src/app/[lang]/console/signin/` 与 `src/app/[lang]/console/signout/` 整个目录
      （FR-016），并确认仓库内不再有指向这两个路径的 `Link`/`redirect` 引用（依赖 T012、T016 已可
      正常工作）
- [X] T019 [P] 在根 [README.md](../../README.md) 的 Development 部分补充本功能所需环境变量说明：
      `CALIEO_OIDC_ISSUER`、`CALIEO_OIDC_CLIENT_ID`、`CALIEO_OIDC_CLIENT_SECRET`、
      `CALIEO_OIDC_REDIRECT_URI`、`SESSION_TTL_DAYS`
- [X] T020 按 [quickstart.md](./quickstart.md) 场景 1～5 完成手动验证（模拟登录、Calieo 登录、退出
      登录、生产环境仅保留 Calieo 登录、安全事件日志），确认均符合预期
- [X] T021 运行 `pnpm test` 与 `pnpm test:e2e` 完成回归检查，确认既有依赖 `getCurrentUser()` 的
      测试与 `e2e/home.spec.ts` 等既有用例未被破坏

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**：无依赖，可立即开始
- **Foundational (Phase 2)**：依赖 Setup 完成；**阻塞**所有用户故事
- **User Stories (Phase 3-5)**：均依赖 Foundational 完成；US1/US2 共享 `account/signin/page.tsx`
  （US2 在 US1 基础上追加表单，需先有 T012），US3 相对独立
- **Polish (Phase 6)**：依赖期望交付的用户故事全部完成

### User Story Dependencies

- **US1 (P1)**：Foundational 完成后即可开始，无对其他故事的依赖
- **US2 (P2)**：依赖 US1 的 T012（同一页面文件）已创建，但表单逻辑本身独立于 Calieo 登录流程
- **US3 (P3)**：仅依赖 Foundational（T004 会话机制、T006 `getCurrentUser`），与 US1/US2 无直接依赖，
  可与它们并行开发

### Parallel Opportunities

- Foundational 阶段：T002、T004、T005、T008 可并行（不同文件）；T003 依赖 T002，T006 依赖
  T004+T005，T007 依赖 T006
- US1 的 T009 可与 Foundational 后期任务并行准备，但 T010/T011 需等待 T009 完成
- US3（T016、T017）可与 US1/US2 的实现并行进行（不同文件，仅共享 Foundational 产出）
- Polish 阶段 T018、T019 可并行

---

## Parallel Example: Foundational 阶段

```bash
Task: "在 src/db/schema.ts 新增 sessions 表定义"
Task: "新增 src/lib/session.ts 会话核心逻辑"
Task: "在 src/lib/auth.ts 新增 logSecurityEvent 辅助函数"
Task: "在 8 个语言文件新增登录/登出相关文案 key"
```

---

## Implementation Strategy

### MVP First（仅 User Story 1）

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational（关键阻塞项）
3. 完成 Phase 3: User Story 1（Calieo 登录）
4. **停下并验证**：按 quickstart.md 场景 2 独立测试 Calieo 登录
5. 如仅需生产可用的登录能力，此时已具备部署条件（US2/US3 可后续迭代）

### Incremental Delivery

1. Setup + Foundational → 会话与身份识别基础设施就绪
2. 加入 US1（Calieo 登录）→ 独立验证 → 生产环境登录能力可用（MVP）
3. 加入 US2（开发环境模拟登录）→ 独立验证 → 提升本地联调效率
4. 加入 US3（退出登录）→ 独立验证 → 登录闭环完整
5. Polish：移除旧页面、补文档、回归验证

---

## Notes

- [P] 任务 = 不同文件、无依赖关系
- [Story] 标签用于将任务追溯到具体用户故事
- 每个用户故事完成后均可独立验证（见各 Checkpoint）
- 严格按 FR-001～FR-017 对应实现，不引入 spec 未要求的额外能力
- 每完成一个任务或一组逻辑相关任务后提交一次
