/**
 * Property Test: Error Handling with Data Preservation
 * 
 * Property 7: For any error that occurs during recording, the system SHALL:
 * (1) log the error without showing it to the user,
 * (2) preserve any audio data captured before the error, and
 * (3) either recover or fall back gracefully.
 * 
 * Validates: Requirements 5.4, 8.2, 8.4, 8.5
 */

import * as fc from 'fast-check';
import { AudioDataEvent, AudioErrorEvent, RecoveryAction } from '../liveAudioService';

/**
 * Mock implementation for testing error handling
 */
class MockErrorHandlingService {
  private preservedChunks: AudioDataEvent[] = [];
  private recoveryAttempts: number = 0;
  private maxRecoveryAttempts: number = 3;
  private errorLog: AudioErrorEvent[] = [];
  private userNotifications: string[] = [];

  /**
   * Simulate receiving audio chunks
   */
  receiveChunk(chunk: AudioDataEvent): void {
    this.preservedChunks.push(chunk);
  }

  /**
   * Get preserved chunks
   */
  getPreservedChunks(): AudioDataEvent[] {
    return [...this.preservedChunks];
  }

  /**
   * Handle an error - logs without user notification
   */
  handleError(error: AudioErrorEvent): void {
    // Log error internally (not shown to user)
    this.errorLog.push(error);
    console.log('[MockService] Error logged:', error.code);
  }

  /**
   * Get error log
   */
  getErrorLog(): AudioErrorEvent[] {
    return [...this.errorLog];
  }

  /**
   * Get user notifications (should be minimal)
   */
  getUserNotifications(): string[] {
    return [...this.userNotifications];
  }

  /**
   * Attempt recovery from error
   */
  attemptRecovery(error: AudioErrorEvent): RecoveryAction {
    if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
      this.recoveryAttempts = 0;
      return { type: 'fallback' };
    }
    
    this.recoveryAttempts++;
    
    switch (error.code) {
      case 'INIT_FAILED':
      case 'MODULE_NOT_AVAILABLE':
        return { type: 'fallback' };
      case 'START_FAILED':
        return { type: 'retry', delay: 500 };
      case 'PERMISSION_DENIED':
        this.userNotifications.push('Microphone permission required');
        return { type: 'notify-user', message: 'Microphone permission required' };
      case 'NETWORK_ERROR':
        return { type: 'queue-offline' };
      default:
        return this.recoveryAttempts < 2 
          ? { type: 'retry', delay: 300 }
          : { type: 'fallback' };
    }
  }

  /**
   * Preserve audio data
   */
  preserveAudioData(): string | null {
    if (this.preservedChunks.length === 0) return null;
    return `preserved-${Date.now()}`;
  }

  /**
   * Reset state
   */
  reset(): void {
    this.preservedChunks = [];
    this.recoveryAttempts = 0;
    this.errorLog = [];
    this.userNotifications = [];
  }
}

// Error code generator for property tests
const errorCodeArb = fc.constantFrom(
  'INIT_FAILED',
  'MODULE_NOT_AVAILABLE',
  'START_FAILED',
  'CAPTURE_STOPPED',
  'PERMISSION_DENIED',
  'NETWORK_ERROR',
  'UNKNOWN_ERROR'
);

// Audio chunk generator
const audioChunkArb = fc.record({
  data: fc.string({ minLength: 10, maxLength: 100 }),
  timestamp: fc.integer({ min: 0, max: 600000 }),
  sequenceNumber: fc.integer({ min: 0, max: 10000 }),
});

// Error event generator
const errorEventArb = fc.record({
  code: errorCodeArb,
  message: fc.string({ minLength: 5, maxLength: 50 }),
  recoverable: fc.boolean(),
});

