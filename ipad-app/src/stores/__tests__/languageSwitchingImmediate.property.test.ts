/**
 * Property-Based Tests for Language Switching Immediacy
 * 
 * **Feature: backend-switching-settings, Property 5: Language switching immediacy**
 * **Validates: Requirements 3.2, 3.5**
 * 
 * Tests that language changes are applied immediately across both settings and assessment stores
 * without requiring app restart or navigation.
 */

import { renderHook, act } from '@testing-library/react-native';
import * as fc from 'fast-check';
import { useSettingsStore } from '../settingsStore';
import { useAssessmentStore } from '../assessmentStore';
import { Language } from '../../types/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { languageSyncService } from '../../services/languageSync';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('Language Switching Immediacy Property Tests', () => {
  beforeEach(() => {
    // Clear language sync listeners
    languageSyncService.clearListeners();
    
    // Re-add the assessment store listener
    languageSyncService.addListener((language: Language) => {
      useAssessmentStore.getState().setLanguage(language);
    });
    
    // Reset stores
    useSettingsStore.getState().resetToDefaults();
    useAssessmentStore.setState({ language: 'ja' });
    
    // Clear AsyncStorage mocks
    mockAsyncStorage.getItem.mockClear();
    mockAsyncStorage.setItem.mockClear();
    mockAsyncStorage.removeItem.mockClear();
    mockAsyncStorage.setItem.mockResolvedValue();
  });

  /**
   * Property 5: Language switching immediacy
   * For any language selection, all visible text should update immediately without requiring app restart or navigation
   */
  describe('Property 5: Language switching immediacy', () => {
    it('should update both settings and assessment stores immediately when language changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          async (initialLanguage, targetLanguage) => {
            // Skip if same language
            if (initialLanguage === targetLanguage) {
              return true;
            }

            // Set initial language in both stores
            useSettingsStore.setState({ currentLanguage: initialLanguage });
            useAssessmentStore.setState({ language: initialLanguage });

            // Verify initial state
            expect(useSettingsStore.getState().currentLanguage).toBe(initialLanguage);
            expect(useAssessmentStore.getState().language).toBe(initialLanguage);

            // Change language through settings store
            await useSettingsStore.getState().setLanguage(targetLanguage);

            // Both stores should be updated immediately
            expect(useSettingsStore.getState().currentLanguage).toBe(targetLanguage);
            expect(useAssessmentStore.getState().language).toBe(targetLanguage);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should persist language changes immediately to AsyncStorage', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          async (targetLanguage) => {
            // Change language
            await useSettingsStore.getState().setLanguage(targetLanguage);

            // AsyncStorage should be called to persist the change
            expect(mockAsyncStorage.setItem).toHaveBeenCalled();

            // Verify the persisted data contains the new language
            const setItemCalls = mockAsyncStorage.setItem.mock.calls;
            const lastCall = setItemCalls[setItemCalls.length - 1];
            
            if (lastCall && lastCall[1]) {
              const persistedData = JSON.parse(lastCall[1]);
              expect(persistedData.currentLanguage).toBe(targetLanguage);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle rapid language switching without race conditions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom<Language>('ja', 'en', 'zh-TW'), { minLength: 2, maxLength: 5 }),
          async (languageSequence) => {
            // Rapidly switch through languages
            for (const language of languageSequence) {
              await useSettingsStore.getState().setLanguage(language);
            }

            // Final state should match the last language in sequence
            const finalLanguage = languageSequence[languageSequence.length - 1];
            expect(useSettingsStore.getState().currentLanguage).toBe(finalLanguage);
            expect(useAssessmentStore.getState().language).toBe(finalLanguage);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain language consistency across store resets', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          async (targetLanguage) => {
            // Set language
            await useSettingsStore.getState().setLanguage(targetLanguage);

            // Simulate app restart by loading settings
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({
              currentServerId: 'mac-mini',
              currentLanguage: targetLanguage,
              serverHistory: [],
              preferences: {
                autoSwitchOnFailure: false,
                showServerIndicator: true,
                confirmServerSwitches: true
              }
            }));

            await useSettingsStore.getState().loadSettings();

            // Language should be restored in both stores
            expect(useSettingsStore.getState().currentLanguage).toBe(targetLanguage);
            expect(useAssessmentStore.getState().language).toBe(targetLanguage);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid languages without affecting current state', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          fc.string().filter(s => !['ja', 'en', 'zh-TW'].includes(s)),
          async (validLanguage, invalidLanguage) => {
            // Set valid initial language
            await useSettingsStore.getState().setLanguage(validLanguage);

            // Try to set invalid language
            await useSettingsStore.getState().setLanguage(invalidLanguage as Language);

            // Should maintain valid language
            expect(useSettingsStore.getState().currentLanguage).toBe(validLanguage);
            expect(useAssessmentStore.getState().language).toBe(validLanguage);

            // Should have error message
            expect(useSettingsStore.getState().lastError).toContain('Invalid language');

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle concurrent language changes gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          async (language1, language2) => {
            // Skip if same language
            if (language1 === language2) {
              return true;
            }

            // Start concurrent language changes
            const promise1 = useSettingsStore.getState().setLanguage(language1);
            const promise2 = useSettingsStore.getState().setLanguage(language2);

            await Promise.all([promise1, promise2]);

            // Final state should be one of the two languages (last one wins)
            const finalLanguage = useSettingsStore.getState().currentLanguage;
            expect([language1, language2]).toContain(finalLanguage);

            // Both stores should be consistent
            expect(useAssessmentStore.getState().language).toBe(finalLanguage);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});