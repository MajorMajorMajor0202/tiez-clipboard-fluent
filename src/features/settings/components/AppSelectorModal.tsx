import { AnimatePresence, motion } from "framer-motion";
import { open } from "@tauri-apps/plugin-dialog";
import AppSelector from "./AppSelector";
import type { InstalledAppOption } from "../../app/types";

interface AppSelectorModalProps {
    show: string | null;
    installedApps: InstalledAppOption[];
    t: (key: string) => string;
    onClose: () => void;
    onSave: (type: string, val: string) => void;
}

const AppSelectorModal = ({ show, installedApps, t, onClose, onSave }: AppSelectorModalProps) => (
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
                    <div className="confirm-dialog-upper" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="confirm-dialog-title" style={{ margin: 0 }}>{t('select_app_title') || "选择程序"}</div>

                        <div className="selector-container" style={{ margin: 0, padding: 0, border: 'none', background: 'transparent' }}>
                            <AppSelector
                                type={show}
                                installedApps={installedApps}
                                onSelect={(val) => {
                                    if (show) onSave(show, val);
                                    onClose();
                                }}
                                t={t}
                            />
                        </div>
                    </div>

                    <div className="confirm-dialog-lower" style={{ display: 'flex', padding: '16px 16px' }}>
                        <div className="confirm-dialog-buttons" style={{ display: 'flex', width: '100%', gap: '4px' }}>
                            <button
                                className="confirm-dialog-button"
                                onClick={onClose}
                            >
                                {t('cancel') || "取消"}
                            </button>
                            <button
                                className="confirm-dialog-button primary"
                                onClick={async () => {
                                    try {
                                        const selected = await open({
                                            multiple: false,
                                            filters: [{
                                                name: 'Applications',
                                                extensions: ['exe', 'cmd', 'bat', 'lnk']
                                            }]
                                        });
                                        if (selected && show) {
                                            onSave(show, selected as string);
                                            onClose();
                                        }
                                    } catch (err) { console.error(err); }
                                }}
                            >
                                {t('browse_file') || "浏览文件"}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        )}
    </AnimatePresence>
);

export default AppSelectorModal;
