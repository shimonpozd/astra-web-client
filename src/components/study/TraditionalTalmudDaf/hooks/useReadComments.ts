import { useState, useEffect, useCallback } from 'react';

export const useReadComments = (currentDafRef: string) => {
  const [readComments, setReadComments] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = sessionStorage.getItem(`astra_read_comments_${currentDafRef}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = sessionStorage.getItem(`astra_read_comments_${currentDafRef}`);
      setReadComments(saved ? JSON.parse(saved) : {});
    } catch {
      setReadComments({});
    }
  }, [currentDafRef]);

  const toggleReadComment = useCallback((ref: string) => {
    setReadComments(prev => {
      const updated = { ...prev, [ref]: !prev[ref] };
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(`astra_read_comments_${currentDafRef}`, JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
  }, [currentDafRef]);

  return {
    readComments,
    toggleReadComment,
  };
};
