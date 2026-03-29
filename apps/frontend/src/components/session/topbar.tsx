import { useQuery } from "@tanstack/react-query";
import { GitFork, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSidebar } from "../../contexts/sidebar-context.js";
import { cn } from "../../lib/utils.js";
import { apiClient } from "../../services/api-client.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.js";
import { Input } from "../ui/input.js";

interface TopbarProps {
  title: string;
  currentTier: string;
  onRename: (title: string) => void;
  onFork: () => void;
  onDelete: () => void;
  onModelTierChange: (tier: string) => void;
}

interface TierInfo {
  tier: string;
  displayName: string;
}

export const Topbar: FC<TopbarProps> = (props) => {
  const { t } = useTranslation();
  const { isOpen } = useSidebar();
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(props.title);

  const tiersQuery = useQuery({
    queryKey: ["modelTiers"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ tiers: TierInfo[] }>("/models/tiers");
      return data.tiers;
    },
    staleTime: 10 * 60 * 1000,
  });

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== props.title) {
      props.onRename(trimmed);
    }
    setIsRenaming(false);
  };

  return (
    <div className={cn("flex h-12 shrink-0 items-center justify-between px-5", !isOpen && "pl-12")}>
      <div className="text-sm font-medium text-[var(--fg)]">
        {isRenaming ? (
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameSubmit();
              if (e.key === "Escape") setIsRenaming(false);
            }}
            className="h-7 w-48 text-sm"
            autoFocus
          />
        ) : (
          props.title
        )}
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-[var(--fg-muted)] transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]"
          title={t("topbar.share")}
        >
          <Share2 size={16} strokeWidth={1.75} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-[var(--fg-muted)] transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]"
              title={t("topbar.more")}
            >
              <MoreHorizontal size={16} strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setRenameValue(props.title);
                setIsRenaming(true);
              }}
            >
              <Pencil size={14} />
              {t("topbar.rename")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={props.onFork}>
              <GitFork size={14} />
              {t("topbar.fork")}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>{t("topbar.modelTier")}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuLabel>{t("topbar.selectTier")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(tiersQuery.data ?? []).map((tier) => (
                  <DropdownMenuItem
                    key={tier.tier}
                    onClick={() => props.onModelTierChange(tier.tier)}
                    className={tier.tier === props.currentTier ? "font-medium" : ""}
                  >
                    {tier.displayName}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={props.onDelete} className="text-red-500">
              <Trash2 size={14} />
              {t("common.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
