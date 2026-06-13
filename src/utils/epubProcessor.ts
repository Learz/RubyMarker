import JSZip from 'jszip';
import { toHiragana } from 'wanakana';
import { alignKanjiReading } from './aligner';
import { getKanjiInfo, isKanjiChar } from './kanjiDb';

export interface ProcessorSettings {
  level: 'all' | 'n5' | 'n4' | 'n3' | 'n2' | 'n1' | 'jōyō' | 'custom';
  repeatMode: 'chapter' | 'gap' | 'none';
  gapLimit: number; // default 1500
}



// Global tokenizer instance
let tokenizer: KuromojiTokenizer | null = null;

/**
 * Initialize the kuromoji tokenizer.
 */
export function initTokenizer(onSuccess: () => void, onError: (err: any) => void) {
  if (tokenizer) {
    onSuccess();
    return;
  }

  if (!window.kuromoji) {
    onError(new Error("Kuromoji library not loaded. Make sure script tag exists in index.html."));
    return;
  }

  const base = import.meta.env.BASE_URL || '/';
  const dicPath = base.endsWith('/') ? `${base}dict/` : `${base}/dict/`;

  window.kuromoji.builder({ dicPath }).build((err, t) => {
    if (err) {
      onError(err);
    } else {
      tokenizer = t;
      onSuccess();
    }
  });
}

/**
 * Helper to unvoice Hiragana consonants (handling Rendaku / 連濁)
 */
function unvoice(char: string): string {
  const map: Record<string, string> = {
    'が': 'か', 'ぎ': 'き', 'ぐ': 'く', 'げ': 'け', 'ご': 'こ',
    'ざ': 'さ', 'じ': 'し', 'ず': 'す', 'ぜ': 'せ', 'ぞ': 'そ',
    'だ': 'た', 'ぢ': 'ち', 'づ': 'つ', 'で': 'て', 'ど': 'と',
    'ば': 'は', 'び': 'ひ', 'ぶ': 'ふ', 'べ': 'へ', 'ぼ': 'ほ',
    'ぱ': 'は', 'ぴ': 'ひ', 'ぷ': 'ふ', 'ぺ': 'へ', 'ぽ': 'ほ'
  };
  return map[char] || char;
}

/**
 * Check if a reading is a standard reading, taking into account sound changes:
 * - Rendaku (voicing): e.g., 'ひと' -> 'びと'
 * - Sokuon contraction: e.g., 'がく' -> 'がっ', 'いち' -> 'いっ'
 */
