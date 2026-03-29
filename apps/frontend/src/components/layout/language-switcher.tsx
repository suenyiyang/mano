import { Languages } from "lucide-react";
import type { FC } from "react";
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "en-US", label: "English" },
  { code: "zh-CN", label: "中文" },
] as const;

export const LanguageSwitcher: FC = () => {
  const { i18n } = useTranslation();

  const current = LANGUAGES.find((l) => l.code === i18n.language);
  const next = LANGUAGES.find((l) => l.code !== i18n.language) ?? LANGUAGES[0];

  return (
    <button
      type="button"
      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-[7px] text-[13px] text-[var(--fg-muted)] transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]"
      onClick={() => i18n.changeLanguage(next.code)}
    >
      <Languages size={15} strokeWidth={1.75} />
      <span>{current?.label ?? "English"}</span>
    </button>
  );
};
