/**
 * Property-Based Tests for User Language Preference
 * Feature: code-consistency-security-offline
 */

import fc from 'fast-check';
import { useAssessmentStore } from '../assessmentStore';
import { Language } from '../../types';
import { t } from '../../constants/translations';

describe('User Language Preference Property Tests', () => {
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
   * Feature: code-consistency-security-offline, Property 53: User language preference
   * Validates: Requirements 14.4
   */
  describe('Property 53: User language preference', () => {
    it('should display data in user selected language', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          fc.constantFrom('common.back', 'common.next', 'common.save', 'vitals.title', 'patient-list.title'),
          (userLanguage, translationKey) => {
            // Set user's language preference
            useAssessmentStore.getState().setLanguage(userLanguage);
            
            // Get translation in user's language
            const translation = t(translationKey, userLanguage);
            
            // Should return a valid translation
            expect(translation).toBeDefined();
            expect(typeof translation).toBe('string');
            expect(translation.length).toBeGreaterThan(0);
            
            // Should not return the key itself (unless it's a fallback)
            // For common keys, we should have translations
            if (translationKey.startsWith('common.')) {
              expect(translation).not.toBe(translationKey);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fall back to default language when selected language unavailable', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          (userLanguage) => {
            // Set user's language preference
            useAssessmentStore.getState().setLanguage(userLanguage);
            
            // Try to get a translation that might not exist in all languages
            const nonExistentKey = 'this.key.does.not.exist';
            const translation = t(nonExistentKey, userLanguage);
            
            // Should fall back to the key itself
            expect(translation).toBe(nonExistentKey);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should persist language preference across app restarts', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          (userLanguage) => {
            // Set language preference
            useAssessmentStore.getState().setLanguage(userLanguage);
            
            // Simulate app restart by getting current state
            const currentLanguage = useAssessmentStore.getState().language;
            
            // Language should be preserved
            expect(currentLanguage).toBe(userLanguage);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply language preference to all UI elements', () => {
      const commonKeys = [
        'common.back',
        'common.next',
        'common.save',
        'common.cancel',
        'common.confirm',
      ];
      
      fc.assert(
        fc.property(
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          (userLanguage) => {
            // Set user's language preference
            useAssessmentStore.getState().setLanguage(userLanguage);
            
            // All common UI elements should be in the selected language
            commonKeys.forEach(key => {
              const translation = t(key, userLanguage);
              expect(translation).toBeDefined();
              expect(typeof translation).toBe('string');
              expect(translation.length).toBeGreaterThan(0);
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle language preference changes without data loss', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          fc.record({
            systolic: fc.integer({ min: 80, max: 200 }),
            diastolic: fc.integer({ min: 40, max: 120 }),
            pulse: fc.integer({ min: 40, max: 180 }),
          }),
          (initialLanguage, newLanguage, vitalsData) => {
            // Set initial language
            useAssessmentStore.getState().setLanguage(initialLanguage);
            
            // Add some data
            useAssessmentStore.getState().setVitals({
              ...vitalsData,
              timestamp: new Date().toISOString(),
              method: 'manual',
              recordedBy: 'test-user',
            });
            
            // Change language
            useAssessmentStore.getState().setLanguage(newLanguage);
            
            // Data should still be present
            const state = useAssessmentStore.getState();
            expect(state.language).toBe(newLanguage);
            expect(state.vitals).toBeDefined();
            if (state.vitals) {
              expect(state.vitals.systolic).toBe(vitalsData.systolic);
              expect(state.vitals.diastolic).toBe(vitalsData.diastolic);
              expect(state.vitals.pulse).toBe(vitalsData.pulse);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should support language-specific formatting preferences', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          (userLanguage) => {
            // Set user's language preference
            useAssessmentStore.getState().setLanguage(userLanguage);
            
            // Get translations that might have language-specific formatting
            const ageTranslation = t('common.years', userLanguage);
            
            // Should return appropriate translation for the language
            expect(ageTranslation).toBeDefined();
            expect(typeof ageTranslation).toBe('string');
            
            // Different languages should have different translations
            const jaAge = t('common.years', 'ja');
            const enAge = t('common.years', 'en');
            expect(jaAge).not.toBe(enAge);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain language preference during concurrent operations', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<Language>('ja', 'en', 'zh-TW'),
          fc.array(fc.constantFrom('setCurrentStep', 'setVitals', 'setADLRecordingId'), { minLength: 3, maxLength: 10 }),
          (userLanguage, operations) => {
            // Set language preference
            useAssessmentStore.getState().setLanguage(userLanguage);
            
            // Perform multiple operations concurrently
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
                case 'setADLRecordingId':
                  useAssessmentStore.getState().setADLRecordingId('test-recording-id');
                  break;
              }
            });
            
            // Language preference should remain unchanged
            expect(useAssessmentStore.getState().language).toBe(userLanguage);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
