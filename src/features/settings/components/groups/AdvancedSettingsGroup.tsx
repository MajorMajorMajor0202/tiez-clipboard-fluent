import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ChevronDown, ChevronUp, Plus, Trash2, Search, X } from "lucide-react";
import type { InstalledAppOption } from "../../../app/types";
import type { AppCleanupPolicy } from "../../types";
import { getTagColor } from "../../../../shared/lib/utils";

interface AdvancedSettingsGroupProps {
    t: (key: string) => string;
    cleanupRules: string;
    setCleanupRules: (val: string) => void;
    appCleanupPolicies: AppCleanupPolicy[];
    setAppCleanupPolicies: (val: AppCleanupPolicy[]) => void;
    installedApps: InstalledAppOption[];
    theme: string;
}

interface EditableRule {
    match: string;
    replace: string;
    label?: string;
    actionType?: "replace" | "ignore";
}

interface SourceTarget {
    id: string;
    kind: "global" | "app";
    label: string;
    appPath?: string;
    policyId?: string;
    ruleCount: number;
    rawRules: string;
}

const DEFAULT_POLICY_CONTENT_TYPES = ["text", "code", "url", "rich_text", "image", "file", "video"];

const createPolicyId = () =>
    `policy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const parseRules = (rawRules: string): EditableRule[] => {
    const lines = rawRules.split(/\r?\n/).map((l) => l.trim());
    const rules: EditableRule[] = [];
    let currentLabel: string | null = null;

    for (const line of lines) {
        if (line.length === 0) continue;
        if (line.startsWith("#")) {
            const labelMatch = line.match(/^#\s*label:\s*(.*)$/i);
            if (labelMatch) {
                currentLabel = labelMatch[1].trim();
            }
            continue;
        }

        const [matchPart, replacePart = ""] = line.split(/=>/, 2);
        const replaceValue = replacePart.trim();
        rules.push({
            match: matchPart.trim(),
            replace: replaceValue === "__IGNORE_CAPTURE__" ? "" : replaceValue,
            label: currentLabel ?? undefined,
            actionType: replaceValue === "__IGNORE_CAPTURE__" ? "ignore" : "replace"
        });
        currentLabel = null;
    }
    return rules;
};

const serializeRules = (rules: EditableRule[]): string =>
    rules
        .filter((rule) => rule.match.trim().length > 0)
        .map((rule) => {
            const lines = [];
            if (rule.label?.trim()) {
                lines.push(`# label: ${rule.label.trim()}`);
            }
            const actualReplace = rule.actionType === "ignore" ? "__IGNORE_CAPTURE__" : rule.replace;
            lines.push(`${rule.match.trim()} => ${actualReplace}`);
            return lines.join("\n");
        })
        .join("\n\n");

const focusEditorWindow = () => {
    getCurrentWindow()
        .setFocus()
        .catch(() => invoke("focus_clipboard_window").catch(console.error));
};

