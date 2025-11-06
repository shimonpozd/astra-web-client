import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface NavigationContextType {
  isNavOpen: boolean;
  openNav: () => void;
  closeNav: () => void;
  onSelectRef: (ref: string) => void;
  currentRef: string | undefined;
  setCurrentRef: (ref: string | undefined) => void;
  setOnNavigateToRef: (callback: (ref: string, segment?: TextSegment) => void) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}

interface NavigationProviderProps {
  children: ReactNode;
}

export function NavigationProvider({ children }: NavigationProviderProps) {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [currentRef, setCurrentRef] = useState<string | undefined>(undefined);
  const [onNavigateToRefCallback, setOnNavigateToRefCallback] = useState<((ref: string, segment?: TextSegment) => void) | undefined>(undefined);

  const openNav = useCallback(() => setIsNavOpen(true), []);
  const closeNav = useCallback(() => setIsNavOpen(false), []);
  const onSelectRef = useCallback((ref: string) => {
    if (onNavigateToRefCallback) {
      onNavigateToRefCallback(ref);
    } else {
      console.warn('No onNavigateToRef callback registered in NavigationContext.');
    }
    closeNav();
  }, [closeNav]);

  const value = {
    isNavOpen,
    openNav,
    closeNav,
    onSelectRef,
    currentRef,
    setCurrentRef,
    setOnNavigateToRef: setOnNavigateToRefCallback,
  };

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}
