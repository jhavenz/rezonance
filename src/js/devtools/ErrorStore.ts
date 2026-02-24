import { ulid } from 'ulid';
import type { ErrorEntry } from './types';

type ErrorListener = (errors: ErrorEntry[]) => void;

class ErrorStore {
  private errors: ErrorEntry[] = [];
  private listeners: Set<ErrorListener> = new Set();
  private readonly MAX_ERRORS = 50;
  private readonly STORAGE_KEY = 'resonance:errors';

  constructor() {
    this.loadFromStorage();
  }

  add(entry: Omit<ErrorEntry, 'id' | 'timestamp' | 'read'>): void {
    const newError: ErrorEntry = {
      ...entry,
      id: ulid(),
      timestamp: Date.now(),
      read: false,
    };

    // Add to beginning (newest first)
    this.errors.unshift(newError);

    // Enforce max limit (FIFO)
    if (this.errors.length > this.MAX_ERRORS) {
      this.errors = this.errors.slice(0, this.MAX_ERRORS);
    }

    this.saveToStorage();
    this.notifyListeners();
  }

  getAll(): ErrorEntry[] {
    return [...this.errors];
  }

  getUnread(): ErrorEntry[] {
    return this.errors.filter((error) => !error.read);
  }

  markRead(id: string): void {
    const error = this.errors.find((e) => e.id === id);
    if (error && !error.read) {
      error.read = true;
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  clear(): void {
    this.errors = [];
    this.saveToStorage();
    this.notifyListeners();
  }

  clearError(id: string): void {
    const index = this.errors.findIndex((e) => e.id === id);
    if (index !== -1) {
      this.errors.splice(index, 1);
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  subscribe(listener: ErrorListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Validate basic structure
          this.errors = parsed.filter(
            (item): item is ErrorEntry =>
              typeof item === 'object' &&
              item !== null &&
              typeof item.id === 'string' &&
              typeof item.timestamp === 'number' &&
              (item.type === 'error' || item.type === 'debug') &&
              typeof item.html === 'string' &&
              typeof item.read === 'boolean'
          );
        }
      }
    } catch (error) {
      console.error('[ErrorStore] Failed to load from localStorage:', error);
      this.errors = [];
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.errors));
    } catch (error) {
      console.error('[ErrorStore] Failed to save to localStorage:', error);
    }
  }

  private notifyListeners(): void {
    const errorsCopy = this.getAll();
    this.listeners.forEach((listener) => {
      try {
        listener(errorsCopy);
      } catch (error) {
        console.error('[ErrorStore] Listener error:', error);
      }
    });
  }
}

// Singleton instance
export const errorStore = new ErrorStore();
export { ErrorStore };
