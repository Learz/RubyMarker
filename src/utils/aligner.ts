import { toHiragana } from 'wanakana';
import { isKanjiChar } from './kanjiDb';

export interface AlignedSegment {
  text: string;
  ruby: string; // If empty, it means no ruby (it's kana/symbol)
}

/**
 * Align Japanese Kanji in surface form with their Hiragana readings.
 * Returns an array of segments.
 * 
 * Example:
 *   alignKanjiReading("取り出す", "とりだす")
 *   => [
 *        { text: "取", ruby: "と" },
 *        { text: "り", ruby: "" },
 *        { text: "出", ruby: "だ" },
 *        { text: "す", ruby: "" }
 *      ]
 */
export function alignKanjiReading(surface: string, readingKatakanaOrHiragana: string): AlignedSegment[] {
  // Convert reading to Hiragana for uniform processing
  const reading = toHiragana(readingKatakanaOrHiragana);
  
  // Quick checks
  if (!surface) return [];
  
  // If no Kanji in surface, it maps directly to itself
  if (!/[\u4e00-\u9faf]/.test(surface)) {
    return [{ text: surface, ruby: '' }];
  }
  
  // If surface is 100% Kanji, it gets the entire reading as ruby
  if (/^[\u4e00-\u9faf]+$/.test(surface)) {
    return [{ text: surface, ruby: reading }];
  }

  const memo: Record<string, AlignedSegment[] | null> = {};

  function solve(sIdx: number, rIdx: number): AlignedSegment[] | null {
    const key = `${sIdx},${rIdx}`;
    if (key in memo) return memo[key];

    // Base cases
    if (sIdx === surface.length && rIdx === reading.length) {
      return [];
    }
    if (sIdx === surface.length || rIdx === reading.length) {
      return null;
    }

    const sChar = surface[sIdx];
    
    if (!isKanjiChar(sChar)) {
      // sChar is Hiragana, Katakana, or a symbol. It must match reading[rIdx]
      // We normalize both to Hiragana for comparison
      const sCharH = toHiragana(sChar);
      const rCharH = toHiragana(reading[rIdx]);
      
      if (sCharH === rCharH) {
        const next = solve(sIdx + 1, rIdx + 1);
        if (next !== null) {
          memo[key] = [{ text: sChar, ruby: '' }, ...next];
          return memo[key];
        }
      }
      memo[key] = null;
      return null;
    }

    // sChar is a Kanji. It can match a substring of reading starting at rIdx.
    // Try different lengths of reading to assign to this Kanji.
    const remainingSurfaceChars = surface.length - 1 - sIdx;
    const maxConsume = reading.length - rIdx - remainingSurfaceChars;

    for (let len = 1; len <= maxConsume; len++) {
      const rubyPart = reading.substring(rIdx, rIdx + len);
      const next = solve(sIdx + 1, rIdx + len);
      if (next !== null) {
        memo[key] = [{ text: sChar, ruby: rubyPart }, ...next];
        return memo[key];
      }
    }

    memo[key] = null;
    return null;
  }

  const result = solve(0, 0);
  if (result !== null) {
    return mergeConsecutiveSegments(result);
  }

  // Fallback if alignment fails: return the whole surface with the whole reading as ruby
  return [{ text: surface, ruby: reading }];
}

/**
 * Merge consecutive segments of the same type.
 * Specifically, consecutive Kanji segments will be merged into a single segment for cleaner rendering (group ruby).
 * e.g., [{ text: "漢", ruby: "かん" }, { text: "字", ruby: "じ" }]
 *    => [{ text: "漢字", ruby: "かんじ" }]
 */
function mergeConsecutiveSegments(segments: AlignedSegment[]): AlignedSegment[] {
  if (segments.length <= 1) return segments;

  const merged: AlignedSegment[] = [];
  let current = segments[0];

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i];
    
    // If both are kanji (have ruby annotations)
    if (current.ruby !== '' && next.ruby !== '') {
      current = {
        text: current.text + next.text,
        ruby: current.ruby + next.ruby
      };
    } 
    // If both are non-kanji (plain text)
    else if (current.ruby === '' && next.ruby === '') {
      current = {
        text: current.text + next.text,
        ruby: ''
      };
    } 
    // Types differ, push current and start new
    else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);
  return merged;
}
