import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, Download, CheckCircle, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';

interface DashboardProps {
  dictLoading: boolean;
  dictError: string | null;
  processing: boolean;
  progress: number;
  statusText: string;
  processedFile: { name: string; size: number; blob: Blob } | null;
  onUpload: (file: File) => void;
  onReset: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  dictLoading,
  dictError,
  processing,
  progress,
  statusText,
  processedFile,
  onUpload,
  onReset
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.epub')) {
        setSelectedFile(file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.endsWith('.epub')) {
        setSelectedFile(file);
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleDownload = () => {
    if (!processedFile) return;
    const url = URL.createObjectURL(processedFile.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = processedFile.name.replace('.epub', '_furigana.epub');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 1. Dictionary loading screen
  if (dictLoading) {
    return (
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px', gap: '1.5rem', textAlign: 'center' }}>
        <div style={{ position: 'relative', width: '80px', height: '80px' }}>
          <RefreshCw className="spinner" style={{ width: '80px', height: '80px', color: 'var(--accent-violet)', strokeWidth: 1.5 }} />
          <div className="loader-bg-glow" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.1)' }} />
        </div>
        <div>
          <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Loading Tokenizer Dictionaries</h3>
          <p style={{ maxWidth: '450px', color: 'var(--text-secondary)' }}>
            Downloading the Japanese tokenizer files (about 15MB). This only happens on the first load and gets saved so you can run it offline later.
          </p>
        </div>
      </div>
    );
  }

  // 2. Dictionary error screen
  if (dictError) {
    return (
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px', gap: '1.5rem', border: '1px solid var(--accent-rose)' }}>
        <AlertCircle style={{ width: '64px', height: '64px', color: 'var(--accent-rose)' }} />
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '1.4rem', color: 'var(--accent-rose)', marginBottom: '0.5rem' }}>Dictionary Initialization Failed</h3>
          <p style={{ maxWidth: '450px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            {dictError}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload Application
          </button>
        </div>
      </div>
    );
  }

  // 3. Processing state screen
  if (processing) {
    return (
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px', gap: '1.5rem', textAlign: 'center' }}>
        <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg style={{ transform: 'rotate(-90deg)', width: '120px', height: '120px' }}>
            <circle
              cx="60"
              cy="60"
              r="50"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="6"
              fill="transparent"
            />
            <circle
              cx="60"
              cy="60"
              r="50"
              stroke="var(--accent-violet)"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={`${2 * Math.PI * 50}`}
              strokeDashoffset={`${2 * Math.PI * 50 * (1 - progress / 100)}`}
              style={{ transition: 'stroke-dashoffset 0.35s ease' }}
            />
          </svg>
          <span style={{ position: 'absolute', fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 'bold' }}>
            {progress}%
          </span>
        </div>
        <div>
          <h3 style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>Injecting Furigana</h3>
          <p style={{ color: 'var(--accent-violet)', fontSize: '0.95rem', fontWeight: 500, minHeight: '1.5rem' }}>
            {statusText}
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Please keep this tab open. Everything runs locally in your browser.
          </p>
        </div>
      </div>
    );
  }

  // 4. Completed processing screen
  if (processedFile) {
    const sizeInMB = (processedFile.size / (1024 * 1024)).toFixed(2);
    return (
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px', gap: '1.5rem', textAlign: 'center' }}>
        <div className="success-badge" style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--accent-emerald)', boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)' }}>
          <CheckCircle style={{ width: '40px', height: '40px', color: 'var(--accent-emerald)' }} />
        </div>
        
        <div>
          <h3 style={{ fontSize: '1.6rem', marginBottom: '0.2rem' }}>Book Injected Successfully!</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            <FileText size={16} />
            <span>{processedFile.name}</span>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <span>{sizeInMB} MB</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: '320px' }}>
          <button 
            type="button" 
            className="btn btn-success pulse-glow" 
            style={{ width: '100%', padding: '0.9rem', fontSize: '1.1rem' }}
            onClick={handleDownload}
          >
            <Download size={20} /> Download Modified EPUB
          </button>
          
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ width: '100%' }}
            onClick={() => {
              setSelectedFile(null);
              onReset();
            }}
          >
            Process Another Ebook <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // 5. Selected file state (waiting to start processing)
  if (selectedFile && !processing && !processedFile) {
    const sizeInMB = (selectedFile.size / (1024 * 1024)).toFixed(2);
    return (
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px', gap: '1.5rem', textAlign: 'center' }}>
        <div className="file-badge" style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-glass)' }}>
          <FileText style={{ width: '36px', height: '36px', color: 'var(--accent-violet)' }} />
        </div>
        
        <div>
          <h3 style={{ fontSize: '1.4rem', marginBottom: '0.2rem' }}>Ebook Selected</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            <span>{selectedFile.name}</span>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <span>{sizeInMB} MB</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: '320px' }}>
          <button 
            type="button" 
            className="btn btn-primary pulse-glow" 
            style={{ width: '100%', padding: '0.9rem', fontSize: '1.1rem' }}
            onClick={() => onUpload(selectedFile)}
          >
            Start Injecting Furigana
          </button>
          
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ width: '100%' }}
            onClick={() => {
              setSelectedFile(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          >
            Cancel / Choose Different File
          </button>
        </div>
      </div>
    );
  }

  // 6. Upload/Drag-and-drop zone
  return (
    <div 
      className="glass-panel" 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '350px', 
        gap: '1.5rem',
        border: dragActive ? '2px dashed var(--accent-violet)' : '2px dashed var(--border-glass)',
        background: dragActive ? 'var(--bg-card-hover)' : undefined,
        cursor: 'pointer',
        textAlign: 'center'
      }}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      onClick={triggerFileInput}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".epub"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      
      <div className="file-badge" style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-glass)' }}>
        <UploadCloud style={{ width: '40px', height: '40px', color: 'var(--accent-violet)' }} />
      </div>

      <div>
          <h3 style={{ fontSize: '1.4rem', marginBottom: '0.4rem' }}>Drag & Drop your EPUB</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '380px', fontSize: '0.95rem' }}>
            Select a Japanese EPUB ebook to add furigana to.
          </p>
      </div>

      <button type="button" className="btn btn-primary" style={{ padding: '0.65rem 1.5rem' }}>
        Select Ebook File
      </button>

      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Only DRM-free EPUBs will work.
      </span>
    </div>
  );
};
