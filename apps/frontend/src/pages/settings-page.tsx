import type { FC } from "react";

export const SettingsPage: FC = () => {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center px-5 text-sm font-medium text-[var(--fg)]">
        Settings
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-[600px] space-y-8">
          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--fg)]">Profile</h2>
            <p className="text-sm text-[var(--fg-muted)]">Profile settings coming soon.</p>
          </section>
          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--fg)]">Skills</h2>
            <p className="text-sm text-[var(--fg-muted)]">Skill management coming soon.</p>
          </section>
          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--fg)]">MCP Servers</h2>
            <p className="text-sm text-[var(--fg-muted)]">MCP server configuration coming soon.</p>
          </section>
        </div>
      </div>
    </div>
  );
};
