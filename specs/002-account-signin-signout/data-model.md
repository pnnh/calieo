# Data Model: 账号登录/登出（Calieo OIDC 单点登录）

## Session（新增实体，对应新增 `sessions` 表）

| 字段 | 类型 | 说明 |
| ------ | ------ | ------ |
| `id` | `text` PK | 会话令牌的 SHA-256 哈希（hex）。Cookie 中下发的是原始随机令牌，数据库不存明文令牌。 |
| `userId` | `text` NOT NULL，外键 → `users.id`（`onDelete: cascade`） | 所属用户；用户被删除时级联删除其全部会话。 |
| `createdAt` | `integer` NOT NULL | 会话创建时间（Unix 毫秒）。 |
| `expiresAt` | `integer` NOT NULL | 过期时间（毫秒）= `createdAt` + `SESSION_TTL_DAYS` × 86400000（签发时按当时环境变量计算并落库，天数变更不追溯影响已签发会话）。 |

**关系**：`User 1 --- N Session`（同一用户可同时持有多条独立会话，对应 spec FR-010：会话彼此独立，
不互踢）。

**校验规则**：

- 读取 Cookie 中的会话令牌 → 计算 SHA-256 → 按 `id` 查表 → 若不存在或 `expiresAt <= now()` 视为
  无效会话（FR-009）。
- 会话失效（主动退出 FR-011 或过期 FR-009）时，对应行从表中删除（而非仅打标记），避免会话表无限增长。

**不包含的字段（有意省略，避免过度设计）**：User-Agent、IP、设备指纹等——spec 不要求"踢出其他会话"能力
（FR-010），关键安全事件已通过应用日志（见下）记录，不需要在会话表中冗余存储。

## User（沿用既有实体，`src/db/schema.ts` 的 `users` 表，无结构变更）

| 字段 | 说明 |
| ------ | ------ |
| `id` | 既有主键（`createId()` 生成） |
| `name` | 显示名称；模拟登录提交的用户名（可选）用于新建用户时填充，留空时回退为邮箱 `@` 前缀 |
| `email` | 唯一索引；模拟登录与 Calieo 登录共用同一匹配依据（spec FR-015） |
| `nickname` / `bio` | 既有字段，本功能不涉及 |
| `createdAt` | 既有字段 |

**匹配/创建规则**（模拟登录与 Calieo 登录共用同一段逻辑，位于 `src/lib/auth.ts` 或其抽出的
辅助函数）：

1. 按 `email` 查找现有用户 → 命中则复用（忽略本次传入的用户名，不覆盖既有 `name`，避免会话中的
   临时展示名污染既有资料）。
2. 未命中则以 `email` + `name`（模拟登录的用户名或 Calieo `name`/`email` 声明，留空回退邮箱前缀）
   新建一行。

## OIDC 临时握手状态（不落库，仅短生命周期 Cookie）

| 字段 | 说明 |
| ------ | ------ |
| `state` | `oauth4webapi.generateRandomState()` 生成，随授权请求发出，回调时比对 |
| `codeVerifier` | `oauth4webapi.generateRandomCodeVerifier()` 生成，令牌交换时使用 |
| `returnTo` | 登录成功后应返回的页面路径，默认 `/{lang}/console` |
| `lang` | 触发登录时所在语言，用于回调后失败提示与重定向 |

存放于名为 `oidc_txn` 的 httpOnly Cookie（JSON 序列化），`Max-Age=300`（5 分钟），回调处理完成后
（无论成功失败）立即清除。不使用数据库表存储，因为该状态生命周期极短、单次性，落库属于不必要的持久化
（宪法"简洁优先"）。

## 应用安全日志事件（不落库，结构化日志）

对应 spec FR-013，事件名与关键字段（沿用 `auth.ts` 现有 `toErrorDetails`/`console.warn` 风格）：

| 事件 | 触发时机 | 关键字段 |
| ------ | ---------- | ---------- |
| `auth.signin.success` | 登录成功（模拟或 Calieo） | `userId`、`method`（`dev` \| `calieo`） |
| `auth.signin.failure` | 登录失败（含模拟登录被生产环境拒绝） | `method`、`reason` |
| `auth.oidc.state_mismatch` | `state` 校验失败 | `lang` |
| `auth.oidc.pkce_failure` | PKCE 校验失败 | `lang` |
| `auth.oidc.token_invalid` | 令牌校验失败（签名/`iss`/`aud`/`exp`） | `lang`、`reason` |
| `auth.session.created` | 会话创建 | `userId`、`sessionIdHash` |
| `auth.session.revoked` | 会话失效（主动退出或过期） | `sessionIdHash`、`reason`（`signout` \| `expired`） |
