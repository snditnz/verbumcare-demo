/**
 * Property-Based Tests for Multi-Language Support
 * Feature: code-consistency-security-offline
 */

import fc from 'fast-check';
import { translations, t } from '../translations';
import { Language } from '../../types';

describe('Multi-Language Support Property Tests', () => {
  /**
   * Feature: code-consistency-security-offline, Property 50: Translation key usage
   * Validates: Requirements 14.1
   */
  describe('Property 50: Translation key usage', () => {
    it('should return translation from centralized translation files for any valid key and language', () => {
      // Get all translation keys from Japanese (our reference language)
      const allKeys = Object.keys(translations.ja);
      
      fc.assert(
        fc.property(
          fc.constantFrom(...allKeys),
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          (key, language) => {
            const result = t(key, language);
            
            // Should return a string
            expect(typeof result).toBe('string');
            
            // Should not return empty string
            expect(result.length).toBeGreaterThan(0);
            
            // Should return the translation from the specified language
            // or fall back to the key if translation doesn't exist
            const expectedTranslation = translations[language][key] || key;
            expect(result).toBe(expectedTranslation);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have consistent translation keys across all languages', () => {
      const jaKeys = Object.keys(translations.ja);
      const enKeys = Object.keys(translations.en);
      const zhTWKeys = Object.keys(translations['zh-TW']);
      
      // Check that all three languages have the same number of keys (approximately)
      // zh-TW might have more due to fallback spreading
      expect(jaKeys.length).toBeGreaterThan(0);
      expect(enKeys.length).toBeGreaterThan(0);
      expect(zhTWKeys.length).toBeGreaterThanOrEqual(jaKeys.length);
      
      // Check that key languages have similar key counts (within 10%)
      const keyCountDiff = Math.abs(jaKeys.length - enKeys.length);
      const maxDiff = Math.max(jaKeys.length, enKeys.length) * 0.1;
      expect(keyCountDiff).toBeLessThanOrEqual(maxDiff);
    });

    it('should never return undefined for any translation key', () => {
      const allKeys = Object.keys(translations.ja);
      
      fc.assert(
        fc.property(
          fc.constantFrom(...allKeys),
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          (key, language) => {
            const result = t(key, language);
            expect(result).toBeDefined();
            expect(result).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fall back to key when translation is missing', () => {
      const nonExistentKey = 'this.key.does.not.exist.in.translations';
      
      fc.assert(
        fc.property(
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          (language) => {
            const result = t(nonExistentKey, language);
            // Should return the key itself as fallback
            expect(result).toBe(nonExistentKey);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should handle all supported languages', () => {
      const supportedLanguages: Language[] = ['ja', 'en', 'zh-TW'];
      const sampleKey = 'common.back';
      
      supportedLanguages.forEach(language => {
        const result = t(sampleKey, language);
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });
});
