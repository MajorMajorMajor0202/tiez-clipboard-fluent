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
    const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
        global: true
    });

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

    const toggleCard = (id: string) => {
        setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
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
            toggleCard(existing.id);
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
        toggleCard(`app:${app.value}`);
        setSearchText("");
    };

    const renderRulesSection = (target: SourceTarget) => {
        const rules = getRulesForTarget(target);

        return (
            <div className="fluent-setting-card" style={{ flexDirection: "column", alignItems: "stretch", gap: "12px", border: "none", boxShadow: "none", background: "transparent", padding: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="fluent-setting-title" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>过滤和清洗规则</span>
                    <button type="button" className="fluent-button fluent-button-primary" style={{ padding: "4px 12px", fontSize: "12px" }} onClick={() => addRule(target)}>
                        <Plus size={14} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                        <span style={{ verticalAlign: "middle" }}>{t("advanced_add_rule")}</span>
                    </button>
                </div>

                {rules.length === 0 ? (
                    <div className="fluent-setting-card" style={{ justifyContent: "center", padding: "20px", borderStyle: "dashed" }}>
                        <span className="fluent-setting-description" style={{ textAlign: "center" }}>
                            {target.kind === "global"
                                ? t("advanced_empty_rules_global")
                                : t("advanced_empty_rules_app")}
                        </span>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {rules.map((rule, idx) => {
                            return (
                                <div key={`${target.id}-rule-${idx}`} className="fluent-rule-editor-card">
                                    <div className="rule-header-row">
                                        <div className="fluent-setting-info" style={{ flex: 1 }}>
                                            <input
                                                type="text"
                                                className="fluent-input"
                                                style={{ fontWeight: 600, border: "none", background: "transparent", padding: "2px 4px", fontSize: "13px" }}
                                                value={rule.label ?? ""}
                                                placeholder={`${t("advanced_rule_label")} ${idx + 1}`}
                                                onFocus={focusEditorWindow}
                                                onChange={(e) => updateRule(target, idx, { label: e.target.value })}
                                            />
                                        </div>
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
                                        <button
                                            type="button"
                                            className="fluent-button"
                                            style={{ padding: "6px", color: "#ef4444" }}
                                            onClick={() => deleteRule(target, idx)}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    
                                    <div className={`rule-fields-grid ${rule.actionType === "replace" ? "two-cols" : ""}`}>
                                        <div className="rule-field">
                                            <span className="rule-field-label">{t("advanced_match_label")}</span>
                                            <textarea
                                                className="fluent-textarea"
                                                style={{ minHeight: "56px" }}
                                                value={rule.match}
                                                placeholder={t("advanced_match_placeholder")}
                                                onFocus={focusEditorWindow}
                                                onChange={(e) => updateRule(target, idx, { match: e.target.value })}
                                            />
                                        </div>

                                        {rule.actionType === "replace" && (
                                            <div className="rule-field">
                                                <span className="rule-field-label">{t("advanced_replace_label")}</span>
                                                <textarea
                                                    className="fluent-textarea"
                                                    style={{ minHeight: "56px" }}
                                                    value={rule.replace}
                                                    placeholder={t("advanced_replace_placeholder")}
                                                    onFocus={focusEditorWindow}
                                                    onChange={(e) => updateRule(target, idx, { replace: e.target.value })}
                                                />
                                            </div>
                                        )}
                                    </div>
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
    const isGlobalExpanded = !!expandedCards.global;

    return (
        <div className="fluent-settings-content" style={{ padding: 0 }}>
            {/* 添加特定应用策略 */}
            <div className="fluent-setting-card" style={{ marginBottom: "16px" }}>
                <div className="fluent-setting-info">
                    <span className="fluent-setting-title">添加应用专属策略</span>
                    <span className="fluent-setting-description">搜索并选择一个已安装的应用，为其添加专属的剪贴板策略</span>
                </div>
                <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                        <Search size={14} style={{ position: "absolute", left: "10px", color: "var(--text-secondary)", opacity: 0.6 }} />
                        <input
                            type="text"
                            className="fluent-input"
                            style={{ width: "200px", paddingLeft: "28px" }}
                            placeholder={t("search_apps_placeholder")}
                            value={searchText}
                            onFocus={focusEditorWindow}
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                        {searchText && (
                            <X
                                size={14}
                                style={{ position: "absolute", right: 8, cursor: "pointer", opacity: 0.6 }}
                                onClick={() => setSearchText("")}
                            />
                        )}
                    </div>
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

            <div className="fluent-section-title">全局策略</div>

            {/* 全局折叠卡片 */}
            <div className="fluent-setting-expander">
                <div
                    className={`fluent-setting-expander-header ${isGlobalExpanded ? "expanded" : ""}`}
                    onClick={() => toggleCard("global")}
                >
                    <div className="fluent-setting-info">
                        <span className="fluent-setting-title">全局清洗规则</span>
                        <span className="fluent-setting-description">对所有应用复制的内容生效（特定应用策略优先）</span>
                    </div>
                    <div className="fluent-setting-control" onClick={(e) => e.stopPropagation()}>
                        {globalTarget.ruleCount > 0 && (
                            <span className="fluent-setting-badge">{globalTarget.ruleCount} 条规则</span>
                        )}
                        <button
                            type="button"
                            className="fluent-hotkey-recorder"
                            style={{ height: "32px", padding: "0 8px" }}
                            onClick={() => toggleCard("global")}
                        >
                            {isGlobalExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                    </div>
                </div>
                {isGlobalExpanded && (
                    <div className="fluent-setting-expander-content">
                        {renderRulesSection(globalTarget)}
                    </div>
                )}
            </div>

            {appTargets.length > 0 && (
                <>
                    <div className="fluent-section-title">特定应用策略</div>
                    {appTargets.map((target) => {
                        const isExpanded = !!expandedCards[target.id];
                        const policy = appCleanupPolicies.find(p => p.id === target.policyId || p.appPath === target.appPath);
                        const isRecordEnabled = policy ? policy.action !== "ignore" : true;

                        return (
                            <div key={target.id} className="fluent-setting-expander">
                                <div
                                    className={`fluent-setting-expander-header ${isExpanded ? "expanded" : ""}`}
                                    onClick={() => toggleCard(target.id)}
                                >
                                    <div className="fluent-setting-info" style={{ flexDirection: "row", alignItems: "center", gap: "10px" }}>
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
                                        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                                            <span className="fluent-setting-title">{target.label}</span>
                                            <span className="fluent-setting-description" style={{ wordBreak: "break-all" }}>{target.appPath}</span>
                                        </div>
                                    </div>
                                    <div className="fluent-setting-control" onClick={(e) => e.stopPropagation()}>
                                        {!isRecordEnabled ? (
                                            <span className="fluent-setting-badge ignore">{t("app_cleanup_policy_ignore")}</span>
                                        ) : target.ruleCount > 0 ? (
                                            <span className="fluent-setting-badge">{target.ruleCount} 条规则</span>
                                        ) : null}
                                        <button
                                            type="button"
                                            className="fluent-hotkey-recorder"
                                            style={{ height: "32px", padding: "0 8px" }}
                                            onClick={() => toggleCard(target.id)}
                                        >
                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </button>
                                        <button
                                            type="button"
                                            className="fluent-button"
                                            style={{ padding: "6px 8px", color: "#ef4444", height: "32px" }}
                                            onClick={(e) => handleDeleteTarget(e, target)}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="fluent-setting-expander-content" style={{ gap: "12px" }}>
                                        <div className="fluent-setting-card" style={{ border: "none", boxShadow: "none", background: "transparent", padding: "4px 0", marginBottom: 0 }}>
                                            <div className="fluent-setting-info">
                                                <span className="fluent-setting-title" style={{ fontSize: "13px" }}>记录此应用的内容？</span>
                                                <span className="fluent-setting-description">
                                                    {isRecordEnabled
                                                        ? "当前已开启记录，可以添加该应用专属的正则清洗规则"
                                                        : "当前已关闭记录，来自该应用的内容将被完全忽略，不保存到剪贴板中"
                                                    }
                                                </span>
                                            </div>
                                            <label className="fluent-switch" style={{ flexShrink: 0 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isRecordEnabled}
                                                    onChange={() => toggleTargetAction(target)}
                                                />
                                                <span className="fluent-slider" />
                                            </label>
                                        </div>

                                        {isRecordEnabled && (
                                            <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: "12px", marginTop: "4px" }}>
                                                {renderRulesSection(target)}
                                            </div>
                                        )}
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
