import type { FC } from "react";

const ACTIONS = ["Build a website", "Analyze data", "Write code", "Research a topic"];

interface QuickActionsProps {
  onSelect: (text: string) => void;
}

export const QuickActions: FC<QuickActionsProps> = (props) => {
  return (
    <div className="mt-3.5 flex max-w-[620px] flex-wrap justify-center gap-1.5 px-6">
      {ACTIONS.map((action) => (
        <button
          key={action}
          type="button"
          className="cursor-pointer rounded-[99px] border-none bg-[var(--bg-hover)] px-3.5 py-1.5 text-[13px] text-[var(--fg-muted)] transition-all hover:bg-[var(--bg-active)] hover:text-[var(--fg)]"
          style={{ fontFamily: "var(--font-sans)" }}
          onClick={() => props.onSelect(action)}
        >
          {action}
        </button>
      ))}
    </div>
  );
};
