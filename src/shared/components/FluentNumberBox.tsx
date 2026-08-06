import React, { useEffect, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface FluentNumberBoxProps {
    value: number | string;
    onChange: (val: number) => void;
    onBlur?: () => void;
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
    style?: React.CSSProperties;
}

const FluentNumberBox = ({
    value,
    onChange,
    onBlur,
    min = 0,
    max = 999999,
    step = 1,
    placeholder,
    style
}: FluentNumberBoxProps) => {
    const [inputValue, setInputValue] = useState<string>(String(value));

    useEffect(() => {
        setInputValue(String(value));
    }, [value]);

    const handleIncrement = () => {
        const current = parseFloat(inputValue) || 0;
        const next = Math.min(max, current + step);
        setInputValue(String(next));
        onChange(next);
    };

    const handleDecrement = () => {
        const current = parseFloat(inputValue) || 0;
        const next = Math.max(min, current - step);
        setInputValue(String(next));
        onChange(next);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val === "") {
            setInputValue("");
            return;
        }
        // Only allow positive integers for limits
        if (!/^\d*$/.test(val)) return;
        setInputValue(val);
    };

    const handleBlur = () => {
        if (inputValue === "") {
            onChange(min);
            setInputValue(String(min));
        } else {
            const parsed = parseFloat(inputValue);
            if (isNaN(parsed)) {
                onChange(min);
                setInputValue(String(min));
            } else {
                const clamped = Math.max(min, Math.min(max, parsed));
                onChange(clamped);
                setInputValue(String(clamped));
            }
        }
        if (onBlur) {
            onBlur();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowUp") {
            e.preventDefault();
            handleIncrement();
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            handleDecrement();
        }
    };

    const focusEditorWindow = () => {
        invoke("focus_clipboard_window").catch(console.error);
    };

    return (
        <div className="fluent-number-box" style={style}>
            <input
                type="text"
                className="fluent-number-box-input"
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onFocus={focusEditorWindow}
                placeholder={placeholder}
            />
            <button
                type="button"
                className="fluent-number-box-btn"
                onClick={handleDecrement}
                tabIndex={-1}
                title="减少"
            >
                <ChevronDown size={12} />
            </button>
            <button
                type="button"
                className="fluent-number-box-btn"
                onClick={handleIncrement}
                tabIndex={-1}
                title="增加"
            >
                <ChevronUp size={12} />
            </button>
        </div>
    );
};

export default FluentNumberBox;
