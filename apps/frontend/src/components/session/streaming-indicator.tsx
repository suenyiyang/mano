import type { FC } from "react";

export const StreamingIndicator: FC = () => {
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-[var(--fg-faint)]" />
      <span
        className="h-[5px] w-[5px] animate-pulse rounded-full bg-[var(--fg-faint)]"
        style={{ animationDelay: "0.2s" }}
      />
      <span
        className="h-[5px] w-[5px] animate-pulse rounded-full bg-[var(--fg-faint)]"
        style={{ animationDelay: "0.4s" }}
      />
    </div>
  );
};
