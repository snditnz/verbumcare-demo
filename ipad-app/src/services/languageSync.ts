/**
 * Language Synchronization Service
 * 
 * Provides a centralized way to synchronize language changes between stores
 * without creating circular dependencies.
 */

import { Language } from '../types/app';

type LanguageChangeListener = (language: Language) => void;

class LanguageSyncService {
  private listeners: Set<LanguageChangeListener> = new Set();

  /**
   * Register a listener for language changes
   */
  addListener(listener: LanguageChangeListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove a language change listener
   */
  removeListener(listener: LanguageChangeListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of a language change
   */
  notifyLanguageChange(language: Language): void {
    this.listeners.forEach(listener => {
      try {
        listener(language);
      } catch (error) {
        console.warn('Language sync listener error:', error);
      }
    });
  }

  /**
   * Clear all listeners (useful for testing)
   */
  clearListeners(): void {
    this.listeners.clear();
  }
}

export const languageSyncService = new LanguageSyncService();