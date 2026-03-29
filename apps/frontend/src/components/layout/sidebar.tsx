import { Plus, Search, Settings, User } from "lucide-react";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/auth-context.js";
import { useSessionListLogic } from "../../hooks/use-session-list-logic.js";
import { LanguageSwitcher } from "./language-switcher.js";
import { SessionList } from "./session-list.js";

export const Sidebar: FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const sessionList = useSessionListLogic();

  return (
    <aside className="flex w-[260px] min-w-[260px] flex-col border-r border-[var(--border)] bg-[var(--bg-sidebar)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 pt-4 pb-2.5">
        <span className="text-[15px] font-[650] tracking-[-0.02em] text-[var(--fg)]">
          {t("brand.name")}
        </span>
        <button
          type="button"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-[var(--fg-muted)] transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]"
          title={t("sidebar.newChat")}
          onClick={sessionList.handleNewChat}
        >
          <Plus size={16} strokeWidth={1.75} />
        </button>
      </div>

      {/* Search */}
      <div className="relative mx-2.5 mb-2">
        <Search
          size={14}
          strokeWidth={1.75}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-faint)]"
        />
        <input
          type="text"
          placeholder={t("sidebar.searchPlaceholder")}
          value={sessionList.search}
          onChange={(e) => sessionList.setSearch(e.target.value)}
          className="h-8 w-full rounded-md border-none bg-[var(--bg-hover)] pl-[30px] pr-2.5 text-[13px] text-[var(--fg)] outline-none placeholder:text-[var(--fg-faint)]"
        />
      </div>

      {/* Session list */}
      <SessionList
        sessions={sessionList.sessions}
        fetchNextPage={sessionList.fetchNextPage}
        hasNextPage={sessionList.hasNextPage ?? false}
        isFetchingNextPage={sessionList.isFetchingNextPage}
        isLoading={sessionList.isLoading}
      />

      {/* Footer */}
      <div className="p-1.5">
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-[7px] text-[13px] text-[var(--fg-muted)] transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]"
        >
          <Settings size={15} strokeWidth={1.75} />
          <span>{t("common.settings")}</span>
        </button>
        <LanguageSwitcher />
        <div className="flex items-center gap-2 rounded-md px-2.5 py-[7px] text-[13px] text-[var(--fg-muted)]">
          <User size={15} strokeWidth={1.75} />
          <span>{user?.displayName ?? t("sidebar.user")}</span>
        </div>
      </div>
    </aside>
  );
};
