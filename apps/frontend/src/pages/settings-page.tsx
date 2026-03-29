import { type FC, useState } from "react";
import { cn } from "../lib/utils.js";
import { McpServersPage } from "./settings/mcp-servers-page.js";
import { ModelTiersPage } from "./settings/model-tiers-page.js";
import { SkillsPage } from "./settings/skills-page.js";

type Tab = "skills" | "mcp-servers" | "model-tiers";

const tabs: { id: Tab; label: string }[] = [
  { id: "skills", label: "Skills" },
  { id: "mcp-servers", label: "MCP Servers" },
  { id: "model-tiers", label: "Model Tiers" },
];

export const SettingsPage: FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("skills");

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center px-5 text-sm font-medium text-[var(--fg)]">
        Settings
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-[600px]">
          <div className="mb-6 flex gap-1 border-b border-[var(--border)]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={cn(
                  "px-3 pb-2 text-sm transition-colors cursor-pointer",
                  activeTab === tab.id
                    ? "border-b-2 border-[var(--fg)] font-medium text-[var(--fg)]"
                    : "text-[var(--fg-muted)] hover:text-[var(--fg)]",
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
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
