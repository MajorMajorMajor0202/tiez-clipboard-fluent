import React from "react";

export interface FluentButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "subtle" | "danger";
  size?: "small" | "medium" | "large";
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  loading?: boolean;
}

const FluentButton: React.FC<FluentButtonProps> = ({
  variant = "secondary",
  size = "medium",
  icon,
  iconPosition = "left",
  loading = false,
  className = "",
  disabled = false,
  children,
  type = "button",
  ...rest
}) => {
  const sizeClass = size === "small" ? "fluent-btn-sm" : size === "large" ? "fluent-btn-lg" : "fluent-btn-md";
  const variantClass = `fluent-btn-${variant}`;

  return (
    <button
      type={type}
      className={`fluent-btn ${variantClass} ${sizeClass} ${className}`.trim()}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="fluent-btn-spinner" />}
      {!loading && icon && iconPosition === "left" && (
        <span className="fluent-btn-icon fluent-btn-icon-left">{icon}</span>
      )}
      {children !== undefined && children !== null && (
        <span className="fluent-btn-text">{children}</span>
      )}
      {!loading && icon && iconPosition === "right" && (
        <span className="fluent-btn-icon fluent-btn-icon-right">{icon}</span>
      )}
    </button>
  );
};

export default FluentButton;
