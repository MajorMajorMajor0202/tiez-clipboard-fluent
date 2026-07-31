import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { RotateCcw, X } from "lucide-react";
import { getHotkeyDisplayTokens } from "../../../shared/lib/hotkeyDisplay";

interface HotkeySelectorModalProps {
    show: 'main' | 'search' | 'rich' | 'sequential' | null;
    currentValue: string;
    defaultValue: string;
    t: (key: string) => string;
    onClose: () => void;
    onSave: (val: string) => void;
}

const HotkeySelectorModal = ({
    show,
    currentValue,
    defaultValue,
    t,
    onClose,
    onSave
}: HotkeySelectorModalProps) => {
    const [tempHotkey, setTempHotkey] = useState(currentValue);
    const focusRef = useRef<HTMLDivElement>(null);

    // Sync tempHotkey when currentValue changes or modal opens
    useEffect(() => {
        if (show) {
            setTempHotkey(currentValue);
        }
    }, [show, currentValue]);

    // Auto focus recording area on mount
    useEffect(() => {
        if (show && focusRef.current) {
            focusRef.current.focus();
        }
    }, [show]);

    // Handle Tauri global hotkey recording events
    useEffect(() => {
        if (!show) return;

        // Turn on backend recording mode
        invoke("set_recording_mode", { enabled: true }).catch(console.error);

        const unlistenRecorded = listen<string>("hotkey-recorded", (event) => {
            setTempHotkey(event.payload);
        });

        const unlistenCancelled = listen("recording-cancelled", () => {
            onClose();
        });

        return () => {
            // Turn off backend recording mode on unmount
            invoke("set_recording_mode", { enabled: false }).catch(console.error);
            unlistenRecorded.then((f) => f());
            unlistenCancelled.then((f) => f());
        };
    }, [show, onClose]);

    // Local keydown handler as fallback when window has focus
    const handleLocalKeyDown = (e: React.KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === "Escape") {
            onClose();
            return;
        }

        if (e.key === "Backspace" || e.key === "Delete") {
            setTempHotkey("");
            return;
        }

        const modifiers: string[] = [];
        if (e.ctrlKey) modifiers.push("Ctrl");
        if (e.shiftKey) modifiers.push("Shift");
        if (e.altKey) modifiers.push("Alt");
        if (e.metaKey) modifiers.push("Win");

        const key = e.key.toUpperCase();
        if (["CONTROL", "SHIFT", "ALT", "META"].includes(key)) {
            // Only modifiers pressed, show intermediate modifiers
            if (modifiers.length > 0) {
                setTempHotkey(modifiers.join("+"));
            }
            return;
        }

        const finalHotkey = [...modifiers, key].join("+");
        setTempHotkey(finalHotkey);
    };

    const renderHotkeyCaps = (hk: string) => {
        const tokens = getHotkeyDisplayTokens(hk, { preferMacSymbols: false });
        if (tokens.length === 0) {
            return <span className="fluent-hotkey-not-set">{t("not_configured") || "未配置"}</span>;
        }
        return (
            <div className="fluent-hotkey-caps-list" style={{ display: 'flex', gap: '4px' }}>
                {tokens.map((token, index) => (
                    <span key={`cap-${index}`} className="fluent-hotkey-cap">
                        {token.label}
                    </span>
                ))}
            </div>
        );
    };

    return (
        <AnimatePresence>
            {show && (
                <div className="modal-overlay" onClick={onClose}>
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="confirm-dialog app-selector-dialog"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="confirm-dialog-upper" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div className="confirm-dialog-title" style={{ margin: 0 }}>
                                {t("edit_hotkey_title") || "修改快捷键"}
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "-8px", lineHeight: "1.4" }}>
                                {t("hotkey_recording_tip") || "请直接按下组合键，Esc键取消"}
                            </div>

                            {/* Display Area */}
                            <div
                                ref={focusRef}
                                tabIndex={0}
                                className="fluent-hotkey-recording-area"
                                onKeyDown={handleLocalKeyDown}
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "8px",
                                    padding: "16px",
                                    minHeight: "64px",
                                    border: "none",
                                    borderRadius: "4px",
                                    background: "var(--bg-input)",
                                    outline: "none",
                                    cursor: "pointer"
                                }}
                            >
                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                                    {renderHotkeyCaps(tempHotkey)}
                                </div>
                            </div>

                            {/* Reset & Clear buttonless links */}
                            <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginTop: "4px" }}>
                                <button
                                    className="fluent-hotkey-action-btn"
                                    onClick={() => setTempHotkey(defaultValue)}
                                >
                                    <RotateCcw size={14} />
                                    <span>{t("reset") || "重置"}</span>
                                </button>
                                <button
                                    className="fluent-hotkey-action-btn"
                                    onClick={() => setTempHotkey("")}
                                >
                                    <X size={14} />
                                    <span>{t("clear") || "清除"}</span>
                                </button>
                            </div>
                        </div>

                        {/* Dialog Footer Actions */}
                        <div className="confirm-dialog-lower" style={{ display: "flex", padding: "16px 16px" }}>
                            <div className="confirm-dialog-buttons" style={{ display: "flex", width: "100%", gap: "4px" }}>
                                <button
                                    className="confirm-dialog-button"
                                    onClick={onClose}
                                >
                                    {t("cancel") || "取消"}
                                </button>
                                <button
                                    className="confirm-dialog-button primary"
                                    onClick={() => {
                                        onSave(tempHotkey);
                                        onClose();
                                    }}
                                >
                                    {t("confirm") || "确定"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default HotkeySelectorModal;
