import { type FC, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { authSession } from "../services/auth-token.js";

export const OAuthCallbackPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    authSession.markLoggedIn();
    navigate("/app", { replace: true });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <p className="text-sm text-[var(--fg-muted)]">{t("common.signingIn")}</p>
    </div>
  );
};
