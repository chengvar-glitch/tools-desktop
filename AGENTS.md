# AGENTS.md

本仓库中 ZCode agent 的工作指南。

## 项目

`tools-desktop` 是一个 Electron 桌面应用，基于 [electron-vite](https://electron-vite.org)、React 19 和 TypeScript 构建。包管理器用 **pnpm**（有 pnpm-lock.yaml + pnpm-workspace.yaml），不要用 npm/yarn。本目录不是 git 仓库。

## 常用命令

- `pnpm dev` — dev server，main/preload/renderer 均支持 HMR。
- `pnpm typecheck` — 对两个 TS 项目都做类型检查（`typecheck:node` + `typecheck:web`）。任何改动后都要跑；项目没有配置测试套件。
- `pnpm lint` — ESLint（flat config，带缓存）。`pnpm format` — Prettier。
- `pnpm build` — typecheck + `electron-vite build`（输出到 `out/`）。
- `pnpm build:win` / `build:linux` / `build:mac` — 用 electron-builder 打安装包。注意：`build:mac` 会跳过 typecheck；win/linux 会先跑 `pnpm build`。

## 架构：三个隔离的进程

- `src/main` — Electron 主进程（Node 侧）。入口 `src/main/index.ts`：app 生命周期、BrowserWindow 创建、`ipcMain` 处理器。构建产物为 `out/main/index.js`（对应 package.json 的 `main` 字段）。
- `src/preload` — 桥接层。通过 `contextBridge` 暴露 `window.electron`（electron-toolkit API）和 `window.api`（自定义）。新增面向 renderer 的 API 时，必须同时加到 `src/preload/index.ts` 的 `api` 对象里 **并且** 在 `src/preload/index.d.ts` 中补类型（该文件包含在 renderer tsconfig 中），否则 `window.api` 类型检查不通过。
- `src/renderer` — React UI。入口 `src/renderer/src/main.tsx`，组件在 `src/renderer/src/components`。
- `src/renderer/src/tools` — 各个工具页面（DiffTool / SortTool / OrderTool / JsonTool / ColorTool / PasswordTool / HashTool），由 `App.tsx` 的侧边栏 Tab 挂载；纯逻辑放在 `src/renderer/src/lib`（`diff.ts` 手写 Myers diff，`lines.ts` 排序去重，`orders.ts` 单号提取与格式化，`json.ts` JSON/YAML/TS 接口，`color.ts` 色彩空间与对比度，`secrets.ts` 密码/哈希/Base64，`copy.ts` 剪贴板），不要在组件里堆算法，逻辑改动优先补 `lib` 里的断言。

新增工具时的约定：逻辑先写进 `lib/*.ts`（纯函数、不碰 DOM），页面组件只用 state + `useMemo` 调这些函数；复制一律用 `components/CopyButton`（内部走 `lib/copy.ts`）；共享布局类用 `components/toolStyles.ts` 的 `useToolStyles()`；写完在 `App.tsx` 的 `tools` 数组里注册一个 tab（图标从 `@fluentui/react-icons` 选）。

边界规则：

- renderer 代码禁止 import `src/main`/`src/preload`，也禁止直接用 Node builtins / `electron` — 必须走 preload 桥接的 IPC（`ipcMain.on/handle` ↔ `window.electron.ipcRenderer`）。
- 目前 renderer 用到的自定义 IPC 只有剪贴板写入：`window.api.writeClipboard(text)` → main 的 `clipboard:write` handler。`copy.ts` 会优先走它，失败再退回 `navigator.clipboard` / `execCommand`。
- `webPreferences` 设置了 `sandbox: false`；保持 context isolation 开启，只通过 `contextBridge` 暴露 API。
- 外部 URL 由 main 中的 `setWindowOpenHandler` 强制走 `shell.openExternal` — renderer 里的 `window.open` 永远不会创建窗口。

## UI 组件库：Fluent UI v9

- 统一用 **Fluent UI v9**：组件从 `@fluentui/react-components` 按需 import，图标从 `@fluentui/react-icons`。不要装/引入旧版 v8（`@fluentui/react`、`@fluentui/react-northstar`）。
- 使用 Fluent 组件的 UI 子树必须包在 `<FluentProvider>` 里并传入 theme（如 `webLightTheme` / `webDarkTheme`），否则组件渲染异常。
- 整体是 **微软 Fluent 2 浅色**：`main.tsx` 固定用 `webLightTheme`，主进程里设了 `nativeTheme.themeSource = 'light'`（系统深色模式下原生控件也保持浅色）。组件内颜色一律用 `tokens.*`，只有全局那几处走 `assets/base.css` 的变量（`--color-chrome` 标题栏/侧边栏、`--color-surface`、滚动条色）。diff 的增删改底色是写死的浅色十六进制值（`DiffTool.tsx` 顶部常量），换主题时要一并改。
- 字体与 `~/dev/nexashell` 对齐，**纯系统字体栈、不引入 web font / `@font-face`**：`base.css` 的 `--font-sans` = nexashell `src/styles/design-system.css` 全局字体栈 + 前置的 Linux 族名（`Ubuntu Sans` / `Ubuntu` / `Cantarell` / `Noto Sans` / `DejaVu Sans`）和 `system-ui`，中文补了 `Noto Sans CJK SC`、emoji 补了 `Noto Color Emoji`。**顺序不能随意动**：Linux 的 fontconfig 会把不认识的族名替换成系统默认字体（中文环境下常是 CJK 字体），所以能用具体字体名打头就不能用 `-apple-system`、`Segoe UI` 这类只在 macOS/Windows 存在的名字打头，否则整条列表后面的项在 Ubuntu 上永远轮不到。`--font-mono` 抄自同文件的 `--font-mono`（`DejaVu Sans Mono` 打头，Ubuntu 上一定命中）。正文基准 14px / line-height 1.6。等宽场景（diff 表格、各 textarea）统一用 `components/toolStyles.ts` 导出的 `MONO_FONT`（即 `var(--font-mono)`），不要再写别的 monospace 名字。
- 样式走组件库自带的 griffel（CSS-in-JS），无需额外 vite/babel 配置；全局样式仍在 `src/renderer/src/assets` 的 CSS 里。

## TypeScript 布局

Solution 风格的 `tsconfig.json`，引用两个 composite 项目：

- `tsconfig.node.json` — `src/main`、`src/preload`、`electron.vite.config.*`。
- `tsconfig.web.json` — `src/renderer/src` 加上 `src/preload/*.d.ts`。

路径别名：`@/*` 和 `@renderer/*` 都指向 `src/renderer/src/*`（新代码用 `@/*`），在 `electron.vite.config.ts` 和 `tsconfig.web.json` 中都有配置。main/preload 没有别名 — 用相对路径 import。

## 代码风格

Prettier（`.prettierrc.yaml`）：单引号、无分号、print width 100、无尾逗号。ESLint 用 `@electron-toolkit` 的 TS/React presets，外加 react-hooks 和 react-refresh。现有代码在函数上声明显式返回类型（如 `function createWindow(): void`）— 保持这个风格。

## 依赖

除 Electron/React/Fluent 外，工具逻辑只用了几个纯 JS 小库（都无原生依赖、无 postinstall 脚本）：

- `json5` — JSON 工具的宽松解析（注释 / 尾逗号 / 单引号 / 无引号键）。
- `jsonc-parser` — 只用来定位严格模式的语法错误位置。原因：新版 V8 的 `JSON.parse` 报错经常只给一段上下文片段、不给 position，`jsonc-parser` 能给出精确 offset，据此换算行列并配上人话提示（`HINTS` 表）。
- `yaml` — JSON ⇄ YAML 互转。
- `culori` — 色彩空间转换、WCAG 对比度、色域映射（OKLCH 这类空间自己写容易错，交给它）。注意它不带类型，用 `@types/culori`；其 `colorsNamed` 的值是 24 位整数而不是 hex 字符串，需要自己转。
- `spark-md5` — MD5（WebCrypto 不提供 MD5），配 `@types/spark-md5`。

新增依赖前先确认是纯 JS、能在 renderer 里跑（不能依赖 Node builtins），并跑一遍 `pnpm build` 确认打包正常。

## 坑

- `.npmrc` 把 Electron/electron-builder 的二进制下载指向 npmmirror.com，并设置了 `shamefully-hoist=true`。没验证过 `pnpm install` 仍可用之前，不要删。
- `postinstall` 会跑 `electron-builder install-app-deps` — 原生依赖有变动时必须执行。
- `resources/` 里的文件在 main 中以 `?asset` 后缀引入（如 `../../resources/icon.png?asset`），打包时会 asar-unpack。
- 平台相关行为在 `src/main/index.ts`：macOS 上所有窗口关闭后 app 仍存活，点击 dock 会重建窗口；Linux 构建需要把图标传给 `BrowserWindow`。
- 顶部没有独立标题栏（Linux `titleBarStyle: 'hidden'` 自绘）：侧边栏和内容区各自顶部 40px 是拖拽条（`.titlebar-drag`），放在里面的控件必须带 `.titlebar-action` 类（`no-drag`）才能点。侧边栏折叠按钮用**绝对定位**固定在窗口左上角（`toggleFloat`，macOS 留 84px 让开 `hiddenInset` 红绿灯，其他平台 8px），折叠/展开时位置不变——放进侧边栏顶部条里会在折叠成 56px 时压到红绿灯。窗口控制按钮（最小化/最大化/关闭，走 `window:*` IPC）只在 Linux 渲染，浮在右上角。标题栏双击最大化是自绘的（`App.tsx`）。
- Linux 上 `node_modules/**/electron/dist/chrome-sandbox` 必须是 root 属主 + 4755（setuid），否则 Electron 启动直接 FATAL abort（"SUID sandbox helper binary ... not configured correctly"），或表现为 GPU 子进程反复 launch 失败（error_code=1002）后 "GPU process isn't usable. Goodbye." 退出。`pnpm install` 或重装 Electron 会重置权限，需重新执行：`sudo chown root:root <path>/chrome-sandbox && sudo chmod 4755 <path>/chrome-sandbox`。
- **不要用 `app.disableHardwareAcceleration()`**：本机（Wayland + 软件渲染）下它会让 `ready-to-show` 永不触发，而 `createWindow` 依赖该事件调 `show()`，窗口就永远不显示（进程还活着、页面也加载完了，只是没有窗口）。当初加它是为了绕开上面的 GPU 子进程崩溃，但那其实是 chrome-sandbox 权限问题——修权限，别禁硬件加速。
- 自动更新脚手架已就位（`electron-updater` 依赖、`dev-app-update.yml`、`electron-builder.yml` 中的 appId `com.electron.app`）；main 中 AppUserModelId 设为 `com.electron`。
