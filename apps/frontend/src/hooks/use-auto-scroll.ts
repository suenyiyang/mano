import { type RefObject, useCallback, useEffect, useRef } from "react";

export const useAutoScroll = (scrollRef: RefObject<HTMLDivElement | null>, deps: unknown[]) => {
  const isAtBottomRef = useRef(true);

  const checkAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, [scrollRef]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [scrollRef]);

  // Auto-scroll when deps change and user is at bottom
  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    onScroll: checkAtBottom,
    scrollToBottom,
  };
};
