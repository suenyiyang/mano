import type { FC } from "react";
import { useTranslation } from "react-i18next";
import type { ContentBlock } from "../../types/message-turn.js";
import { ContentBlockRenderer } from "./content-block-renderer.js";
import { FeedbackButtons } from "./feedback-buttons.js";
import { StreamingIndicator } from "./streaming-indicator.js";

interface AgentMessageProps {
  timestamp: string;
  blocks: ContentBlock[];
  isStreaming?: boolean;
  onRetry?: () => void;
  feedback?: "like" | "dislike" | null;
  onFeedback?: (feedback: "like" | "dislike" | null) => void;
}

export const AgentMessage: FC<AgentMessageProps> = (props) => {
  const { t, i18n } = useTranslation();
  const timeStr = formatTime(props.timestamp, i18n.language);

  return (
    <div className="mb-6">
      <div className="mb-1.5 flex items-center gap-1.5">
        <div className="flex h-4 w-4 items-center justify-center rounded bg-[var(--fg)]">
          <span className="text-[9px] font-bold leading-none text-[var(--bg)]">M</span>
        </div>
        <span className="text-[13px] font-semibold text-[var(--fg)]">{t("agentMessage.name")}</span>
        <span className="text-xs text-[var(--fg-faint)]">{timeStr}</span>
      </div>
      <ContentBlockRenderer blocks={props.blocks} onRetry={props.onRetry} />
      {props.isStreaming && <StreamingIndicator />}
      {!props.isStreaming && props.blocks.length > 0 && props.onFeedback && (
        <FeedbackButtons feedback={props.feedback ?? null} onFeedback={props.onFeedback} />
      )}
    </div>
  );
};

const formatTime = (iso: string, locale: string): string => {
  try {
    const date = new Date(iso);
    return date.toLocaleTimeString(locale, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};
