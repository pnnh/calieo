# Quickstart: 账号登录/登出（Calieo OIDC 单点登录）功能验证

## 前置条件

- 已安装依赖：`pnpm install`（含新增的 `oauth4webapi`）
- 已应用数据库迁移（新增 `sessions` 表）：`pnpm db:migrate`
- 本地 `.env`（或 `.dev.vars`）已配置：

  ```
  CALIEO_OIDC_ISSUER=https://portal.calieo.xyz
  CALIEO_OIDC_CLIENT_ID=<在 Calieo 侧注册的测试客户端 ID>
  CALIEO_OIDC_CLIENT_SECRET=<对应密钥>
  CALIEO_OIDC_REDIRECT_URI=http://localhost:7300/api/auth/calieo/callback
  SESSION_TTL_DAYS=7
  ```

## 场景 1：开发环境模拟登录（User Story 2）

1. `pnpm dev`，访问 `http://localhost:7300/en/account/signin`
2. 确认页面上方展示邮箱 + 用户名（可选）表单，下方展示"通过 Calieo 登录"按钮
3. 输入一个此前未使用过的邮箱（用户名留空），点击登录
4. **预期**：跳转到 `/en/console`（或 `return_to` 指定页面），数据库中新增一条 `users` 行与一条
   `sessions` 行
5. 打开浏览器开发者工具，确认存在会话 Cookie（`httpOnly`，值为不透明随机字符串，非可读身份信息）
6. 再次访问 `/en/account/signin` 并用同一邮箱登录 → **预期**：不产生新的 `users` 行，仅新增一条
   `sessions` 行

## 场景 2：通过 Calieo 登录（User Story 1）

1. 访问 `/en/account/signin`，点击"通过 Calieo 登录"
2. **预期**：跳转至 `https://portal.calieo.xyz` 的授权页面
3. 在 Calieo 完成认证后，浏览器被重定向回
   `http://localhost:7300/api/auth/calieo/callback?code=...&state=...`
4. **预期**：最终落地到登录前的目标页面，已建立会话；若该邮箱首次出现则自动新建用户

## 场景 3：退出登录（User Story 3）

1. 在已登录状态下访问 `/en/account/signout`，确认展示当前用户信息
2. 点击退出登录按钮
3. **预期**：跳转到 `/en/account/signout?signed_out=true` 并展示已退出提示；再次访问任意受保护页面
   （如 `/en/console`）被重定向回登录页
4. 在另一个浏览器（或隐私模式窗口）中保持登录 → **预期**：该浏览器会话不受第 2 步影响，仍可正常访问
   受保护页面

## 场景 4：生产环境仅保留 Calieo 登录

1. 以生产模式构建并预览：`pnpm adapter && pnpm preview`
2. 访问 `/en/account/signin`
3. **预期**：页面不渲染邮箱/用户名模拟登录表单，仅有"通过 Calieo 登录"入口
4. 尝试直接向模拟登录的 Server Action / 底层接口发起请求（如通过修改过的前端脚本绕过 UI）
5. **预期**：请求被服务器拒绝，不建立会话，应用日志中记录 `auth.signin.failure`

## 场景 5：安全事件日志

1. 故意访问一个 `state` 参数被篡改的回调 URL（例如手动修改 `state` 查询参数后再访问
   `/api/auth/calieo/callback`）
2. **预期**：不建立会话，重定向回登录页展示统一失败提示，应用日志中出现
   `auth.oidc.state_mismatch` 事件（不包含内部实现细节）

## 回归检查

- `pnpm test`：现有 `src/lib/*.test.ts`、组件测试全部通过（尤其是依赖 `getCurrentUser()` 的用例）
- `pnpm test:e2e`：`e2e/home.spec.ts` 等既有用例不受影响
- 确认 `/{lang}/console/signin`、`/{lang}/console/signout` 路径已移除（访问返回 404）