const AdvancedSettingsGroup = ({
    t,
    cleanupRules,
    setCleanupRules,
    appCleanupPolicies,
    setAppCleanupPolicies,
    installedApps,
    theme
}: AdvancedSettingsGroupProps) => {
    const [searchText, setSearchText] = useState("");
    const [isGlobalExpanded, setIsGlobalExpanded] = useState(true);
    const [expandedAppIds, setExpandedAppIds] = useState<Record<string, boolean>>({});
    const [expandedRuleKeys, setExpandedRuleKeys] = useState<Record<string, number | null>>({});

    const configuredAppPolicies = appCleanupPolicies;

    const sourceTargets = useMemo(() => {
        const targets: SourceTarget[] = [
            {
                id: "global",
                kind: "global",
                label: t("advanced_target_global"),
                ruleCount: parseRules(cleanupRules).length,
                rawRules: cleanupRules
            }
        ];

        configuredAppPolicies.forEach((policy) => {
            const appPath = policy.appPath.trim();
            const appLabel = policy.appName.trim()
                || installedApps.find((app) => app.value === appPath)?.label
                || t("advanced_target_unknown_app");
            const rawRules = policy.cleanupRules ?? "";
            targets.push({
                id: appPath ? `app:${appPath}` : `legacy:${policy.id}`,
                kind: "app",
                label: appLabel,
                appPath,
                policyId: policy.id,
                ruleCount: policy.action === "ignore" ? 0 : parseRules(rawRules).length,
                rawRules
            });
        });

        return targets;
    }, [cleanupRules, configuredAppPolicies, installedApps, t]);

    const searchResults = useMemo(() => {
        const keyword = searchText.trim().toLowerCase();
        if (!keyword) {
            return [];
        }

        const existingPaths = new Set(
            sourceTargets
                .filter((target) => target.kind === "app" && target.appPath)
                .map((target) => target.appPath as string)
        );

        return installedApps
            .filter((app) => app.label.toLowerCase().includes(keyword))
            .map((app) => ({
                ...app,
                added: existingPaths.has(app.value)
            }))
            .slice(0, 8);
    }, [installedApps, searchText, sourceTargets]);

    const toggleAppExpand = (id: string) => {
        setExpandedAppIds((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const persistAppPolicies = (nextPolicies: AppCleanupPolicy[]) => {
        setAppCleanupPolicies(nextPolicies);
        invoke("set_app_cleanup_policies", { policies: JSON.stringify(nextPolicies) }).catch(console.error);
    };

    const persistRulesForTarget = (target: SourceTarget, nextRules: EditableRule[]) => {
        const serialized = serializeRules(nextRules);

        if (target.kind === "global") {
            setCleanupRules(serialized);
            invoke("set_cleanup_rules", { rules: serialized }).catch(console.error);
            return;
        }

        const appPath = target.appPath ?? "";
        const existingIndex = appCleanupPolicies.findIndex((policy) => (
            target.policyId ? policy.id === target.policyId : policy.appPath === appPath
        ));
        const nextPolicies = [...appCleanupPolicies];

        const nextContentTypes = existingIndex >= 0
            ? Array.from(new Set([...(nextPolicies[existingIndex].contentTypes ?? []), ...DEFAULT_POLICY_CONTENT_TYPES]))
            : [...DEFAULT_POLICY_CONTENT_TYPES];

        const nextPolicy: AppCleanupPolicy = {
            id: existingIndex >= 0 ? nextPolicies[existingIndex].id : (target.policyId ?? createPolicyId()),
            enabled: existingIndex >= 0 ? nextPolicies[existingIndex].enabled : true,
            appName: target.label,
            appPath,
            action: existingIndex >= 0 ? nextPolicies[existingIndex].action : "clean",
            contentTypes: nextContentTypes,
            cleanupRules: serialized
        };

        if (existingIndex >= 0) {
            nextPolicies[existingIndex] = nextPolicy;
        } else {
            nextPolicies.push(nextPolicy);
        }

        persistAppPolicies(nextPolicies);
    };

    const handleDeleteTarget = (event: React.MouseEvent, target: SourceTarget) => {
        event.stopPropagation();
        if (target.kind === "global") return;

        const nextPolicies = appCleanupPolicies.filter(p => (
            p.id !== target.policyId && (p.appPath !== target.appPath || !target.appPath)
        ));
        
        persistAppPolicies(nextPolicies);
    };

    const getRulesForTarget = (target: SourceTarget): EditableRule[] => {
        return parseRules(target.rawRules);
    };

    const addRule = (target: SourceTarget) => {
        const currentRules = getRulesForTarget(target);
        const nextRules = [...currentRules, { match: "", replace: "", actionType: "replace" as const }];
        persistRulesForTarget(target, nextRules);
        setExpandedRuleKeys(prev => ({ ...prev, [target.id]: nextRules.length - 1 }));
    };

    const updateRule = (target: SourceTarget, ruleIndex: number, patch: Partial<EditableRule>) => {
        const currentRules = getRulesForTarget(target);
        const nextRules = currentRules.map((rule, index) => (
            index === ruleIndex ? { ...rule, ...patch } : rule
        ));
        persistRulesForTarget(target, nextRules);
    };

    const deleteRule = (target: SourceTarget, ruleIndex: number) => {
        const currentRules = getRulesForTarget(target);
        const nextRules = currentRules.filter((_, index) => index !== ruleIndex);
        persistRulesForTarget(target, nextRules);
        
        const expandedIdx = expandedRuleKeys[target.id];
        if (expandedIdx === ruleIndex) {
            setExpandedRuleKeys(prev => ({
                ...prev,
                [target.id]: nextRules.length > 0 ? Math.max(0, ruleIndex - 1) : null
            }));
        }
    };

    const toggleTargetAction = (target: SourceTarget) => {
        if (target.kind === "global") return;

        const existingIndex = appCleanupPolicies.findIndex((policy) => (
            target.policyId ? policy.id === target.policyId : policy.appPath === (target.appPath ?? "")
        ));
        
        if (existingIndex < 0) return;

        const nextPolicies = [...appCleanupPolicies];
        const nextAction = nextPolicies[existingIndex].action === "ignore" ? "clean" : "ignore";
        nextPolicies[existingIndex] = {
            ...nextPolicies[existingIndex],
            action: nextAction,
            contentTypes: Array.from(new Set([...(nextPolicies[existingIndex].contentTypes ?? []), ...DEFAULT_POLICY_CONTENT_TYPES]))
        };

        persistAppPolicies(nextPolicies);
    };

    const handleAddApp = (app: InstalledAppOption) => {
        const existing = sourceTargets.find((target) => target.kind === "app" && target.appPath === app.value);
        if (existing) {
            toggleAppExpand(existing.id);
            setSearchText("");
            return;
        }

        const nextPolicy: AppCleanupPolicy = {
            id: createPolicyId(),
            enabled: true,
            appName: app.label,
            appPath: app.value,
            action: "clean",
            contentTypes: [...DEFAULT_POLICY_CONTENT_TYPES],
            cleanupRules: ""
        };
        persistAppPolicies([...appCleanupPolicies, nextPolicy]);
        toggleAppExpand(`app:${app.value}`);
        setSearchText("");
    };

    const renderRulesSection = (target: SourceTarget) => {
        const rules = getRulesForTarget(target);
        const expandedIdx = expandedRuleKeys[target.id];

        return (
            <div className="advanced-rules-container">
                <div className="rules-section-header">
                    <span className="rules-section-title">过滤和清洗规则</span>
                    <button type="button" className="fluent-btn-primary" onClick={() => addRule(target)}>
                        <Plus size={12} />
                        <span>{t("advanced_add_rule")}</span>
                    </button>
                </div>

                {rules.length === 0 ? (
                    <div className="advanced-empty-state" style={{ marginTop: "4px" }}>
                        <div className="advanced-empty-title">{t("advanced_empty_rules_title")}</div>
                        <div className="advanced-empty-text">
                            {target.kind === "global"
                                ? t("advanced_empty_rules_global")
                                : t("advanced_empty_rules_app")}
                        </div>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
                        {rules.map((rule, idx) => {
                            const isExpanded = expandedIdx === idx;
                            return (
                                <div key={`${target.id}-rule-${idx}`} className="advanced-rule-card">
                                    <button
                                        type="button"
                                        className="advanced-rule-header"
                                        onClick={() => setExpandedRuleKeys(prev => ({
                                            ...prev,
                                            [target.id]: isExpanded ? null : idx
                                        }))}
                                    >
                                        <span className="advanced-rule-title">
                                            {rule.label?.trim() || `${t("advanced_rule_label")} ${idx + 1}`}
                                        </span>
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>

                                    {isExpanded && (
                                        <div className="advanced-rule-body">
                                            <div className="advanced-rule-field">
                                                <label>{t("advanced_rule_label_name")}</label>
                                                <div className="fluent-input-wrapper">
                                                    <input
                                                        type="text"
                                                        className="advanced-rule-input"
                                                        value={rule.label ?? ""}
                                                        placeholder={`${t("advanced_rule_label")} ${idx + 1}`}
                                                        onFocus={focusEditorWindow}
                                                        onChange={(e) => updateRule(target, idx, { label: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="advanced-rule-field">
                                                <label>{t("advanced_match_label")}</label>
                                                <div className="fluent-input-wrapper">
                                                    <textarea
                                                        className="advanced-rule-textarea"
                                                        value={rule.match}
                                                        placeholder={t("advanced_match_placeholder")}
                                                        onFocus={focusEditorWindow}
                                                        onChange={(e) => updateRule(target, idx, { match: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="advanced-rule-field">
                                                <label>命中后动作</label>
                                                <div className="fluent-segmented-control">
                                                    <button
                                                        type="button"
                                                        className={`fluent-segmented-button ${rule.actionType === "replace" ? "active" : ""}`}
                                                        onClick={() => updateRule(target, idx, { actionType: "replace" })}
                                                    >
                                                        {t("advanced_replace_label")}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`fluent-segmented-button ${rule.actionType === "ignore" ? "active" : ""}`}
                                                        onClick={() => updateRule(target, idx, { actionType: "ignore" })}
                                                    >
                                                        {t("app_cleanup_policy_ignore")}
                                                    </button>
                                                </div>
                                            </div>

                                            {rule.actionType === "replace" && (
                                                <div className="advanced-rule-field">
                                                    <label>{t("advanced_replace_label")}</label>
                                                    <div className="fluent-input-wrapper">
                                                        <textarea
                                                            className="advanced-rule-textarea"
                                                            value={rule.replace}
                                                            placeholder={t("advanced_replace_placeholder")}
                                                            onFocus={focusEditorWindow}
                                                            onChange={(e) => updateRule(target, idx, { replace: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <div className="advanced-rule-actions">
                                                <button
                                                    type="button"
                                                    className="fluent-btn-danger"
                                                    onClick={() => deleteRule(target, idx)}
                                                >
                                                    <Trash2 size={13} />
                                                    <span>{t("delete")}</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    const globalTarget = sourceTargets[0];
    const appTargets = sourceTargets.slice(1);

    return (
        <div className="settings-subpage advanced-settings-page">
            {/* 添加应用卡片 */}
            <div className="fluent-settings-expander add-app-card">
                <div className="setting-row">
                    <div className="setting-row-info">
                        <span className="setting-row-label">添加应用专属策略</span>
                        <span className="setting-row-hint">搜索并选择一个已安装的应用，为其添加专属的剪贴板策略</span>
                    </div>
                    <div className="fluent-search-box">
                        <Search size={14} className="fluent-search-icon" />
                        <input
                            type="text"
                            className="fluent-search-input"
                            placeholder={t("search_apps_placeholder")}
                            value={searchText}
                            onFocus={focusEditorWindow}
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                        {searchText && (
                            <X
                                size={14}
                                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", cursor: "pointer", opacity: 0.6 }}
                                onClick={() => setSearchText("")}
                            />
                        )}
                        {searchResults.length > 0 && (
                            <div className="advanced-search-results">
                                {searchResults.map((app) => (
                                    <button
                                        key={app.value}
                                        type="button"
                                        className="advanced-search-result-item"
                                        onClick={() => handleAddApp(app)}
                                    >
                                        <span className="advanced-search-result-name">{app.label}</span>
                                        <span className="advanced-search-result-action">
                                            {app.added ? "已添加" : "添加"}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="advanced-section-title">全局策略</div>

            {/* 全局折叠卡片 */}
            <div className={`fluent-settings-expander ${isGlobalExpanded ? "expanded" : ""}`}>
                <button
                    type="button"
                    className="expander-header"
                    onClick={() => setIsGlobalExpanded(!isGlobalExpanded)}
                >
                    <div className="expander-title-area">
                        <div className="expander-text">
                            <span className="expander-title">全局清洗规则</span>
                            <span className="expander-subtitle">对所有应用复制的内容生效（若应用有专属规则则优先执行专属规则）</span>
                        </div>
                    </div>
                    <div className="expander-actions">
                        {globalTarget.ruleCount > 0 && (
                            <span className="target-badge">{globalTarget.ruleCount}</span>
                        )}
                        <span className="expander-arrow">
                            <ChevronDown size={16} />
                        </span>
                    </div>
                </button>
                {isGlobalExpanded && (
                    <div className="expander-content">
                        {renderRulesSection(globalTarget)}
                    </div>
                )}
            </div>

            {appTargets.length > 0 && (
                <>
                    <div className="advanced-section-title">特定应用策略</div>
                    {appTargets.map((target) => {
                        const isExpanded = !!expandedAppIds[target.id];
                        const policy = appCleanupPolicies.find(p => p.id === target.policyId || p.appPath === target.appPath);
                        const isRecordEnabled = policy ? policy.action !== "ignore" : true;

                        return (
                            <div key={target.id} className={`fluent-settings-expander ${isExpanded ? "expanded" : ""}`}>
                                <button
                                    type="button"
                                    className="expander-header"
                                    onClick={() => toggleAppExpand(target.id)}
                                >
                                    <div className="expander-title-area">
                                        <div
                                            className="target-color-dot"
                                            style={{
                                                background: getTagColor(target.label, theme),
                                                width: "8px",
                                                height: "8px",
                                                borderRadius: "50%",
                                                flexShrink: 0
                                            }}
                                        />
                                        <div className="expander-text">
                                            <span className="expander-title">{target.label}</span>
                                            <span className="expander-subtitle" style={{ wordBreak: "break-all" }}>
                                                {target.appPath}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="expander-actions" onClick={(e) => e.stopPropagation()}>
                                        {!isRecordEnabled ? (
                                            <span className="target-badge ignore">{t("app_cleanup_policy_ignore")}</span>
                                        ) : target.ruleCount > 0 ? (
                                            <span className="target-badge">{target.ruleCount}</span>
                                        ) : null}
                                        <button
                                            type="button"
                                            className="fluent-switch-control"
                                            style={{ padding: 0, marginLeft: "4px" }}
                                            onClick={() => toggleAppExpand(target.id)}
                                        >
                                            <span className="expander-arrow" style={{ padding: "6px" }}>
                                                <ChevronDown size={16} />
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            className="fluent-btn-danger"
                                            style={{ padding: "6px", minHeight: "auto", height: "auto" }}
                                            onClick={(e) => handleDeleteTarget(e, target)}
                                            title={t("delete")}
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="expander-content">
                                        <div className="setting-row">
                                            <div className="setting-row-info">
                                                <span className="setting-row-label">记录此应用的内容？</span>
                                                <span className="setting-row-hint">
                                                    {isRecordEnabled
                                                        ? "当前已开启记录，可以添加该应用专属的正则清洗规则"
                                                        : "当前已关闭记录，来自该应用的内容将被完全忽略，不保存到剪贴板中"
                                                    }
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                className={`fluent-switch-control ${isRecordEnabled ? "active" : ""}`}
                                                onClick={() => toggleTargetAction(target)}
                                            >
                                                <span className="fluent-switch-track">
                                                    <span className="fluent-switch-thumb" />
                                                </span>
                                                <span className="fluent-switch-label">
                                                    {isRecordEnabled ? "开启" : "关闭"}
                                                </span>
                                            </button>
                                        </div>

                                        {isRecordEnabled && renderRulesSection(target)}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </>
            )}
        </div>
    );
};

export default AdvancedSettingsGroup;
