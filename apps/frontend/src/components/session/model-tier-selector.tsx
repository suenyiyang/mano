import { useQuery } from "@tanstack/react-query";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { apiClient } from "../../services/api-client.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.js";

interface ModelTierSelectorProps {
  currentTier: string;
  onSelect: (tier: string) => void;
  children: React.ReactNode;
}

interface TierInfo {
  tier: string;
  displayName: string;
  models: Array<{ displayName: string }>;
}

export const ModelTierSelector: FC<ModelTierSelectorProps> = (props) => {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ["modelTiers"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ tiers: TierInfo[] }>("/models/tiers");
      return data.tiers;
    },
    staleTime: 10 * 60 * 1000,
  });

  const tiers = data ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{props.children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("modelTierSelector.label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tiers.map((tier) => (
          <DropdownMenuItem
            key={tier.tier}
            onClick={() => props.onSelect(tier.tier)}
            className={tier.tier === props.currentTier ? "font-medium" : ""}
          >
            {tier.displayName}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
