/**
 * Property-Based Tests for Language Switching
 * Feature: code-consistency-security-offline
 */

import fc from 'fast-check';
import { useAssessmentStore } from '../assessmentStore';
import { Language } from '../../types';
import { t } from '../../constants/translations';

describe('Language Switching Property Tests', () => {
  beforeEach(() => {
    // Reset the store before each test
    useAssessmentStore.setState({
      language: 'ja',
      currentPatient: null,
      currentStep: 'patient-list',
      vitals: null,
      adlRecordingId: null,
      adlProcessedData: null,
      incidentPhotos: [],
      barthelIndex: null,
      startedAt: null,
      patientSessions: {},
      originalPatientData: {},
      _hasHydrated: true,
      sessionVitals: null,
      sessionMedications: [],
      sessionPatientUpdates: null,
      sessionIncidents: [],
      sessionBarthelIndex: null,
      sessionPainAssessment: null,
      sessionFallRiskAssessment: null,
      sessionKihonChecklist: null,
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 51: Language switching updates UI
   * Validates: Requirements 14.2
   */
  describe('Property 51: Language switching updates UI', () => {
    it('should update language state immediately when setLanguage is called', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          (initialLang, newLang) => {
            // Set initial language
            useAssessmentStore.getState().setLanguage(initialLang);
            expect(useAssessmentStore.getState().language).toBe(initialLang);
            
            // Switch to new language
            useAssessmentStore.getState().setLanguage(newLang);
            
            // Language should update immediately
            expect(useAssessmentStore.getState().language).toBe(newLang);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return different translations for different languages', () => {
      const testKey = 'common.back';
      
      fc.assert(
        fc.property(
          fc.constantFrom<Language>('ja', 'en'),
          (language) => {
            useAssessmentStore.getState().setLanguage(language);
            const translation = t(testKey, language);
            
            // Should return a valid translation
            expect(translation).toBeDefined();
            expect(typeof translation).toBe('string');
            expect(translation.length).toBeGreaterThan(0);
            
            // Japanese and English should have different translations
            const jaTranslation = t(testKey, 'ja');
            const enTranslation = t(testKey, 'en');
            expect(jaTranslation).not.toBe(enTranslation);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain language preference across multiple operations', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          fc.array(fc.constantFrom('setCurrentStep', 'setVitals', 'addMedication'), { minLength: 1, maxLength: 5 }),
          (language, operations) => {
            // Set language
            useAssessmentStore.getState().setLanguage(language);
            
            // Perform various operations
            operations.forEach(op => {
              switch (op) {
                case 'setCurrentStep':
                  useAssessmentStore.getState().setCurrentStep('vitals-capture');
                  break;
                case 'setVitals':
                  useAssessmentStore.getState().setVitals({
                    systolic: 120,
                    diastolic: 80,
                    pulse: 72,
                    timestamp: new Date().toISOString(),
                    method: 'ble',
                    recordedBy: 'test-user',
                  });
                  break;
                case 'addMedication':
                  // Skip if no patient
                  break;
              }
            });
            
            // Language should remain unchanged
            expect(useAssessmentStore.getState().language).toBe(language);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should support all three languages without errors', () => {
      const supportedLanguages: Language[] = ['ja', 'en', 'zh-TW'];
      
      supportedLanguages.forEach(lang => {
        // Should not throw when setting language
        expect(() => {
          useAssessmentStore.getState().setLanguage(lang);
        }).not.toThrow();
        
        // Should update state correctly
        expect(useAssessmentStore.getState().language).toBe(lang);
        
        // Should be able to get translations
        const translation = t('common.back', lang);
        expect(translation).toBeDefined();
        expect(typeof translation).toBe('string');
      });
    });

    it('should handle rapid language switching', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom<Language>('ja', 'en', 'zh-TW'), { minLength: 5, maxLength: 20 }),
          (languages) => {
            // Rapidly switch languages
            languages.forEach(lang => {
              useAssessmentStore.getState().setLanguage(lang);
            });
            
            // Final language should be the last one in the array
            const finalLanguage = languages[languages.length - 1];
            expect(useAssessmentStore.getState().language).toBe(finalLanguage);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
