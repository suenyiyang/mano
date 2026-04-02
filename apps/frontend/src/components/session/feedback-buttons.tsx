import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { FC } from "react";
import { useTranslation } from "react-i18next";

interface FeedbackButtonsProps {
  feedback: "like" | "dislike" | null;
  onFeedback: (feedback: "like" | "dislike" | null) => void;
}

export const FeedbackButtons: FC<FeedbackButtonsProps> = (props) => {
  const { t } = useTranslation();

  const isLiked = props.feedback === "like";
  const isDisliked = props.feedback === "dislike";

  return (
    <div className="mt-1 flex items-center gap-0.5">
      <button
        type="button"
        className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded border-none bg-transparent transition-all hover:bg-[var(--bg-hover)] ${isLiked ? "text-[var(--fg-muted)]" : "text-[var(--fg-faint)] hover:text-[var(--fg-muted)]"}`}
        title={t("feedback.like")}
        onClick={() => props.onFeedback(isLiked ? null : "like")}
      >
        <ThumbsUp size={14} strokeWidth={1.75} fill={isLiked ? "currentColor" : "none"} />
      </button>
      <button
        type="button"
        className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded border-none bg-transparent transition-all hover:bg-[var(--bg-hover)] ${isDisliked ? "text-[var(--fg-muted)]" : "text-[var(--fg-faint)] hover:text-[var(--fg-muted)]"}`}
        title={t("feedback.dislike")}
        onClick={() => props.onFeedback(isDisliked ? null : "dislike")}
      >
        <ThumbsDown size={14} strokeWidth={1.75} fill={isDisliked ? "currentColor" : "none"} />
      </button>
    </div>
  );
};
