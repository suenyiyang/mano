import type { FC } from "react";
import { useTranslation } from "react-i18next";

interface QuickActionsProps {
  onSelect: (text: string) => void;
}

const ACTION_KEYS = [
  "quickActions.buildWebsite",
  "quickActions.analyzeData",
  "quickActions.writeCode",
  "quickActions.researchTopic",
] as const;

export const QuickActions: FC<QuickActionsProps> = (props) => {
  const { t } = useTranslation();

  return (
    <div className="mt-3.5 flex max-w-[620px] flex-wrap justify-center gap-1.5 px-6">
      {ACTION_KEYS.map((key) => {
        const label = t(key);
        return (
          <button
            key={key}
            type="button"
            className="cursor-pointer rounded-[99px] border-none bg-[var(--bg-hover)] px-3.5 py-1.5 text-[13px] text-[var(--fg-muted)] transition-all hover:bg-[var(--bg-active)] hover:text-[var(--fg)]"
            style={{ fontFamily: "var(--font-sans)" }}
            onClick={() => props.onSelect(label)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};
