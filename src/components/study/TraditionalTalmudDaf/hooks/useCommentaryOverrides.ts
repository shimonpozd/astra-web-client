import { useState, useCallback } from 'react';

export const useCommentaryOverrides = (currentCategory: string) => {
  const [commentaryOverrides, setCommentaryOverrides] = useState<Record<string, { left?: string; right?: string }>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem('astra_commentary_overrides');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleSetCommentatorOverride = useCallback((side: 'left' | 'right', name: string) => {
    setCommentaryOverrides(prev => {
      const updated = {
        ...prev,
        [currentCategory]: {
          ...(prev[currentCategory] || {}),
          [side]: name,
        }
      };
      try {
        localStorage.setItem('astra_commentary_overrides', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, [currentCategory]);

  const handleResetCommentatorOverride = useCallback((side: 'left' | 'right') => {
    setCommentaryOverrides(prev => {
      const updated = { ...prev };
      if (updated[currentCategory]) {
        delete updated[currentCategory][side];
        if (Object.keys(updated[currentCategory]).length === 0) delete updated[currentCategory];
      }
      try {
        localStorage.setItem('astra_commentary_overrides', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, [currentCategory]);

  return {
    commentaryOverrides,
    handleSetCommentatorOverride,
    handleResetCommentatorOverride,
  };
};
