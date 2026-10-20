# Release 中 Fluent 样式丢失

## 原因

普通 Vite 生产构建可正常显示；Tauri release 会为 HTML 中的样式注入 nonce，并将它加入 CSP。
存在 nonce 时，`style-src` 中的 `unsafe-inline` 不再放行任意内联样式。
Fluent v9 使用 Griffel 在运行时创建组件样式和主题样式，默认没有 nonce，因而被 WebView 拦截。
界面只剩应用自身的静态 CSS，表现为组件被旧样式覆盖。

## 修复

- 给现有启动背景样式设置稳定的 `tiez-style-nonce` ID，供运行时读取 Tauri 注入的 nonce。
- 用 `HTMLStyleElement.nonce` 读取值；浏览器会隐藏 `getAttribute('nonce')` 的值。
- 在 `TieZFluentProvider` 外层提供显式 Griffel renderer，设置 `styleElementAttributes.nonce`。Fluent 的主题样式与 Portal 共享这个 renderer。
- 动态加载的主题样式也沿用该 nonce。
- 保留原 CSP 配置，不关闭 Tauri 的 nonce 注入。

## 回归

`npm run test:components` 检查开发模式。
`npm run test:components:release` 构建压缩产物，并用响应头模拟 Tauri 的 nonce 样式策略，给已有 HTML 样式注入同一 nonce。

Release 检查包含组件样式、主题样式、弹层、输入、开关、滑条、选择框、对话框、快捷编号和启动背景，要求无样式 CSP 拦截且运行时样式具有有效规则。
修复前，该条件下可复现样式拦截及选择框无法正常点击；修复后通过。

参考：[Tauri CSP](https://v2.tauri.app/security/csp/)、[Griffel renderer 的 nonce 配置](https://griffel.js.org/react/api/create-dom-renderer/#styleelementattributes)。
