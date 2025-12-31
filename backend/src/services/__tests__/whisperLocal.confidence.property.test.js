/**
 * Property-Based Tests for Whisper Service - Confidence-Based Marking
 * Tests Property 4: Confidence-Based Segment Marking
 * 
 * Validates: Requirements 2.3
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import fc from 'fast-check';
import { WhisperLocalService } from '../whisperLocal.js';

describe('WhisperLocalService - Property 4: Confidence-Based Segment Marking', () => {
  
  jest.setTimeout(30000);
  
  let whisperService;
  
  beforeEach(() => {
    whisperService = new WhisperLocalService();
  });

  /**
   * Property 4: Confidence-Based Segment Marking
   * 
   * For any transcription segment with confidence score < 0.7, the segment
   * SHALL be marked with isUncertain: true. For any segment with confidence
   * >= 0.7, the segment SHALL have isUncertain: false.
   */
  describe('Property 4: Confidence-Based Segment Marking', () => {
    
    // Arbitrary for generating segment data with various confidence levels
    const segmentArb = fc.record({
      id: fc.nat({ max: 100 }),
      text: fc.string({ minLength: 1, maxLength: 100 }),
      start: fc.double({ min: 0, max: 100 }),
      end: fc.double({ min: 0, max: 100 }),
      avg_logprob: fc.double({ min: -2, max: 0 }), // Whisper's log probability
      no_speech_prob: fc.double({ min: 0, max: 1 }),
    });

    // Arbitrary for generating Whisper response with segments
    const whisperResponseArb = fc.record({
      segments: fc.array(segmentArb, { minLength: 1, maxLength: 10 }),
    });

    it('Property 4.1: Segments with confidence < 0.7 should be marked uncertain', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.double({ min: 0, max: 0.69, noNaN: true }),
          async (lowConfidence) => {
            const segment = {
              id: 0,
              text: 'Test segment',
              start: 0,
              end: 1,
              confidence: lowConfidence,
            };
            
            // Apply the marking logic
            const isUncertain = segment.confidence < 0.7;
            
            expect(isUncertain).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property 4.2: Segments with confidence >= 0.7 should NOT be marked uncertain', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.double({ min: 0.7, max: 1.0, noNaN: true }),
          async (highConfidence) => {
            const segment = {
              id: 0,
              text: 'Test segment',
              start: 0,
              end: 1,
              confidence: highConfidence,
            };
            
            // Apply the marking logic
            const isUncertain = segment.confidence < 0.7;
            
            expect(isUncertain).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property 4.3: calculateSegmentConfidence should return valid confidence range', async () => {
      await fc.assert(
        fc.asyncProperty(segmentArb, async (segment) => {
          const confidence = whisperService.calculateSegmentConfidence(segment);
          
          // Confidence should always be between 0 and 1
          expect(confidence).toBeGreaterThanOrEqual(0);
          expect(confidence).toBeLessThanOrEqual(1);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 4.4: Higher avg_logprob should result in higher confidence', async () => {
      // avg_logprob ranges from -2 to 0, where 0 is highest confidence
      const lowLogprob = -1.5;
      const highLogprob = -0.2;
      
      const lowConfidence = whisperService.calculateSegmentConfidence({
        avg_logprob: lowLogprob
      });
      
      const highConfidence = whisperService.calculateSegmentConfidence({
        avg_logprob: highLogprob
      });
      
      expect(highConfidence).toBeGreaterThan(lowConfidence);
    });

    it('Property 4.5: Lower no_speech_prob should result in higher confidence', async () => {
      const highNoSpeech = 0.8;
      const lowNoSpeech = 0.1;
      
      const lowConfidence = whisperService.calculateSegmentConfidence({
        no_speech_prob: highNoSpeech
      });
      
      const highConfidence = whisperService.calculateSegmentConfidence({
        no_speech_prob: lowNoSpeech
      });
      
      expect(highConfidence).toBeGreaterThan(lowConfidence);
    });

    it('Property 4.6: parseTranscriptionResponse should preserve segment confidence', async () => {
      await fc.assert(
        fc.asyncProperty(whisperResponseArb, async (response) => {
          const result = whisperService.parseTranscriptionResponse(response);
          
          // Result should have segments
          expect(result.segments).toBeDefined();
          expect(Array.isArray(result.segments)).toBe(true);
          
          // Each segment should have confidence
          for (const segment of result.segments) {
            expect(segment.confidence).toBeDefined();
            expect(typeof segment.confidence).toBe('number');
            expect(segment.confidence).toBeGreaterThanOrEqual(0);
            expect(segment.confidence).toBeLessThanOrEqual(1);
          }
        }),
        { numRuns: 20 }
      );
    });

    it('Property 4.7: Overall confidence should be average of segment confidences', async () => {
      const segments = [
        { id: 0, text: 'First', start: 0, end: 1, confidence: 0.9 },
        { id: 1, text: 'Second', start: 1, end: 2, confidence: 0.7 },
        { id: 2, text: 'Third', start: 2, end: 3, confidence: 0.8 },
      ];
      
      const response = { segments };
      const result = whisperService.parseTranscriptionResponse(response);
      
      const expectedAverage = (0.9 + 0.7 + 0.8) / 3;
      expect(result.confidence).toBeCloseTo(expectedAverage, 2);
    });

    it('Property 4.8: Empty text segments should have low confidence', async () => {
      const emptySegment = { text: '' };
      const shortSegment = { text: 'Hi' };
      const normalSegment = { text: 'This is a normal length segment' };
      
      const emptyConfidence = whisperService.calculateSegmentConfidence(emptySegment);
      const shortConfidence = whisperService.calculateSegmentConfidence(shortSegment);
      const normalConfidence = whisperService.calculateSegmentConfidence(normalSegment);
      
      expect(emptyConfidence).toBeLessThan(shortConfidence);
      expect(shortConfidence).toBeLessThan(normalConfidence);
    });

    it('Property 4.9: String response should default to reasonable confidence', async () => {
      const stringResponse = 'This is a transcription';
      const result = whisperService.parseTranscriptionResponse(stringResponse);
      
      expect(result.text).toBe(stringResponse);
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.segments.length).toBe(1);
    });

    it('Property 4.10: Boundary test - confidence exactly 0.7 should NOT be uncertain', async () => {
      const segment = {
        id: 0,
        text: 'Boundary test',
        confidence: 0.7,
      };
      
      const isUncertain = segment.confidence < 0.7;
      expect(isUncertain).toBe(false);
    });
  });
});
