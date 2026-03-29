import type { FC } from "react";
import { useTranslation } from "react-i18next";

export const Hero: FC = () => {
  const { t } = useTranslation();

  return (
    <div className="mb-8 flex flex-col items-center gap-1.5">
      <h1 className="text-[22px] font-[650] tracking-[-0.03em] text-[var(--fg)]">
        {t("hero.title")}
      </h1>
      <p className="text-sm text-[var(--fg-muted)]">{t("hero.subtitle")}</p>
    </div>
  );
};
