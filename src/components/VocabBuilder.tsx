import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, Download, Upload, Trash2, CheckCircle, RefreshCw } from 'lucide-react';
import { countWordsInEpub } from '../utils/epubProcessor';
import { getVocabStats } from '../utils/vocabDb';

import type { BookEntry } from '../utils/vocabDb';

interface VocabBuilderProps {
  dictLoading: boolean;
  vocabCounts: Record<string, number>;
  books: BookEntry[];
  onMergeVocab: (bookName: string, newCounts: Record<string, number>) => void;
  onDeleteBook: (bookId: string) => void;
  onClearVocab: () => void;
  onImportVocab: (jsonString: string, overwrite: boolean) => void;
  onExportVocab: () => void;
}

export const VocabBuilder: React.FC<VocabBuilderProps> = ({
  dictLoading,
  vocabCounts,
  books,
  onMergeVocab,
  onDeleteBook,
  onClearVocab,
  onImportVocab,
  onExportVocab
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  
  // Word Cloud States
  const [showCloud, setShowCloud] = useState(false);
  const [selectedWord, setSelectedWord] = useState<{ word: string; count: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'frequency' | 'alphabetical'>('frequency');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const stats = getVocabStats(vocabCounts);

  // Top 10 most frequent words preview
  const topWords = Object.entries(vocabCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.epub')) {
        await analyzeBook(file);
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.endsWith('.epub')) {
        await analyzeBook(file);
      }
    }
  };

  const analyzeBook = async (file: File) => {
    setAnalyzing(true);
    setFeedback(null);
    setProgress(0);
    setStatusText("Loading file...");

    try {
      const counts = await countWordsInEpub(file, (prog, text) => {
        setProgress(prog);
        setStatusText(text);
      });

      const uniqueCount = Object.keys(counts).length;
      const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

      onMergeVocab(file.name, counts);
      setFeedback(`Analyzed "${file.name}": Found ${uniqueCount} unique kanji words (total ${totalCount} occurrences) and added them to your vocabulary database!`);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to analyze book.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result;
        if (typeof result === 'string') {
          const overwrite = window.confirm("Do you want to overwrite your existing vocabulary database with this backup? (Click Cancel to MERGE instead)");
          try {
            onImportVocab(result, overwrite);
            alert("Backup imported successfully!");
          } catch (err: any) {
            alert(err.message || "Failed to import backup.");
          }
        }
      };
      reader.readAsText(file);
      // Reset input value to allow uploading same file again
      e.target.value = '';
    }
  };

  const handleClearDatabase = () => {
    if (window.confirm("ARE YOU SURE you want to clear your entire vocabulary database? This will delete all accumulated word counts and cannot be undone.")) {
      onClearVocab();
      setFeedback("Vocabulary database cleared.");
    }
  };

  if (dictLoading) {
    return (
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px', gap: '1.5rem', textAlign: 'center' }}>
        <RefreshCw className="spinner" style={{ width: '64px', height: '64px', color: 'var(--accent-teal)' }} />
        <h3>Loading Dictionaries...</h3>
      </div>
    );
  }

  if (analyzing) {
    return (
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px', gap: '1.5rem', textAlign: 'center' }}>
        <div style={{ position: 'relative', width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg style={{ transform: 'rotate(-90deg)', width: '100px', height: '100px' }}>
            <circle cx="50" cy="50" r="40" stroke="var(--circle-track)" strokeWidth="6" fill="transparent" />
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="var(--accent-teal)"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={`${2 * Math.PI * 40}`}
              strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
              style={{ transition: 'stroke-dashoffset 0.35s ease' }}
            />
          </svg>
          <span style={{ position: 'absolute', fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 'bold' }}>{progress}%</span>
        </div>
        <div>
          <h3>Analyzing Book Vocabulary</h3>
          <p style={{ color: 'var(--accent-teal)', fontSize: '0.95rem', fontWeight: 500 }}>{statusText}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* 1. Drag & Drop Area */}
      <div 
        className="glass-panel" 
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '220px', 
          gap: '1rem',
          border: dragActive ? '2px dashed var(--accent-teal)' : '2px dashed var(--border-glass)',
          background: dragActive ? 'var(--bg-card-hover)' : undefined,
          cursor: 'pointer',
          textAlign: 'center'
        }}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept=".epub" style={{ display: 'none' }} onChange={handleFileChange} />
        <UploadCloud style={{ width: '40px', height: '40px', color: 'var(--accent-teal)' }} />
        <div>
          <h4 style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>Add Read Book to Vocabulary</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '380px' }}>
            Upload books you've already read to find which words you know.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" style={{ padding: '0.5rem 1.25rem', borderColor: 'var(--accent-teal)' }}>
          Select Ebook File
        </button>
      </div>

      {/* Feedback Message */}
      {feedback && (
        <div className="glass-panel" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', borderColor: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.08)' }}>
          <CheckCircle style={{ color: 'var(--accent-emerald)', flexShrink: 0 }} size={20} />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{feedback}</span>
        </div>
      )}

      {/* 2. Stats Dashboard Grid */}
      <div className="vocab-stats-grid">
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Words learned</span>
          <span style={{ fontSize: '2rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)', color: 'var(--accent-teal)' }}>
            {stats.uniqueWords.toLocaleString()}
          </span>
        </div>
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total words parsed</span>
          <span style={{ fontSize: '2rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)', color: 'var(--accent-fuchsia)' }}>
            {stats.totalOccurrences.toLocaleString()}
          </span>
        </div>
      </div>

      {/* 3. Top Words & Backup Actions Side-by-side */}
      <div className="vocab-actions-grid">
        
        {/* Top Words Preview list */}
        <div className="glass-panel" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h4 style={{ fontSize: '0.95rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileSpreadsheet size={16} style={{ color: 'var(--accent-teal)' }} />
              Most Frequent Words
            </div>
            {topWords.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCloud(true)}
                style={{ background: 'none', border: 'none', color: 'var(--accent-teal)', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'var(--font-heading)' }}
              >
                Show all
              </button>
            )}
          </h4>
          
          {topWords.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', margin: 'auto' }}>
              No words in database yet. Upload a book above.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {topWords.map(([word, count], i) => (
                <div key={word} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.25rem 0.5rem', borderRadius: '6px', background: i % 2 === 0 ? 'var(--bg-breakdown)' : 'transparent' }}>
                  <span>{i + 1}. <strong style={{ color: 'var(--text-primary)' }}>{word}</strong></span>
                  <span style={{ color: 'var(--text-muted)' }}>{count} times</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Database Actions */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center' }}>
          <h4 style={{ fontSize: '0.95rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', textAlign: 'left' }}>
            Import / Export
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
            {/* Export */}
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
              onClick={onExportVocab}
              disabled={stats.uniqueWords === 0}
            >
              <Download size={14} /> Export JSON
            </button>
            
            {/* Import */}
            <input 
              ref={backupInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportBackup}
            />
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
              onClick={() => backupInputRef.current?.click()}
            >
              <Upload size={14} /> Import JSON
            </button>
            
            {/* Clear database */}
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem', color: 'var(--accent-rose)', borderColor: 'rgba(244, 63, 94, 0.3)' }}
              onClick={handleClearDatabase}
              disabled={stats.uniqueWords === 0}
            >
              <Trash2 size={14} /> Clear everything
            </button>
          </div>
        </div>
      </div>

      {/* 4. Vocabulary Word Cloud Modal Overlay */}
      {showCloud && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content" style={{
            maxWidth: '850px',
            width: '100%',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            border: '1px solid var(--border-glass-focus)',
            textAlign: 'left'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem', flexShrink: 0 }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileSpreadsheet style={{ color: 'var(--accent-teal)' }} />
                Vocabulary ({stats.uniqueWords} words)
              </h3>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                onClick={() => {
                  setShowCloud(false);
                  setSelectedWord(null);
                  setSearchQuery('');
                  setSortBy('frequency');
                }}
              >
                Close
              </button>
            </div>

            {/* Filter and Sort Toolbar */}
            <div style={{ 
              display: 'flex', 
              gap: '1rem', 
              flexWrap: 'wrap', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.01)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
              paddingBottom: '0.5rem',
              flexShrink: 0
            }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <input
                  type="text"
                  placeholder="Search words (e.g. 勉強, 行く)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.85rem',
                    fontSize: '0.85rem'
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'frequency' | 'alphabetical')}
                  style={{
                    padding: '0.55rem 1.75rem 0.55rem 0.75rem',
                    fontSize: '0.85rem',
                    width: 'auto',
                    cursor: 'pointer'
                  }}
                >
                  <option value="frequency">Frequency (Highest first)</option>
                  <option value="alphabetical">Alphabetical (A-Z)</option>
                </select>
              </div>
            </div>

            {/* Selected Word Info bar */}
            <div style={{ 
              background: 'var(--bg-breakdown)', 
              border: '1px dashed var(--border-glass)', 
              borderRadius: '10px', 
              padding: '0.75rem 1rem', 
              textAlign: 'center', 
              fontSize: '0.95rem',
              minHeight: '60px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              flexShrink: 0
            }}>
              {selectedWord ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                  <div>
                    The word <strong style={{ color: 'var(--accent-teal)', fontSize: '1.1rem' }}>{selectedWord.word}</strong> has{' '}
                    <strong style={{ color: 'var(--accent-fuchsia)', fontSize: '1.1rem' }}>{selectedWord.count.toLocaleString()}</strong> total {selectedWord.count === 1 ? 'occurrence' : 'occurrences'}.
                  </div>
                  
                  {/* Book breakdown */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem', padding: '0.5rem 0.75rem', background: 'var(--bg-breakdown)', border: '1px solid var(--border-breakdown)', borderRadius: '8px', textAlign: 'left' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-breakdown)', paddingBottom: '0.25rem', marginBottom: '0.25rem', fontWeight: 600 }}>
                      Occurrence by Book:
                    </span>
                    <div style={{ maxHeight: '100px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {books
                        .map(b => ({ name: b.name, count: b.wordCounts[selectedWord.word] || 0 }))
                        .filter(b => b.count > 0)
                        .sort((a, b) => b.count - a.count)
                        .map(b => (
                          <div key={b.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                            <span style={{ color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                              📖 {b.name}
                            </span>
                            <strong style={{ color: 'var(--accent-teal)' }}>{b.count.toLocaleString()}x</strong>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                </div>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>Tap any word to see its occurrence count.</span>
              )}
            </div>

            {/* Masonry Cloud Area */}
            <div style={{ 
              overflowY: 'auto', 
              flex: 1, 
              paddingRight: '0.5rem',
              minHeight: '250px'
            }}>
              {Object.entries(vocabCounts).length === 0 ? (
                <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ color: 'var(--text-muted)' }}>No words in database yet.</p>
                </div>
              ) : (
                (() => {
                  const allWords = Object.entries(vocabCounts);
                  const filteredWords = allWords.filter(([word]) => 
                    word.toLowerCase().includes(searchQuery.toLowerCase())
                  );

                  if (filteredWords.length === 0) {
                    return (
                      <div style={{ display: 'flex', width: '100%', height: '150px', alignItems: 'center', justifyContent: 'center' }}>
                        <p style={{ color: 'var(--text-muted)' }}>No matching words found for "{searchQuery}".</p>
                      </div>
                    );
                  }

                  const sortedWords = [...filteredWords].sort((a, b) => {
                    if (sortBy === 'frequency') {
                      return b[1] - a[1];
                    } else {
                      return a[0].localeCompare(b[0], 'ja');
                    }
                  });

                  return (
                    <div className="vocab-list-grid">
                      {sortedWords.map(([word, count]) => {
                        const isSelected = selectedWord?.word === word;

                        return (
                          <div
                            key={word}
                            onClick={() => setSelectedWord({ word, count })}
                            className={`vocab-list-item ${isSelected ? 'selected' : ''}`}
                          >
                            <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                              {word}
                            </strong>
                            <span style={{ 
                              fontSize: '0.85rem', 
                              color: isSelected ? 'var(--accent-fuchsia)' : 'var(--text-secondary)',
                              fontWeight: 500
                            }}>
                              {count.toLocaleString()}x
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* 4. Added Books List */}
      <div className="glass-panel" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
        <h4 style={{ fontSize: '0.95rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          📖 Books Added ({books.length})
        </h4>
        
        {books.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0', margin: 0 }}>
            No books added to vocabulary yet. Upload completed EPUB files above.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
            {books.map((book) => {
              const bookUniqueWords = Object.keys(book.wordCounts).length;
              const bookTotalWords = Object.values(book.wordCounts).reduce((a, b) => a + b, 0);
              return (
                <div key={book.id} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '0.6rem 0.8rem', 
                  borderRadius: '10px', 
                  background: 'var(--bg-breakdown)',
                  border: '1px solid var(--border-glass)'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxWidth: '75%' }}>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {book.name}
                    </strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Added on {new Date(book.addedAt).toLocaleDateString()} &middot; {bookUniqueWords} unique words ({bookTotalWords} total)
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to remove "${book.name}" from your vocabulary? This will subtract its word occurrences from your database.`)) {
                        onDeleteBook(book.id);
                      }
                    }}
                    style={{ 
                      padding: '0.35rem 0.65rem', 
                      fontSize: '0.75rem', 
                      background: 'rgba(244, 63, 94, 0.08)', 
                      color: 'var(--accent-rose)',
                      border: '1px solid rgba(244, 63, 94, 0.2)',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
