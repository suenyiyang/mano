import { MoreHorizontal, Share2 } from "lucide-react";
import type { FC } from "react";

interface TopbarProps {
  title: string;
}

export const Topbar: FC<TopbarProps> = (props) => {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between px-5">
      <div className="text-sm font-medium text-[var(--fg)]">{props.title}</div>
      <div className="flex gap-1">
        <button
          type="button"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-[var(--fg-muted)] transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]"
          title="Share"
        >
          <Share2 size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-[var(--fg-muted)] transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]"
          title="More"
        >
          <MoreHorizontal size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
};
