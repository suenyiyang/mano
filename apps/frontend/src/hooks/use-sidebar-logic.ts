import { useCallback, useEffect, useState } from "react";

const DESKTOP_QUERY = "(min-width: 1024px)";

export const useSidebarLogic = () => {
  const [isOpen, setIsOpen] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);
  const [isMobile, setIsMobile] = useState(() => !window.matchMedia(DESKTOP_QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(!e.matches);
      setIsOpen(e.matches);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return { isOpen, isMobile, toggle, open, close };
};
