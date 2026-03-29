import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "../components/ui/button.js";

export const NotFoundPage: FC = () => {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <div className="flex flex-col items-center gap-1.5 px-6">
        <span className="text-[72px] font-[700] leading-none tracking-[-0.04em] text-[var(--fg-faint)]">
          {t("notFound.code")}
        </span>
        <h1 className="mt-2 text-[22px] font-[650] tracking-[-0.03em] text-[var(--fg)]">
          {t("notFound.title")}
        </h1>
        <p className="text-sm text-[var(--fg-muted)]">{t("notFound.description")}</p>
        <Button asChild className="mt-4">
          <Link to="/app">{t("notFound.goHome")}</Link>
        </Button>
      </div>
    </div>
  );
};
