# Contract: 登录/登出相关服务端接口

本项目为 Next.js App Router 单体应用，"接口"指服务端页面路由 + Server Action + API Route，而非独立
对外发布的公共 API。以下契约描述本功能新增/变更的服务端入口，供 `/speckit.tasks` 与实现阶段对齐。

## 页面路由

### `GET /{lang}/account/signin`

- 未登录时渲染登录页：
  - 开发环境（`NODE_ENV !== "production"`）：页面上方渲染邮箱（必填）+ 用户名（可选）表单，提交为
    Server Action（见下）；页面下方渲染"通过 Calieo 登录"按钮，链接到
    `/api/auth/calieo/start?lang={lang}&return_to={return_to}`。
  - 生产环境：仅渲染"通过 Calieo 登录"按钮，不渲染模拟登录表单 DOM。
- 已登录时：显示当前用户信息 + 提示可切换账号（沿用现有 `/console/signin` 的交互模式）。
- 查询参数：`return_to`（可选，登录成功后要返回的路径；缺省为 `/{lang}/console`）。

**Server Action：模拟登录**（仅开发环境处理，生产环境即使收到请求也 MUST 直接拒绝并记录
`auth.signin.failure`）：

- 输入：`email`（必填，需包含 `@`）、`username`（可选）
- 行为：按 email 查找/创建用户 → 创建会话 → 设置会话 Cookie → 记录 `auth.signin.success`
  （`method=dev`）→ 重定向到 `return_to` 或 `/{lang}/console`
- 失败（生产环境拦截、email 格式非法）：记录 `auth.signin.failure`，页面展示统一失败提示

### `GET /{lang}/account/signout`

- 已登录：展示当前用户信息 + 退出按钮（Server Action）
- 未登录：提示未登录状态，引导前往 `/{lang}/account/signin`

**Server Action：退出登录**：

- 行为：删除当前会话 Cookie 对应的 `sessions` 行 → 清除 Cookie → 记录 `auth.session.revoked`
  （`reason=signout`）→ 重定向到 `/{lang}/account/signout?signed_out=true`
- 仅影响当前浏览器持有的这一条会话记录，不影响同用户的其他会话（FR-011）

## API Routes（OIDC 授权/回调，无语言前缀）

### `GET /api/auth/calieo/start`

- 查询参数：`lang`（必填）、`return_to`（可选）
- 行为：生成 `state` + PKCE `code_verifier`/`code_challenge` → 写入 `oidc_txn` httpOnly Cookie
  （5 分钟有效）→ 302 重定向至 Calieo 授权端点（`response_type=code`、`scope` 至少含
  `openid email profile`、`code_challenge_method=S256`）

### `GET /api/auth/calieo/callback`

- 查询参数：Calieo 回调携带的 `code`、`state`（以及可能的 `error`/`error_description`）
- 前置条件：存在有效 `oidc_txn` Cookie 且其中 `state` 与查询参数一致
- 成功路径：
  1. 用 `oauth4webapi.authorizationCodeGrant` 完成令牌交换与 ID Token 校验
  2. 取 ID Token 的 `email`（必需，缺失则按失败处理）声明按邮箱创建/复用用户
  3. 创建会话，设置会话 Cookie，清除 `oidc_txn`
  4. 记录 `auth.signin.success`（`method=calieo`）、`auth.session.created`
  5. 302 重定向到 `oidc_txn` 中保存的 `return_to`（缺省 `/{lang}/console`）
- 失败路径（`state` 不匹配 / PKCE 校验失败 / 令牌校验失败 / Calieo 返回 `error` / 网络异常）：
  - 记录对应安全事件（`auth.oidc.state_mismatch` / `auth.oidc.pkce_failure` /
    `auth.oidc.token_invalid` / `auth.signin.failure`）
  - 清除 `oidc_txn`，不创建会话
  - 302 重定向回 `/{lang}/account/signin?error=1`，页面展示统一"登录失败，请重试"提示（不暴露内部
    错误细节）

## 受保护页面的身份识别（无新增路由，行为变更）

- `getCurrentUser()`（`src/lib/auth.ts`）：对外签名不变，内部改为校验会话 Cookie；未认证时行为与
  既有契约一致（抛出异常），调用方决定如何处理（详见下）。
- `/console`、`/files`、`/channels` 等受保护布局：捕获 `getCurrentUser()` 异常后
  `redirect()` 至 `/{lang}/account/signin?return_to={当前路径}`，取代此前"未处理异常"的行为。
