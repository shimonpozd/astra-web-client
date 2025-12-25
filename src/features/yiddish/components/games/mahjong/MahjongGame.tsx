import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/services/api';
import type { YiddishMahjongSession } from '@/types/yiddish';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MahjongBoard } from './MahjongBoard';
import { useMahjongGame } from './useMahjongGame';

interface MahjongGameProps {
  onClose?: () => void;
}

export const MahjongGame: React.FC<MahjongGameProps> = ({ onClose }) => {
  const [session, setSession] = useState<YiddishMahjongSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [stats, setStats] = useState<{ elapsedMs: number; mistakes: number; maxCombo: number; wordsReviewed: number } | null>(null);

  const loadSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsComplete(false);
    setStats(null);
    try {
      const data = await api.generateYiddishMahjongExam({ min_words: 8, max_words: 12 });
      setSession(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load mahjong session');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const {
    tiles,
    selectedId,
    matchedIds,
    mismatchedIds,
    combo,
    mistakes,
    maxCombo,
    progress,
    onTileClick,
  } = useMahjongGame({
    tiles: session?.tiles || [],
    onComplete: (nextStats) => {
      setIsComplete(true);
      setStats(nextStats);
      import('canvas-confetti')
        .then((module) => {
          const confetti = module.default;
          confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
        })
        .catch(() => {
          // ignore optional confetti failures
        });
    },
  });

  const progressPercent = Math.round(progress * 100);
  const comboClass = combo > 2 ? 'shadow-[0_0_14px_rgba(251,146,60,0.7)] animate-pulse' : '';

  const elapsedSeconds = useMemo(() => {
    if (!stats) return 0;
    return Math.round(stats.elapsedMs / 1000);
  }, [stats]);

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold">Mahjong Review</div>
          {session?.exam_id ? <Badge variant="outline">{session.exam_id}</Badge> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={loadSession} disabled={isLoading}>
            New Session
          </Button>
          {onClose ? (
            <Button size="sm" variant="outline" onClick={onClose}>
              Close
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className={`rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold ${comboClass}`}>
          Combo x{combo}
        </div>
        <div className="text-sm text-muted-foreground">Mistakes: {mistakes}</div>
        <div className="flex-1 min-w-[200px]">
          <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-1">{progressPercent}% complete</div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Dealing tiles...</div>
      ) : error ? (
        <div className="text-sm text-red-500">{error}</div>
      ) : (
        <MahjongBoard
          tiles={tiles}
          selectedId={selectedId}
          matchedIds={matchedIds}
          mismatchedIds={mismatchedIds}
          onTileClick={onTileClick}
        />
      )}

      {isComplete && stats ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <div className="text-lg font-semibold">Session Complete</div>
          <div className="mt-2 grid gap-2 text-sm">
            <div>Time: {elapsedSeconds}s</div>
            <div>Mistakes: {stats.mistakes}</div>
            <div>Max Combo: {stats.maxCombo}</div>
            <div>Words Reviewed: {stats.wordsReviewed}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
