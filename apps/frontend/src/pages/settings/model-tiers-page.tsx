import { useQuery } from "@tanstack/react-query";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { apiClient } from "../../services/api-client.js";
import type { ModelTier } from "../../types/api.js";

export const ModelTiersPage: FC = () => {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["modelTiers"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ tiers: ModelTier[] }>("/models/tiers");
      return data.tiers;
    },
  });

  if (query.isLoading) {
    return <p className="text-sm text-[var(--fg-muted)]">{t("modelTiers.loading")}</p>;
  }

  const tiers = query.data ?? [];

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-[var(--fg)]">{t("modelTiers.title")}</h2>

      {tiers.length === 0 ? (
        <p className="text-sm text-[var(--fg-muted)]">{t("modelTiers.empty")}</p>
      ) : (
        <div className="space-y-4">
          {tiers.map((tier) => (
            <div
              key={tier.tier}
              className="rounded-[var(--radius-default)] border border-[var(--border)] px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--fg)] capitalize">{tier.tier}</span>
                {tier.rateLimit && (
                  <span className="text-xs text-[var(--fg-muted)]">
                    {t("modelTiers.reqPerMin", { count: tier.rateLimit.requestsPerMinute })}{" "}
                    &middot; {t("modelTiers.reqPerDay", { count: tier.rateLimit.requestsPerDay })}
                  </span>
                )}
              </div>
              {tier.models.length > 0 && (
                <div className="mt-2 space-y-1">
                  {tier.models.map((model) => (
                    <div
                      key={`${model.provider}-${model.apiModelId}`}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="rounded bg-[var(--bg-hover)] px-1.5 py-0.5 text-[var(--fg-muted)]">
                        {model.provider}
                      </span>
                      <span className="text-[var(--fg)]">{model.displayName}</span>
                      <span className="text-[var(--fg-faint)] font-mono">{model.apiModelId}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
