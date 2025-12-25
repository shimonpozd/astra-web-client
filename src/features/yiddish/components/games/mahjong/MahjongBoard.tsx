import React, { useMemo } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import type { YiddishMahjongTile } from '@/types/yiddish';
import { MahjongTile } from './MahjongTile';

interface MahjongBoardProps {
  tiles: YiddishMahjongTile[];
  selectedId: string | null;
  matchedIds: Set<string>;
  mismatchedIds: Set<string>;
  onTileClick: (tile: YiddishMahjongTile, isLocked: boolean) => void;
}

const TILE_W = 80;
const TILE_H = 112;
const GAP = 16;

const containerVariants = {
  hidden: {},
  enter: {
    transition: { staggerChildren: 0.05 },
  },
};

export const MahjongBoard: React.FC<MahjongBoardProps> = ({
  tiles,
  selectedId,
  matchedIds,
  mismatchedIds,
  onTileClick,
}) => {
  const layoutSlots = useMemo(() => {
    const layers = [
      { rows: 4, cols: 5 },
      { rows: 3, cols: 4 },
      { rows: 2, cols: 2 },
    ];
    const slots: Array<{ x: number; y: number; layer: number }> = [];
    layers.forEach((layer, layerIndex) => {
      const offsetX = ((layers[0].cols - layer.cols) / 2) * (TILE_W + GAP);
      const offsetY = ((layers[0].rows - layer.rows) / 2) * (TILE_H + GAP);
      for (let r = 0; r < layer.rows; r += 1) {
        for (let c = 0; c < layer.cols; c += 1) {
          slots.push({
            x: offsetX + c * (TILE_W + GAP),
            y: offsetY + r * (TILE_H + GAP),
            layer: layerIndex,
          });
        }
      }
    });
    return slots;
  }, []);

  const placedTiles = useMemo(() => {
    return tiles.map((tile, index) => {
      const slot = layoutSlots[index % layoutSlots.length];
      return { tile, ...slot };
    });
  }, [tiles, layoutSlots]);

  const lockedIds = useMemo(() => {
    const locked = new Set<string>();
    const boxes = placedTiles.map((p) => ({
      id: p.tile.id,
      layer: p.layer,
      left: p.x,
      right: p.x + TILE_W,
      top: p.y,
      bottom: p.y + TILE_H,
    }));
    boxes.forEach((box, idx) => {
      for (let j = 0; j < boxes.length; j += 1) {
        if (j === idx) continue;
        const other = boxes[j];
        if (other.layer <= box.layer) continue;
        const intersects =
          !(other.left >= box.right ||
            other.right <= box.left ||
            other.top >= box.bottom ||
            other.bottom <= box.top);
        if (intersects) {
          locked.add(box.id);
          break;
        }
      }
    });
    return locked;
  }, [placedTiles]);

  const boardWidth = (TILE_W + GAP) * 5 - GAP;
  const boardHeight = (TILE_H + GAP) * 4 - GAP;

  return (
    <div className="relative mx-auto w-full max-w-[760px]">
      <div className="relative rounded-2xl border border-slate-200 bg-gradient-to-b from-indigo-50 via-white to-white p-6 shadow-lg dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950">
        <div className="absolute inset-0 rounded-2xl opacity-40 pointer-events-none bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:18px_18px] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)]" />
        <LayoutGroup>
          <motion.div
            className="relative mx-auto"
            style={{ width: boardWidth, height: boardHeight }}
            variants={containerVariants}
            initial="hidden"
            animate="enter"
          >
            <AnimatePresence mode="popLayout">
              {placedTiles.map((placement) => {
                const isLocked = lockedIds.has(placement.tile.id);
                const isSelected = selectedId === placement.tile.id;
                const isMatched = matchedIds.has(placement.tile.id);
                const isMismatched = mismatchedIds.has(placement.tile.id);
                return (
                  <motion.div
                    key={placement.tile.id}
                    layout
                    className="absolute"
                    style={{ left: placement.x, top: placement.y, width: TILE_W, height: TILE_H, zIndex: 10 + placement.layer }}
                  >
                    <MahjongTile
                      tile={placement.tile}
                      isLocked={isLocked}
                      isSelected={isSelected}
                      isMatched={isMatched}
                      isMismatched={isMismatched}
                      onClick={(tile) => onTileClick(tile, isLocked)}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>
      </div>
    </div>
  );
};