function isStandardReadingWithSoundChanges(char: string, reading: string): boolean {
  const info = getKanjiInfo(char);
  if (!info) return false;

  const normReading = reading.trim().toLowerCase();

  // Direct standard reading match
  if (info.readings.includes(normReading)) return true;

  // 1. Check Rendaku (Voiced starting consonant)
  if (normReading.length > 0) {
    const first = normReading[0];
    const unvoicedFirst = unvoice(first);
    if (first !== unvoicedFirst) {
      const modifiedReading = unvoicedFirst + normReading.substring(1);
      if (info.readings.includes(modifiedReading)) return true;
    }
  }

  // 2. Check Sokuon contraction (ends with 'っ')
  if (normReading.endsWith('っ')) {
    const base = normReading.slice(0, -1);
    // Common contractions are from readings ending in 'く', 'つ', 'ち'
    if (
      info.readings.includes(base + 'く') ||
      info.readings.includes(base + 'つ') ||
      info.readings.includes(base + 'ち')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Resolves relative paths in EPUB manifest (e.g. "Text/chapter1.xhtml" relative to "OEBPS/content.opf")
 */
function resolvePath(basePath: string, relativePath: string): string {
  const baseDir = basePath.substring(0, basePath.lastIndexOf('/'));
  if (!baseDir) return relativePath;

  const parts = baseDir.split('/').concat(relativePath.split('/'));
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === '.' || part === '') continue;
    if (part === '..') {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }

  return resolved.join('/');
}

/**
 * Add Furigana/Ruby to an EPUB file.
 * Returns a Promise that resolves to the modified EPUB blob and a preview of chapters.
 */
export async function processEpub(
  file: File,
  settings: ProcessorSettings,
  onProgress: (progress: number, status: string) => void,
  excludedWords?: Set<string>
): Promise<Blob> {
  if (!tokenizer) {
    throw new Error("Tokenizer is not initialized. Call initTokenizer first.");
  }

  onProgress(5, "Reading EPUB file...");
  const zip = await JSZip.loadAsync(file);

  // 1. Find the OPF file path from container.xml
  onProgress(10, "Locating package metadata...");
  const containerXml = await zip.file("META-INF/container.xml")?.async("string");
  if (!containerXml) {
    throw new Error("Invalid EPUB: META-INF/container.xml not found.");
  }

  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, "text/xml");
  const rootfile = containerDoc.getElementsByTagName("rootfile")[0];
  const opfPath = rootfile?.getAttribute("full-path");

  if (!opfPath) {
    throw new Error("Invalid EPUB: Root OPF file path not found in container.xml.");
  }

  // 2. Read OPF file to find XHTML documents
  const opfText = await zip.file(opfPath)?.async("string");
  if (!opfText) {
    throw new Error(`Invalid EPUB: OPF file not found at ${opfPath}`);
  }

  onProgress(15, "Parsing manifest...");
  const opfDoc = parser.parseFromString(opfText, "text/xml");
  
  // Create a map of items from manifest
  const manifestItems = opfDoc.getElementsByTagName("item");
  const manifestMap: Record<string, { href: string; mediaType: string }> = {};
  for (let i = 0; i < manifestItems.length; i++) {
    const item = manifestItems[i];
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    const mediaType = item.getAttribute("media-type");
    if (id && href) {
      manifestMap[id] = { href, mediaType: mediaType || '' };
    }
  }

  // Find spine order (reading order)
  const spineItems = opfDoc.getElementsByTagName("itemref");
  const htmlRelativePaths: string[] = [];
  for (let i = 0; i < spineItems.length; i++) {
    const idref = spineItems[i].getAttribute("idref");
    if (idref && manifestMap[idref]) {
      const item = manifestMap[idref];
      if (item.mediaType === 'application/xhtml+xml' || item.mediaType === 'text/html') {
        htmlRelativePaths.push(item.href);
      }
    }
  }


  const totalChapters = htmlRelativePaths.length;

  if (totalChapters === 0) {
    throw new Error("No XHTML chapter files found in EPUB spine.");
  }

  const serializer = new XMLSerializer();

  // 3. Process each HTML file
  for (let idx = 0; idx < totalChapters; idx++) {
    const relativeHref = htmlRelativePaths[idx];
    const resolvedPath = resolvePath(opfPath, relativeHref);
    const htmlFile = zip.file(resolvedPath);

    if (!htmlFile) {
      console.warn(`File not found in ZIP: ${resolvedPath}`);
      continue;
    }

    const chapterPercent = Math.round(15 + (idx / totalChapters) * 80);
    onProgress(chapterPercent, `Processing chapter ${idx + 1} of ${totalChapters}...`);

    const originalText = await htmlFile.async("string");
    const doc = parser.parseFromString(originalText, "application/xhtml+xml");

    // Initialize state trackers for this chapter
    const seenWords = new Set<string>();
    const lastSeenIndices = new Map<string, number>();
    let charCounter = 0;

    // Recursive DOM traversal function
    const processNode = (node: Node, insideRuby: boolean) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const tagName = el.tagName.toLowerCase();
        // Skip code, styles, script, svg and metadata tags
        if (['script', 'style', 'svg', 'iframe', 'code', 'pre', 'textarea', 'title', 'head'].includes(tagName)) {
          return;
        }
        const isRubyTag = tagName === 'ruby' || tagName === 'rt' || tagName === 'rp';
        
        // Copy children to a static array since we will modify DOM in-place
        const children = Array.from(el.childNodes);
        for (const child of children) {
          processNode(child, insideRuby || isRubyTag);
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        if (insideRuby) return;

        const textContent = node.nodeValue || '';
        // If no kanji, just increment position counter
        if (!/[\u4e00-\u9faf]/.test(textContent)) {
          charCounter += textContent.length;
          return;
        }

        // Tokenize and build new DOM nodes list
        const replacementNodes = processTextContent(textContent);
        if (replacementNodes.length > 0) {
          const parent = node.parentNode;
          if (parent) {
            const fragment = doc.createDocumentFragment();
            for (const rNode of replacementNodes) {
              fragment.appendChild(rNode);
            }
            parent.replaceChild(fragment, node);
          }
        }
      }
    };

    // Process a text block
    const processTextContent = (text: string): Node[] => {
      if (!tokenizer) return [];
      const tokens = tokenizer.tokenize(text);
      const nodesList: Node[] = [];

      for (const token of tokens) {
        const surface = token.surface_form;
        const reading = token.reading ? toHiragana(token.reading) : '';
        const baseKey = (token.basic_form && token.basic_form !== '*') ? token.basic_form : surface;

        // If word contains no kanji, just append as plain text
        if (!/[\u4e00-\u9faf]/.test(surface)) {
          nodesList.push(doc.createTextNode(surface));
          charCounter += surface.length;
          continue;
        }

        // Determine if furigana should be added
        const needsRuby = checkIfWordNeedsFurigana(token, surface, reading);

        if (needsRuby && reading) {
          // Align and build ruby elements
          const segments = alignKanjiReading(surface, reading);
          for (const seg of segments) {
            if (seg.ruby !== '') {
              // Check if individual segment text or the whole token's baseKey is excluded
              const isExcluded = excludedWords && (excludedWords.has(seg.text) || excludedWords.has(baseKey));

              // Check if the segment's kanji are already known by the reader's selected level
              let isSegmentKnown = false;
              if (settings.level !== 'all' && settings.level !== 'custom') {
                isSegmentKnown = true;
                for (let i = 0; i < seg.text.length; i++) {
                  const char = seg.text[i];
                  if (isKanjiChar(char)) {
                    const info = getKanjiInfo(char);
                    if (!info) {
                      isSegmentKnown = false;
                      break;
                    }
                    if (settings.level === 'jōyō') {
                      if (!info.jōyō) {
                        isSegmentKnown = false;
                        break;
                      }
                    } else {
                      const readerLevelNum = parseInt(settings.level.replace('n', ''));
                      if (!info.jlpt || info.jlpt < readerLevelNum) {
                        isSegmentKnown = false;
                        break;
                      }
                    }
                  }
                }
              }

              if (isExcluded || isSegmentKnown) {
                console.log(`[Exclusion] Suppressed furigana for segment "${seg.text}" (reading "${seg.ruby}") in word "${surface}" (known level or custom excluded)`);
                nodesList.push(doc.createTextNode(seg.text));
              } else {
                const rubyEl = doc.createElementNS("http://www.w3.org/1999/xhtml", "ruby");
                const rtEl = doc.createElementNS("http://www.w3.org/1999/xhtml", "rt");
                
                rubyEl.textContent = seg.text;
                rtEl.textContent = seg.ruby;
                rubyEl.appendChild(rtEl);
                
                nodesList.push(rubyEl);
              }
            } else {
              nodesList.push(doc.createTextNode(seg.text));
            }
          }
          charCounter += surface.length;
        } else {
          // Plain text fallback
          nodesList.push(doc.createTextNode(surface));
          charCounter += surface.length;
        }
      }

      return nodesList;
    };

    // Helper to evaluate eligibility
    const checkIfWordNeedsFurigana = (
      _token: KuromojiToken,
      surface: string,
      reading: string
    ): boolean => {
      // 1. Double check Kanji presence
      if (!/[\u4e00-\u9faf]/.test(surface)) return false;

      let levelEligible = false;

      // 2. Check settings level
      if (settings.level === 'all' || settings.level === 'custom') {
        levelEligible = true;
      } else {
        // Evaluate each kanji character
        for (let i = 0; i < surface.length; i++) {
          const char = surface[i];
          if (isKanjiChar(char)) {
            const info = getKanjiInfo(char);
            if (!info) {
              // Non-standard kanji outside the database -> add furigana
              levelEligible = true;
              break;
            }

            if (settings.level === 'jōyō') {
              if (!info.jōyō) {
                levelEligible = true;
                break;
              }
            } else {
              // JLPT levels (N5 to N1)
              const readerLevelNum = parseInt(settings.level.replace('n', '')); // e.g. 3
              // If info.jlpt is undefined, it is above N1 or non-JLPT
              if (!info.jlpt || info.jlpt < readerLevelNum) {
                levelEligible = true;
                break;
              }
            }
          }
        }
      }

      // 3. Check for rare/non-standard readings
      if (!levelEligible && reading) {
        const segments = alignKanjiReading(surface, reading);
        for (const seg of segments) {
          if (seg.ruby !== '') {
            // Group-ruby compound (e.g. '秋刀魚' -> 'さんま') which doesn't align to single characters
            if (seg.text.length > 1) {
              levelEligible = true;
              break;
            } else {
              // Single kanji reading check
              const isStd = isStandardReadingWithSoundChanges(seg.text, seg.ruby);
              if (!isStd) {
                levelEligible = true;
                break;
              }
            }
          }
        }
      }

      if (!levelEligible) return false;

      // Custom Known Words filter (using basic form grouping)
      const baseKey = (_token.basic_form && _token.basic_form !== '*') ? _token.basic_form : surface;
      if (excludedWords && excludedWords.has(baseKey)) {
        console.log(`[Exclusion] Suppressed furigana for whole word "${surface}" (baseKey: "${baseKey}")`);
        return false;
      }

      // 4. Memory/Repeat filter
      const wordKey = surface;
      if (settings.repeatMode === 'chapter') {
        if (seenWords.has(wordKey)) {
          return false;
        }
        seenWords.add(wordKey);
      } else if (settings.repeatMode === 'gap') {
        const lastSeen = lastSeenIndices.get(wordKey);
        const currentPos = charCounter;
        if (lastSeen !== undefined && (currentPos - lastSeen <= settings.gapLimit)) {
          // Word appeared recently, update index and suppress furigana
          lastSeenIndices.set(wordKey, currentPos);
          return false;
        }
        lastSeenIndices.set(wordKey, currentPos);
      }

      return true;
    };

    // Traverse DOM starting from the body (or root if body doesn't exist)
    const startNode = doc.body || doc.documentElement;
    processNode(startNode, false);

    // Serialize modified document
    const processedText = serializer.serializeToString(doc);
    
    // Save back to ZIP
    zip.file(resolvedPath, processedText);


  }

  // 4. Export the modified ZIP as Blob
  onProgress(95, "Reassembling EPUB file...");
  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/epub+zip" });
  onProgress(100, "Done!");

  return blob;
}

