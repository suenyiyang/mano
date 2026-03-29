import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { type FC, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import { cn } from "../../lib/utils.js";
import type { Session } from "../../types/api.js";
import { DeleteSessionDialog } from "../session/delete-session-dialog.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.js";
import { Input } from "../ui/input.js";

interface SessionListProps {
  sessions: Session[];
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  onRename: (sessionId: string, title: string) => void;
  onDelete: (sessionId: string) => void;
}

export const SessionList: FC<SessionListProps> = (props) => {
  const { t } = useTranslation();
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
  const [menuOpenSessionId, setMenuOpenSessionId] = useState<string | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !props.hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !props.isFetchingNextPage) {
          props.fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [props.hasNextPage, props.isFetchingNextPage, props.fetchNextPage]);

  const startRename = (session: Session) => {
    setRenamingSessionId(session.id);
    setRenameValue(session.title || "");
  };

  const handleRenameSubmit = () => {
    if (!renamingSessionId) return;
    const trimmed = renameValue.trim();
    if (trimmed) {
      props.onRename(renamingSessionId, trimmed);
    }
    setRenamingSessionId(null);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    props.onDelete(deleteTarget.id);
    if (sessionId === deleteTarget.id) {
      navigate("/app");
    }
    setDeleteTarget(null);
  };

  if (props.isLoading) {
    return (
      <div className="flex-1 px-2 py-4">
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="h-8 animate-pulse rounded-md bg-[var(--bg-hover)]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (props.sessions.length === 0) {
    return (
      <div className="flex-1 px-4 py-8 text-center text-xs text-[var(--fg-faint)]">
        {t("sessionList.empty")}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-2 py-0.5">
      {props.sessions.map((session) => (
        <div key={session.id} className="group relative">
          {renamingSessionId === session.id ? (
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit();
                if (e.key === "Escape") setRenamingSessionId(null);
              }}
              className="h-8 rounded-md px-2.5 text-[13px]"
              autoFocus
            />
          ) : (
            <>
              <Link
                to={`/app/${session.id}`}
                className={cn(
                  "block cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap rounded-md px-2.5 py-2 pr-8 text-[13px] leading-[1.4] text-[var(--fg-muted)] transition-colors",
                  "hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]",
                  sessionId === session.id && "bg-[var(--bg-active)] font-medium text-[var(--fg)]",
                )}
              >
                {session.title || t("common.untitled")}
              </Link>
              <DropdownMenu onOpenChange={(open) => setMenuOpenSessionId(open ? session.id : null)}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-[var(--fg-muted)] transition-opacity hover:bg-[var(--bg-hover)] hover:text-[var(--fg)] group-hover:opacity-100",
                      menuOpenSessionId === session.id ? "opacity-100" : "opacity-0",
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <MoreHorizontal size={14} strokeWidth={1.75} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="right">
                  <DropdownMenuItem onClick={() => startRename(session)}>
                    <Pencil size={14} />
                    {t("sessionList.rename")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDeleteTarget(session)}
                    className="text-red-500"
                  >
                    <Trash2 size={14} />
                    {t("common.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      ))}
      <div ref={sentinelRef} className="h-1" />

      <DeleteSessionDialog
        open={deleteTarget !== null}
        title={deleteTarget?.title || ""}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};
