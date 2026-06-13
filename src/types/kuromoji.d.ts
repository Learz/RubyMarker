interface KuromojiToken {
  word_id: number;
  word_type: string;
  word_position: number;
  surface_form: string;
  pos: string;
  pos_detail_1: string;
  pos_detail_2: string;
  pos_detail_3: string;
  conjugated_type: string;
  conjugated_form: string;
  basic_form: string;
  reading?: string; // in Katakana
  pronunciation?: string;
}

interface KuromojiTokenizer {
  tokenize(text: string): KuromojiToken[];
}

interface KuromojiBuilder {
  build(callback: (err: Error | null, tokenizer: KuromojiTokenizer) => void): void;
}

interface Kuromoji {
  builder(option: { dicPath: string }): KuromojiBuilder;
}

interface Window {
  kuromoji: Kuromoji;
}

// Add wanakana declarations if needed, or use npm package exports
declare module 'wanakana' {
  export function toHiragana(input: string): string;
  export function isKana(input: string): boolean;
  export function isKanji(input: string): boolean;
  export function isRomaji(input: string): boolean;
  export function isJapanese(input: string): boolean;
  export function stripOkurigana(input: string, options?: { leading?: boolean; matchKanji?: string }): string;
}