/**
 * Count the occurrences of Kanji words in an EPUB file.
 * Returns a Promise that resolves to a map of word -> count.
 */
export async function countWordsInEpub(
  file: File,
  onProgress: (progress: number, status: string) => void
): Promise<Record<string, number>> {
  if (!tokenizer) {
    throw new Error("Tokenizer is not initialized. Call initTokenizer first.");
  }

  onProgress(5, "Reading EPUB file...");
  const zip = await JSZip.loadAsync(file);

  // Find container.xml
  const containerXml = await zip.file("META-INF/container.xml")?.async("string");
  if (!containerXml) throw new Error("Invalid EPUB: container.xml not found.");

  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, "text/xml");
  const rootfile = containerDoc.getElementsByTagName("rootfile")[0];
  const opfPath = rootfile?.getAttribute("full-path");
  if (!opfPath) throw new Error("Invalid EPUB: OPF path not found.");

  // Read OPF
  const opfText = await zip.file(opfPath)?.async("string");
  if (!opfText) throw new Error("Invalid EPUB: OPF file not found.");

  const opfDoc = parser.parseFromString(opfText, "text/xml");
  const manifestItems = opfDoc.getElementsByTagName("item");
  const manifestMap: Record<string, { href: string; mediaType: string }> = {};
  for (let i = 0; i < manifestItems.length; i++) {
    const item = manifestItems[i];
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    const mediaType = item.getAttribute("media-type");
    if (id && href) {
      manifestMap[id] = { href, mediaType: mediaType || '' };
    }
  }

  const spineItems = opfDoc.getElementsByTagName("itemref");
  const htmlRelativePaths: string[] = [];
  for (let i = 0; i < spineItems.length; i++) {
    const idref = spineItems[i].getAttribute("idref");
    if (idref && manifestMap[idref]) {
      const item = manifestMap[idref];
      if (item.mediaType === 'application/xhtml+xml' || item.mediaType === 'text/html') {
        htmlRelativePaths.push(item.href);
      }
    }
  }

  const wordCounts: Record<string, number> = {};
  const totalChapters = htmlRelativePaths.length;

  for (let idx = 0; idx < totalChapters; idx++) {
    const relativeHref = htmlRelativePaths[idx];
    const resolvedPath = resolvePath(opfPath, relativeHref);
    const htmlFile = zip.file(resolvedPath);

    if (!htmlFile) continue;

    const percent = Math.round(15 + (idx / totalChapters) * 80);
    onProgress(percent, `Analyzing chapter ${idx + 1} of ${totalChapters}...`);

    const htmlText = await htmlFile.async("string");
    const doc = parser.parseFromString(htmlText, "application/xhtml+xml");

    const traverse = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const tagName = el.tagName.toLowerCase();
        if (['script', 'style', 'svg', 'iframe', 'code', 'pre', 'textarea', 'title', 'head'].includes(tagName)) {
          return;
        }
        const children = Array.from(el.childNodes);
        for (const child of children) {
          traverse(child);
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue || '';
        if (/[\u4e00-\u9faf]/.test(text)) {
          const tokens = tokenizer!.tokenize(text);
          for (const token of tokens) {
            const surface = token.surface_form;
            // Only count words that contain Kanji
            if (/[\u4e00-\u9faf]/.test(surface)) {
              const key = (token.basic_form && token.basic_form !== '*') ? token.basic_form : surface;
              wordCounts[key] = (wordCounts[key] || 0) + 1;
            }
          }
        }
      }
    };

    const body = doc.body || doc.documentElement;
    traverse(body);
  }

  onProgress(100, "Analysis complete!");
  return wordCounts;
}
