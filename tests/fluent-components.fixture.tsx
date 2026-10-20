import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import AppHeader from "../src/features/app/components/AppHeader";
import { applyWindowFrameState } from "../src/shared/lib/windowFrameState";
import { injectStoreThemeCSS } from "../src/features/theme-store/hooks/useThemeApply";
import TieZFluentProvider from "../src/shared/components/TieZFluentProvider";
import FluentDropdown from "../src/shared/components/FluentDropdown";
import FluentTooltip from "../src/shared/components/FluentTooltip";
import FluentButton from "../src/shared/components/FluentButton";
import FluentModal from "../src/shared/components/FluentModal";
import FluentSwitch from "../src/shared/components/FluentSwitch";
import FluentSlider from "../src/shared/components/FluentSlider";
import FluentNumberBox from "../src/shared/components/FluentNumberBox";
import FluentCheckbox from "../src/shared/components/FluentCheckbox";
import FluentSettingsExpander from "../src/shared/components/FluentSettingsExpander";
import { isControlKeyboardTarget } from "../src/shared/lib/controlKeyboardScope";
import FluentSearchInput from "../src/shared/components/FluentSearchInput";
import "../src/index.css";
import "../src/styles/components/index.css";
import "../src/styles/themes/load";


function Fixture() {
  const [value, setValue] = useState("ctrl");
  const [search, setSearch] = useState("");
  const [composing, setComposing] = useState(false);
  const [checked, setChecked] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [number, setNumber] = useState(5);
  const [expanded, setExpanded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [modal, setModal] = useState(false);
  const [nested, setNested] = useState(false);
  const [locked, setLocked] = useState(false);
  const [format, setFormat] = useState("text");
  const [widthValue, setWidthValue] = useState("short");
  useEffect(() => {
    const capture = (event: KeyboardEvent) => {
      if (isControlKeyboardTarget(event.target) || document.querySelector('[role="dialog"]')) return;
      if (event.key === "ArrowDown" || event.key === "Escape") event.preventDefault();
    };
    window.addEventListener("keydown", capture, true);
    return () => window.removeEventListener("keydown", capture, true);
  }, []);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <TieZFluentProvider>
      <div style={{ padding: 24, maxWidth: 440, margin: "auto", maxHeight: "100vh", minHeight: "100vh", background: "var(--bg-input)", color: "var(--text-primary)", overflowY: "auto", boxSizing: "border-box" }}>
        <div data-testid="main-header">
          <AppHeader t={key => key === "app_name" ? "TieZ" : key} showSettings={false} showTagManager={false}
            tagManagerEnabled={true} showEmojiPanel={false} isWindowPinned={false} setIsWindowPinned={() => {}}
            showSearchBox={false} search="" setSearch={() => {}} setIsComposing={() => {}} searchInputRef={ref}
            showTagFilter={false} setShowTagFilter={() => {}} allTags={[]} searchIsFocused={false}
            setSearchIsFocused={() => {}} setEditingTagsId={() => {}} theme="mica" settingsTitle="设置"
            typeFilter={null} setTypeFilter={() => {}} onBack={() => {}} />
        </div>
        <div className="fluent-search-box home-search-wrapper">
          <FluentSearchInput
            ref={ref}
            aria-label="搜索工作区"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
          />
        </div>
        <output data-testid="search-value">{search}</output>
        <output data-testid="composing">{String(composing)}</output>
        <button onClick={() => injectStoreThemeCSS("csp-fixture", ":root { --tiez-store-csp-check: applied; }")}>应用动态主题</button>
        <p>
          <button onClick={() => setSearch("")}>清空搜索</button>
          <button onClick={() => ref.current?.focus()}>聚焦搜索</button>
          <button onClick={() => {
            const dark = document.documentElement.classList.toggle("dark-mode");
            document.documentElement.classList.toggle("light-mode", !dark);
            document.body.classList.toggle("dark-mode", dark);
            document.body.classList.toggle("light-mode", !dark);
          }}>切换主题</button>
        </p>
        <FluentDropdown
          aria-label="粘贴修饰键"
          options={[{ id: "ctrl", label: "Ctrl" }, { id: "alt", label: "Alt" }, { id: "shift", label: "Shift" }]}
          value={value}
          onChange={setValue}
        />
        <output data-testid="selected-value">{value}</output>
        <p><FluentTooltip text="复制所选材料"><button type="button">复制</button></FluentTooltip></p>
        <p><FluentTooltip text="请先选择材料"><button type="button" disabled>删除</button></FluentTooltip></p>
        <div className="fluent-setting-card">
          <span className="fluent-setting-title">保留工作区材料</span>
          <FluentSwitch checked={checked} onChange={e => setChecked(e.target.checked)} />
        </div>
        <FluentSwitch aria-label="禁用开关" disabled checked />
        <FluentCheckbox label="包括标签" checked={checked} onChange={(_e, data) => setChecked(data.checked === true)} />
        <div className="fluent-setting-card" style={{ flexDirection: "column" }}>
          <span className="fluent-setting-title">提示音量</span>
          <FluentSlider min="0" max="1" step="0.01" value={volume} onChange={e => setVolume(Number(e.target.value))} />
        </div>
        <output data-testid="volume">{volume}</output>
        <div className="fluent-setting-card">
          <span className="fluent-setting-title">历史容量</span>
          <FluentNumberBox min={1} max={10} value={number} onChange={setNumber} />
        </div>
        <FluentSettingsExpander expanded={expanded} onToggle={() => setExpanded(!expanded)}
          header={<span className="fluent-setting-title">高级选项</span>}>
          <div className="fluent-setting-expander-content"><FluentButton>展开后的操作</FluentButton></div>
        </FluentSettingsExpander>
        <FluentSettingsExpander disabled={!enabled} expanded={enabled && expanded} onToggle={() => setExpanded(!expanded)}
          header={<span className="fluent-setting-title">提示音设置</span>}
          actions={<FluentSwitch checked={enabled} onChange={e => setEnabled(e.target.checked)} />}>
          <div className="fluent-setting-expander-content">提示音内容</div>
        </FluentSettingsExpander>
        <FluentDropdown aria-label="固定宽度测试" value={widthValue} onChange={setWidthValue}
          options={[{ id: "short", label: "短" }, { id: "long", label: "这是一项很长的修饰键选项文字" }]} />
        <FluentButton onClick={() => applyWindowFrameState(document, { square_corners: true, maximized: true, snapped: false })}>模拟最大化</FluentButton>
        <FluentButton onClick={() => applyWindowFrameState(document, { square_corners: true, maximized: false, snapped: true })}>模拟吸附</FluentButton>
        <FluentButton onClick={() => applyWindowFrameState(document, { square_corners: false, maximized: false, snapped: false })}>模拟还原</FluentButton>
        <FluentButton variant="danger">删除材料</FluentButton>
        <FluentButton loading>正在保存</FluentButton>
        <FluentButton disabled>不可用操作</FluentButton>
        <FluentButton variant="primary" onClick={() => { setLocked(false); setModal(true); }}>打开对话框</FluentButton>
        <FluentButton onClick={() => { setLocked(true); setModal(true); }}>打开受限对话框</FluentButton>
        <FluentModal open={modal} onClose={() => setModal(false)} title="处理材料" subtitle="仅处理所选内容"
          closeOnEscape={!locked} closeOnOverlayClick={!locked}
          footer={<><FluentButton onClick={() => setModal(false)}>取消处理</FluentButton><FluentButton variant="primary" onClick={() => setModal(false)}>确认处理</FluentButton></>}>
          <input aria-label="材料名称" defaultValue="工作区" />
          <FluentDropdown aria-label="输出格式" value={format} onChange={setFormat}
            options={[{ id: "text", label: "纯文本" }, { id: "markdown", label: "Markdown" }]} />
          <FluentButton onClick={() => setNested(true)}>打开子对话框</FluentButton>
          <FluentModal open={nested} onClose={() => setNested(false)} title="子对话框"
            footer={<FluentButton onClick={() => setNested(false)}>关闭子对话框</FluentButton>}>嵌套内容</FluentModal>
        </FluentModal>
      </div>
    </TieZFluentProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
