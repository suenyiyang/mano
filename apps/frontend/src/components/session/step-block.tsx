import { CheckCircle, Clock } from "lucide-react";
import type { FC } from "react";

interface StepBlockProps {
  label: string;
  status: "running" | "done";
}

export const StepBlock: FC<StepBlockProps> = (props) => {
  return (
    <div className="flex items-center gap-1.5 text-[13px] text-[var(--fg-muted)]">
      {props.status === "done" ? (
        <CheckCircle size={14} strokeWidth={2} className="shrink-0 text-green-500" />
      ) : (
        <Clock size={14} strokeWidth={2} className="shrink-0 text-[var(--fg-faint)]" />
      )}
      {props.label}
    </div>
  );
};
