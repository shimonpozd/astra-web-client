export const escapeRegExp = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const getNextDafRef = (dafRef: string): string => {
  if (!dafRef) return dafRef;
  const match = dafRef.match(/^(.+?)\s+(\d+)([ab])(?:[:.].*)?$/i);
  if (match) {
    const tractate = match[1];
    const page = parseInt(match[2], 10);
    const amud = match[3].toLowerCase();
    if (amud === 'a') {
      return `${tractate} ${page}b`;
    } else {
      return `${tractate} ${page + 1}a`;
    }
  }

  const verseMatch = dafRef.match(/^(.+?)\s+(\d+)[:.](.+?)$/i);
  if (verseMatch) {
    const book = verseMatch[1];
    const chapter = verseMatch[2];
    const verseNum = parseInt(verseMatch[3], 10);
    if (!isNaN(verseNum)) {
      return `${book} ${chapter}:${verseNum + 1}`;
    }
  }

  const chapterMatch = dafRef.match(/^(.+?)\s+(\d+)$/i);
  if (chapterMatch) {
    const book = chapterMatch[1];
    const chapter = parseInt(chapterMatch[2], 10);
    return `${book} ${chapter + 1}`;
  }

  return dafRef;
};

export const getPrevDafRef = (dafRef: string): string => {
  if (!dafRef) return dafRef;
  const match = dafRef.match(/^(.+?)\s+(\d+)([ab])(?:[:.].*)?$/i);
  if (match) {
    const tractate = match[1];
    const page = parseInt(match[2], 10);
    const amud = match[3].toLowerCase();
    if (amud === 'b') {
      return `${tractate} ${page}a`;
    } else {
      if (page <= 2) return `${tractate} 2a`;
      return `${tractate} ${page - 1}b`;
    }
  }

  const verseMatch = dafRef.match(/^(.+?)\s+(\d+)[:.](.+?)$/i);
  if (verseMatch) {
    const book = verseMatch[1];
    const chapter = verseMatch[2];
    const verseNum = parseInt(verseMatch[3], 10);
    if (!isNaN(verseNum)) {
      return verseNum <= 1 ? `${book} ${chapter}:1` : `${book} ${chapter}:${verseNum - 1}`;
    }
  }

  const chapterMatch = dafRef.match(/^(.+?)\s+(\d+)$/i);
  if (chapterMatch) {
    const book = chapterMatch[1];
    const chapter = parseInt(chapterMatch[2], 10);
    return chapter <= 1 ? `${book} 1` : `${book} ${chapter - 1}`;
  }

  return dafRef;
};

// Helper to compare refs flexibly (ignoring dots, colons, spaces, commas, retaining range hyphens)
export const isSameRef = (ref1: string, ref2: string): boolean => {
  if (!ref1 || !ref2) return false;
  const normalize = (r: string) => r.replace(/[:\s,.]/g, '').toLowerCase();
  return normalize(ref1) === normalize(ref2);
};

export const isHadranLine = (text?: string): boolean => {
  if (!text) return false;
  const clean = text.replace(/[\u0591-\u05C7]/g, '').trim();
  return /^\s*הדרן\s+עלך/i.test(clean) || /^\s*סליק\s+(פירקא|מסכת)/i.test(clean);
};
