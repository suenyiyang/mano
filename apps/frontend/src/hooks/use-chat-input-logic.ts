import { type RefObject, useCallback, useRef, useState } from "react";

interface UseChatInputLogicResult {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

export const useChatInputLogic = (onSend: (content: string) => void): UseChatInputLogicResult => {
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
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = "auto";
      }
    });
  }, [value, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return {
    value,
    onChange,
    onSend: handleSend,
    textareaRef,
    handleKeyDown,
  };
};
