import { PanelLeft } from "lucide-react";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { AuthProvider } from "../../contexts/auth-context.js";
import { SidebarProvider, useSidebar } from "../../contexts/sidebar-context.js";
import { ThemeProvider } from "../../contexts/theme-context.js";
import { Sidebar } from "./sidebar.js";

const AppLayoutInner: FC = () => {
  const { t } = useTranslation();
  const { isOpen, open } = useSidebar();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="relative flex min-w-0 flex-1 flex-col bg-[var(--bg)]">
        {!isOpen && (
          <button
            type="button"
            className="absolute top-2.5 left-3 z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-[var(--fg-muted)] transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]"
            title={t("sidebar.open")}
            onClick={open}
          >
            <PanelLeft size={16} strokeWidth={1.75} />
          </button>
        )}
        <Outlet />
      </main>
    </div>
  );
};

export const AppLayout: FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SidebarProvider>
          <AppLayoutInner />
        </SidebarProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};
