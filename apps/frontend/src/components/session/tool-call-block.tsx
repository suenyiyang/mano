import { ChevronRight, Wrench } from "lucide-react";
import { type FC, useState } from "react";

interface ToolCallBlockProps {
  name: string;
  label: string | Record<string, unknown>;
  status: "running" | "done" | "error";
  resultContent?: string;
}

export const ToolCallBlock: FC<ToolCallBlockProps> = (props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandable = !!props.resultContent;
  const formattedLabel = formatLabel(props.label);

  const handleClick = () => {
    if (isExpandable) {
      setIsExpanded((prev) => !prev);
    }
  };

  return (
    <div className="my-2.5">
      <div
        className={`flex items-center gap-1.5 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] ${isExpandable ? "cursor-pointer" : ""}`}
        onClick={handleClick}
      >
        <Wrench size={14} strokeWidth={1.75} className="shrink-0" />
        <span className="text-xs" style={{ fontFamily: "var(--font-mono)" }}>
          {props.name}
          {formattedLabel && <span className="text-[var(--fg-faint)]">({formattedLabel})</span>}
        </span>
        {isExpandable && (
          <span
            className={`text-[var(--fg-faint)] transition-transform ${isExpanded ? "rotate-90" : ""}`}
          >
            <ChevronRight size={12} />
          </span>
        )}
      </div>
      {isExpanded && props.resultContent && (
        <pre
          className="mt-1.5 max-h-[300px] overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--bg-bubble)] p-3 text-[13px] leading-[1.5] text-[var(--fg-muted)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {props.resultContent}
        </pre>
      )}
    </div>
  );
};

const extractKey = (obj: Record<string, unknown>): string => {
  const val = obj.path ?? obj.file_path ?? obj.filename ?? obj.query ?? obj.command;
  return val != null ? String(val) : "";
};

const formatLabel = (label: unknown): string => {
  // label may be a JSON string (streaming) or a parsed object (persisted from DB)
  if (typeof label === "object" && label !== null) {
    return extractKey(label as Record<string, unknown>);
  }
  if (typeof label !== "string" || !label) {
    return "";
  }
  try {
    const parsed = JSON.parse(label);
    if (typeof parsed === "object" && parsed !== null) {
      return extractKey(parsed as Record<string, unknown>);
    }
    return String(parsed);
  } catch {
    return label.length > 50 ? `${label.slice(0, 50)}...` : label;
  }
};
