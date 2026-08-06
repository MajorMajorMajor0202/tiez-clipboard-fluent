import React, { useEffect, useState, useRef } from "react";
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
    const [isFocused, setIsFocused] = useState<boolean>(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setInputValue(String(value));
    }, [value]);

    const selectAndFocusInput = () => {
        if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    };

    const handleIncrement = (e: React.MouseEvent) => {
        e.preventDefault(); // Prevents input from losing focus
        const current = parseFloat(inputValue) || 0;
        const next = Math.min(max, current + step);
        setInputValue(String(next));
        onChange(next);
        // Highlight content
        setTimeout(selectAndFocusInput, 0);
    };

    const handleDecrement = (e: React.MouseEvent) => {
        e.preventDefault(); // Prevents input from losing focus
        const current = parseFloat(inputValue) || 0;
        const next = Math.max(min, current - step);
        setInputValue(String(next));
        onChange(next);
        // Highlight content
        setTimeout(selectAndFocusInput, 0);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val === "") {
            setInputValue("");
            return;
        }
        if (!/^\d*$/.test(val)) return;
        setInputValue(val);
    };

    const handleBlur = () => {
        setIsFocused(false);
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
            const current = parseFloat(inputValue) || 0;
            const next = Math.min(max, current + step);
            setInputValue(String(next));
            onChange(next);
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            const current = parseFloat(inputValue) || 0;
            const next = Math.max(min, current - step);
            setInputValue(String(next));
            onChange(next);
        }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);
        e.target.select();
        invoke("focus_clipboard_window").catch(console.error);
    };

    return (
        <div className="fluent-number-box" style={style} onClick={selectAndFocusInput}>
            <input
                ref={inputRef}
                type="text"
                className="fluent-number-box-input"
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                placeholder={placeholder}
            />
            
            {/* Permanent display chevrons (non-interactive, clicks focus/select main input) */}
            <div className="fluent-number-box-static-spinners">
                <ChevronUp size={8} className="static-chevron" />
                <ChevronDown size={8} className="static-chevron" />
            </div>

            {/* Active dropdown/popover spinners panel overlaying the static chevrons */}
            {isFocused && (
                <div className="fluent-number-box-popup" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        className="fluent-number-box-popup-btn"
                        onMouseDown={handleIncrement}
                        tabIndex={-1}
                        title="增加"
                    >
                        <ChevronUp size={12} />
                    </button>
                    <button
                        type="button"
                        className="fluent-number-box-popup-btn"
                        onMouseDown={handleDecrement}
                        tabIndex={-1}
                        title="减少"
                    >
                        <ChevronDown size={12} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default FluentNumberBox;
