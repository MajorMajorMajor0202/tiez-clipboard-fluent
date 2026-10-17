import { useState, type Dispatch, type SetStateAction } from "react";
import { Bug, X, Plus, Trash2, RotateCcw, Sparkles, Filter, Layers } from "lucide-react";
import type { TabItem } from "../types";
import type { ClipboardEntry } from "../../../shared/types";

interface TabDebugWindowProps {
  isOpen: boolean;
  onClose: () => void;
  tabs: TabItem[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  setTabs: Dispatch<SetStateAction<TabItem[]>>;
  history: ClipboardEntry[];
  setHistory: Dispatch<SetStateAction<ClipboardEntry[]>>;
  typeFilter: string | null;
  setTypeFilter: (val: string | null) => void;
}

export const TabDebugWindow = ({
  isOpen,
  onClose,
  tabs,
  activeTabId,
  onSelectTab,
  setTabs,
  history,
  setHistory,
  typeFilter,
  setTypeFilter
}: TabDebugWindowProps) => {
  const [newTabName, setNewTabName] = useState("");

  if (!isOpen) return null;

  // Add a single custom tab
  const handleAddCustomTab = () => {
    const trimmed = newTabName.trim();
    if (!trimmed) return;
    const newId = `tab_${Date.now()}`;
    setTabs((prev) => [...prev, { id: newId, name: trimmed }]);
    setNewTabName("");
    onSelectTab(newId);
  };

  // Batch inject 8 tabs to immediately test long horizontal scrolling & auto-hiding arrows
  const handleBatchInjectLongTabs = () => {
    const sampleNames = [
      "问候",
      "卖萌",
      "忧伤",
      "生气",
      "无语",
      "惊讶",
      "开心",
      "工作材料",
      "本次发布",
      "发票报销",
      "便签笔记",
      "日常灵感"
    ];
    setTabs((prev) => {
      const existingNames = new Set(prev.map((t) => t.name));
      const next = [...prev];
      sampleNames.forEach((name, i) => {
        if (!existingNames.has(name)) {
          next.push({ id: `tab_demo_${Date.now()}_${i}`, name });
        }
      });
      return next;
    });
  };

  // Reset to default tabs
  const handleResetTabs = () => {
    setTabs([
      { id: "clipboard", name: "剪贴板", isBuiltin: true },
      { id: "release", name: "本次发布" },
      { id: "reimburse", name: "报销资料" },
      { id: "notes", name: "便签" },
      { id: "code_snippets", name: "常用代码" },
      { id: "temp", name: "临时暂存" }
    ]);
    onSelectTab("clipboard");
  };

  // Remove the currently active tab (if not builtin)
  const handleRemoveActiveTab = () => {
    const target = tabs.find((t) => t.id === activeTabId);
    if (!target || target.isBuiltin) return;
    setTabs((prev) => prev.filter((t) => t.id !== activeTabId));
    onSelectTab("clipboard");
  };

  // Inject a mock entry assigned to active tab
  const handleInjectMockItem = () => {
    const now = Date.now();
    const currentTab = tabs.find((t) => t.id === activeTabId);
    const tabName = currentTab ? currentTab.name : activeTabId;
    const mockItem: ClipboardEntry = {
      id: -now,
      content_type: "text",
      content: `[材料集 - ${tabName}] 这是一条测试材料，于 ${new Date().toLocaleTimeString()} 归档到该 Tab。`,
      source_app: "TieZ Debugger",
      timestamp: now,
      preview: `[材料集 - ${tabName}] 这是一条测试材料...`,
      is_pinned: false,
      tags: [tabName],
      tab_id: activeTabId
    };
    setHistory((prev) => [mockItem, ...prev]);
  };

  // Assign the most recent clipboard entry to current tab
  const handleAssignLatestItem = () => {
    if (history.length === 0) return;
    setHistory((prev) => {
      const first = prev[0];
      return [{ ...first, tab_id: activeTabId }, ...prev.slice(1)];
    });
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const itemsInActiveTab = history.filter(
    (item) => activeTabId === "clipboard" || item.tab_id === activeTabId || item.tags?.includes(activeTab?.name || "")
  ).length;

  return (
    <div className="tab-debug-overlay" onClick={onClose}>
      <div
        className="tab-debug-window window-no-drag"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="tab-debug-header">
          <h3>
            <Bug size={16} color="var(--accent-color)" />
            Tab 功能与原分类接口调试面板
          </h3>
          <button className="tab-debug-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="tab-debug-content">
          {/* Section 1: Current Active Tab & Quick Switch */}
          <div className="tab-debug-section">
            <div className="tab-debug-section-title">
              <span>当前选中的 Tab 状态</span>
              <span className="tab-debug-badge">{activeTabId}</span>
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: "12px", marginBottom: "4px" }}>
              Tab 名称：<strong>{activeTab?.name || activeTabId}</strong>（匹配条目数: {itemsInActiveTab} / 总数: {history.length}）
            </div>
            <div className="tab-debug-btn-row">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`tab-debug-btn ${tab.id === activeTabId ? "active" : ""}`}
                  onClick={() => onSelectTab(tab.id)}
                >
                  {tab.name}
                  {tab.isBuiltin && " (内置)"}
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Tab Operations */}
          <div className="tab-debug-section">
            <div className="tab-debug-section-title">
              <span>Tab 动态管理与长标签测试</span>
            </div>
            <div className="tab-debug-input-row">
              <input
                type="text"
                className="tab-debug-input"
                placeholder="输入新 Tab 名称..."
                value={newTabName}
                onChange={(e) => setNewTabName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCustomTab()}
              />
              <button className="tab-debug-btn primary" onClick={handleAddCustomTab}>
                <Plus size={13} />
                添加
              </button>
            </div>
            <div className="tab-debug-btn-row" style={{ marginTop: "6px" }}>
              <button className="tab-debug-btn" onClick={handleBatchInjectLongTabs} title="批量注入多个Tab以产生横向滚动条并测试悬停翻页按钮">
                <Sparkles size={13} color="#e59819" />
                注入 12 个长标签（测试左右翻页浮钮）
              </button>
              {activeTab && !activeTab.isBuiltin && (
                <button className="tab-debug-btn" onClick={handleRemoveActiveTab} style={{ color: "#e03131" }}>
                  <Trash2 size={13} />
                  删除当前 Tab
                </button>
              )}
              <button className="tab-debug-btn" onClick={handleResetTabs}>
                <RotateCcw size={13} />
                恢复默认 Tabs
              </button>
            </div>
          </div>

          {/* Section 3: Item Assignment Test */}
          <div className="tab-debug-section">
            <div className="tab-debug-section-title">
              <span>材料条目归属测试</span>
            </div>
            <div className="tab-debug-btn-row">
              <button className="tab-debug-btn" onClick={handleInjectMockItem}>
                <Plus size={13} />
                向当前 Tab [{activeTab?.name}] 插入一条测试材料
              </button>
              <button className="tab-debug-btn" onClick={handleAssignLatestItem}>
                <Layers size={13} />
                将历史第 1 条分配到 [{activeTab?.name}]
              </button>
            </div>
          </div>

          {/* Section 4: Old Type Filter Interface Debug */}
          <div className="tab-debug-section">
            <div className="tab-debug-section-title">
              <span>原分类过滤接口（保留接口调试）</span>
              <span className="tab-debug-badge">{typeFilter || "全部"}</span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>
              原分类已从顶栏胶囊移出，此处保留接口调用供测试验证：
            </div>
            <div className="tab-debug-btn-row">
              {[
                { label: "全部", val: null },
                { label: "文本", val: "text" },
                { label: "图片", val: "image" },
                { label: "代码", val: "code" },
                { label: "链接", val: "url" },
                { label: "文件", val: "file" },
                { label: "富文本", val: "rich_text" }
              ].map(({ label, val }) => (
                <button
                  key={label}
                  className={`tab-debug-btn ${typeFilter === val ? "active" : ""}`}
                  onClick={() => setTypeFilter(val)}
                >
                  <Filter size={11} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Help Note */}
          <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.5 }}>
            💡 <strong>测试指引</strong>：点击“注入 12 个长标签”，回到主界面将鼠标移至顶栏 Tab 区域，即可看到左右两侧出现的半透明胶囊翻页按钮（移开鼠标后约 1.8 秒自动渐隐）。
          </div>
        </div>
      </div>
    </div>
  );
};

export default TabDebugWindow;
