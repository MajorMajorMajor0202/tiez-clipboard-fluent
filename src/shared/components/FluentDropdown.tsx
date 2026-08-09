import React, { useState, useRef, useEffect } from "react";
import { ChevronRight } from "lucide-react";

export interface FluentDropdownOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface FluentDropdownProps {
  options: FluentDropdownOption[];
  value: string;
  onChange: (id: string) => void;
  triggerClassName?: string;
  menuClassName?: string;
  style?: React.CSSProperties;
}

export const FluentDropdown: React.FC<FluentDropdownProps> = ({
  options,
  value,
  onChange,
  triggerClassName = "",
  menuClassName = "",
  style,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedIndex = options.findIndex((opt) => opt.id === value);
  const selectedOption = options[selectedIndex] || options[0];

  // Dynamic positioning for Fluent overlay effect
  const itemHeight = 32;
  const padding = 4;
  const gap = 4;
  const triggerHeight = 32;

  const topOffset = selectedIndex !== -1
    ? -(padding + selectedIndex * (itemHeight + gap)) + (triggerHeight - itemHeight) / 2
    : -4;

  const transformOrigin = selectedIndex !== -1
    ? `center ${padding + selectedIndex * (itemHeight + gap) + itemHeight / 2}px`
    : "top center";

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  const handleOptionClick = (id: string) => {
    onChange(id);
    setIsOpen(false);
  };

  return (
    <div
      className="fluent-dropdown-container"
      style={{
        ...style,
        zIndex: isOpen ? 1000 : undefined
      }}
    >
      <button
        ref={triggerRef}
        className={`fluent-dropdown-trigger-btn ${triggerClassName}`}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {selectedOption?.icon}
        <span>{selectedOption?.label}</span>
        <ChevronRight size={12} className="chevron-icon" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className={`fluent-dropdown-menu ${menuClassName}`}
          style={{
            top: `${topOffset}px`,
            transformOrigin,
          }}
        >
          {options.map((option) => {
            const isActive = option.id === value;
            return (
              <button
                key={option.id}
                className={`fluent-dropdown-item ${isActive ? "active" : ""}`}
                onClick={() => handleOptionClick(option.id)}
              >
                {option.icon}
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FluentDropdown;
