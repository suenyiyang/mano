import type { FC, InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils.js";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

const Input: FC<InputProps> = ({ className, type, ...props }) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-[var(--radius-default)] border border-[var(--border-input)] bg-transparent px-3 py-1 text-sm transition-colors",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "placeholder:text-[var(--fg-faint)]",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
};

export type { InputProps };
export { Input };
