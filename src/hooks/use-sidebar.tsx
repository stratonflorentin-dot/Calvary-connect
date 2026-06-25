"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";

interface SidebarContextType {
  isOpen: boolean;
  isCollapsed: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  toggleCollapse: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load saved state from localStorage for persistence on refresh
  useEffect(() => {
    try {
      const savedOpen = localStorage.getItem("sidebar-open");
      const savedCollapsed = localStorage.getItem("sidebar-collapsed");
      
      if (savedOpen !== null) setIsOpen(savedOpen === "true");
      if (savedCollapsed !== null) setIsCollapsed(savedCollapsed === "true");
    } catch (e) {
      console.warn("Failed to load sidebar state from localStorage", e);
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("sidebar-open", String(isOpen));
      localStorage.setItem("sidebar-collapsed", String(isCollapsed));
    } catch (e) {
      console.warn("Failed to save sidebar state to localStorage", e);
    }
  }, [isOpen, isCollapsed]);

  const toggle = useCallback(() => setIsOpen(prev => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggleCollapse = useCallback(() => setIsCollapsed(prev => !prev), []);
  const setCollapsedCallback = useCallback((collapsed: boolean) => setIsCollapsed(collapsed), []);

  return (
    <SidebarContext.Provider value={{
      isOpen,
      isCollapsed,
      toggle,
      open,
      close,
      toggleCollapse,
      setCollapsed: setCollapsedCallback
    }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
