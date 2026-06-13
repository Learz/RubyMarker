import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("Setting up RubyMarker assets...");

  // 1. Ensure target directories exist
  const dataDir = path.join(__dirname, '..', 'src', 'data');
  const jsDir = path.join(__dirname, '..', 'public', 'js');
  const dictDir = path.join(__dirname, '..', 'public', 'dict');

  [dataDir, jsDir, dictDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // 2. Download and process Kanji data
  console.log("Downloading kanji data from GitHub...");
  const kanjiUrl = 'https://raw.githubusercontent.com/davidluzgouveia/kanji-data/master/kanji.json';
  
  try {
    const res = await fetch(kanjiUrl);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const fullKanjiData = await res.json();
    
    console.log("Processing Kanji data...");
    const processed = {};

    for (const [char, info] of Object.entries(fullKanjiData)) {
      // We only care about Kanji characters
      // Kanji grade 1 to 8 are Jōyō. Grade 9 is Jinmeiyou.
      // If grade is not specified, it's typically Hyogaigana/non-Jōyō.
      const grade = info.grade;
      const isJōyō = grade !== undefined && grade >= 1 && grade <= 8;
      const jlptVal = info.jlpt_new || info.jlpt_old;
      const jlpt = (jlptVal !== null && jlptVal !== undefined) ? jlptVal : undefined;
      
      // Clean and normalize readings
      const readings = [];
      
      if (info.readings_on) {
        info.readings_on.forEach(r => {
          // Convert Katakana to Hiragana for Onyomi standard checking
          const hReading = katakanaToHiragana(r);
          // Clean up any extra dashes (e.g. -た, か-)
          const clean = hReading.replace(/^-|-$/g, '');
          if (clean && !readings.includes(clean)) readings.push(clean);
        });
      }
      
      if (info.readings_kun) {
        info.readings_kun.forEach(r => {
          // Clean up dashes
          let clean = r.replace(/^-|-$/g, '');
          // Kunyomi readings in kanji-data often contain "." separating the stem from okurigana (e.g. あたら.しい, た.べる)
          // We want to store both:
          // 1. The stem reading (e.g., 'たべる' -> 'た' for '食')
          // 2. The full reading without the dot (e.g. 'たべる')
          // Let's store both to make alignment matching highly robust
          const parts = clean.split('.');
          const stem = parts[0];
          const full = parts.join('');
          
          if (stem && !readings.includes(stem)) readings.push(stem);
          if (full && !readings.includes(full)) readings.push(full);
        });
      }

      processed[char] = {
        jōyō: isJōyō,
        jlpt: jlpt, // undefined means non-JLPT
        readings: readings
      };
    }

    const outputPath = path.join(dataDir, 'kanji-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(processed, null, 2));
    console.log(`Successfully compiled kanji database to ${outputPath}`);

  } catch (err) {
    console.error("Failed to download or parse kanji data:", err);
    process.exit(1);
  }

  // 3. Copy kuromoji library and dictionaries from node_modules
  console.log("Copying kuromoji browser library...");
  const kuromojiJsSource = path.join(__dirname, '..', 'node_modules', 'kuromoji', 'build', 'kuromoji.js');
  const kuromojiJsDest = path.join(jsDir, 'kuromoji.js');

  if (fs.existsSync(kuromojiJsSource)) {
    fs.copyFileSync(kuromojiJsSource, kuromojiJsDest);
    console.log(`Copied kuromoji.js to ${kuromojiJsDest}`);
  } else {
    console.error(`Kuromoji JS source not found at ${kuromojiJsSource}. Make sure kuromoji is installed.`);
    process.exit(1);
  }

  // Patch kuromoji.js to look for .gzip files instead of .gz to prevent browser/bundler automatic decompression
  console.log("Patching kuromoji.js to use .gzip extension...");
  let kuromojiContent = fs.readFileSync(kuromojiJsDest, 'utf8');
  kuromojiContent = kuromojiContent.replace(/\.gz/g, '.gzip');
  fs.writeFileSync(kuromojiJsDest, kuromojiContent);
  console.log("Successfully patched kuromoji.js!");

  console.log("Copying dictionary files...");
  const dictSourceDir = path.join(__dirname, '..', 'node_modules', 'kuromoji', 'dict');
  
  if (fs.existsSync(dictSourceDir)) {
    // Clean old files in destination directory first
    if (fs.existsSync(dictDir)) {
      const existing = fs.readdirSync(dictDir);
      existing.forEach(file => {
        try {
          fs.unlinkSync(path.join(dictDir, file));
        } catch (e) {
          // ignore if folder/missing
        }
      });
    }

    const files = fs.readdirSync(dictSourceDir);
    let count = 0;
    files.forEach(file => {
      if (file.endsWith('.dat.gz')) {
        const src = path.join(dictSourceDir, file);
        // Rename .gz to .gzip
        const dest = path.join(dictDir, file.replace('.gz', '.gzip'));
        fs.copyFileSync(src, dest);
        count++;
      }
    });
    console.log(`Copied and renamed ${count} dictionary files to ${dictDir}`);
  } else {
    console.error(`Kuromoji dict source not found at ${dictSourceDir}. Make sure kuromoji is installed.`);
    process.exit(1);
  }

  console.log("Setup completed successfully!");
}

// Simple Katakana to Hiragana converter for Node script (to avoid dependencies)
function katakanaToHiragana(str) {
  return str.replace(/[\u30a1-\u30f6]/g, function(match) {
    var chr = match.charCodeAt(0) - 0x60;
    return String.fromCharCode(chr);
  });
}

main();
