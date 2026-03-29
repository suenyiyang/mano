import type { FC } from "react";
import type { ContentBlock } from "../../types/message-turn.js";
import { ContentBlockRenderer } from "./content-block-renderer.js";
import { StreamingIndicator } from "./streaming-indicator.js";

interface AgentMessageProps {
  timestamp: string;
  blocks: ContentBlock[];
  isStreaming?: boolean;
}

export const AgentMessage: FC<AgentMessageProps> = (props) => {
  const timeStr = formatTime(props.timestamp);

  return (
    <div className="mb-6">
      <div className="mb-1.5 flex items-center gap-1.5">
        <div className="flex h-4 w-4 items-center justify-center rounded bg-[var(--fg)]">
          <span className="text-[9px] font-bold leading-none text-[var(--bg)]">M</span>
        </div>
        <span className="text-[13px] font-semibold text-[var(--fg)]">Mano</span>
        <span className="text-xs text-[var(--fg-faint)]">{timeStr}</span>
      </div>
      <ContentBlockRenderer blocks={props.blocks} />
      {props.isStreaming && <StreamingIndicator />}
    </div>
  );
};

const formatTime = (iso: string): string => {
  try {
    const date = new Date(iso);
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};
