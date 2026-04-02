import { ArrowLeft } from "lucide-react";
import { type FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";
import { useSidebar } from "../contexts/sidebar-context.js";
import { cn } from "../lib/utils.js";
import { McpServersPage } from "./settings/mcp-servers-page.js";
import { SkillsPage } from "./settings/skills-page.js";

type Tab = "skills" | "mcp-servers";

const TAB_IDS: Tab[] = ["skills", "mcp-servers"];

const TAB_LABEL_KEYS: Record<Tab, string> = {
  skills: "settings.tabSkills",
  "mcp-servers": "settings.tabMcpServers",
};

export const SettingsPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isOpen } = useSidebar();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get("tab") as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(
    tabParam && TAB_IDS.includes(tabParam) ? tabParam : "skills",
  );

  // Sync tab from URL query param
  useEffect(() => {
    const tab = searchParams.get("tab") as Tab | null;
    if (tab && TAB_IDS.includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  return (
    <div className="flex flex-1 flex-col">
      <div
        className={cn(
          "flex h-12 shrink-0 items-center gap-1 px-5 text-sm font-medium text-[var(--fg)]",
          !isOpen && "pl-12",
        )}
      >
        <button
          type="button"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-[var(--fg-muted)] transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={16} strokeWidth={1.75} />
        </button>
        {t("settings.title")}
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-[600px]">
          <div className="mb-6 flex gap-1 border-b border-[var(--border)]">
            {TAB_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={cn(
                  "px-3 pb-2 text-sm transition-colors cursor-pointer",
                  activeTab === id
                    ? "border-b-2 border-[var(--fg)] font-medium text-[var(--fg)]"
                    : "text-[var(--fg-muted)] hover:text-[var(--fg)]",
                )}
                onClick={() => handleTabChange(id)}
              >
                {t(TAB_LABEL_KEYS[id])}
              </button>
            ))}
          </div>

          {activeTab === "skills" && <SkillsPage />}
          {activeTab === "mcp-servers" && <McpServersPage />}
        </div>
      </div>
    </div>
  );
};
