# Research: 账号登录/登出（Calieo OIDC 单点登录）

## 1. OIDC 客户端库选型

**Decision**：使用 `oauth4webapi` 实现 Authorization Code Flow + PKCE，对接 Calieo（Issuer
`https://portal.calieo.xyz`）。

**Rationale**：

- 用户在原始需求中明确指定使用该库（非本次调研发明）。
- 零运行时依赖、纯 Web 标准 API（`fetch`、`crypto.subtle`），已被验证可在 Cloudflare Workers
  （`nodejs_compat`）环境下运行，无需额外 polyfill。
- 提供 `discoveryRequest`/`processDiscoveryResponse` 自动读取
  `https://portal.calieo.xyz/.well-known/openid-configuration`，避免手写端点地址、签名算法协商等
  安全敏感逻辑。
- 内置 `generateRandomState`、`generateRandomCodeVerifier`、`calculatePKCECodeChallenge`、
  `authorizationCodeGrant`（自动校验 `state`、`iss`、令牌签名/`nonce` 等）。

**Alternatives considered**：

- 自行用 `fetch` + 手写 PKCE/state 校验：违反"简洁优先"，且 OIDC 令牌校验（签名、`aud`/`iss`/`exp`）
  属于安全敏感代码，自研风险高。
- `openid-client`：功能更重、面向 Node.js（依赖 `node:` 内置模块较深），Workers 兼容性不如
  `oauth4webapi` 明确。
- NextAuth.js / Auth.js：引入完整会话/适配器框架，与本功能"服务器存储 + 不透明会话 ID Cookie +
  自建 sessions 表"的既定设计冲突，属于过度依赖，不符合"新增依赖 MUST 经过必要性评估，优先使用已有
  技术栈能力"。

## 2. 会话（Session）存储与 Cookie 设计

**Decision**：

- 新增 `sessions` 表（Drizzle schema，随主库一起用 D1/本地 SQLite），仅存必要字段：会话标识的
  **哈希值**（`id`，SHA-256 hex）、`userId`、`createdAt`、`expiresAt`。
- 下发给浏览器的 Cookie 值是**原始随机令牌**（`crypto.getRandomValues` 生成的 256 位随机数，
  Base64URL 编码），数据库中只保存其哈希，不落库明文令牌。校验时对收到的 Cookie 值取哈希后按主键
  查表。
- Cookie 属性：`httpOnly`、生产环境 `Secure`、`SameSite=Lax`、`Path=/`、`Max-Age` = 可配置的
  `SESSION_TTL_DAYS`（默认 7）× 86400。

**Rationale**：

- 哈希存储可防止数据库读取权限泄露（备份、只读副本、SQL 注入等场景）直接拿到可用会话令牌，属于
  OWASP 建议的会话管理最佳实践。
- 不使用 `createId()`（基于 `uuidv7`，含时间戳前缀）作为会话令牌，因其可预测性高于纯随机数，不适合
  作为安全令牌；`sessions.id` 仍可使用该哈希值本身作为主键，无需额外 `createId()`。
- 会话表只保留 spec 要求的最小字段（FR-007），不添加 IP/User-Agent 等审计列，避免过度设计；这些
  信息如需审计，通过 FR-013 的应用日志（结构化 `console.log`/`console.warn`，沿用 `auth.ts` 现有
  `toErrorDetails` 风格）在事件发生时记录，不做关系型持久化。

**Alternatives considered**：

- 明文令牌直接作为主键：实现更简单，但一旦数据库泄露即等同于会话劫持，不符合安全基线，予以否决。
- 使用 Cloudflare KV 存储会话：需求已明确"sqlite 数据库中创建记录表"，且 KV 引入新绑定/新技术面，
  与既有 D1 + Drizzle 技术栈重复，予以否决。

## 3. OIDC 授权/回调路由设计

**Decision**：

- `GET /api/auth/calieo/start`：读取 `lang`、`return_to` 查询参数；生成 `state`、PKCE
  `code_verifier`/`code_challenge`；将 `{state, codeVerifier, returnTo, lang}` 写入短生命周期
  （5 分钟）httpOnly Cookie（`oidc_txn`，仅用于本次授权流程）；重定向至 Calieo 授权端点。
