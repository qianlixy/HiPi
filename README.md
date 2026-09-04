# HiPi Desktop Client

基于 **PI Coding Agent**（[pi.dev](https://pi.dev/docs/latest)）底层包装实现的智能编程桌面客户端（类似 OpenCode / Codex 体验）。

## ✨ 核心特性

- 🎯 **独立沙箱与平滑升级**：底层 PI 引擎运行在独立的隔离沙箱（`~/.hipi/pi-runtime`），不污染系统全局环境。支持在客户端设置中一键在线检测并升级 PI 版本。
- ⚡ **原生 RPC 驱动**：基于官方 `pi --mode rpc` 双向 JSONL 流式协议，实现高响应度的实时 Token 流、思考预算配置与工具调用状态追踪。
- 📂 **多工作空间进程池**：支持同时打开多个工程目录，每个工程维护常驻的独立 PI 子进程，切换即刻就绪，后台流式互不干扰。
- 🗂️ **会话按工程归组**：自动扫描解析本地历史会话记录（`~/.pi/agent/sessions/`），按工作空间分类管理，支持一键新建与无缝切换。
- 📦 **折叠式工具卡片**：Markdown 富文本渲染结合折叠式工具卡片，直观查看 Bash 命令行实时输出、文件修改 Diff 与状态。
- 🔑 **配置与环境变量管理**：继承开发机既有环境，并在客户端设置中心支持灵活配置 Anthropic、OpenAI、Gemini、DeepSeek 等服务商密钥。

## 🛠️ 技术架构

- **桌面运行时**: Electron 34+
- **构建工具**: electron-vite + Vite 6
- **UI 技术栈**: React 19 + Tailwind CSS + Lucide Icons + React Markdown
- **开发语言**: TypeScript 5.7+

## 🚀 启动与运行

### 1. 安装依赖
```bash
npm install
```

### 2. 本地开发
```bash
npm run dev
```

### 3. 构建打包
```bash
npm run build
```

## 📁 目录结构

```
hipi/
├── src/
│   ├── main/                       # Electron 主进程
│   │   ├── index.ts                # 主窗口创建与生命周期管理
│   │   ├── store.ts                # 本地持久化配置 (~/.hipi/settings.json)
│   │   ├── runtime/
│   │   │   └── pi-runtime.ts       # ~/.hipi/pi-runtime 沙箱初始化与升级器
│   │   ├── rpc/
│   │   │   ├── rpc-client.ts       # 单工作空间 PI RPC 进程 (stdin/stdout JSONL)
│   │   │   └── process-pool.ts     # 多工作空间常驻进程池
│   │   ├── session/
│   │   │   └── session-scanner.ts  # ~/.pi/agent/sessions 历史扫描与解析
│   │   └── ipc/
│   │       └── register-handlers.ts# 统一 IPC 路由注册
│   ├── preload/                    # Preload 安全桥接层
│   │   ├── index.ts                # typed window.hipiApi 暴露
│   │   └── index.d.ts
│   └── renderer/                   # 前端渲染进程 (React + Tailwind)
│       ├── src/
│       │   ├── App.tsx             # 核心应用流式状态流转与调度
│       │   ├── components/
│       │   │   ├── sidebar/        # 侧边栏与工作空间会话分组
│       │   │   ├── header/         # 顶部状态、模型与思考预算选择器
│       │   │   ├── chat/           # 聊天流区、折叠工具卡片与输入框
│       │   │   └── settings/       # 密钥配置与 PI 升级中心
│       │   └── types/              # 前后端共享类型声明
```
