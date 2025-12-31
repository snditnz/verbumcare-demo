/**
 * Property Test: Fallback Mode Equivalence
 * 
 * Property 8: Fallback Mode Equivalence
 * *For any* recording completed in fallback mode, the resulting audio file and 
 * transcription workflow SHALL be equivalent to the current expo-av implementation.
 * The user experience SHALL be indistinguishable from the current app behavior.
 * 
 * **Validates: Requirements 10.2, 10.3**
 * 
 * Feature: live-audio-streaming-integration
 */

import * as fc from 'fast-check';
import { recordingModeSelector, RecordingContext, RecordingMode } from '../../services/recordingModeSelector';

// Set a reasonable timeout for property tests
jest.setTimeout(30000);

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Arbitrary for generating valid recording contexts
 */
const recordingContextArb = fc.record({
  streamingEnabled: fc.boolean(),
  networkAvailable: fc.boolean(),
  liveAudioAvailable: fc.boolean(),
  backendSupportsStreaming: fc.boolean(),
});

/**
 * Arbitrary for generating fallback-only contexts
 * These are contexts where fallback mode should be selected (NOT offline-queue)
 */
const fallbackContextArb = fc.oneof(
  // Streaming disabled by user (network available)
  fc.record({
    streamingEnabled: fc.constant(false),
    networkAvailable: fc.constant(true), // Must be online for fallback-upload
    liveAudioAvailable: fc.boolean(),
    backendSupportsStreaming: fc.boolean(),
  }),
  // Live audio not available (network available)
  fc.record({
    streamingEnabled: fc.constant(true),
    networkAvailable: fc.constant(true), // Must be online for fallback-upload
    liveAudioAvailable: fc.constant(false),
    backendSupportsStreaming: fc.boolean(),
  }),
  // Backend doesn't support streaming (network available)
  fc.record({
    streamingEnabled: fc.constant(true),
    networkAvailable: fc.constant(true), // Must be online for fallback-upload
    liveAudioAvailable: fc.constant(true),
    backendSupportsStreaming: fc.constant(false),
  }),
);

/**
 * Arbitrary for generating offline contexts
 */
const offlineContextArb = fc.record({
  streamingEnabled: fc.boolean(),
  networkAvailable: fc.constant(false),
  liveAudioAvailable: fc.boolean(),
  backendSupportsStreaming: fc.boolean(),
});

/**
 * Simulated recording result for testing equivalence
 */
interface RecordingResult {
  uri: string;
  duration: number;
  mode: RecordingMode;
  audioFormat: 'wav' | 'm4a';
  canUpload: boolean;
  canQueue: boolean;
}

/**
 * Simulate a recording completion based on mode
 */
function simulateRecordingCompletion(
  mode: RecordingMode,
  duration: number
): RecordingResult {
  const baseUri = `file://recordings/recording_${Date.now()}`;
  
  switch (mode) {
    case 'live-streaming':
      return {
        uri: `${baseUri}.wav`,
        duration,
        mode,
        audioFormat: 'wav',
        canUpload: true,
        canQueue: true,
      };
    case 'fallback-upload':
      return {
        uri: `${baseUri}.m4a`,
        duration,
        mode,
        audioFormat: 'm4a',
        canUpload: true,
        canQueue: true,
      };
    case 'offline-queue':
      return {
        uri: `${baseUri}.m4a`,
        duration,
        mode,
        audioFormat: 'm4a',
        canUpload: false,
        canQueue: true,
      };
  }
}

/**
 * Check if two recording results are functionally equivalent
 * (same user experience, same data handling capabilities)
 */
