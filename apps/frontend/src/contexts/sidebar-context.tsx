import { createContext, type FC, type ReactNode, useContext, useEffect } from "react";
import { useLocation } from "react-router";
import { useSidebarLogic } from "../hooks/use-sidebar-logic.js";

interface SidebarContextValue {
  isOpen: boolean;
  isMobile: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

interface SidebarProviderProps {
  children: ReactNode;
}

export const SidebarProvider: FC<SidebarProviderProps> = (props) => {
  const sidebar = useSidebarLogic();
  const location = useLocation();

  useEffect(() => {
    if (sidebar.isMobile) {
      sidebar.close();
    }
  }, [location.pathname]);

  return <SidebarContext.Provider value={sidebar}>{props.children}</SidebarContext.Provider>;
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return context;
};
