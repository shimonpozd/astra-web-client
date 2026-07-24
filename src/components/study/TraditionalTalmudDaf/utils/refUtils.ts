export const escapeRegExp = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const getNextDafRef = (dafRef: string): string => {
  if (!dafRef) return dafRef;
  const match = dafRef.match(/^(.+?)\s+(\d+)([ab])(?:[:.].*)?$/i);
  if (!match) return dafRef;
  const tractate = match[1];
  const page = parseInt(match[2], 10);
  const amud = match[3].toLowerCase();
  if (amud === 'a') {
    return `${tractate} ${page}b`;
  } else {
    return `${tractate} ${page + 1}a`;
  }
};

export const getPrevDafRef = (dafRef: string): string => {
  if (!dafRef) return dafRef;
  const match = dafRef.match(/^(.+?)\s+(\d+)([ab])(?:[:.].*)?$/i);
  if (!match) return dafRef;
  const tractate = match[1];
  const page = parseInt(match[2], 10);
  const amud = match[3].toLowerCase();
  if (amud === 'b') {
    return `${tractate} ${page}a`;
  } else {
    if (page <= 2) return `${tractate} 2a`;
    return `${tractate} ${page - 1}b`;
  }
};

// Helper to compare refs flexibly (ignoring dots, colons, spaces, commas, retaining range hyphens)
export const isSameRef = (ref1: string, ref2: string): boolean => {
  if (!ref1 || !ref2) return false;
  const normalize = (r: string) => r.replace(/[:\s,.]/g, '').toLowerCase();
  return normalize(ref1) === normalize(ref2);
};
