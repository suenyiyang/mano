import { GitFork, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSidebar } from "../../contexts/sidebar-context.js";
import { cn } from "../../lib/utils.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.js";
import { Input } from "../ui/input.js";
import { DeleteSessionDialog } from "./delete-session-dialog.js";

interface TopbarProps {
  title: string;
  onRename: (title: string) => void;
  onFork: () => void;
  onDelete: () => void;
}

export const Topbar: FC<TopbarProps> = (props) => {
  const { t } = useTranslation();
  const { isOpen } = useSidebar();
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(props.title);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== props.title) {
      props.onRename(trimmed);
    }
    setIsRenaming(false);
  };

  return (
    <div
      className={cn(
        "flex h-12 shrink-0 items-center justify-between px-5 pr-16",
        !isOpen && "pl-12",
      )}
    >
      <div className="text-base font-medium text-[var(--fg)]">
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
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-red-500">
              <Trash2 size={14} />
              {t("common.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DeleteSessionDialog
        open={showDeleteDialog}
        title={props.title}
        onOpenChange={setShowDeleteDialog}
        onConfirm={() => {
          props.onDelete();
          setShowDeleteDialog(false);
        }}
      />
    </div>
  );
};
