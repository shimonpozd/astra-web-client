import { useState, useEffect, useMemo, useCallback } from 'react';
import { SageHighlight, ConceptHighlight } from '../../types/highlight';
import { CompiledSageHighlight, CompiledConceptHighlight } from '../types';
import { buildHebrewFuzzyRegex } from '../utils/highlightMatching';

export const useHighlights = (
  initialSageHighlights: SageHighlight[] = [],
  initialConceptHighlights: ConceptHighlight[] = []
) => {
  const [localSageHighlights, setLocalSageHighlights] = useState<SageHighlight[]>(initialSageHighlights);
  const [localConceptHighlights, setLocalConceptHighlights] = useState<ConceptHighlight[]>(initialConceptHighlights);

  useEffect(() => {
    setLocalSageHighlights(initialSageHighlights);
  }, [initialSageHighlights]);

  useEffect(() => {
    setLocalConceptHighlights(initialConceptHighlights);
  }, [initialConceptHighlights]);

  const compileSageHighlights = useCallback((items: SageHighlight[]): CompiledSageHighlight[] => {
    const allowed = new Set(['zugot', 'tannaim', 'amoraim', 'achronim']);
    const sorted = [...(items || [])].sort((a, b) => {
      const lenA = Math.max((a.name_he || '').length, (a.regex_pattern || '').length, (a.slug || '').length);
      const lenB = Math.max((b.name_he || '').length, (b.regex_pattern || '').length, (b.slug || '').length);
      return lenB - lenA;
    });
    const compiled: CompiledSageHighlight[] = [];
    for (const item of sorted) {
      if (!item?.slug || !item?.regex_pattern) continue;
      try {
        const periodRaw = (item.period || '').toLowerCase();
        const periodBase = (periodRaw.split('_')[0] || periodRaw || 'sage').trim();
        if (periodBase && !allowed.has(periodBase)) {
          continue;
        }
        const regex = item.regex_pattern.includes('[WILD]')
          ? (buildHebrewFuzzyRegex(item.regex_pattern) || new RegExp(item.regex_pattern, 'gu'))
          : new RegExp(item.regex_pattern, 'gu');
        compiled.push({ ...item, period: periodRaw || periodBase, regex });
      } catch (err) {
        console.warn('[TraditionalTalmudDaf] Invalid sage regex', err);
      }
    }
    return compiled;
  }, []);

  const compileConceptHighlights = useCallback((items: ConceptHighlight[]): CompiledConceptHighlight[] => {
    const sorted = [...(items || [])].sort((a, b) => {
      const lenA = (a.term_he || a.slug || '').length;
      const lenB = (b.term_he || b.slug || '').length;
      return lenB - lenA;
    });
    const compiled: CompiledConceptHighlight[] = [];
    for (const item of sorted) {
      if (!item?.slug) continue;
      const regexes: RegExp[] = [];
      for (const pat of item.search_patterns || []) {
        if (!pat) continue;
        try {
          const rx = pat.includes('[WILD]')
            ? (buildHebrewFuzzyRegex(pat) || new RegExp(pat, 'gu'))
            : new RegExp(pat, 'gu');
          regexes.push(rx);
        } catch (err) {
          console.warn('[TraditionalTalmudDaf] Invalid concept regex', err);
        }
      }
      if (regexes.length) {
        compiled.push({ ...item, regexes });
      }
    }
    return compiled;
  }, []);

  const compiledSageHighlights = useMemo(
    () => compileSageHighlights(localSageHighlights),
    [compileSageHighlights, localSageHighlights]
  );

  const compiledConceptHighlights = useMemo(
    () => compileConceptHighlights(localConceptHighlights),
    [compileConceptHighlights, localConceptHighlights]
  );

  const sagesBySlug = useMemo(() => {
    const map = new Map<string, CompiledSageHighlight>();
    compiledSageHighlights.forEach((s) => map.set(s.slug, s));
    return map;
  }, [compiledSageHighlights]);

  const conceptsBySlug = useMemo(() => {
    const map = new Map<string, CompiledConceptHighlight>();
    compiledConceptHighlights.forEach((c) => map.set(c.slug, c));
    return map;
  }, [compiledConceptHighlights]);

  return {
    localSageHighlights,
    setLocalSageHighlights,
    localConceptHighlights,
    setLocalConceptHighlights,
    compiledSageHighlights,
    compiledConceptHighlights,
    sagesBySlug,
    conceptsBySlug,
  };
};
