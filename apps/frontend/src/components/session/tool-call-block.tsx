import { ChevronRight, Wrench } from "lucide-react";
import type { FC } from "react";

interface ToolCallBlockProps {
  name: string;
  label: string;
  status: "running" | "done" | "error";
}

export const ToolCallBlock: FC<ToolCallBlockProps> = (props) => {
  return (
    <div className="my-2.5 flex cursor-pointer items-center gap-1.5 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)]">
      <Wrench size={14} strokeWidth={1.75} className="shrink-0" />
      <span className="text-xs" style={{ fontFamily: "var(--font-mono)" }}>
        {props.name}
      </span>
      {props.label && (
        <span className="text-xs text-[var(--fg-faint)]">{formatLabel(props.label)}</span>
      )}
      <span className="text-[var(--fg-faint)]">
        <ChevronRight size={12} />
      </span>
    </div>
  );
};

const formatLabel = (label: string): string => {
  // Try to extract a meaningful label from the tool arguments JSON
  try {
    const parsed = JSON.parse(label);
    // Common patterns: file path, query, etc.
    if (typeof parsed === "object" && parsed !== null) {
      return (
        parsed.path ?? parsed.file_path ?? parsed.filename ?? parsed.query ?? parsed.command ?? ""
      );
    }
    return String(parsed);
  } catch {
    return label.length > 50 ? `${label.slice(0, 50)}...` : label;
  }
};
