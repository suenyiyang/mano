import { type RefObject, useCallback, useRef, useState } from "react";

interface UseChatInputLogicProps {
  onSend: (content: string) => void;
  isStreaming?: boolean;
}

interface UseChatInputLogicResult {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

export const useChatInputLogic = (props: UseChatInputLogicProps): UseChatInputLogicResult => {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, []);

  const onChange = useCallback(
    (newValue: string) => {
      setValue(newValue);
      requestAnimationFrame(adjustHeight);
    },
    [adjustHeight],
  );

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || props.isStreaming) return;
    props.onSend(trimmed);
    setValue("");
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = "auto";
      }
    });
  }, [value, props.onSend, props.isStreaming]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        if (!props.isStreaming) {
          handleSend();
        }
      }
    },
    [handleSend, props.isStreaming],
  );

  return {
    value,
    onChange,
    onSend: handleSend,
    textareaRef,
    handleKeyDown,
  };
};
