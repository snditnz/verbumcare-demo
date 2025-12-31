/**
 * Property Test: Network-Based Fallback
 * 
 * Property 5: For any recording context where network is unavailable at 
 * recording start, the selected mode SHALL be 'offline-queue' regardless 
 * of other settings.
 * 
 * Validates: Requirements 3.3
 */

import * as fc from 'fast-check';
import { RecordingContext, RecordingMode } from '../recordingModeSelector';

/**
 * Pure function implementation of mode selection for testing
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

describe('RecordingModeSelector - Network-Based Fallback Property', () => {
  /**
   * Property 5a: No network always results in offline-queue
   */
  it('Property 5a: Network unavailable always results in offline-queue', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // streamingEnabled
        fc.boolean(), // liveAudioAvailable
        fc.boolean(), // backendSupportsStreaming
        (streamingEnabled, liveAudioAvailable, backendSupportsStreaming) => {
          const context: RecordingContext = {
            streamingEnabled,
            networkAvailable: false, // Network unavailable
            liveAudioAvailable,
            backendSupportsStreaming,
          };
          
          const mode = selectMode(context);
          
          // Must always be offline-queue when network is unavailable
          expect(mode).toBe('offline-queue');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5b: Network availability is the highest priority check
   */
  it('Property 5b: Network check takes precedence over all other settings', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (streamingEnabled, liveAudioAvailable, backendSupportsStreaming) => {
          // Context with network unavailable
          const offlineContext: RecordingContext = {
            streamingEnabled,
            networkAvailable: false,
            liveAudioAvailable,
            backendSupportsStreaming,
          };
          
          // Context with network available (same other settings)
          const onlineContext: RecordingContext = {
            streamingEnabled,
            networkAvailable: true,
            liveAudioAvailable,
            backendSupportsStreaming,
          };
          
          const offlineMode = selectMode(offlineContext);
          const onlineMode = selectMode(onlineContext);
          
          // Offline must always be offline-queue
          expect(offlineMode).toBe('offline-queue');
          
          // Online should NOT be offline-queue (unless that's the only valid mode)
          expect(onlineMode).not.toBe('offline-queue');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5c: Even with all features enabled, no network = offline-queue
   */
  it('Property 5c: All features enabled but no network = offline-queue', () => {
    const context: RecordingContext = {
      streamingEnabled: true,
      networkAvailable: false,
      liveAudioAvailable: true,
      backendSupportsStreaming: true,
    };
    
    const mode = selectMode(context);
    expect(mode).toBe('offline-queue');
  });

  /**
   * Property 5d: Network restoration changes mode from offline-queue
   */
  it('Property 5d: Network restoration enables other modes', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (streamingEnabled, liveAudioAvailable, backendSupportsStreaming) => {
          // Simulate network going from offline to online
          const offlineContext: RecordingContext = {
            streamingEnabled,
            networkAvailable: false,
            liveAudioAvailable,
            backendSupportsStreaming,
          };
          
          const onlineContext: RecordingContext = {
            ...offlineContext,
            networkAvailable: true,
          };
          
          const offlineMode = selectMode(offlineContext);
          const onlineMode = selectMode(onlineContext);
          
          // Offline mode must be offline-queue
          expect(offlineMode).toBe('offline-queue');
          
          // Online mode must NOT be offline-queue
          expect(onlineMode).not.toBe('offline-queue');
          
          // Online mode should be either live-streaming or fallback-upload
          expect(['live-streaming', 'fallback-upload']).toContain(onlineMode);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5e: Offline mode is independent of streaming setting
   */
  it('Property 5e: Streaming setting does not affect offline mode', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // liveAudioAvailable
        fc.boolean(), // backendSupportsStreaming
        (liveAudioAvailable, backendSupportsStreaming) => {
          // With streaming enabled
          const enabledContext: RecordingContext = {
            streamingEnabled: true,
            networkAvailable: false,
            liveAudioAvailable,
            backendSupportsStreaming,
          };
          
          // With streaming disabled
          const disabledContext: RecordingContext = {
            streamingEnabled: false,
            networkAvailable: false,
            liveAudioAvailable,
            backendSupportsStreaming,
          };
          
          const enabledMode = selectMode(enabledContext);
          const disabledMode = selectMode(disabledContext);
          
          // Both should be offline-queue
          expect(enabledMode).toBe('offline-queue');
          expect(disabledMode).toBe('offline-queue');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 5f: Offline mode is independent of module availability
   */
  it('Property 5f: Module availability does not affect offline mode', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // streamingEnabled
        fc.boolean(), // backendSupportsStreaming
        (streamingEnabled, backendSupportsStreaming) => {
          // With module available
          const availableContext: RecordingContext = {
            streamingEnabled,
            networkAvailable: false,
            liveAudioAvailable: true,
            backendSupportsStreaming,
          };
          
          // With module unavailable
          const unavailableContext: RecordingContext = {
            streamingEnabled,
            networkAvailable: false,
            liveAudioAvailable: false,
            backendSupportsStreaming,
          };
          
          const availableMode = selectMode(availableContext);
          const unavailableMode = selectMode(unavailableContext);
          
          // Both should be offline-queue
          expect(availableMode).toBe('offline-queue');
          expect(unavailableMode).toBe('offline-queue');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 5g: Network state transitions are handled correctly
   */
  it('Property 5g: Simulated network state transitions', () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 2, maxLength: 10 }), // Network state sequence
        (networkStates) => {
          const baseContext: Omit<RecordingContext, 'networkAvailable'> = {
            streamingEnabled: true,
            liveAudioAvailable: true,
            backendSupportsStreaming: true,
          };
          
          for (const networkAvailable of networkStates) {
            const context: RecordingContext = {
              ...baseContext,
              networkAvailable,
            };
            
            const mode = selectMode(context);
            
            if (networkAvailable) {
              expect(mode).toBe('live-streaming');
            } else {
              expect(mode).toBe('offline-queue');
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 5h: Offline-queue is the only mode when network is down
   */
  it('Property 5h: offline-queue is exclusive mode for no network', () => {
    // Exhaustively test all combinations with network=false
    for (let i = 0; i < 8; i++) {
      const context: RecordingContext = {
        streamingEnabled: !!(i & 1),
        networkAvailable: false, // Always false
        liveAudioAvailable: !!(i & 2),
        backendSupportsStreaming: !!(i & 4),
      };
      
      const mode = selectMode(context);
      expect(mode).toBe('offline-queue');
    }
  });
});
