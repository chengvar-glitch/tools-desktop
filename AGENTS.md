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

边界规则：
- renderer 代码禁止 import `src/main`/`src/preload`，也禁止直接用 Node builtins / `electron` — 必须走 preload 桥接的 IPC（`ipcMain.on/handle` ↔ `window.electron.ipcRenderer`）。
- `webPreferences` 设置了 `sandbox: false`；保持 context isolation 开启，只通过 `contextBridge` 暴露 API。
- 外部 URL 由 main 中的 `setWindowOpenHandler` 强制走 `shell.openExternal` — renderer 里的 `window.open` 永远不会创建窗口。

## TypeScript 布局

Solution 风格的 `tsconfig.json`，引用两个 composite 项目：
- `tsconfig.node.json` — `src/main`、`src/preload`、`electron.vite.config.*`。
- `tsconfig.web.json` — `src/renderer/src` 加上 `src/preload/*.d.ts`。

路径别名：`@renderer/*` → `src/renderer/src/*`，在 `electron.vite.config.ts` 和 `tsconfig.web.json` 中都有配置。main/preload 没有别名 — 用相对路径 import。

## 代码风格

Prettier（`.prettierrc.yaml`）：单引号、无分号、print width 100、无尾逗号。ESLint 用 `@electron-toolkit` 的 TS/React presets，外加 react-hooks 和 react-refresh。现有代码在函数上声明显式返回类型（如 `function createWindow(): void`）— 保持这个风格。

## 坑

- `.npmrc` 把 Electron/electron-builder 的二进制下载指向 npmmirror.com，并设置了 `shamefully-hoist=true`。没验证过 `pnpm install` 仍可用之前，不要删。
- `postinstall` 会跑 `electron-builder install-app-deps` — 原生依赖有变动时必须执行。
- `resources/` 里的文件在 main 中以 `?asset` 后缀引入（如 `../../resources/icon.png?asset`），打包时会 asar-unpack。
- 平台相关行为在 `src/main/index.ts`：macOS 上所有窗口关闭后 app 仍存活，点击 dock 会重建窗口；Linux 构建需要把图标传给 `BrowserWindow`。
- 自动更新脚手架已就位（`electron-updater` 依赖、`dev-app-update.yml`、`electron-builder.yml` 中的 appId `com.electron.app`）；main 中 AppUserModelId 设为 `com.electron`。
