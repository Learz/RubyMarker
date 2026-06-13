const STORAGE_KEY = 'rubymarker_vocab_books';
const LEGACY_KEY = 'rubymarker_vocab_counts';

export interface BookEntry {
  id: string;
  name: string;
  addedAt: string;
  wordCounts: Record<string, number>;
}

/**
 * Load all books from localStorage. Migrates legacy data if present.
 */
export function loadVocabBooks(): BookEntry[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data) as BookEntry[];
    }

    // Check for legacy counts data and migrate it
    const legacyData = localStorage.getItem(LEGACY_KEY);
    if (legacyData) {
      try {
        const legacyCounts = JSON.parse(legacyData) as Record<string, number>;
        if (legacyCounts && Object.keys(legacyCounts).length > 0) {
          const legacyEntry: BookEntry = {
            id: 'legacy_data',
            name: 'Legacy Cumulative Data',
            addedAt: new Date().toISOString(),
            wordCounts: legacyCounts
          };
          const books = [legacyEntry];
          saveVocabBooks(books);
          // Remove legacy key to finalize migration
          localStorage.removeItem(LEGACY_KEY);
          return books;
        }
      } catch (e) {
        console.error("Failed to parse legacy vocabulary counts during migration:", e);
      }
    }

    return [];
  } catch (err) {
    console.error("Failed to load vocabulary books from localStorage:", err);
    return [];
  }
}

/**
 * Save books to localStorage.
 */
export function saveVocabBooks(books: BookEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  } catch (err) {
    console.error("Failed to save vocabulary books to localStorage:", err);
  }
}

/**
 * Add a book's word counts to the database.
 */
export function addVocabBook(name: string, wordCounts: Record<string, number>): BookEntry[] {
  const books = loadVocabBooks();
  
  // Assign a unique ID using timestamp and random string
  const id = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const newBook: BookEntry = {
    id,
    name,
    addedAt: new Date().toISOString(),
    wordCounts
  };
  
  books.push(newBook);
  saveVocabBooks(books);
  return books;
}

/**
 * Delete a book from the database by ID.
 */
export function deleteVocabBook(id: string): BookEntry[] {
  const books = loadVocabBooks();
  const filtered = books.filter(b => b.id !== id);
  saveVocabBooks(filtered);
  return filtered;
}

/**
 * Reset/Clear the cumulative vocabulary database.
 */
export function clearVocabDb(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch (err) {
    console.error("Failed to clear vocabulary database:", err);
  }
}

/**
 * Aggregate word counts from all books.
 */
export function getAggregateCounts(books: BookEntry[]): Record<string, number> {
  const aggregate: Record<string, number> = {};
  for (const book of books) {
    for (const [word, count] of Object.entries(book.wordCounts)) {
      aggregate[word] = (aggregate[word] || 0) + count;
    }
  }
  return aggregate;
}

/**
 * Get stats of the vocabulary database.
 */
export function getVocabStats(counts: Record<string, number>) {
  const words = Object.keys(counts);
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  
  return {
    uniqueWords: words.length,
    totalOccurrences: total
  };
}

/**
 * Get a Set of words that have been seen at least `threshold` times.
 */
export function getExcludedWordSet(counts: Record<string, number>, threshold: number): Set<string> {
  const set = new Set<string>();
  for (const [word, count] of Object.entries(counts)) {
    if (count >= threshold) {
      set.add(word);
    }
  }
  return set;
}

/**
 * Export the vocabulary books database as a downloadable JSON file.
 */
export function exportVocabAsJson(books: BookEntry[]): void {
  try {
    const jsonStr = JSON.stringify(books, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `rubymarker_vocab_books_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Failed to export vocabulary backup:", err);
    alert("Failed to export vocabulary backup file.");
  }
}

/**
 * Import vocabulary database from a JSON string.
 * Supports both new BookEntry[] format and old flat Record<string, number> format.
 */
export function importVocabFromJson(
  jsonString: string, 
  overwrite: boolean = false
): BookEntry[] {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed) {
      throw new Error("Invalid backup format: Empty JSON.");
    }
    
    const importedBooks: BookEntry[] = [];
    
    if (Array.isArray(parsed)) {
      // Validate that it looks like BookEntry[]
      for (const item of parsed) {
        if (item && typeof item === 'object' && 'id' in item && 'name' in item && 'wordCounts' in item) {
          importedBooks.push({
            id: item.id || `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            name: item.name || 'Imported Book',
            addedAt: item.addedAt || new Date().toISOString(),
            wordCounts: item.wordCounts || {}
          });
        }
      }
    } else if (typeof parsed === 'object') {
      // Legacy flat counts format -> convert to a single legacy book entry
      const cleanedCounts: Record<string, number> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof key === 'string' && typeof value === 'number') {
          cleanedCounts[key] = value;
        }
      }
      if (Object.keys(cleanedCounts).length > 0) {
        importedBooks.push({
          id: `legacy_imported_${Date.now()}`,
          name: 'Imported flat backup',
          addedAt: new Date().toISOString(),
          wordCounts: cleanedCounts
        });
      }
    } else {
      throw new Error("Invalid backup format.");
    }
    
    if (overwrite) {
      saveVocabBooks(importedBooks);
      return importedBooks;
    } else {
      const current = loadVocabBooks();
      // To prevent ID collisions, assign new IDs to imported books
      const merged = current.concat(importedBooks.map(b => ({
        ...b,
        id: `${b.id}_merged_${Math.random().toString(36).substring(2, 11)}`
      })));
      saveVocabBooks(merged);
      return merged;
    }
  } catch (err: any) {
    console.error("Failed to import vocabulary backup:", err);
    throw new Error(err.message || "Failed to parse JSON backup file.");
  }
}

/**
 * Legacy compatibility: load vocab counts directly (aggregated).
 */
export function loadVocabCounts(): Record<string, number> {
  const books = loadVocabBooks();
  return getAggregateCounts(books);
}

/**
 * Legacy compatibility: clear counts directly.
 */
export function clearVocabCounts(): void {
  clearVocabDb();
}
