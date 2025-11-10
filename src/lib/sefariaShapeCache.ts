import type { WorkShape } from './sefariaCatalog';
import { loadShape } from './sefariaCatalog';

const chapterSizeCache = new Map<string, number[] | null>();

function normalizeCacheKey(basePath: string, workPath: string): string {
  const normalizedBase = basePath?.trim().replace(/\/+$/, '') ?? '';
  const normalizedPath = workPath?.trim().replace(/^\/*/, '').replace(/\/+$/, '') ?? '';
  return `${normalizedBase}|${normalizedPath}`;
}

function extractChapterSizes(shapeData: WorkShape | null): number[] {
  if (!shapeData) {
    return [];
  }

  const chaptersField = (shapeData as unknown as { chapters?: unknown }).chapters;
  if (
    Array.isArray(chaptersField) &&
    chaptersField.every((value) => typeof value === 'number' && Number.isFinite(value))
  ) {
    return chaptersField as number[];
  }

  const shape = (shapeData as unknown as { shape?: unknown[] }).shape;
  if (!Array.isArray(shape)) {
    return [];
  }

  return shape.map((leaf) => {
    if (Array.isArray(leaf)) {
      return leaf.length;
    }
    if (typeof leaf === 'number') {
      return leaf;
    }
    return 0;
  });
}

export async function getChapterSizesForWork(
  workPath: string,
  basePath = '/sefaria-cache/',
): Promise<number[] | null> {
  if (!workPath) {
    return null;
  }
  const cacheKey = normalizeCacheKey(basePath, workPath);
  if (chapterSizeCache.has(cacheKey)) {
    return chapterSizeCache.get(cacheKey) ?? null;
  }

  try {
    const shapeData = await loadShape(basePath, workPath);
    const sizes = extractChapterSizes(shapeData);
    const normalized = sizes.length ? sizes : null;
    chapterSizeCache.set(cacheKey, normalized);
    return normalized;
  } catch (error) {
    chapterSizeCache.set(cacheKey, null);
    return null;
  }
}
