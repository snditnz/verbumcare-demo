/**
 * Property-Based Tests for Multilingual Data Preservation
 * Feature: code-consistency-security-offline
 */

import fc from 'fast-check';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language } from '../../types';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
  multiRemove: jest.fn(),
}));

describe('Multilingual Data Preservation Property Tests', () => {
  let storage: Map<string, string>;

  beforeEach(async () => {
    // Create a fresh storage map for each test
    storage = new Map<string, string>();
    
    // Setup AsyncStorage mock to use our map
    (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    });
    
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      return Promise.resolve(storage.get(key) || null);
    });
    
    (AsyncStorage.removeItem as jest.Mock).mockImplementation((key: string) => {
      storage.delete(key);
      return Promise.resolve();
    });
    
    (AsyncStorage.clear as jest.Mock).mockImplementation(() => {
      storage.clear();
      return Promise.resolve();
    });
    
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(Array.from(storage.keys()));
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  /**
   * Feature: code-consistency-security-offline, Property 52: Multilingual data preservation
   * Validates: Requirements 14.3
   */
  describe('Property 52: Multilingual data preservation', () => {
    it('should preserve data with multiple language versions through storage round trip', () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            name_ja: fc.string({ minLength: 1, maxLength: 50 }),
            name_en: fc.string({ minLength: 1, maxLength: 50 }),
            name_zh_tw: fc.string({ minLength: 1, maxLength: 50 }),
            description_ja: fc.string({ minLength: 1, maxLength: 200 }),
            description_en: fc.string({ minLength: 1, maxLength: 200 }),
            description_zh_tw: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          async (multilingualData) => {
            // Store multilingual data
            const key = `test_multilingual_${multilingualData.id}`;
            await AsyncStorage.setItem(key, JSON.stringify(multilingualData));
            
            // Retrieve data
            const retrieved = await AsyncStorage.getItem(key);
            expect(retrieved).not.toBeNull();
            
            const parsedData = JSON.parse(retrieved!);
            
            // All language versions should be preserved
            expect(parsedData.name_ja).toBe(multilingualData.name_ja);
            expect(parsedData.name_en).toBe(multilingualData.name_en);
            expect(parsedData.name_zh_tw).toBe(multilingualData.name_zh_tw);
            expect(parsedData.description_ja).toBe(multilingualData.description_ja);
            expect(parsedData.description_en).toBe(multilingualData.description_en);
            expect(parsedData.description_zh_tw).toBe(multilingualData.description_zh_tw);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve multilingual arrays without data loss', () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.uuid(),
              label_ja: fc.string({ minLength: 1, maxLength: 30 }),
              label_en: fc.string({ minLength: 1, maxLength: 30 }),
              label_zh_tw: fc.string({ minLength: 1, maxLength: 30 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (multilingualArray) => {
            // Store array
            const key = 'test_multilingual_array';
            await AsyncStorage.setItem(key, JSON.stringify(multilingualArray));
            
            // Retrieve array
            const retrieved = await AsyncStorage.getItem(key);
            expect(retrieved).not.toBeNull();
            
            const parsedArray = JSON.parse(retrieved!);
            
            // Array length should be preserved
            expect(parsedArray.length).toBe(multilingualArray.length);
            
            // Each item should have all language versions
            parsedArray.forEach((item: any, index: number) => {
              expect(item.label_ja).toBe(multilingualArray[index].label_ja);
              expect(item.label_en).toBe(multilingualArray[index].label_en);
              expect(item.label_zh_tw).toBe(multilingualArray[index].label_zh_tw);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle missing language versions gracefully', () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            name_ja: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
            name_en: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
            name_zh_tw: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
          }),
          async (partialData) => {
            // Store data with potentially missing language versions
            const key = `test_partial_${partialData.id}`;
            await AsyncStorage.setItem(key, JSON.stringify(partialData));
            
            // Retrieve data
            const retrieved = await AsyncStorage.getItem(key);
            expect(retrieved).not.toBeNull();
            
            const parsedData = JSON.parse(retrieved!);
            
            // All fields should be preserved, including null values
            expect(parsedData.name_ja).toBe(partialData.name_ja);
            expect(parsedData.name_en).toBe(partialData.name_en);
            expect(parsedData.name_zh_tw).toBe(partialData.name_zh_tw);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve multilingual data in nested structures', () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            patient: fc.record({
              id: fc.uuid(),
              name_ja: fc.string({ minLength: 1, maxLength: 50 }),
              name_en: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            carePlan: fc.record({
              id: fc.uuid(),
              title_ja: fc.string({ minLength: 1, maxLength: 100 }),
              title_en: fc.string({ minLength: 1, maxLength: 100 }),
              problems: fc.array(
                fc.record({
                  description_ja: fc.string({ minLength: 1, maxLength: 200 }),
                  description_en: fc.string({ minLength: 1, maxLength: 200 }),
                }),
                { minLength: 1, maxLength: 5 }
              ),
            }),
          }),
          async (nestedData) => {
            // Store nested multilingual data
            const key = 'test_nested_multilingual';
            await AsyncStorage.setItem(key, JSON.stringify(nestedData));
            
            // Retrieve data
            const retrieved = await AsyncStorage.getItem(key);
            expect(retrieved).not.toBeNull();
            
            const parsedData = JSON.parse(retrieved!);
            
            // Patient multilingual fields should be preserved
            expect(parsedData.patient.name_ja).toBe(nestedData.patient.name_ja);
            expect(parsedData.patient.name_en).toBe(nestedData.patient.name_en);
            
            // Care plan multilingual fields should be preserved
            expect(parsedData.carePlan.title_ja).toBe(nestedData.carePlan.title_ja);
            expect(parsedData.carePlan.title_en).toBe(nestedData.carePlan.title_en);
            
            // Nested array multilingual fields should be preserved
            expect(parsedData.carePlan.problems.length).toBe(nestedData.carePlan.problems.length);
            parsedData.carePlan.problems.forEach((problem: any, index: number) => {
              expect(problem.description_ja).toBe(nestedData.carePlan.problems[index].description_ja);
              expect(problem.description_en).toBe(nestedData.carePlan.problems[index].description_en);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve special characters in multilingual data', () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            // Japanese with kanji, hiragana, katakana
            text_ja: fc.string({ minLength: 1, maxLength: 100 }),
            // English with special characters
            text_en: fc.string({ minLength: 1, maxLength: 100 }),
            // Chinese with traditional characters
            text_zh_tw: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          async (specialCharData) => {
            // Store data with special characters
            const key = `test_special_${specialCharData.id}`;
            await AsyncStorage.setItem(key, JSON.stringify(specialCharData));
            
            // Retrieve data
            const retrieved = await AsyncStorage.getItem(key);
            expect(retrieved).not.toBeNull();
            
            const parsedData = JSON.parse(retrieved!);
            
            // Special characters should be preserved exactly
            expect(parsedData.text_ja).toBe(specialCharData.text_ja);
            expect(parsedData.text_en).toBe(specialCharData.text_en);
            expect(parsedData.text_zh_tw).toBe(specialCharData.text_zh_tw);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
