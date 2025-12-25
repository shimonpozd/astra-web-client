import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { YiddishMahjongTile } from '@/types/yiddish';

interface MahjongStats {
  elapsedMs: number;
  mistakes: number;
  maxCombo: number;
  wordsReviewed: number;
}

interface UseMahjongGameOptions {
  tiles: YiddishMahjongTile[];
  onComplete?: (stats: MahjongStats) => void;
}

export const useMahjongGame = ({ tiles, onComplete }: UseMahjongGameOptions) => {
  const [visibleTiles, setVisibleTiles] = useState<YiddishMahjongTile[]>(tiles);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [mismatchedIds, setMismatchedIds] = useState<Set<string>>(new Set());
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const startAtRef = useRef<number>(Date.now());
  const initialPairs = useRef<number>(Math.max(1, Math.floor(tiles.length / 2)));

  useEffect(() => {
    setVisibleTiles(tiles);
    setSelectedId(null);
    setMatchedIds(new Set());
    setMismatchedIds(new Set());
    setCombo(0);
    setMaxCombo(0);
    setMistakes(0);
    startAtRef.current = Date.now();
    initialPairs.current = Math.max(1, Math.floor(tiles.length / 2));
  }, [tiles]);

  const tileMap = useMemo(() => {
    const map = new Map<string, YiddishMahjongTile>();
    visibleTiles.forEach((tile) => map.set(tile.id, tile));
    return map;
  }, [visibleTiles]);

  const finishIfComplete = useCallback(
    (nextTiles: YiddishMahjongTile[]) => {
      if (nextTiles.length === 0 && onComplete) {
        onComplete({
          elapsedMs: Date.now() - startAtRef.current,
          mistakes,
          maxCombo,
          wordsReviewed: initialPairs.current,
        });
      }
    },
    [mistakes, maxCombo, onComplete],
  );

  const onTileClick = useCallback(
    (tile: YiddishMahjongTile, isLocked: boolean) => {
      if (isLocked) return;
      if (matchedIds.has(tile.id)) return;

      if (!selectedId) {
        setSelectedId(tile.id);
        return;
      }

      if (selectedId === tile.id) {
        setSelectedId(null);
        return;
      }

      const selected = tileMap.get(selectedId);
      if (!selected) {
        setSelectedId(null);
        return;
      }

      if (selected.match_id === tile.match_id) {
        const nextMatched = new Set(matchedIds);
        nextMatched.add(selected.id);
        nextMatched.add(tile.id);
        setMatchedIds(nextMatched);
        setCombo((prev) => {
          const next = prev + 1;
          setMaxCombo((current) => (next > current ? next : current));
          return next;
        });

        window.setTimeout(() => {
          setVisibleTiles((prev) => {
            const nextTiles = prev.filter((t) => t.id !== selected.id && t.id !== tile.id);
            finishIfComplete(nextTiles);
            return nextTiles;
          });
          setMatchedIds((prev) => {
            const next = new Set(prev);
            next.delete(selected.id);
            next.delete(tile.id);
            return next;
          });
          setSelectedId(null);
        }, 420);
      } else {
        setMistakes((prev) => prev + 1);
        setCombo(0);
        const nextMismatched = new Set<string>();
        nextMismatched.add(selected.id);
        nextMismatched.add(tile.id);
        setMismatchedIds(nextMismatched);
        window.setTimeout(() => {
          setMismatchedIds(new Set());
          setSelectedId(null);
        }, 320);
      }
    },
    [matchedIds, selectedId, tileMap, finishIfComplete],
  );

  const progress = useMemo(() => {
    const totalPairs = initialPairs.current;
    const remainingPairs = Math.floor(visibleTiles.length / 2);
    return Math.max(0, Math.min(1, (totalPairs - remainingPairs) / totalPairs));
  }, [visibleTiles.length]);

  return {
    tiles: visibleTiles,
    selectedId,
    matchedIds,
    mismatchedIds,
    combo,
    mistakes,
    maxCombo,
    progress,
    onTileClick,
  };
};
