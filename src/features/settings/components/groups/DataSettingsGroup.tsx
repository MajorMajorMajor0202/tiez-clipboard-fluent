import { open, ask, message } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { ChevronDown, ChevronUp } from "lucide-react";

interface DataSettingsGroupProps {
    t: (key: string) => string;
    collapsed: boolean;
    onToggle: () => void;
    dataPath: string;
}

const DataSettingsGroup = ({ t, collapsed, onToggle, dataPath }: DataSettingsGroupProps) => (
    <div className={`settings-group ${collapsed ? 'collapsed' : ''}`}>
        <div className="group-header" onClick={onToggle}>
            <h3 style={{ margin: 0 }}>{t('data_management')}</h3>
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </div>
        {!collapsed && (
            <div className="group-content">
                <div className="setting-item column no-border" style={{ gap: '8px' }}>
                    <span className="item-label" style={{ textTransform: 'uppercase', fontSize: '11px', opacity: 0.8 }}>{t('data_path')}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                        <div className="fluent-input-wrapper" style={{ flex: 1, minWidth: 0 }}>
                            <input
                                type="text"
                                value={dataPath}
                                readOnly
                                onClick={(e) => e.currentTarget.select()}
                                style={{
                                    width: '100%',
                                    textOverflow: 'ellipsis',
                                    fontSize: '12px',
                                    padding: '6px 10px',
                                    borderRadius: '4px',
                                    border: '1px solid var(--line-soft)',
                                    background: 'var(--bg-input)',
                                    color: 'var(--text-primary)',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    height: '28px'
                                }}
                            />
                        </div>
                        <button
                            className="btn-icon"
                            onClick={() => {
                                open({
                                    directory: true,
                                    multiple: false,
                                    title: t('change_data_path')
                                }).then(async (selected) => {
                                    if (selected) {
                                        const newPath = selected as string;
                                        const confirm = await ask(
                                            t('data_move_confirm').replace('{path}', newPath),
                                            { title: t('change_data_path'), kind: 'warning', okLabel: t('confirm'), cancelLabel: t('cancel') }
                                        );

                                        if (confirm) {
                                            try {
                                                await invoke("set_data_path", { newPath });
                                                await message(
                                                    t('data_move_success'),
                                                    { title: t('notice'), kind: 'info' }
                                                );
                                                await invoke("relaunch");
                                            } catch (e: unknown) {
                                                console.error(e);
                                                const errorMsg = e instanceof Error ? e.message : String(e);
                                                await message(
                                                    t('data_move_failed').replace('{e}', errorMsg),
                                                    { title: t('error'), kind: 'error' }
                                                );
                                            }
                                        }
                                    }
                                });
                            }}
                            style={{
                                width: 'auto',
                                padding: '4px 10px',
                                fontSize: '12px',
                                height: '28px',
                                flexShrink: 0,
                                background: 'var(--bg-button)',
                                boxShadow: 'none',
                                border: '1px solid var(--line-soft)'
                            }}
                        >
                            搬迁数据库
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
);

export default DataSettingsGroup;
