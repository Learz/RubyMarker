import kanjiDataJson from '../data/kanji-data.json';

export interface KanjiInfo {
  jōyō: boolean;
  jlpt?: number; // 5 = N5, 4 = N4, etc. (optional)
  readings: string[];
}

const kanjiDb = kanjiDataJson as Record<string, KanjiInfo>;

/**
 * Get information for a specific kanji character.
 */
export function getKanjiInfo(char: string): KanjiInfo | undefined {
  return kanjiDb[char];
}

/**
 * Check if a character is a Jōyō Kanji.
 * If the character is not in our database, we assume it is non-Jōyō.
 */
export function isJōyōKanji(char: string): boolean {
  const info = getKanjiInfo(char);
  return info ? info.jōyō : false;
}

/**
 * Get the JLPT level of a kanji character (1 to 5).
 * Returns undefined if it's not a standard JLPT kanji.
 */
export function getKanjiJlptLevel(char: string): number | undefined {
  const info = getKanjiInfo(char);
  return info ? info.jlpt : undefined;
}

/**
 * Checks if a reading is a standard reading for the kanji.
 * Reading should be in Hiragana.
 */
export function isStandardKanjiReading(char: string, reading: string): boolean {
  const info = getKanjiInfo(char);
  if (!info) return false;
  // Normalize reading (Hiragana, lowercase)
  const normReading = reading.trim().toLowerCase();
  return info.readings.includes(normReading);
}

/**
 * Check if a string contains any Kanji.
 */
export function hasKanji(text: string): boolean {
  return /[\u4e00-\u9faf]/.test(text);
}

/**
 * Check if a single character is Kanji.
 */
export function isKanjiChar(char: string): boolean {
  return /[\u4e00-\u9faf]/.test(char);
}