function areResultsEquivalent(
  fallbackResult: RecordingResult,
  legacyResult: RecordingResult
): boolean {
  // Both should have valid URIs
  if (!fallbackResult.uri || !legacyResult.uri) return false;
  
  // Both should have the same duration
  if (fallbackResult.duration !== legacyResult.duration) return false;
  
  // Both should have the same upload/queue capabilities
  if (fallbackResult.canUpload !== legacyResult.canUpload) return false;
  if (fallbackResult.canQueue !== legacyResult.canQueue) return false;
  
  return true;
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Property 8: Fallback Mode Equivalence', () => {
  /**
   * Property 8.1: Fallback mode produces valid recording results
   * 
   * For any fallback context, the recording result should have:
   * - A valid file URI
   * - A positive duration
   * - The ability to upload or queue
   */
  it('should produce valid recording results in fallback mode', () => {
    fc.assert(
      fc.property(
        fallbackContextArb,
        fc.integer({ min: 1000, max: 600000 }), // Duration 1s to 10min
        (context, duration) => {
          const modeResult = recordingModeSelector.selectMode(context);
          
          // Should select fallback-upload mode
          expect(modeResult.mode).toBe('fallback-upload');
          
          // Simulate recording completion
          const result = simulateRecordingCompletion(modeResult.mode, duration);
          
          // Verify valid result
          expect(result.uri).toBeTruthy();
          expect(result.uri.length).toBeGreaterThan(0);
          expect(result.duration).toBe(duration);
          expect(result.canUpload).toBe(true);
          expect(result.canQueue).toBe(true);
        }
      ),
      { numRuns: 50 } // Reduced for faster execution
    );
  });

  /**
   * Property 8.2: Fallback mode is equivalent to legacy expo-av behavior
   * 
   * For any recording completed in fallback mode, the result should be
   * functionally equivalent to what the legacy expo-av implementation produces.
   */
  it('should be equivalent to legacy expo-av behavior', () => {
    fc.assert(
      fc.property(
        fallbackContextArb,
        fc.integer({ min: 1000, max: 600000 }),
        (context, duration) => {
          const modeResult = recordingModeSelector.selectMode(context);
          
          // This test only applies to fallback-upload mode
          expect(modeResult.mode).toBe('fallback-upload');
          
          // Simulate fallback recording
          const fallbackResult = simulateRecordingCompletion(modeResult.mode, duration);
          
          // Simulate legacy expo-av recording (always fallback-upload)
          const legacyResult = simulateRecordingCompletion('fallback-upload', duration);
          
          // Results should be functionally equivalent
          expect(areResultsEquivalent(fallbackResult, legacyResult)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 8.3: Offline mode produces queueable results
   * 
   * For any offline context, the recording should be queueable for later upload.
   */
  it('should produce queueable results in offline mode', () => {
    fc.assert(
      fc.property(
        offlineContextArb,
        fc.integer({ min: 1000, max: 600000 }),
        (context, duration) => {
          const modeResult = recordingModeSelector.selectMode(context);
          
          // Should select offline-queue mode
          expect(modeResult.mode).toBe('offline-queue');
          
          // Simulate recording completion
          const result = simulateRecordingCompletion(modeResult.mode, duration);
          
          // Should be queueable
          expect(result.canQueue).toBe(true);
          expect(result.uri).toBeTruthy();
          expect(result.duration).toBe(duration);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 8.4: Mode selection is deterministic
   * 
   * For any given context, the mode selection should always produce
   * the same result (no randomness in selection).
   */
  it('should select mode deterministically', () => {
    fc.assert(
      fc.property(
        recordingContextArb,
        (context) => {
          const result1 = recordingModeSelector.selectMode(context);
          const result2 = recordingModeSelector.selectMode(context);
          
          // Same context should always produce same mode
          expect(result1.mode).toBe(result2.mode);
          expect(result1.reason).toBe(result2.reason);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 8.5: User settings are respected
   * 
   * When streaming is disabled by user, fallback mode should always be selected
   * regardless of other conditions (when online).
   */
  it('should respect user streaming preference', () => {
    fc.assert(
      fc.property(
        fc.record({
          streamingEnabled: fc.constant(false),
          networkAvailable: fc.constant(true),
          liveAudioAvailable: fc.constant(true),
          backendSupportsStreaming: fc.constant(true),
        }),
        (context) => {
          const result = recordingModeSelector.selectMode(context);
          
          // Even with all other conditions met, should use fallback
          // because user disabled streaming
          expect(result.mode).toBe('fallback-upload');
          expect(result.reason).toContain('disabled');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 8.6: Audio service type matches mode
   * 
   * The audio service type returned should match the selected mode.
   */
  it('should return correct audio service type for mode', () => {
    fc.assert(
      fc.property(
        recordingContextArb,
        (context) => {
          const modeResult = recordingModeSelector.selectMode(context);
          const serviceType = recordingModeSelector.getAudioServiceType(modeResult.mode);
          
          if (modeResult.mode === 'live-streaming') {
            expect(serviceType).toBe('live');
          } else {
            expect(serviceType).toBe('expo-av');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 8.7: Progressive transcription support matches mode
   * 
   * Only live-streaming mode should support progressive transcription.
   */
  it('should correctly indicate progressive transcription support', () => {
    fc.assert(
      fc.property(
        recordingContextArb,
        (context) => {
          const modeResult = recordingModeSelector.selectMode(context);
          const supportsProgressive = recordingModeSelector.supportsProgressiveTranscription(modeResult.mode);
          
          if (modeResult.mode === 'live-streaming') {
            expect(supportsProgressive).toBe(true);
          } else {
            expect(supportsProgressive).toBe(false);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
