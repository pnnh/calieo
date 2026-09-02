# Feature Specification: 账号登录/登出（Calieo OIDC 单点登录）

**Feature Branch**: `002-account-signin-signout`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "为当前项目实现/en/account/signin和/en/account/signout页面。在/en/account/signin上方添加表单允许输入邮箱和用户名（可选）并点击登录直接登录成功，若邮箱不存在则新建用户。同时在页面下方增加"通过Calieo登录"功能。其中"Calieo"是一种OAuth2 OIDC认证提供程序，地址是<https://portal.calieo.xyz。在开发环境下，保留输入邮箱和用户名模拟登录功能以方便调试，同时开放> Calieo 登录功能。但是在发布到生产环境后，仅保留"通过Calieo登录"功能。可以使用 oauth4webapi npm库实现 Authorization Code Flow + PKCE。使用服务器存储+不透明会话ID Cookie，在sqlite数据库中创建记录表用来存储会话。生产环境完全由 Calieo 登录取代 - 完全移除 Cloudflare Zero Trust 校验路径，生产环境身份识别只走 Calieo 登录会话。Cookie固定有效期7天（服务器.env可配置），过期需重新登录。允许会话在多个浏览器之间共存，不必实现互相踢出的逻辑。不用对登录授权等接口调用做限流等逻辑，交由 Cloudflare 边缘层防护。记录关键安全事件到应用日志。"

## Clarifications

### Session 2026-09-01

- Q: 现有的 `/{lang}/console/signin`、`/{lang}/console/signout`（基于 `dev_email` Cookie 的开发期模拟登录）在本功能上线后应如何处理？ → A: 移除，由本功能新建的 `/{lang}/account/signin`、`/{lang}/account/signout` 完全取代。
- Q: "生产环境身份识别只走 Calieo 登录会话"是否要求修改 `src/lib/auth.ts` 及全站其它认证相关代码，使整个网站（而不仅是新登录页）在生产环境下都改为经由 Calieo 会话识别身份，并完全移除 Cloudflare Zero Trust 校验路径？ → A: 是，需修改 `auth.ts` 及其它认证代码，全站生产环境完全由 Calieo 登录取代，完全移除 Cloudflare Zero Trust 校验路径。
- Q: 模拟登录与 Calieo 登录是否共用同一套会话表与用户表，而非维护两套并行的登录状态实现？ → A: 是，共用同一套会话表 + 用户表，不做两套并行实现。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 通过 Calieo 登录（Priority: P1）

用户访问需要登录的页面或直接打开登录页时，可以点击"通过 Calieo 登录"，跳转至 Calieo 身份提供方完成认证，认证成功后返回本站并处于已登录状态，无需在本站输入密码。

**Why this priority**：这是生产环境下唯一的登录入口，是本功能上线后系统身份识别的基础；没有它整个登录体系不可用。

**Independent Test**：在开发或生产环境下，未登录状态访问 `/{lang}/account/signin`，点击"通过 Calieo 登录"，在 Calieo 完成认证后跳回本站，验证已建立会话且可访问受保护页面。

**Acceptance Scenarios**:

1. **Given** 用户未登录且访问 `/{lang}/account/signin`，**When** 点击"通过 Calieo 登录"，**Then** 浏览器跳转至 `https://portal.calieo.xyz` 发起 OIDC 授权请求。
2. **Given** 用户在 Calieo 完成认证并被重定向回本站的回调地址，**When** 回调请求携带的 `state` 与 PKCE 校验均通过，**Then** 系统建立新的服务器端会话记录，向浏览器下发不透明会话 ID Cookie，并将用户导向登录前原本要访问的页面（或默认页面）。
3. **Given** 该邮箱在 Calieo 认证结果中首次出现（本地不存在对应用户），**When** 登录流程完成，**Then** 系统自动创建新用户记录。
4. **Given** 该邮箱已存在对应用户，**When** 登录流程完成，**Then** 系统复用已有用户记录，不产生重复用户。

---

### User Story 2 - 开发环境模拟登录（Priority: P2）

工程师在本地开发环境调试时，可以在 `/{lang}/account/signin` 页面上方的表单中输入邮箱和用户名（用户名可选），点击登录后立即以该身份登录成功，无需真实走 Calieo 认证流程；若该邮箱不存在则自动创建新用户。

**Why this priority**：显著提升本地联调效率，但仅服务于开发环境，不影响生产环境可用性，因此优先级低于 P1。

**Independent Test**：在开发环境下打开 `/{lang}/account/signin`，输入一个新邮箱并提交表单，验证登录成功且系统中新建了对应用户；再次输入同一邮箱登录，验证复用同一用户且未重复创建。

**Acceptance Scenarios**:

1. **Given** 当前为开发环境，**When** 用户在页面上方表单输入合法邮箱（用户名留空）并提交，**Then** 系统以该邮箱创建或复用用户并建立会话，跳转到已登录状态的页面。
2. **Given** 当前为开发环境，**When** 用户输入合法邮箱与用户名并提交，**Then** 新建用户时使用提交的用户名作为用户名称。
3. **Given** 当前为生产环境，**When** 用户访问 `/{lang}/account/signin`，**Then** 页面上不显示邮箱/用户名模拟登录表单，且直接向对应服务端提交请求也会被拒绝。

---

### User Story 3 - 退出登录（Priority: P3）

已登录用户访问 `/{lang}/account/signout` 并确认退出后，当前浏览器的登录会话立即失效，后续访问受保护页面需要重新登录；该用户在其他浏览器/设备上的会话不受影响。

**Why this priority**：是登录闭环的必要组成部分，但依赖 P1/P2 已建立的会话机制才能验证，因此排在其后。

**Independent Test**：在已登录状态下访问 `/{lang}/account/signout` 并提交退出，验证当前浏览器无法再访问受保护页面；在另一浏览器保持登录状态不受影响。

**Acceptance Scenarios**:

1. **Given** 用户已登录，**When** 访问 `/{lang}/account/signout` 并确认退出，**Then** 当前会话记录被失效、会话 Cookie 被清除，且后续访问受保护页面需重新登录。
2. **Given** 用户在浏览器 A 和浏览器 B 同时保持登录，**When** 在浏览器 A 退出登录，**Then** 浏览器 B 的会话继续有效，不受影响。
3. **Given** 用户当前未登录，**When** 访问 `/{lang}/account/signout`，**Then** 页面提示未登录状态，并引导前往登录页。

---

### Edge Cases

- Calieo 认证回调中 `state` 或 PKCE `code_verifier` 校验失败时，系统必须拒绝建立会话，记录安全事件，并向用户展示统一的登录失败提示（不暴露内部错误细节）。
- Calieo 服务不可用、超时或返回错误时，用户应看到明确的失败提示并可重试，不应产生无效或部分写入的会话记录。
- 会话 Cookie 过期（超过 7 天）后，用户访问受保护页面应被要求重新登录，而不是看到无法解释的错误。
- 生产环境下，若有人绕过前端直接向模拟登录接口发起请求，服务器端必须拒绝该请求（不能仅依赖隐藏 UI 元素）。
- 同一邮箱先后通过模拟登录与 Calieo 登录访问，应识别为同一用户，而不是产生两条用户记录。
- 用户在多个浏览器同时登录后，其中一个会话过期或被主动退出，不应影响其余仍在有效期内的会话。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 提供 `/{lang}/account/signin` 页面作为统一登录入口。
- **FR-002**: 开发环境下，`/{lang}/account/signin` 页面上方 MUST 展示邮箱（必填）与用户名（可选）的模拟登录表单；提交后若邮箱不存在则创建新用户，若已存在则直接以该用户身份登录，全程无需密码。
- **FR-003**: `/{lang}/account/signin` 页面（开发环境与生产环境均需）MUST 提供"通过 Calieo 登录"入口，点击后以 OAuth2 OIDC Authorization Code + PKCE 方式跳转至 Calieo（`https://portal.calieo.xyz`）发起认证。
- **FR-004**: 生产环境下，`/{lang}/account/signin` 页面 MUST NOT 渲染邮箱/用户名模拟登录表单；对应的服务器端处理逻辑 MUST 在生产环境下拒绝执行模拟登录，即使请求被直接发往后端。
- **FR-005**: Calieo 认证回调 MUST 校验授权响应中的 `state` 参数与 PKCE `code_verifier`，任一校验失败 MUST 中止登录、不建立会话，并记录对应安全事件。
- **FR-006**: 登录成功（无论模拟登录或 Calieo 登录）后，系统 MUST 在服务器端创建会话记录，并向浏览器下发不携带用户身份或令牌信息的不透明会话 ID Cookie。
- **FR-007**: 会话记录 MUST 持久化在 SQLite 数据库的会话表中，至少包含会话标识、所属用户、创建时间与过期时间。
- **FR-008**: 会话 Cookie 的有效期 MUST 固定为 7 天，且该天数 MUST 可通过服务器环境变量配置，无需修改代码。
- **FR-009**: 会话过期后，系统 MUST 视该会话为无效，用户 MUST 重新登录才能访问受保护资源。
- **FR-010**: 同一用户 MUST 能在多个浏览器/设备中同时持有各自独立、互不干扰的有效会话；系统 MUST NOT 实现"新登录使其他会话失效"的互踢逻辑。
- **FR-011**: 系统 MUST 提供 `/{lang}/account/signout` 页面，已登录用户确认退出后 MUST 使当前会话记录失效并清除对应会话 Cookie，且 MUST NOT 影响该用户在其他浏览器/设备上的其他有效会话。
- **FR-012**: 生产环境的用户身份识别 MUST 仅通过本功能建立的 Calieo 登录会话完成（具体涉及的代码路径范围见 FR-017）。
- **FR-013**: 系统 MUST 记录以下安全事件到应用日志：登录成功、登录失败、`state` 校验失败、PKCE 校验失败、令牌校验失败、会话创建、会话失效（含主动退出与过期两种情形）。
- **FR-014**: 系统 MUST NOT 为登录、Calieo 授权回调等相关接口实现应用层限流/节流逻辑（该职责由 Cloudflare 边缘层的 WAF / Rate Limiting 承担）。
- **FR-015**: 无论通过模拟登录还是 Calieo 登录，系统 MUST 以邮箱作为匹配/创建用户的唯一依据：邮箱不存在则创建新用户，邮箱已存在则复用现有用户记录，不产生重复用户。模拟登录与 Calieo 登录 MUST 共用同一套会话表与用户表，不得维护两套并行的登录状态实现。
- **FR-016**: 系统 MUST 移除现有的 `/{lang}/console/signin` 与 `/{lang}/console/signout` 页面及其 `dev_email` Cookie 模拟登录实现，由 `/{lang}/account/signin`、`/{lang}/account/signout` 完全取代。
- **FR-017**: 生产环境下，`src/lib/auth.ts` 及全站所有依赖身份识别的代码路径（包括但不限于 `/console`、`/files`、`/channels` 页面与相关 API 路由）MUST 改为基于本功能建立的 Calieo 会话进行身份识别；MUST 完全移除对 Cloudflare Access 请求头（`cf-access-jwt-assertion`、`cf-access-authenticated-user-email`）与 `CF_Authorization` Cookie 的解析和依赖，不得保留任何生产环境下可用的 Cloudflare Zero Trust 校验回退路径。

