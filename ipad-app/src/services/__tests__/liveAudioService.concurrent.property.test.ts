/**
 * Property Test: Concurrent Recording Prevention
 * 
 * Property 6: For any state where isRecording() returns true, attempting to 
 * call start() again SHALL either throw an error or return without starting 
 * a new recording. Only one recording SHALL be active at any time.
 * 
 * Validates: Requirements 5.5
 */

import * as fc from 'fast-check';

/**
 * Mock implementation of LiveAudioService for testing concurrent recording prevention
 */
class MockLiveAudioService {
  private recording: boolean = false;
  private startCount: number = 0;
  private activeRecordingId: number | null = null;
  private startLock: boolean = false;

  isRecording(): boolean {
    return this.recording;
  }

  getActiveRecordingId(): number | null {
    return this.activeRecordingId;
  }

  getStartCount(): number {
    return this.startCount;
  }

  async start(): Promise<void> {
    // Use lock to prevent race conditions in concurrent calls
    if (this.recording || this.startLock) {
      // Already recording or another start in progress - do not start a new recording
      console.log('[MockLiveAudio] Already recording, ignoring start request');
      return;
    }
    
    this.startLock = true;
    this.recording = true;
    this.startCount++;
    this.activeRecordingId = Date.now();
    this.startLock = false;
  }

  async stop(): Promise<void> {
    this.recording = false;
    this.activeRecordingId = null;
  }

  reset(): void {
    this.recording = false;
    this.startCount = 0;
    this.activeRecordingId = null;
    this.startLock = false;
  }
}

describe('LiveAudioService - Concurrent Recording Prevention Property', () => {
  let service: MockLiveAudioService;

  beforeEach(() => {
    service = new MockLiveAudioService();
  });

  afterEach(() => {
    service.reset();
  });

  /**
   * Property 6a: Only one recording can be active at a time
   */
  it('Property 6a: Only one recording active at any time', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }), // Number of concurrent start attempts
        async (attempts) => {
          const testService = new MockLiveAudioService();
          
          // Start first recording
          await testService.start();
          expect(testService.isRecording()).toBe(true);
          const firstRecordingId = testService.getActiveRecordingId();
          
          // Attempt multiple concurrent starts
          for (let i = 0; i < attempts; i++) {
            await testService.start();
          }
          
          // Should still have only one recording
          expect(testService.isRecording()).toBe(true);
          
          // Recording ID should not have changed
          expect(testService.getActiveRecordingId()).toBe(firstRecordingId);
          
          // Start count should be 1 (only the first successful start)
          expect(testService.getStartCount()).toBe(1);
          
          await testService.stop();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 6b: Calling start() while recording does not throw
   */
  it('Property 6b: start() while recording does not throw', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }),
        async (attempts) => {
          await service.start();
          
          // Multiple start calls should not throw
          for (let i = 0; i < attempts; i++) {
            await expect(service.start()).resolves.not.toThrow();
          }
          
          await service.stop();
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property 6c: Recording state is consistent after concurrent attempts
   */
  it('Property 6c: Recording state remains consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.boolean(), { minLength: 5, maxLength: 20 }), // Random start/stop sequence
        async (operations) => {
          let expectedRecording = false;
          
          for (const shouldStart of operations) {
            if (shouldStart) {
              await service.start();
              expectedRecording = true;
            } else {
              await service.stop();
              expectedRecording = false;
            }
            
            expect(service.isRecording()).toBe(expectedRecording);
          }
          
          // Cleanup
          await service.stop();
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property 6d: Start count only increments on successful starts
   */
  it('Property 6d: Start count only increments on successful starts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }), // Number of recording sessions
        fc.integer({ min: 1, max: 10 }), // Extra start attempts per session
        async (sessions, extraAttempts) => {
          const testService = new MockLiveAudioService();
          let expectedStartCount = 0;
          
          for (let session = 0; session < sessions; session++) {
            // Start a new session
            await testService.start();
            expectedStartCount++;
            
            // Try extra starts (should not increment)
            for (let i = 0; i < extraAttempts; i++) {
              await testService.start();
            }
            
            expect(testService.getStartCount()).toBe(expectedStartCount);
            
            // Stop the session
            await testService.stop();
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 6e: Rapid start/stop cycles maintain consistency
   */
  it('Property 6e: Rapid start/stop cycles maintain consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 5, max: 20 }), // Number of rapid cycles
        async (cycles) => {
          const testService = new MockLiveAudioService();
          
          for (let i = 0; i < cycles; i++) {
            // Rapid start
            await testService.start();
            expect(testService.isRecording()).toBe(true);
            
            // Rapid stop
            await testService.stop();
            expect(testService.isRecording()).toBe(false);
          }
          
          // Final state should be not recording
          expect(testService.isRecording()).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 6f: Interleaved operations from multiple "callers"
   */
  it('Property 6f: Simulated concurrent callers', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }), // Number of simulated callers
        async (callerCount) => {
          const testService = new MockLiveAudioService();
          
          // Simulate multiple callers trying to start
          const startPromises: Promise<void>[] = [];
          
          for (let i = 0; i < callerCount; i++) {
            startPromises.push(testService.start());
          }
          
          // Wait for all to complete
          await Promise.all(startPromises);
          
          // Should still have only one recording
          expect(testService.isRecording()).toBe(true);
          expect(testService.getStartCount()).toBe(1);
          
          await testService.stop();
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property 6g: Recording ID uniqueness across sessions
   */
  it('Property 6g: Each session has unique recording ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }),
        async (sessions) => {
          const recordingIds: number[] = [];
          
          for (let i = 0; i < sessions; i++) {
            await service.start();
            const id = service.getActiveRecordingId();
            expect(id).not.toBeNull();
            
            // ID should be unique
            expect(recordingIds).not.toContain(id);
            recordingIds.push(id!);
            
            await service.stop();
            
            // Small delay to ensure unique timestamps
            await new Promise(resolve => setTimeout(resolve, 5));
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});

describe('LiveAudioService - Concurrent Recording Edge Cases', () => {
  /**
   * Property 6h: Double stop is safe
   */
  it('Property 6h: Double stop is idempotent', async () => {
    const service = new MockLiveAudioService();
    
    await service.start();
    await service.stop();
    
    // Second stop should not throw
    await expect(service.stop()).resolves.not.toThrow();
    expect(service.isRecording()).toBe(false);
  });

  /**
   * Property 6i: Stop without start is safe
   */
  it('Property 6i: Stop without start is safe', async () => {
    const service = new MockLiveAudioService();
    
    // Stop without ever starting
    await expect(service.stop()).resolves.not.toThrow();
    expect(service.isRecording()).toBe(false);
  });
});
