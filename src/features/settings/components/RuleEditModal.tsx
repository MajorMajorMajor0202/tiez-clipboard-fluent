import { AnimatePresence, motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface EditableRule {
    match: string;
    replace: string;
    label?: string;
    actionType?: "replace" | "ignore";
}

interface RuleEditModalProps {
    show: boolean;
    rule: EditableRule | null;
    isNew: boolean;
    onClose: () => void;
    onSave: (rule: EditableRule) => void;
}

const focusEditorWindow = () => {
    invoke("focus_clipboard_window").catch(console.error);
};

const RuleEditModal = ({ show, rule, isNew, onClose, onSave }: RuleEditModalProps) => {
    const [label, setLabel] = useState("");
    const [actionType, setActionType] = useState<"replace" | "ignore">("replace");
    const [match, setMatch] = useState("");
    const [replace, setReplace] = useState("");

    // Reset fields when rule changes or modal is shown
    useEffect(() => {
        if (rule && show) {
            setLabel(rule.label ?? "");
            setActionType(rule.actionType ?? "replace");
            setMatch(rule.match ?? "");
            setReplace(rule.replace ?? "");
        } else if (show) {
            setLabel("");
            setActionType("replace");
            setMatch("");
            setReplace("");
        }
    }, [rule, show]);

    const handleSave = () => {
        if (!match.trim()) {
            return;
        }
        onSave({
            label: label.trim() || undefined,
            actionType,
            match: match.trim(),
            replace: actionType === "replace" ? replace : ""
        });
    };

    return (
        <AnimatePresence>
            {show && (
                <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="confirm-dialog rule-edit-dialog"
                        style={{ display: "flex", flexDirection: "column" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="confirm-dialog-upper" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div className="confirm-dialog-title" style={{ margin: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span>{isNew ? "添加清洗规则" : "编辑清洗规则"}</span>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-secondary)", opacity: 0.7, padding: 0, display: "flex", alignItems: "center" }}
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                    <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>规则名称</span>
                                    <input
                                        type="text"
                                        className="fluent-dialog-input"
                                        style={{ width: "100%" }}
                                        value={label}
                                        placeholder="例如：过滤手机号"
                                        onFocus={focusEditorWindow}
                                        onChange={(e) => setLabel(e.target.value)}
                                    />
                                </div>

                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
                                    <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>动作</span>
                                    <div className="fluent-segmented-control">
                                        <button
                                            type="button"
                                            className={`fluent-segmented-button ${actionType === "replace" ? "active" : ""}`}
                                            onClick={() => setActionType("replace")}
                                        >
                                            替换
                                        </button>
                                        <button
                                            type="button"
                                            className={`fluent-segmented-button ${actionType === "ignore" ? "active" : ""}`}
                                            onClick={() => setActionType("ignore")}
                                        >
                                            忽略
                                        </button>
                                    </div>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                    <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>匹配正则表达式</span>
                                    <textarea
                                        className="fluent-dialog-textarea"
                                        style={{ width: "100%", minHeight: "56px" }}
                                        value={match}
                                        placeholder="输入匹配的正则表达式..."
                                        onFocus={focusEditorWindow}
                                        onChange={(e) => setMatch(e.target.value)}
                                    />
                                </div>

                                {actionType === "replace" && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>替换为</span>
                                        <textarea
                                            className="fluent-dialog-textarea"
                                            style={{ width: "100%", minHeight: "56px" }}
                                            value={replace}
                                            placeholder="输入替换的文本..."
                                            onFocus={focusEditorWindow}
                                            onChange={(e) => setReplace(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="confirm-dialog-lower">
                            <div className="confirm-dialog-buttons">
                                <button className="confirm-dialog-button" onClick={onClose}>
                                    取消
                                </button>
                                <button
                                    className="confirm-dialog-button primary"
                                    onClick={handleSave}
                                    disabled={!match.trim()}
                                    style={{ opacity: match.trim() ? 1 : 0.6, cursor: match.trim() ? "pointer" : "not-allowed" }}
                                >
                                    保存
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default RuleEditModal;
