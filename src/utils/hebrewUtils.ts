// utils/hebrewUtils.ts
export const HEBREW_REGEX = /[\u0590-\u05FF\u200F\u200E]/;
export const ARAMAIC_REGEX = /[\u0590-\u05FF]/; // Можно уточнить

export function containsHebrew(text?: string): boolean {
  return !!text && HEBREW_REGEX.test(text);
}

export function getTextDirection(text?: string): 'ltr' | 'rtl' {
  if (!text) return 'ltr';
  const clean = text.replace(/<[^>]+>/g, '').trim();
  if (!clean) return 'ltr';

  // Count Hebrew characters
  const hebrewMatches = clean.match(/[\u0590-\u05FF]/g);
  const hebrewCount = hebrewMatches ? hebrewMatches.length : 0;

  // Count Latin and Cyrillic characters
  const latinCyrillicMatches = clean.match(/[a-zA-Z\u0400-\u04FF]/g);
  const latinCyrillicCount = latinCyrillicMatches ? latinCyrillicMatches.length : 0;

  // If there is significant Cyrillic or Latin text, the outer flow must be LTR
  if (latinCyrillicCount > 3 || latinCyrillicCount >= hebrewCount) {
    return 'ltr';
  }

  // Only pure/predominantly Hebrew texts are RTL
  return hebrewCount > 0 ? 'rtl' : 'ltr';
}

export function formatHebrewText(text: string): string {
  // Обработка специальных случаев для иврита
  return text
    .replace(/\u200F/g, '') // Удаляем RLM
    .replace(/\u200E/g, '') // Удаляем LRM
    .trim();
  }

  export function stripHebrewVowels(text: string): string {
  return text.replace(/[\u05B0-\u05C7]/g, '');
  }

  export function stripPunctuation(text: string): string {
  return text.replace(/["'\"().,!?;:\-\[\]{}]/g, '');
  }