import { useState, useEffect } from 'react';
import { SettingsPanel } from './components/SettingsPanel';
import { Dashboard } from './components/Dashboard';
import { VocabBuilder } from './components/VocabBuilder';
import { initTokenizer, processEpub } from './utils/epubProcessor';
import type { ProcessorSettings } from './utils/epubProcessor';
import { 
  loadVocabBooks,
  addVocabBook,
  deleteVocabBook,
  clearVocabDb,
  getAggregateCounts,
  getExcludedWordSet, 
  exportVocabAsJson, 
  importVocabFromJson 
} from './utils/vocabDb';
import type { BookEntry } from './utils/vocabDb';
import { BookMarked, Sparkles, Database, FileText } from 'lucide-react';

function App() {
  // 1. Settings State
  const [settings, setSettings] = useState<ProcessorSettings>({
    level: 'n3', // default reader is N3
    repeatMode: 'chapter', // default resets per chapter
    gapLimit: 1500 // default character gap limit is 1,500
  });

  // 2. Tab Navigation State
  const [activeTab, setActiveTab] = useState<'injector' | 'vocab'>('injector');

  // 3. Custom Vocabulary States
  const [books, setBooks] = useState<BookEntry[]>([]);
  const [vocabCounts, setVocabCounts] = useState<Record<string, number>>({});
  const [useVocabFilter, setUseVocabFilter] = useState<boolean>(false);
  const [vocabThreshold, setVocabThreshold] = useState<number>(5);
  const [customExcludeText, setCustomExcludeText] = useState<string>(() => {
    return localStorage.getItem('rubymarker_custom_exclude') || '';
  });

  // 5. Theme & Mode State
  const [theme, setTheme] = useState<'developer' | 'aislop'>(() => {
    return (localStorage.getItem('rubymarker_theme') as 'developer' | 'aislop') || 'developer';
  });
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    const savedMode = localStorage.getItem('rubymarker_mode');
    if (savedMode === 'light' || savedMode === 'dark') return savedMode;
    // Default: Developer is light mode, AI Slop is dark mode
    const currentTheme = (localStorage.getItem('rubymarker_theme') as 'developer' | 'aislop') || 'developer';
    return currentTheme === 'developer' ? 'light' : 'dark';
  });

  const [dictLoading, setDictLoading] = useState<boolean>(true);
  const [dictError, setDictError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');
  const [processedFile, setProcessedFile] = useState<{ name: string; size: number; blob: Blob } | null>(null);

  // Initialize kuromoji tokenizer on app load
  useEffect(() => {
    setDictLoading(true);
    initTokenizer(
      () => {
        setDictLoading(false);
      },
      (err) => {
        console.error("Failed to load tokenizer:", err);
        setDictLoading(false);
        setDictError("Could not download morphological dictionary files. Please ensure you are running on a server (e.g. localhost) and the '/dict' directory is served properly in the public folder.");
      }
    );

    // Load vocabulary counts and settings on mount
    const loadedBooks = loadVocabBooks();
    setBooks(loadedBooks);
    setVocabCounts(getAggregateCounts(loadedBooks));
    const savedFilter = localStorage.getItem('rubymarker_use_vocab_filter');
    if (savedFilter !== null) setUseVocabFilter(savedFilter === 'true');
    const savedThreshold = localStorage.getItem('rubymarker_vocab_threshold');
    if (savedThreshold !== null) setVocabThreshold(parseInt(savedThreshold));
  }, []);

  // Apply theme & mode class/attribute on state change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-mode', mode);
    localStorage.setItem('rubymarker_theme', theme);
    localStorage.setItem('rubymarker_mode', mode);
  }, [theme, mode]);

  // Custom vocab state triggers
  const handleUseVocabFilterChange = (val: boolean) => {
    setUseVocabFilter(val);
    localStorage.setItem('rubymarker_use_vocab_filter', String(val));
  };

  const handleVocabThresholdChange = (val: number) => {
    setVocabThreshold(val);
    localStorage.setItem('rubymarker_vocab_threshold', String(val));
  };

  const handleCustomExcludeTextChange = (val: string) => {
    setCustomExcludeText(val);
    localStorage.setItem('rubymarker_custom_exclude', val);
  };

  const handleMergeVocab = (bookName: string, newCounts: Record<string, number>) => {
    const updatedBooks = addVocabBook(bookName, newCounts);
    setBooks(updatedBooks);
    setVocabCounts(getAggregateCounts(updatedBooks));
  };

  const handleDeleteBook = (bookId: string) => {
    const updatedBooks = deleteVocabBook(bookId);
    setBooks(updatedBooks);
    setVocabCounts(getAggregateCounts(updatedBooks));
  };

  const handleClearVocab = () => {
    clearVocabDb();
    setBooks([]);
    setVocabCounts({});
  };

  const handleImportVocab = (jsonString: string, overwrite: boolean) => {
    const updatedBooks = importVocabFromJson(jsonString, overwrite);
    setBooks(updatedBooks);
    setVocabCounts(getAggregateCounts(updatedBooks));
  };

  const handleExportVocab = () => {
    exportVocabAsJson(books);
  };

  const handleUpload = async (file: File) => {
    setProcessing(true);
    setProcessedFile(null);
    setProgress(0);
    setStatusText("Reading ebook...");

    try {
      // Create set of excluded words if vocabulary filter is active or custom level is selected
      const excludedSet = new Set<string>();

      if (useVocabFilter) {
        getExcludedWordSet(vocabCounts, vocabThreshold).forEach(w => excludedSet.add(w));
      }

      if (settings.level === 'custom') {
        customExcludeText
          .split(/[\s,、，\n\r]+/)
          .map(w => w.trim())
          .filter(w => w.length > 0)
          .forEach(w => excludedSet.add(w));
      }

      const excludedWords = excludedSet.size > 0 ? excludedSet : undefined;
      
      const blob = await processEpub(file, settings, (prog, text) => {
        setProgress(prog);
        setStatusText(text);
      }, excludedWords);

      setProcessedFile({
        name: file.name,
        size: blob.size,
        blob: blob
      });
    } catch (err: any) {
      console.error(err);
      alert(err.message || "An error occurred while processing the EPUB file.");
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setProcessedFile(null);
    setProgress(0);
    setStatusText('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '2.5rem 0', position: 'relative' }}>
      

      
      {/* 1. Header Area */}
      <header style={{ textAlign: 'center', marginBottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ 
            width: '48px', 
            height: '48px', 
            borderRadius: '12px', 
            background: 'var(--grad-primary)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)'
          }}>
            <BookMarked size={26} style={{ color: 'white' }} />
          </div>
          <h1 style={{ margin: 0 }}>RubyMarker</h1>
        </div>
        <p style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '1rem', color: 'var(--text-secondary)' }}>
          <Sparkles size={16} style={{ color: 'var(--accent-fuchsia)' }} />
          Add furigana to your Japanese EPUB ebooks
        </p>
      </header>

      {/* 2. Tab Navigation */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn ${activeTab === 'injector' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('injector')}
          style={{ padding: '0.6rem 1.25rem', gap: '0.5rem' }}
        >
          <FileText size={18} /> Furigana Injector
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'vocab' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('vocab')}
          style={{ 
            padding: '0.6rem 1.25rem', 
            gap: '0.5rem', 
            background: activeTab === 'vocab' ? 'var(--grad-teal)' : undefined, 
            boxShadow: activeTab === 'vocab' ? 'var(--shadow-glow-teal)' : undefined 
          }}
        >
          <Database size={18} /> Vocabulary Builder
        </button>
      </div>

      {/* 3. Main Dashboard Layout based on active tab */}
      {activeTab === 'injector' ? (
        <main className="app-grid">
          {/* Left Column: Config Panel */}
          <SettingsPanel
            settings={settings}
            onChange={setSettings}
            disabled={processing}
            vocabCounts={vocabCounts}
            useVocabFilter={useVocabFilter}
            setUseVocabFilter={handleUseVocabFilterChange}
            vocabThreshold={vocabThreshold}
            setVocabThreshold={handleVocabThresholdChange}
            customExcludeText={customExcludeText}
            setCustomExcludeText={handleCustomExcludeTextChange}
          />

          {/* Right Column: File Area */}
          <Dashboard
            dictLoading={dictLoading}
            dictError={dictError}
            processing={processing}
            progress={progress}
            statusText={statusText}
            processedFile={processedFile}
            onUpload={handleUpload}
            onReset={handleReset}
          />
        </main>
      ) : (
        <main style={{ maxWidth: '800px', width: '100%', margin: '0 auto', padding: '0 1.5rem' }}>
          <VocabBuilder
            dictLoading={dictLoading}
            vocabCounts={vocabCounts}
            books={books}
            onMergeVocab={handleMergeVocab}
            onDeleteBook={handleDeleteBook}
            onClearVocab={handleClearVocab}
            onImportVocab={handleImportVocab}
            onExportVocab={handleExportVocab}
          />
        </main>
      )}



      {/* 5. Footer */}
      <footer style={{ marginTop: 'auto', textAlign: 'center', paddingTop: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <select
            id="theme-select"
            className="btn"
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'developer' | 'aislop')}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer', width: 'auto' }}
          >
            <option value="developer">Theme: Developer Art</option>
            <option value="aislop">Theme: AI Slop</option>
          </select>
          <button
            type="button"
            className="btn"
            onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer' }}
          >
            {mode === 'light' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
        <p>&copy; {new Date().getFullYear()} RubyMarker. Everything runs locally in your browser. Your files never leave your computer.</p>
      </footer>
    </div>
  );
}

export default App;
