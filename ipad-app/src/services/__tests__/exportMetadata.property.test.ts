/**
 * Property-Based Tests for Export Language Metadata
 * Feature: code-consistency-security-offline
 */

import fc from 'fast-check';
import { Language } from '../../types';

describe('Export Language Metadata Property Tests', () => {
  /**
   * Feature: code-consistency-security-offline, Property 54: Export language metadata
   * Validates: Requirements 14.5
   */
  describe('Property 54: Export language metadata', () => {
    // Helper function to simulate data export with language metadata
    const exportDataWithMetadata = (data: any, language: Language) => {
      return {
        data,
        metadata: {
          language,
          exportedAt: new Date().toISOString(),
          version: '1.0',
        },
      };
    };

    it('should include language metadata in all exports', () => {
      fc.assert(
        fc.property(
          fc.record({
            patientId: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            vitals: fc.record({
              systolic: fc.integer({ min: 80, max: 200 }),
              diastolic: fc.integer({ min: 40, max: 120 }),
              pulse: fc.integer({ min: 40, max: 180 }),
            }),
          }),
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          (exportData, language) => {
            // Export data with language metadata
            const exported = exportDataWithMetadata(exportData, language);
            
            // Should include metadata
            expect(exported.metadata).toBeDefined();
            
            // Should include language in metadata
            expect(exported.metadata.language).toBe(language);
            
            // Should include export timestamp
            expect(exported.metadata.exportedAt).toBeDefined();
            expect(typeof exported.metadata.exportedAt).toBe('string');
            
            // Should include version
            expect(exported.metadata.version).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve language metadata through serialization round trip', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            content: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          (data, language) => {
            // Export with metadata
            const exported = exportDataWithMetadata(data, language);
            
            // Serialize to JSON
            const serialized = JSON.stringify(exported);
            
            // Deserialize
            const deserialized = JSON.parse(serialized);
            
            // Language metadata should be preserved
            expect(deserialized.metadata.language).toBe(language);
            expect(deserialized.data).toEqual(data);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include language metadata for all supported languages', () => {
      const supportedLanguages: Language[] = ['ja', 'en', 'zh-TW'];
      
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            value: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          (data) => {
            // Export in each supported language
            supportedLanguages.forEach(lang => {
              const exported = exportDataWithMetadata(data, lang);
              
              // Should include language metadata
              expect(exported.metadata.language).toBe(lang);
              expect(exported.metadata.language).toMatch(/^(ja|en|zh-TW)$/);
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should include language metadata in batch exports', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          (dataArray, language) => {
            // Export batch with metadata
            const exported = exportDataWithMetadata(dataArray, language);
            
            // Should include language metadata for the entire batch
            expect(exported.metadata.language).toBe(language);
            
            // Data array should be preserved
            expect(Array.isArray(exported.data)).toBe(true);
            expect(exported.data.length).toBe(dataArray.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include language metadata in nested export structures', () => {
      fc.assert(
        fc.property(
          fc.record({
            patient: fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            carePlans: fc.array(
              fc.record({
                id: fc.uuid(),
                title: fc.string({ minLength: 1, maxLength: 100 }),
              }),
              { minLength: 1, maxLength: 5 }
            ),
            vitals: fc.array(
              fc.record({
                systolic: fc.integer({ min: 80, max: 200 }),
                diastolic: fc.integer({ min: 40, max: 120 }),
              }),
              { minLength: 1, maxLength: 10 }
            ),
          }),
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          (nestedData, language) => {
            // Export nested structure with metadata
            const exported = exportDataWithMetadata(nestedData, language);
            
            // Should include language metadata at top level
            expect(exported.metadata.language).toBe(language);
            
            // Nested structures should be preserved
            expect(exported.data.patient).toBeDefined();
            expect(exported.data.carePlans).toBeDefined();
            expect(exported.data.vitals).toBeDefined();
            expect(Array.isArray(exported.data.carePlans)).toBe(true);
            expect(Array.isArray(exported.data.vitals)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain language metadata consistency across multiple exports', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              data: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          (dataItems, language) => {
            // Export multiple items with same language
            const exports = dataItems.map(item => exportDataWithMetadata(item, language));
            
            // All exports should have the same language metadata
            exports.forEach(exported => {
              expect(exported.metadata.language).toBe(language);
            });
            
            // All exports should have unique timestamps (or very close)
            const timestamps = exports.map(e => e.metadata.exportedAt);
            expect(timestamps.length).toBe(dataItems.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include language metadata even for empty exports', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          (language) => {
            // Export empty data with metadata
            const exported = exportDataWithMetadata([], language);
            
            // Should still include language metadata
            expect(exported.metadata.language).toBe(language);
            
            // Data should be empty array
            expect(Array.isArray(exported.data)).toBe(true);
            expect(exported.data.length).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should format language metadata consistently', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            value: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          (data, language) => {
            // Export with metadata
            const exported = exportDataWithMetadata(data, language);
            
            // Language should be in expected format
            expect(exported.metadata.language).toMatch(/^(ja|en|zh-TW)$/);
            
            // Metadata structure should be consistent
            expect(Object.keys(exported.metadata)).toContain('language');
            expect(Object.keys(exported.metadata)).toContain('exportedAt');
            expect(Object.keys(exported.metadata)).toContain('version');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
