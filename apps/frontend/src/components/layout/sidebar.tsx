import { PanelLeftClose, Plus, Search, Settings, User } from "lucide-react";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/auth-context.js";
import { useSidebar } from "../../contexts/sidebar-context.js";
import { useSessionListLogic } from "../../hooks/use-session-list-logic.js";
import { cn } from "../../lib/utils.js";
import { LanguageSwitcher } from "./language-switcher.js";
import { SessionList } from "./session-list.js";

export const Sidebar: FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isOpen, isMobile, close } = useSidebar();
  const sessionList = useSessionListLogic();

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 pt-4 pb-2.5">
        <span className="text-[15px] font-[650] tracking-[-0.02em] text-[var(--fg)]">
          {t("brand.name")}
        </span>
        <div className="flex gap-0.5">
          <button
            type="button"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-[var(--fg-muted)] transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]"
            title={t("sidebar.newChat")}
            onClick={sessionList.handleNewChat}
          >
            <Plus size={16} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-[var(--fg-muted)] transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]"
            title={t("sidebar.close")}
            onClick={close}
          >
            <PanelLeftClose size={16} strokeWidth={1.75} />
          </button>
        </div>
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
        onRename={(sessionId, title) => {
          sessionList.renameSessionMutation.mutate({ sessionId, title });
        }}
        onDelete={(sessionId) => {
          sessionList.deleteSessionMutation.mutate(sessionId);
        }}
      />

      {/* Footer */}
      <div className="p-1.5">
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-[7px] text-[13px] text-[var(--fg-muted)] transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]"
          onClick={sessionList.handleOpenSettings}
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
    </>
  );

  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        <button
          type="button"
          className={cn(
            "fixed inset-0 z-40 cursor-default border-none bg-black/50 transition-opacity duration-300",
            isOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          aria-label="Close sidebar"
          onClick={close}
        />
        {/* Drawer */}
        <aside
          className={cn(
            "fixed left-0 top-0 z-50 flex h-full w-[260px] flex-col border-r border-[var(--border)] bg-[var(--bg-sidebar)] transition-transform duration-300",
            isOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {sidebarContent}
        </aside>
      </>
    );
  }

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-[var(--border)] bg-[var(--bg-sidebar)] transition-[width,min-width] duration-300",
        isOpen ? "w-[260px] min-w-[260px]" : "w-0 min-w-0 overflow-hidden",
      )}
    >
      {sidebarContent}
    </aside>
  );
};
