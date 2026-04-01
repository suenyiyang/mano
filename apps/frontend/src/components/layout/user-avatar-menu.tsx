import { Languages, LogOut, Settings, User } from "lucide-react";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useAuth } from "../../contexts/auth-context.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.js";

const LANGUAGES = [
  { code: "en-US", label: "English" },
  { code: "zh-CN", label: "中文" },
] as const;

export const UserAvatarMenu: FC = () => {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const current = LANGUAGES.find((l) => l.code === i18n.language);
  const next = LANGUAGES.find((l) => l.code !== i18n.language) ?? LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none bg-[var(--bg-hover)] text-[var(--fg-muted)] transition-all hover:text-[var(--fg)]"
        >
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <User size={16} strokeWidth={1.75} />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-[var(--fg)]">
              {user?.displayName ?? t("sidebar.user")}
            </span>
            {user?.email && <span className="text-xs text-[var(--fg-muted)]">{user.email}</span>}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/app/settings")}>
          <Settings size={14} />
          {t("common.settings")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => i18n.changeLanguage(next.code)}>
          <Languages size={14} />
          {current?.label ?? "English"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={logout}
          className="text-red-500 focus:bg-red-500/10 focus:text-red-500"
        >
          <LogOut size={14} />
          {t("sidebar.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
