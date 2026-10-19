import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import TieZFluentProvider from "../src/shared/components/TieZFluentProvider";
import FluentDropdown from "../src/shared/components/FluentDropdown";
import FluentTooltip from "../src/shared/components/FluentTooltip";
import FluentSearchInput from "../src/shared/components/FluentSearchInput";
import "../src/index.css";
import "../src/styles/components/index.css";
import "../src/styles/themes/mica.css";
import "../src/styles/themes/dark.css";

function Fixture() {
  const [value, setValue] = useState("ctrl");
  const [search, setSearch] = useState("");
  const [composing, setComposing] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <TieZFluentProvider>
      <div style={{ padding: 24, maxWidth: 440, margin: "auto" }}>
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
      </div>
    </TieZFluentProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
