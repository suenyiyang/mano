import { type FC, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { cn } from "../../lib/utils.js";
import type { Session } from "../../types/api.js";

interface SessionListProps {
  sessions: Session[];
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
}

export const SessionList: FC<SessionListProps> = (props) => {
  const { t } = useTranslation();
  const { sessionId } = useParams();
  const sentinelRef = useRef<HTMLDivElement>(null);

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
        <Link
          key={session.id}
          to={`/app/${session.id}`}
          className={cn(
            "block cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap rounded-md px-2.5 py-2 text-[13px] leading-[1.4] text-[var(--fg-muted)] transition-colors",
            "hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]",
            sessionId === session.id && "bg-[var(--bg-active)] font-medium text-[var(--fg)]",
          )}
        >
          {session.title || t("common.untitled")}
        </Link>
      ))}
      <div ref={sentinelRef} className="h-1" />
    </div>
  );
};
