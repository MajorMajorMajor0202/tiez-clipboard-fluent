# TieZ Fluent

面向 Windows 的剪贴板管理与桌面效率工具。集中整理复制过的内容、常用片段、便笺和图片，通过搜索与快捷键随时取用，并按需连接 AI、云端同步和局域网传输。

基于 [tiez-clipboard](https://github.com/jimuzhe/tiez-clipboard)，使用 Fluent Design 2 重构界面。支持简体中文与 English，推荐使用 Windows 11。

[下载最新版本](https://github.com/MajorMajorMajor0202/tiez-clipboard-fluent/releases/latest) · [反馈问题](https://github.com/MajorMajorMajor0202/tiez-clipboard-fluent/issues)

## 主要功能

| 功能 | 用途 |
| --- | --- |
| 剪贴板历史 | 收集文本、代码、链接、富文本、图片及文件路径，搜索历史、预览内容并查看来源应用。可选择保留富文本格式。 |
| 分类与常用内容 | 通过置顶、标签与分组整理内容，合并重复记录，让常用片段方便复用。 |
| 快捷粘贴 | 全局快捷键唤出窗口，键盘选择条目；支持列表数字快捷粘贴、置顶内容快捷调用、顺次粘贴、带格式粘贴和无换行复制。快捷键可自行配置。 |
| 桌面便笺与贴图 | 创建和管理 Markdown 便笺，将文字或图片作为独立桌面窗口查看，方便记录待办、参考资料与临时信息。 |
| 表情收藏 | 浏览 Emoji、收藏图片表情，通过拖拽或添加文件整理常用素材。 |
| AI 文本助手 | 对文本进行问答、辅助回复（嘴替）和翻译；可配置 API 地址、密钥、模型，以及不同功能使用的模型策略。 |
| 同步与传输 | 通过 WebDAV 或 HTTP API 同步选定类型的剪贴板数据与表情收藏；通过 MQTT 接收验证码或文本；开启局域网接收服务后，其他设备可扫码发送文件。 |
| 数据与隐私 | 选择仅在内存中保存或持久化保存历史，设置记录上限；配置敏感文本遮罩、正则清洗和按来源应用忽略记录等策略。 |
| 个性化与后台使用 | Fluent 控件、Mica / Acrylic 外观、浅色 / 深色 / 跟随系统、紧凑布局；支持托盘、开机自启动、启动隐藏与窗口置顶。 |

## 下载与使用

在 [Releases](https://github.com/MajorMajorMajor0202/tiez-clipboard-fluent/releases/latest) 下载 Windows x64 版本：

- **安装版**：`TieZ.Fluent_1.0.0_x64-setup.exe`，按安装向导完成安装。
- **免安装版**：`TieZ-Fluent-Portable.exe`，放到一个可写文件夹运行；如需将数据保存在程序旁，请先在同级目录创建 `data` 文件夹。未创建时使用应用数据目录。

启动后复制内容即可收集历史，在设置的“剪贴板与热键”中配置唤出和粘贴快捷键，再按需要启用标签、便笺、表情等入口。AI、云端同步和 MQTT 需要自行配置对应服务；局域网传输需要设备处于可互相访问的网络。

隐私遮罩用于隐藏界面中的敏感文本，不等于对本地历史加密。文件路径同步也不等于传输文件本体；需要发送文件时请使用文件传输功能。

## 本地开发

技术栈：Tauri 2 / Rust、React 19 / TypeScript、Fluent UI React v9、SQLite。

准备 Node.js、Rust 和 Tauri Windows 构建所需的 C++ 工具链与 WebView2，然后运行：

```sh
npm ci
npm run tauri:dev
```

```sh
npm run build                     # 前端类型检查与生产构建
npm run test:components:release   # Fluent 组件与生产 CSP 样式回归
npm run tauri:build               # Windows 安装包构建
```

## 来源与许可

本项目是 [tiez-clipboard](https://github.com/jimuzhe/tiez-clipboard) 的 Fluent Design 分支，感谢原项目及其贡献者。以 [GNU GPL v3](LICENSE) 开源。

## English

TieZ Fluent is a Windows clipboard manager and desktop productivity tool based on [tiez-clipboard](https://github.com/jimuzhe/tiez-clipboard), with a Fluent Design 2 interface.

- Capture and search text, code, links, rich text, images, and file paths; organize reusable content with pins, tags, and groups.
- Work with configurable global shortcuts, numbered quick paste, sequential paste, formatted paste, and copy without newlines.
- Keep Markdown sticky notes and image stickers on your desktop, and collect Emoji and image favorites.
- Use configurable AI models for questions, reply assistance, and translation.
- Optionally sync selected data through WebDAV or an HTTP API, receive text through MQTT, and receive files over your local network.
- Control history persistence, retention limits, sensitive-text masking, regular-expression cleanup, and per-application capture policies.
- Customize light/dark appearance, Mica/Acrylic effects, compact layout, tray behavior, and startup options.

Download the Windows x64 installer or standalone executable from [Releases](https://github.com/MajorMajorMajor0202/tiez-clipboard-fluent/releases/latest). For portable data storage, create a `data` folder beside the executable before launching it. AI and sync features require your own service configuration. Display masking does not encrypt stored history; syncing file paths does not transfer the underlying files.
