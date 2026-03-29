import { ArrowUp, Globe, Paperclip, Square } from "lucide-react";
import type { FC, RefObject } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils.js";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  placeholder?: string;
  disabled?: boolean;
  isStreaming?: boolean;
  onTerminate?: () => void;
  maxWidth?: string;
}

export const ChatInput: FC<ChatInputProps> = (props) => {
  const { t } = useTranslation();
  const isEmpty = !props.value.trim();

  return (
    <div className="w-full px-6" style={{ maxWidth: props.maxWidth ?? "620px" }}>
      <div
        className={cn(
          "flex flex-col gap-2.5 rounded-[var(--radius-lg)] border border-transparent bg-[var(--bg-hover)] p-3 px-3.5 transition-all",
          "focus-within:border-[var(--border)] focus-within:bg-[var(--bg)]",
        )}
      >
        <textarea
          ref={props.textareaRef}
          className="w-full resize-none border-none bg-transparent text-sm leading-[1.5] text-[var(--fg)] outline-none placeholder:text-[var(--fg-faint)]"
          style={{ minHeight: "22px", fontFamily: "var(--font-sans)" }}
          rows={1}
          placeholder={props.placeholder ?? t("chatInput.placeholder")}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          onKeyDown={props.handleKeyDown}
          disabled={props.disabled}
        />
        <div className="flex items-center justify-between">
          <div className="flex gap-0.5">
            <IconButton title={t("chatInput.attachFile")}>
              <Paperclip size={15} strokeWidth={1.75} />
            </IconButton>
            <IconButton title={t("chatInput.webSearch")}>
              <Globe size={15} strokeWidth={1.75} />
            </IconButton>
          </div>
          {props.isStreaming ? (
            <button
              type="button"
              className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-lg border-none bg-[var(--primary)] text-[var(--fg-on-primary)] transition-colors hover:bg-[var(--primary-hover)]"
              onClick={props.onTerminate}
              title={t("chatInput.stopGenerating")}
            >
              <Square size={15} strokeWidth={2} />
            </button>
          ) : (
            <button
              type="button"
              className={cn(
                "flex h-[30px] w-[30px] items-center justify-center rounded-lg border-none bg-[var(--primary)] text-[var(--fg-on-primary)] transition-colors hover:bg-[var(--primary-hover)]",
                isEmpty ? "cursor-default opacity-35" : "cursor-pointer",
              )}
              onClick={props.onSend}
              disabled={isEmpty}
            >
              <ArrowUp size={15} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface IconButtonProps {
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const IconButton: FC<IconButtonProps> = (props) => (
  <button
    type="button"
    className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-[var(--fg-muted)] transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]"
    title={props.title}
    onClick={props.onClick}
  >
    {props.children}
  </button>
);
