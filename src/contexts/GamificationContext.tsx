import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { emitGamificationEvent, GamificationEvent, onGamificationEvent } from '../lib/gamificationBus';
import { api, XpProfile } from '../services/api';

const BASE_LEVEL_XP = 300;
const LEVEL_GROWTH = 1.18;
const xpFormatter = new Intl.NumberFormat('ru-RU');

function calculateLevelFromXp(totalXp: number) {
  let level = 1;
  let remaining = Math.max(0, totalXp);
  let xpForLevel = BASE_LEVEL_XP;

  while (remaining >= xpForLevel) {
    remaining -= xpForLevel;
    level += 1;
    xpForLevel = Math.round(BASE_LEVEL_XP * LEVEL_GROWTH ** (level - 1));
  }

  const progress = xpForLevel === 0 ? 0 : Math.min(1, remaining / xpForLevel);
  return {
    level,
    xpIntoLevel: remaining,
    xpForLevel,
    xpToNext: Math.max(0, xpForLevel - remaining),
    progress,
  };
}

export interface XpGain {
  amount: number;
  source: GamificationEvent['source'];
  verb?: string;
  label?: string;
  at: number;
}

export interface LevelUpEvent {
  level: number;
  at: number;
}

interface GamificationContextValue {
  xpTotal: number;
  level: number;
  xpIntoLevel: number;
  xpForLevel: number;
  xpToNext: number;
  progress: number;
  recent: XpGain[];
  levelUps: LevelUpEvent[];
  awardXp: (event: GamificationEvent) => void;
  formatXp: (value: number) => string;
}

const GamificationContext = createContext<GamificationContextValue | undefined>(undefined);

export function GamificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const initialTotal = useMemo(() => Math.max(0, user?.xp_total ?? 0), [user?.xp_total]);
  const [xpTotal, setXpTotal] = useState<number>(initialTotal);
  const [recent, setRecent] = useState<XpGain[]>([]);
  const [levelUps, setLevelUps] = useState<LevelUpEvent[]>([]);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    setXpTotal(initialTotal);
  }, [initialTotal]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setXpTotal(0);
        setProfileLoaded(true);
        return;
      }
      try {
        const profile = await api.getXpProfile();
        setXpTotal(profile.xp_total);
        setProfileLoaded(true);
      } catch {
        setProfileLoaded(true);
      }
    };
    fetchProfile();
  }, [user?.id]);

  const awardXp = useCallback(async (event: GamificationEvent) => {
    try {
      const prevTotal = xpTotal;
      const profile = await api.postXpEvent({
        source: event.source as any,
        verb: event.verb,
        session_id: (event.meta as any)?.session_id,
        ref: event.meta?.ref as any,
        title: event.label,
        chars: (event.meta as any)?.chars,
        duration_ms: (event.meta as any)?.duration_ms,
        event_id: (event.meta as any)?.event_id,
        amount: event.amount,
        ts: Date.now(),
      });
      setXpTotal(profile.xp_total);
      const delta = Math.max(0, profile.xp_total - prevTotal);
      let amount = delta || Math.max(0, Math.round(event.amount));
      // Если сервер вернул 0 (не сохранил), делаем оптимистичное начисление
      if (amount <= 0) {
        amount = Math.max(0, Math.round(event.amount));
        setXpTotal((prev) => prev + amount);
      }
      if (amount > 0) {
        const now = Date.now();
        setRecent((prev) => {
          const next = [{ amount, source: event.source, verb: event.verb, label: event.label, at: now }, ...prev];
          return next.slice(0, 6);
        });
        setTimeout(() => {
          setRecent((prev) => prev.filter((item) => item.at !== now));
        }, 5000);
      }
    } catch {
      // fallback: optimistic local
      const amount = Math.max(0, Math.round(event.amount));
      if (!amount) return;
      setXpTotal((prev) => prev + amount);
      const now = Date.now();
      setRecent((prev) => {
        const next = [{ amount, source: event.source, verb: event.verb, label: event.label, at: now }, ...prev];
        return next.slice(0, 6);
      });
      setTimeout(() => {
        setRecent((prev) => prev.filter((item) => item.at !== now));
      }, 5000);
    }
  }, [xpTotal]);

  useEffect(() => {
    const off = onGamificationEvent((ev) => awardXp(ev));
    return () => off();
  }, [awardXp]);

  const levelState = useMemo(() => {
    return calculateLevelFromXp(xpTotal);
  }, [xpTotal]);

  // Detect level ups
  const lastLevelRef = React.useRef(levelState.level);
  useEffect(() => {
    if (levelState.level > lastLevelRef.current) {
      const at = Date.now();
      setLevelUps((prev) => [{ level: levelState.level, at }, ...prev].slice(0, 4));
      setTimeout(() => {
        setLevelUps((prev) => prev.filter((item) => item.at !== at));
      }, 6000);
    }
    lastLevelRef.current = levelState.level;
  }, [levelState.level]);

  const formatXp = useCallback((value: number) => xpFormatter.format(Math.max(0, Math.round(value))), []);

  const value = useMemo(
    () => ({
      xpTotal,
      recent,
      levelUps,
      awardXp,
      formatXp,
      ...levelState,
    }),
    [awardXp, formatXp, levelState, levelUps, recent, xpTotal],
  );

  return <GamificationContext.Provider value={value}>{children}</GamificationContext.Provider>;
}

export function useGamification(): GamificationContextValue {
  const ctx = useContext(GamificationContext);
  if (!ctx) {
    throw new Error('useGamification must be used within GamificationProvider');
  }
  return ctx;
}

export { emitGamificationEvent };
