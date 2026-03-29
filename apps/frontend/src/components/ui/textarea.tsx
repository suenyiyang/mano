import type { FC, TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils.js";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea: FC<TextareaProps> = ({ className, ...props }) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-[var(--radius-default)] border border-[var(--border-input)] bg-transparent px-3 py-2 text-sm",
        "placeholder:text-[var(--fg-faint)]",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
};

export type { TextareaProps };
export { Textarea };
