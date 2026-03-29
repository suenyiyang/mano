import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSidebar } from "../contexts/sidebar-context.js";
import { cn } from "../lib/utils.js";
import { McpServersPage } from "./settings/mcp-servers-page.js";
import { ModelTiersPage } from "./settings/model-tiers-page.js";
import { SkillsPage } from "./settings/skills-page.js";

type Tab = "skills" | "mcp-servers" | "model-tiers";

const TAB_IDS: Tab[] = ["skills", "mcp-servers", "model-tiers"];

const TAB_LABEL_KEYS: Record<Tab, string> = {
  skills: "settings.tabSkills",
  "mcp-servers": "settings.tabMcpServers",
  "model-tiers": "settings.tabModelTiers",
};

export const SettingsPage: FC = () => {
  const { t } = useTranslation();
  const { isOpen } = useSidebar();
  const [activeTab, setActiveTab] = useState<Tab>("skills");

  return (
    <div className="flex flex-1 flex-col">
      <div
        className={cn(
          "flex h-12 shrink-0 items-center px-5 text-sm font-medium text-[var(--fg)]",
          !isOpen && "pl-12",
        )}
      >
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
                onClick={() => setActiveTab(id)}
              >
                {t(TAB_LABEL_KEYS[id])}
              </button>
            ))}
          </div>

          {activeTab === "skills" && <SkillsPage />}
          {activeTab === "mcp-servers" && <McpServersPage />}
          {activeTab === "model-tiers" && <ModelTiersPage />}
        </div>
      </div>
    </div>
  );
};