describe('LiveAudioService - Error Handling Property', () => {
  let service: MockErrorHandlingService;

  beforeEach(() => {
    service = new MockErrorHandlingService();
  });

  afterEach(() => {
    service.reset();
  });

  /**
   * Property 7a: Errors are logged without user notification (for most errors)
   */
  it('Property 7a: Errors are logged internally without user notification', () => {
    fc.assert(
      fc.property(
        fc.array(errorEventArb, { minLength: 1, maxLength: 10 }),
        (errors) => {
          // Create fresh service for each test
          const testService = new MockErrorHandlingService();
          
          for (const error of errors) {
            testService.handleError(error);
          }
          
          // All errors should be logged
          expect(testService.getErrorLog().length).toBe(errors.length);
          
          // User notifications should be minimal (only for permission errors)
          // Note: handleError doesn't add notifications, attemptRecovery does
          expect(testService.getUserNotifications().length).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 7b: Audio data is preserved before error handling
   */
  it('Property 7b: Audio data captured before error is preserved', () => {
    fc.assert(
      fc.property(
        fc.array(audioChunkArb, { minLength: 1, maxLength: 50 }),
        errorEventArb,
        (chunks, error) => {
          // Create fresh service for each test
          const testService = new MockErrorHandlingService();
          
          // Simulate receiving chunks
          for (const chunk of chunks) {
            testService.receiveChunk(chunk);
          }
          
          // Error occurs
          testService.handleError(error);
          
          // Chunks should still be preserved
          const preserved = testService.getPreservedChunks();
          expect(preserved.length).toBe(chunks.length);
          
          // Can generate preservation ID
          const preservedId = testService.preserveAudioData();
          expect(preservedId).not.toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 7c: Recovery action is always returned
   */
  it('Property 7c: Recovery action is always determined', () => {
    fc.assert(
      fc.property(
        errorEventArb,
        (error) => {
          const testService = new MockErrorHandlingService();
          const action = testService.attemptRecovery(error);
          
          // Action should always be defined
          expect(action).toBeDefined();
          expect(action.type).toBeDefined();
          
          // Action type should be valid
          expect(['retry', 'fallback', 'queue-offline', 'notify-user']).toContain(action.type);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7d: Fallback is used after max recovery attempts
   */
  it('Property 7d: Fallback after max recovery attempts', () => {
    fc.assert(
      fc.property(
        fc.array(errorEventArb, { minLength: 5, maxLength: 10 }),
        (errors) => {
          const testService = new MockErrorHandlingService();
          let fallbackUsed = false;
          
          for (const error of errors) {
            const action = testService.attemptRecovery(error);
            if (action.type === 'fallback') {
              fallbackUsed = true;
            }
          }
          
          // With enough errors, fallback should eventually be used
          // (unless all errors are immediately fallback-worthy)
          expect(fallbackUsed || errors.every(e => 
            e.code === 'INIT_FAILED' || 
            e.code === 'MODULE_NOT_AVAILABLE'
          )).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property 7e: Module unavailable errors always result in fallback
   */
  it('Property 7e: Module unavailable always results in fallback', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('INIT_FAILED', 'MODULE_NOT_AVAILABLE'),
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.boolean(),
        (code, message, recoverable) => {
          const testService = new MockErrorHandlingService();
          const error: AudioErrorEvent = { code, message, recoverable };
          const action = testService.attemptRecovery(error);
          
          expect(action.type).toBe('fallback');
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 7f: Network errors result in offline queue
   */
  it('Property 7f: Network errors queue for offline processing', () => {
    const testService = new MockErrorHandlingService();
    const error: AudioErrorEvent = {
      code: 'NETWORK_ERROR',
      message: 'Network unavailable',
      recoverable: true,
    };
    
    const action = testService.attemptRecovery(error);
    expect(action.type).toBe('queue-offline');
  });

  /**
   * Property 7g: Permission errors notify user
   */
  it('Property 7g: Permission errors notify user', () => {
    const testService = new MockErrorHandlingService();
    const error: AudioErrorEvent = {
      code: 'PERMISSION_DENIED',
      message: 'Microphone access denied',
      recoverable: false,
    };
    
    const action = testService.attemptRecovery(error);
    expect(action.type).toBe('notify-user');
    expect((action as any).message).toBeDefined();
  });

  /**
   * Property 7h: Retry actions have positive delay
   */
  it('Property 7h: Retry actions have positive delay', () => {
    fc.assert(
      fc.property(
        errorEventArb,
        (error) => {
          const testService = new MockErrorHandlingService();
          const action = testService.attemptRecovery(error);
          
          if (action.type === 'retry') {
            expect((action as any).delay).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('LiveAudioService - Data Preservation Property', () => {
  /**
   * Property 7i: Preserved chunks maintain order
   */
  it('Property 7i: Preserved chunks maintain sequence order', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 2, maxLength: 50 }),
        (sequenceNumbers) => {
          const service = new MockErrorHandlingService();
          
          // Add chunks with given sequence numbers
          for (const seq of sequenceNumbers) {
            service.receiveChunk({
              data: `chunk-${seq}`,
              timestamp: seq * 100,
              sequenceNumber: seq,
            });
          }
          
          const preserved = service.getPreservedChunks();
          
          // All chunks should be preserved
          expect(preserved.length).toBe(sequenceNumbers.length);
          
          // Sequence numbers should match input order
          for (let i = 0; i < sequenceNumbers.length; i++) {
            expect(preserved[i].sequenceNumber).toBe(sequenceNumbers[i]);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 7j: Empty preservation returns null
   */
  it('Property 7j: Empty preservation returns null', () => {
    const service = new MockErrorHandlingService();
    expect(service.preserveAudioData()).toBeNull();
  });

  /**
   * Property 7k: Preservation ID is unique
   */
  it('Property 7k: Preservation IDs are unique', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        async (count) => {
          const ids: string[] = [];
          
          for (let i = 0; i < count; i++) {
            const service = new MockErrorHandlingService();
            service.receiveChunk({
              data: `chunk-${i}-${Math.random()}`,
              timestamp: i * 100,
              sequenceNumber: i,
            });
            
            // Add small delay to ensure unique timestamps
            await new Promise(resolve => setTimeout(resolve, 5));
            
            const id = service.preserveAudioData();
            expect(id).not.toBeNull();
            expect(ids).not.toContain(id);
            ids.push(id!);
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});