### Key Entities *(include if feature involves data)*

- **会话（Session）**：表示一次已认证的登录状态。关键属性：不透明会话标识（作为 Cookie 值下发，不编码任何身份信息）、所属用户、创建时间、过期时间（签发时间 + 可配置的有效天数）。与"用户"是多对一关系——同一用户可同时拥有多条有效会话记录（对应不同浏览器/设备），彼此独立失效。
- **用户（User）**：沿用现有用户实体，以邮箱唯一标识；模拟登录与 Calieo 登录共用同一份用户数据，不区分来源。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 生产环境用户点击"通过 Calieo 登录"后，在 Calieo 侧完成认证的前提下，可在跳转回本站后立即（不含用户在 Calieo 侧的操作耗时）进入原本要访问的页面或默认页面。
- **SC-002**: 开发环境工程师无需拥有真实 Calieo 账号，仅凭一个邮箱即可在几秒内切换为任意测试身份并开始调试。
- **SC-003**: 用户在一个浏览器中退出登录后，该浏览器 100% 无法再访问任何需要登录的页面；同时其在其他浏览器中的登录状态 100% 不受影响。
- **SC-004**: 会话在签发 7 天后 100% 自动失效，用户必须重新登录；该天数可仅通过修改服务器环境变量调整，无需改动代码或重新构建应用逻辑。
- **SC-005**: 登录失败、`state`/PKCE 校验失败、令牌校验失败、会话创建、会话失效等安全相关事件 100% 产生可供审计的应用日志记录。
- **SC-006**: 生产环境下，无法通过任何前端界面操作或直接的后端请求方式使用邮箱/用户名模拟登录进入系统。

## Assumptions

- 开发环境可继续保留现有默认开发身份兜底行为（如未显式登录时的默认调试用户），但需与本功能新建的会话机制保持一致，不得与被移除的 `dev_email` Cookie 方案并存。
- Calieo 返回的身份信息中的邮箱声明作为与本地用户匹配/创建的唯一依据；模拟登录表单中的用户名（可选）在创建新用户时作为用户名称，留空时回退为邮箱前缀。
- 未登录用户访问受保护页面时，系统会将用户引导至对应语言的 `/account/signin`；登录成功后返回值原本请求的页面，具体的"返回原页面"实现方式留给规划阶段设计。
- Calieo 一侧的 OAuth2 客户端凭据、回调地址等接入参数由服务器环境变量提供，本规格不固定具体变量名称。
- `state`/PKCE 校验失败或 Calieo 服务异常时，用户仅会看到统一的"登录失败，请重试"提示，不展示内部错误细节，以避免信息泄露。
