import { AlertCircle, RotateCw } from "lucide-react";
import type { FC } from "react";
import { useTranslation } from "react-i18next";

interface ErrorBlockProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorBlock: FC<ErrorBlockProps> = (props) => {
  const { t } = useTranslation();

  return (
    <div className="my-2.5">
      <div className="flex items-start gap-2">
        <AlertCircle size={14} strokeWidth={1.75} className="mt-0.5 shrink-0 text-red-500" />
        <span className="text-[13px] text-red-500">{props.message}</span>
      </div>
      {props.onRetry && (
        <button
          type="button"
          onClick={props.onRetry}
          className="mt-2 flex items-center gap-1 rounded-[6px] bg-[var(--bg-hover)] px-2 py-0.5 text-[13px] text-[var(--fg-muted)] transition-colors duration-100 hover:bg-[var(--bg-active)] hover:text-[var(--fg)]"
        >
          <RotateCw size={13} strokeWidth={1.75} />
          {t("errorBlock.retry")}
        </button>
      )}
    </div>
  );
};
