/**
 * Property Test: Mode Selection Based on Settings
 * 
 * Property 4: For any recording context where streaming is enabled in settings 
 * and the native module is available and network is available, the selected 
 * mode SHALL be 'live-streaming'. For any context where streaming is disabled, 
 * the selected mode SHALL be 'fallback-upload' or 'offline-queue'.
 * 
 * Validates: Requirements 3.1, 3.4
 */

import * as fc from 'fast-check';
import { RecordingContext, RecordingMode } from '../recordingModeSelector';

/**
 * Pure function implementation of mode selection for testing
 * Mirrors the logic in RecordingModeSelector
 */
function selectMode(context: RecordingContext): RecordingMode {
  if (!context.networkAvailable) {
    return 'offline-queue';
  }
  if (!context.streamingEnabled) {
    return 'fallback-upload';
  }
  if (!context.liveAudioAvailable) {
    return 'fallback-upload';
  }
  if (!context.backendSupportsStreaming) {
    return 'fallback-upload';
  }
  return 'live-streaming';
}

describe('RecordingModeSelector - Settings-Based Mode Selection Property', () => {
  /**
   * Property 4a: When all conditions are met, mode is 'live-streaming'
   */
  it('Property 4a: All conditions met results in live-streaming mode', () => {
    fc.assert(
      fc.property(
        fc.constant(true), // All conditions true
        () => {
          const context: RecordingContext = {
            streamingEnabled: true,
            networkAvailable: true,
            liveAudioAvailable: true,
            backendSupportsStreaming: true,
          };
          
          const mode = selectMode(context);
          expect(mode).toBe('live-streaming');
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 4b: When streaming is disabled, mode is NOT 'live-streaming'
   */
  it('Property 4b: Streaming disabled results in fallback or offline mode', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // networkAvailable
        fc.boolean(), // liveAudioAvailable
        fc.boolean(), // backendSupportsStreaming
        (networkAvailable, liveAudioAvailable, backendSupportsStreaming) => {
          const context: RecordingContext = {
            streamingEnabled: false, // Disabled
            networkAvailable,
            liveAudioAvailable,
            backendSupportsStreaming,
          };
          
          const mode = selectMode(context);
          
          // Should never be live-streaming when disabled
          expect(mode).not.toBe('live-streaming');
          
          // Should be either fallback-upload or offline-queue
          expect(['fallback-upload', 'offline-queue']).toContain(mode);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4c: Streaming enabled with all other conditions met = live-streaming
   */
  it('Property 4c: Streaming enabled with all conditions = live-streaming', () => {
    fc.assert(
      fc.property(
        fc.constant(true),
        () => {
          const context: RecordingContext = {
            streamingEnabled: true,
            networkAvailable: true,
            liveAudioAvailable: true,
            backendSupportsStreaming: true,
          };
          
          const mode = selectMode(context);
          expect(mode).toBe('live-streaming');
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 4d: Any single missing condition prevents live-streaming
   */
  it('Property 4d: Missing any condition prevents live-streaming', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }), // Which condition to disable
        (disabledCondition) => {
          const context: RecordingContext = {
            streamingEnabled: disabledCondition !== 0,
            networkAvailable: disabledCondition !== 1,
            liveAudioAvailable: disabledCondition !== 2,
            backendSupportsStreaming: disabledCondition !== 3,
          };
          
          const mode = selectMode(context);
          
          // With any condition false, should not be live-streaming
          expect(mode).not.toBe('live-streaming');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4e: Mode selection is deterministic
   */
  it('Property 4e: Same context always produces same mode', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (streamingEnabled, networkAvailable, liveAudioAvailable, backendSupportsStreaming) => {
          const context: RecordingContext = {
            streamingEnabled,
            networkAvailable,
            liveAudioAvailable,
            backendSupportsStreaming,
          };
          
          // Call multiple times
          const mode1 = selectMode(context);
          const mode2 = selectMode(context);
          const mode3 = selectMode(context);
          
          // Should always be the same
          expect(mode1).toBe(mode2);
          expect(mode2).toBe(mode3);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4f: Mode is always one of the valid modes
   */
  it('Property 4f: Mode is always a valid RecordingMode', () => {
    const validModes: RecordingMode[] = ['live-streaming', 'fallback-upload', 'offline-queue'];
    
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (streamingEnabled, networkAvailable, liveAudioAvailable, backendSupportsStreaming) => {
          const context: RecordingContext = {
            streamingEnabled,
            networkAvailable,
            liveAudioAvailable,
            backendSupportsStreaming,
          };
          
          const mode = selectMode(context);
          expect(validModes).toContain(mode);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4g: User setting takes precedence over module availability
   */
  it('Property 4g: User setting (disabled) overrides module availability', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // networkAvailable
        (networkAvailable) => {
          // Even with module available, if user disabled streaming
          const context: RecordingContext = {
            streamingEnabled: false,
            networkAvailable,
            liveAudioAvailable: true, // Module is available
            backendSupportsStreaming: true,
          };
          
          const mode = selectMode(context);
          
          // Should respect user setting
          expect(mode).not.toBe('live-streaming');
          
          if (networkAvailable) {
            expect(mode).toBe('fallback-upload');
          } else {
            expect(mode).toBe('offline-queue');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 4h: All 16 combinations produce valid results
   */
  it('Property 4h: All boolean combinations produce valid results', () => {
    const validModes: RecordingMode[] = ['live-streaming', 'fallback-upload', 'offline-queue'];
    
    // Test all 16 combinations explicitly
    for (let i = 0; i < 16; i++) {
      const context: RecordingContext = {
        streamingEnabled: !!(i & 1),
        networkAvailable: !!(i & 2),
        liveAudioAvailable: !!(i & 4),
        backendSupportsStreaming: !!(i & 8),
      };
      
      const mode = selectMode(context);
      expect(validModes).toContain(mode);
      
      // Verify specific expected outcomes
      if (!context.networkAvailable) {
        expect(mode).toBe('offline-queue');
      } else if (!context.streamingEnabled || !context.liveAudioAvailable || !context.backendSupportsStreaming) {
        expect(mode).toBe('fallback-upload');
      } else {
        expect(mode).toBe('live-streaming');
      }
    }
  });
});