- `GET /api/auth/calieo/callback`：读取 `oidc_txn` Cookie 与回调查询参数；用 `oauth4webapi`
  的 `authorizationCodeGrant` 校验 `state` 并交换令牌（同时校验 ID Token 签名/`iss`/`aud`/`exp`）；
  校验失败记录安全事件并跳转回登录页展示统一失败提示；成功后以 ID Token 中的 `email` 声明为准调用
  与模拟登录共用的"按邮箱创建或复用用户"逻辑，建立会话并设置会话 Cookie，清除 `oidc_txn`，重定向到
  `returnTo`（不存在则回退到 `/{lang}/console`）。

**Rationale**：使用独立、不带 `[lang]` 前缀的 API 路由承载回调，因为 OAuth2 redirect_uri 通常需要在
Calieo 侧注册为固定地址，随语言变化的路径会增加对接与白名单维护成本；`lang`/`return_to` 改由查询参数
或 `oidc_txn` Cookie 传递，不影响多语言体验。

**Alternatives considered**：

- 把回调路径做成 `/{lang}/api/auth/callback`：需要在 Calieo 侧为 8 种语言各注册一个回调地址（或做
  正则白名单），显著增加对接复杂度，予以否决。

## 4. 生产环境移除 Cloudflare Access 依赖的影响面

**Decision**：`src/lib/auth.ts` 的 `getCurrentUser()` 对外签名与"未认证时抛错"的既有契约保持不变，
仅将内部身份来源从解析 `cf-access-jwt-assertion`/`cf-access-authenticated-user-email`/
`CF_Authorization` 改为读取并校验本功能的会话 Cookie；调用方（`/console/layout.tsx`、
`/files`、`/channels` 等布局与相关 API 路由）无需感知身份来源变化。对于"未登录时应引导至登录页"的
体验诉求（spec Assumptions），在受保护布局中捕获 `getCurrentUser()` 的异常并 `redirect()` 至
`/{lang}/account/signin?return_to=...`，而不是让请求以未处理异常结束。

**Rationale**：符合宪法"精准手术式修改"——最小化对现有调用方代码的改动面；同时满足 spec FR-017
"生产环境完全移除 Cloudflare Zero Trust 校验路径"的强约束。

**已知但不在本功能处理范围内的技术债（记录以避免实现时误判范围）**：

- `src/lib/db.ts` 的 `upsertUser`/`listUsers`（服务于 `/console/users` 管理页）通过原始 D1 SQL
  读写的 `users` 列（`sub`/`groups`/`country`/`iss`/`aud`/`last_seen_at`/`token_exp`）与
  `src/db/schema.ts` 的 Drizzle `users` 表结构不一致，且 `upsertUser` 目前仅由即将被移除的
  `console/layout.tsx` CF Access 追踪逻辑调用。本功能移除该调用后，`/console/users` 页面将不再
  更新（但不会报错、不阻塞本功能验收）；是否修复该页面的数据源留待后续独立变更处理，不在本次
  FR 范围内。

## 5. 环境变量

**Decision**：新增以下服务器环境变量（`.env` / `wrangler` secrets），均不在 spec 中固定强制默认值
（除 `SESSION_TTL_DAYS` 外均为必需的 Calieo 接入参数）：

| 变量 | 用途 | 默认值 |
| ------ | ------ | -------- |
| `CALIEO_OIDC_ISSUER` | Calieo OIDC Issuer 基地址 | `https://portal.calieo.xyz` |
| `CALIEO_OIDC_CLIENT_ID` | 已在 Calieo 侧注册的客户端 ID | 无（必填） |
| `CALIEO_OIDC_CLIENT_SECRET` | 客户端密钥（服务器端机密，走 Secrets） | 无（必填） |
| `CALIEO_OIDC_REDIRECT_URI` | 注册在 Calieo 侧的回调地址 | 无（必填） |
| `SESSION_TTL_DAYS` | 会话 Cookie 有效天数 | `7` |

**Rationale**：与仓库现有 `DEV_USER_ID`/`DEV_USER_EMAIL`/`DB_PATH` 等环境变量命名风格一致；客户端
密钥通过 Cloudflare Secrets（`wrangler secret put`）管理，不写入仓库或明文配置文件。
