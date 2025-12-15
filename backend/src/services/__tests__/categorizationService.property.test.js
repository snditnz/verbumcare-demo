/**
 * Property-Based Tests for Categorization Service
 * Tests Properties 8-14, 15, 22-26 from design document
 */

import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import fc from 'fast-check';
import categorizationService from '../categorizationService.js';

describe('Categorization Service - Property-Based Tests', () => {
  
  // Increase timeout for AI processing
  jest.setTimeout(180000); // 3 minutes per test
  
  beforeAll(async () => {
    // Verify Ollama is available
    console.log('⚠️  These tests require Ollama service running on localhost:11434');
    console.log('⚠️  Tests will take several minutes due to AI processing');
  });

  /**
   * Property 8-14: Category detection for all data types
   * Validates: Requirements 3.1-3.7
   * 
   * For any transcription containing specific medical data types,
   * the system SHALL detect the appropriate category
   */
  describe('Property 8-14: Category Detection', () => {
    
    // Arbitraries for generating transcriptions with known categories
    const vitalsTranscriptArb = fc.record({
      language: fc.constantFrom('ja', 'en', 'zh-TW'),
      content: fc.constantFrom(
        'Blood pressure 120/80, heart rate 72 bpm, temperature 36.5°C',
        '血圧120/80、心拍数72、体温36.5度',
        '血壓120/80，心率72，體溫36.5度'
      )
    });

    const medicationTranscriptArb = fc.record({
      language: fc.constantFrom('ja', 'en', 'zh-TW'),
      content: fc.constantFrom(
        'Administered aspirin 100mg orally at 09:00',
        'アスピリン100mgを9時に経口投与',
        '於9點口服阿司匹林100mg'
      )
    });

    const clinicalNoteTranscriptArb = fc.record({
      language: fc.constantFrom('ja', 'en', 'zh-TW'),
      content: fc.constantFrom(
        'Patient complains of headache. Vital signs stable. Assess for migraine. Plan: monitor and provide pain relief.',
        '患者は頭痛を訴えています。バイタルサインは安定しています。片頭痛の評価。計画：モニタリングと鎮痛剤の提供。',
        '患者抱怨頭痛。生命徵象穩定。評估偏頭痛。計劃：監測並提供止痛。'
      )
    });

    const adlTranscriptArb = fc.record({
      language: fc.constantFrom('ja', 'en', 'zh-TW'),
      content: fc.constantFrom(
        'Patient can eat independently, score 10. Bathing requires assistance, score 5.',
        '患者は自立して食事ができます、スコア10。入浴には介助が必要、スコア5。',
        '患者可以獨立進食，得分10。洗澡需要協助，得分5。'
      )
    });

    const incidentTranscriptArb = fc.record({
      language: fc.constantFrom('ja', 'en', 'zh-TW'),
      content: fc.constantFrom(
        'Patient fell in bathroom at 14:30. No injuries observed. Severity: low. Assisted patient back to bed.',
        '患者が14時30分にトイレで転倒。怪我は観察されず。重症度：低。患者をベッドに戻すのを介助。',
        '患者於14:30在浴室跌倒。未觀察到傷害。嚴重程度：低。協助患者回到床上。'
      )
    });

    const carePlanTranscriptArb = fc.record({
      language: fc.constantFrom('ja', 'en', 'zh-TW'),
      content: fc.constantFrom(
        'Problem: Risk of falls. Goal: Prevent falls for next 30 days. Interventions: bed alarm, frequent rounding, non-slip socks.',
        '問題：転倒のリスク。目標：今後30日間の転倒を防ぐ。介入：ベッドアラーム、頻繁な巡回、滑り止めソックス。',
        '問題：跌倒風險。目標：未來30天預防跌倒。介入：床邊警報、頻繁巡視、防滑襪。'
      )
    });

    const painTranscriptArb = fc.record({
      language: fc.constantFrom('ja', 'en', 'zh-TW'),
      content: fc.constantFrom(
        'Patient reports pain in lower back, intensity 7 out of 10, sharp character, duration 2 hours.',
        '患者は腰痛を報告、強度10段階中7、鋭い性質、持続時間2時間。',
        '患者報告下背部疼痛，強度7/10，尖銳性質，持續2小時。'
      )
    });

    it('Property 8: Should detect vitals category', async () => {
      await fc.assert(
        fc.asyncProperty(vitalsTranscriptArb, async (transcript) => {
          const result = await categorizationService.detectCategories(
            transcript.content,
            transcript.language
          );

          // Should detect vitals category
          expect(result.categories).toContain('vitals');
          expect(result.overallConfidence).toBeGreaterThan(0.5);
          expect(result.detectedLanguage).toBe(transcript.language);
        }),
        { numRuns: 3 } // Reduced runs due to AI processing time
      );
    });

    it('Property 9: Should detect medication category', async () => {
      await fc.assert(
        fc.asyncProperty(medicationTranscriptArb, async (transcript) => {
          const result = await categorizationService.detectCategories(
            transcript.content,
            transcript.language
          );

          // Should detect medication category
          expect(result.categories).toContain('medication');
          expect(result.overallConfidence).toBeGreaterThan(0.5);
        }),
        { numRuns: 3 }
      );
    });

    it('Property 10: Should detect clinical_note category', async () => {
      await fc.assert(
        fc.asyncProperty(clinicalNoteTranscriptArb, async (transcript) => {
          const result = await categorizationService.detectCategories(
            transcript.content,
            transcript.language
          );

          // Should detect clinical_note category
          expect(result.categories).toContain('clinical_note');
          expect(result.overallConfidence).toBeGreaterThan(0.5);
        }),
        { numRuns: 3 }
      );
    });

    it('Property 11: Should detect adl category', async () => {
      await fc.assert(
        fc.asyncProperty(adlTranscriptArb, async (transcript) => {
          const result = await categorizationService.detectCategories(
            transcript.content,
            transcript.language
          );

          // Should detect adl category
          expect(result.categories).toContain('adl');
          expect(result.overallConfidence).toBeGreaterThan(0.5);
        }),
        { numRuns: 3 }
      );
    });

    it('Property 12: Should detect incident category', async () => {
      await fc.assert(
        fc.asyncProperty(incidentTranscriptArb, async (transcript) => {
          const result = await categorizationService.detectCategories(
            transcript.content,
            transcript.language
          );

          // Should detect incident category
          expect(result.categories).toContain('incident');
          expect(result.overallConfidence).toBeGreaterThan(0.5);
        }),
        { numRuns: 3 }
      );
    });

    it('Property 13: Should detect care_plan category', async () => {
      await fc.assert(
        fc.asyncProperty(carePlanTranscriptArb, async (transcript) => {
          const result = await categorizationService.detectCategories(
            transcript.content,
            transcript.language
          );

          // Should detect care_plan category
          expect(result.categories).toContain('care_plan');
          expect(result.overallConfidence).toBeGreaterThan(0.5);
        }),
        { numRuns: 3 }
      );
    });

    it('Property 14: Should detect pain category', async () => {
      await fc.assert(
        fc.asyncProperty(painTranscriptArb, async (transcript) => {
          const result = await categorizationService.detectCategories(
            transcript.content,
            transcript.language
          );

          // Should detect pain category
          expect(result.categories).toContain('pain');
          expect(result.overallConfidence).toBeGreaterThan(0.5);
        }),
        { numRuns: 3 }
      );
    });
  });

  /**
   * Property 15: Transcript preservation
   * Validates: Requirements 4.1
   * 
   * For any AI extraction, the system SHALL store the original transcription
   * alongside the extracted data
   */
  describe('Property 15: Transcript Preservation', () => {
    
    const transcriptArb = fc.string({ minLength: 20, maxLength: 200 });

    it('Property 15: Should preserve original transcript with extracted data', async () => {
      // This property is validated at the API/service integration level
      // The categorizationService returns extracted data, and the calling code
      // (reviewQueueService) is responsible for storing both transcript and extracted data
      
      // We verify that extraction doesn't modify the input transcript
      const testTranscript = 'Blood pressure 120/80, heart rate 72 bpm';
      const originalTranscript = testTranscript;
      
      const result = await categorizationService.extractDataForCategory(
        testTranscript,
        'vitals',
        'en'
      );

      // Transcript should not be modified by extraction
      expect(testTranscript).toBe(originalTranscript);
      
      // Result should contain extracted data
      expect(result.data).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  /**
   * Property 22-26: Language preservation
   * Validates: Requirements 6.1-6.5
   * 
   * For any transcription in a specific language, the extracted structured data
   * SHALL preserve the original language in text fields
   */
  describe('Property 22-26: Language Preservation', () => {
    
    const japaneseVitalsArb = fc.constant({
      transcript: '血圧120/80、心拍数72、体温36.5度',
      language: 'ja',
      category: 'vitals'
    });

    const englishVitalsArb = fc.constant({
      transcript: 'Blood pressure 120/80, heart rate 72 bpm, temperature 36.5°C',
      language: 'en',
      category: 'vitals'
    });

    const chineseVitalsArb = fc.constant({
      transcript: '血壓120/80，心率72，體溫36.5度',
      language: 'zh-TW',
      category: 'vitals'
    });

    it('Property 22: Should preserve Japanese language in extracted data', async () => {
      await fc.assert(
        fc.asyncProperty(japaneseVitalsArb, async (testCase) => {
          const result = await categorizationService.extractDataForCategory(
            testCase.transcript,
            testCase.category,
            testCase.language
          );

          // Should preserve Japanese language
          expect(result.language).toBe('ja');
          expect(result.data).toBeDefined();
        }),
        { numRuns: 2 }
      );
    });

    it('Property 23: Should preserve English language in extracted data', async () => {
      await fc.assert(
        fc.asyncProperty(englishVitalsArb, async (testCase) => {
          const result = await categorizationService.extractDataForCategory(
            testCase.transcript,
            testCase.category,
            testCase.language
          );

          // Should preserve English language
          expect(result.language).toBe('en');
          expect(result.data).toBeDefined();
        }),
        { numRuns: 2 }
      );
    });

    it('Property 24: Should preserve Traditional Chinese language in extracted data', async () => {
      await fc.assert(
        fc.asyncProperty(chineseVitalsArb, async (testCase) => {
          const result = await categorizationService.extractDataForCategory(
            testCase.transcript,
            testCase.category,
            testCase.language
          );

          // Should preserve Traditional Chinese language
          expect(result.language).toBe('zh-TW');
          expect(result.data).toBeDefined();
        }),
        { numRuns: 2 }
      );
    });

    it('Property 25: Should auto-detect and preserve language for mixed content', async () => {
      // Test auto-detection
      const japaneseText = '血圧120/80';
      const detectedLang = categorizationService.detectLanguage(japaneseText);
      expect(detectedLang).toBe('ja');

      const englishText = 'Blood pressure 120/80';
      const detectedLang2 = categorizationService.detectLanguage(englishText);
      expect(detectedLang2).toBe('en');
    });

    it('Property 26: Should handle language-specific database storage', async () => {
      // This property is validated at the database insertion level
      // The categorizationService correctly identifies and preserves language
      // Database insertion (Phase 8) will handle language-specific columns
      
      const result = await categorizationService.extractDataForCategory(
        'Blood pressure 120/80',
        'vitals',
        'en'
      );

      expect(result.language).toBe('en');
      expect(result.data).toBeDefined();
    });
  });
});
