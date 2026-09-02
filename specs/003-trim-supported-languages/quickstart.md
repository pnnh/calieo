# Quickstart: 精简支持语言 功能验证

## 前置条件

- 已完成实现（`language.ts`/`i18n.ts`/`tools.ts`/`privacy.ts`/相关测试/README 均已更新）

## 场景 1：编译期核对无遗漏

1. 运行 `pnpm exec tsc --noEmit`
2. **预期**：无编译错误——若仍有文件引用 `de-DE`/`ja`/`pt-PT`/`zh-TW`，此步骤会先失败并指出具体
   文件与行号

## 场景 2：保留语言正常可用（User Story 1）

1. `pnpm dev`，依次访问 `/en/`、`/es/`、`/fr/`、`/zh/`
2. **预期**：页面正常渲染，内容完整；点击语言切换下拉框，只看到 4 个选项（English / Español /
   Français / 简体中文）
3. 依次访问任一工具详情页（如 `/en/tools/basex`）与隐私政策页（如 `/zh/privacy`）
4. **预期**：内容正常，文案中语言数量描述显示为"4"而非"8"（或"6"，针对 Timeis）

## 场景 3：已移除语言的入口被清除（User Story 2）

1. 打开任意页面的语言切换下拉框
2. **预期**：不出现"Deutsch”“日本語”“Português”“繁體中文”
3. 检查 `src/locales/` 目录
4. **预期**：只有 `en.json`、`es.json`、`fr.json`、`zh.json` 四个文件

## 场景 4：已移除语言路径优雅回退（User Story 3）

1. 访问 `/de-DE/`、`/ja/tools/basex`、`/pt-PT/privacy`、`/zh-TW/`
2. **预期**：均返回标准 404 页面
3. 以 `Accept-Language: de-DE` 请求根路径 `/`
4. **预期**：重定向到 `/en/`（默认语言）
5. 以 `Accept-Language: de-DE,fr;q=0.5` 请求根路径 `/`
6. **预期**：重定向到 `/fr/`（偏好列表中第一个仍受支持的语言）

## 场景 5：静态生成页面数量

1. 运行 `pnpm build`
2. **预期**：构建输出的静态页面数量为 32（主页 4 + 工具详情 6×4=24 + 隐私政策 4），不再是 67

## 回归检查

- `pnpm test`：全部测试通过，且不包含针对已移除语言的过时断言/快照
- `pnpm test:e2e`（如环境可用）：`e2e/home.spec.ts` 等既有用例不受影响
