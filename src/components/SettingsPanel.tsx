import React from 'react';
import { Sliders, BookOpen, Repeat } from 'lucide-react';
import type { ProcessorSettings } from '../utils/epubProcessor';

interface SettingsPanelProps {
  settings: ProcessorSettings;
  onChange: (settings: ProcessorSettings) => void;
  disabled: boolean;
  vocabCounts: Record<string, number>;
  useVocabFilter: boolean;
  setUseVocabFilter: (use: boolean) => void;
  vocabThreshold: number;
  setVocabThreshold: (val: number) => void;
  customExcludeText: string;
  setCustomExcludeText: (val: string) => void;
}

const getLevelDescription = (level: ProcessorSettings['level']) => {
  switch (level) {
    case 'all':
      return 'Adds furigana to all kanji. Recommended for absolute beginners.';
    case 'n5':
      return 'Adds furigana to all kanji except BIZ/standard N5-level (approx. 100 base characters).';
    case 'n4':
      return 'Adds furigana to all kanji except N5 and N4-level (approx. 400 characters).';
    case 'n3':
      return 'Adds furigana to all kanji except N5, N4, and N3-level (approx. 1,000 characters).';
    case 'n2':
      return 'Adds furigana to advanced N1 kanji and non-JLPT/rare kanji.';
    case 'n1':
      return 'Adds furigana to rare, non-JLPT kanji and rare, non-standard readings only.';
    case 'jōyō':
      return 'Adds furigana only to non-Jōyō kanji (outside the 2,136 daily-use characters).';
    case 'custom':
      return 'Adds furigana to all kanji except the custom list of words defined below.';
    default:
      return '';
  }
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onChange,
  disabled,
  vocabCounts,
  useVocabFilter,
  setUseVocabFilter,
  vocabThreshold,
  setVocabThreshold,
  customExcludeText,
  setCustomExcludeText
}) => {
  const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...settings,
      level: e.target.value as ProcessorSettings['level']
    });
  };

  const handleRepeatModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...settings,
      repeatMode: e.target.value as ProcessorSettings['repeatMode']
    });
  };

  const handleGapLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    onChange({
      ...settings,
      gapLimit: isNaN(value) ? 1500 : value
    });
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
        <Sliders style={{ color: 'var(--accent-violet)', width: '20px', height: '20px' }} />
        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Furigana Settings</h3>
      </div>

      {/* 1. Target Level Selection */}
      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <BookOpen size={16} style={{ color: 'var(--accent-violet)' }} />
          Reader's Kanji Level
        </label>
        <select value={settings.level} onChange={handleLevelChange} disabled={disabled}>
          <option value="all">Level 0 (All Kanji)</option>
          <option value="n5">JLPT N5</option>
          <option value="n4">JLPT N4</option>
          <option value="n3">JLPT N3</option>
          <option value="n2">JLPT N2</option>
          <option value="n1">JLPT N1</option>
          <option value="jōyō">Jōyō Only</option>
          <option value="custom">Custom List</option>
        </select>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem', lineHeight: '1.4' }}>
          {getLevelDescription(settings.level)}
        </p>
      </div>

      {/* Custom Exclude List Input */}
      {settings.level === 'custom' && (
        <div className="form-group" style={{ paddingLeft: '1rem', borderLeft: '2px solid var(--accent-violet)' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Custom Exclusion Words</label>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.55rem' }}>
            Paste words or upload a text file. Separated by commas, spaces, or newlines.
          </p>
          <textarea
            value={customExcludeText}
            onChange={(e) => setCustomExcludeText(e.target.value)}
            disabled={disabled}
            placeholder="e.g. 勉強, 行く, 食べる"
            rows={4}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '8px',
              border: '1px solid var(--border-glass)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              fontSize: '0.85rem',
              resize: 'vertical',
              outline: 'none'
            }}
          />
          <div style={{ marginTop: '0.5rem' }}>
            <label className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', display: 'inline-flex', cursor: 'pointer' }}>
              Upload List (.txt)
              <input
                type="file"
                accept=".txt"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      const text = evt.target?.result;
                      if (typeof text === 'string') {
                        if (customExcludeText.trim()) {
                          setCustomExcludeText(customExcludeText.trim() + ', ' + text.trim());
                        } else {
                          setCustomExcludeText(text.trim());
                        }
                      }
                    };
                    reader.readAsText(file);
                    e.target.value = '';
                  }
                }}
                disabled={disabled}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
      )}

      {/* 2. Repeat / Reset Rules */}
      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Repeat size={16} style={{ color: 'var(--accent-fuchsia)' }} />
          Furigana Repeat Rule
        </label>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
          Determines when to show furigana again for repeating words.
        </p>
        <select value={settings.repeatMode} onChange={handleRepeatModeChange} disabled={disabled}>
          <option value="chapter">Reset per Chapter (Standard publishing)</option>
          <option value="gap">Reset by Character Gap (Custom interval)</option>
          <option value="none">No Reset (Show on every single occurrence)</option>
        </select>
      </div>

      {/* 3. Character Gap Input (Conditional) */}
      {settings.repeatMode === 'gap' && (
        <div className="form-group" style={{ paddingLeft: '1rem', borderLeft: '2px solid var(--accent-fuchsia)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
            Character Gap Threshold
          </label>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Show furigana again if a word hasn't appeared for this many characters.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
            <input
              type="range"
              min="100"
              max="5000"
              step="100"
              value={settings.gapLimit}
              onChange={handleGapLimitChange}
              disabled={disabled}
              style={{ flex: 1, accentColor: 'var(--accent-fuchsia)' }}
            />
            <span style={{ fontFamily: 'var(--font-heading)', width: '60px', textAlign: 'right', fontSize: '0.9rem' }}>
              {settings.gapLimit}
            </span>
          </div>
        </div>
      )}


      {/* 4. Custom Vocabulary Exclusion Filter */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1.25rem', marginTop: '0.5rem', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600 }}>Known Words Filter</span>
        </div>

        {Object.keys(vocabCounts).length === 0 ? (
          <div style={{ padding: '0.75rem', borderRadius: '8px', border: '1px dashed var(--border-glass)', background: 'var(--bg-list-item)', marginTop: '0.25rem' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
              No words found in your vocabulary database. Go to the <strong>Vocabulary Builder</strong> tab to import some previously read books first!
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={useVocabFilter}
                  onChange={(e) => setUseVocabFilter(e.target.checked)}
                  disabled={disabled}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--accent-teal)' }}
                />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Enable Known Words Filter</span>
              </label>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Exclude words you already know from having furigana added.
            </p>

            {useVocabFilter && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1rem', borderLeft: '2px solid var(--accent-teal)', marginTop: '0.25rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Exclude words seen at least: <strong style={{ color: 'var(--accent-teal)' }}>{vocabThreshold} times</strong>
                </label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  value={vocabThreshold}
                  onChange={(e) => setVocabThreshold(parseInt(e.target.value))}
                  disabled={disabled}
                  style={{ width: '100%', accentColor: 'var(--accent-teal)' }}
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {Object.values(vocabCounts).filter(c => c >= vocabThreshold).length.toLocaleString()}
                  </strong> words will be excluded.
                </div>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
};
