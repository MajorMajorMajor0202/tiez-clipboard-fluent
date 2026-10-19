# 主窗口边距与系统圆角

- 主窗口标题栏右侧控件右移 8px，补偿按钮 padding 和 X 图标 viewBox 内的留白；实际图形右边距与左侧标题边距约为 16px。
- Windows 通过 `IsWindowArranged` 识别系统 Snap 布局，另读取最大化/全屏状态。该接口动态解析并缓存，旧系统不支持时不会影响启动，不用尺寸或屏幕边缘猜测吸附状态。
- 原生 DWM 圆角偏好、DOM 外壳/背景裁剪和 Canvas 边框共用状态：最大化、系统吸附或全屏为直角，还原后恢复主题圆角。主题/材质重施不会将吸附窗口改回圆角。
- 在移动、缩放、显示和聚焦事件中同步；前端按帧合并查询，补足系统最终布局状态。静止时无轮询。原生 DWM 属性仅在圆角状态变化时更新。
- 已识别为吸附/最大化的尺寸不写入普通窗口尺寸偏好。

浏览器回归使用实际 AppHeader 测量图形边距，并模拟原生状态载荷检查 DOM 半径、背景裁剪、Canvas 所读取的 CSS 半径以及还原行为。原生部分通过 Rust 编译检查。浏览器模拟不等于 Windows Snap 操作实测。

实际桌面复核应覆盖：最大化/还原、Win+方向键、拖至屏幕边缘与顶部 Snap 布局、从吸附位置拖出，以及保持吸附时切换主题。设置窗口不使用此主窗口同步逻辑。

参考：[IsWindowArranged](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-iswindowarranged)；[Windows 圆角行为](https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/ui/apply-rounded-corners)。
