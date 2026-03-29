import { type FC, type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "../components/ui/button.js";
import { Input } from "../components/ui/input.js";
import { useAuthLogic } from "../hooks/use-auth.js";

export const LoginPage: FC = () => {
  const { t } = useTranslation();
  const { loginMutation } = useAuthLogic();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-sm space-y-6 px-6">
        <div className="text-center">
          <h1 className="text-[22px] font-[650] tracking-[-0.03em] text-[var(--fg)]">
            {t("brand.name")}
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{t("login.title")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="email"
            placeholder={t("login.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder={t("login.passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          {loginMutation.error && <p className="text-sm text-red-500">{t("login.error")}</p>}
          <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? t("login.submitting") : t("login.submit")}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[var(--border)]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[var(--bg)] px-2 text-[var(--fg-faint)]">
              {t("login.orContinueWith")}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              window.location.href = "/api/auth/github";
            }}
          >
            {t("login.github")}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              window.location.href = "/api/auth/google";
            }}
          >
            {t("login.google")}
          </Button>
        </div>

        <p className="text-center text-sm text-[var(--fg-muted)]">
          {t("login.noAccount")}{" "}
          <Link to="/register" className="text-[var(--fg)] hover:underline">
            {t("login.signUp")}
          </Link>
        </p>
      </div>
    </div>
  );
};
