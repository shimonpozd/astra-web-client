export function buildStreamingMimeCandidates(contentType?: string | null): string[] {
  const candidates = new Set<string>();
  const normalized = contentType?.split(';')[0].trim().toLowerCase();

  if (contentType) {
    candidates.add(contentType.toLowerCase());
  }

  if (normalized) {
    candidates.add(normalized);
    if (normalized === 'audio/ogg' && !(contentType?.toLowerCase().includes('codecs') ?? false)) {
      candidates.add('audio/ogg;codecs=opus');
    }
  }

  if (!normalized) {
    candidates.add('audio/mpeg');
  }

  candidates.add('audio/mpeg');

  return Array.from(candidates);
}
