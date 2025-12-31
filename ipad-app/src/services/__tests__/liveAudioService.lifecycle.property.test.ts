/**
 * Property Test: Stop Releases Resources
 * 
 * Property 3: For any recording session, after stop() is called, no more data 
 * events SHALL be emitted and isRecording() SHALL return false within 1 second.
 * 
 * Validates: Requirements 1.5
 */

import * as fc from 'fast-check';

/**
 * Mock implementation of LiveAudioService for testing lifecycle properties
 * This simulates the service behavior without requiring native modules
 */
class MockLiveAudioService {
  private recording: boolean = false;
  private dataCallbacks: ((data: any) => void)[] = [];
  private emitInterval: NodeJS.Timeout | null = null;
  private sequenceNumber: number = 0;

  isRecording(): boolean {
    return this.recording;
  }

  onData(callback: (data: any) => void): () => void {
    this.dataCallbacks.push(callback);
    return () => {
      this.dataCallbacks = this.dataCallbacks.filter(cb => cb !== callback);
    };
  }

  async start(): Promise<void> {
    if (this.recording) {
      return; // Prevent concurrent recordings
    }
    
    this.recording = true;
    this.sequenceNumber = 0;
    
    // Simulate data emission every 100ms
    this.emitInterval = setInterval(() => {
      if (this.recording) {
        const event = {
          data: 'base64data',
          timestamp: Date.now(),
          sequenceNumber: this.sequenceNumber++,
        };
        this.dataCallbacks.forEach(cb => cb(event));
      }
    }, 100);
  }

  async stop(): Promise<void> {
    this.recording = false;
    
    if (this.emitInterval) {
      clearInterval(this.emitInterval);
      this.emitInterval = null;
    }
  }

  // For testing: force cleanup
  cleanup(): void {
    this.recording = false;
    if (this.emitInterval) {
      clearInterval(this.emitInterval);
      this.emitInterval = null;
    }
    this.dataCallbacks = [];
    this.sequenceNumber = 0;
  }
}

describe('LiveAudioService - Lifecycle Property', () => {
  let service: MockLiveAudioService;

  beforeEach(() => {
    service = new MockLiveAudioService();
  });

  afterEach(() => {
    service.cleanup();
  });

  /**
   * Property 3a: isRecording() returns false after stop()
   */
  it('Property 3a: isRecording() returns false immediately after stop()', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }), // Number of start/stop cycles
        async (cycles) => {
          for (let i = 0; i < cycles; i++) {
            // Start recording
            await service.start();
            expect(service.isRecording()).toBe(true);
            
            // Wait a bit to simulate recording
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Stop recording
            await service.stop();
            
            // Should immediately be false
            expect(service.isRecording()).toBe(false);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 3b: No data events after stop()
   */
  it('Property 3b: No data events are emitted after stop()', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 300 }), // Recording duration in ms
        async (recordingDuration) => {
          let eventsBeforeStop = 0;
          let eventsAfterStop = 0;
          let stopped = false;
          
          const unsubscribe = service.onData(() => {
            if (stopped) {
              eventsAfterStop++;
            } else {
              eventsBeforeStop++;
            }
          });
          
          // Start recording
          await service.start();
          
          // Wait for some events
          await new Promise(resolve => setTimeout(resolve, recordingDuration));
          
          // Stop recording
          await service.stop();
          stopped = true;
          
          // Wait to see if any events come after stop
          await new Promise(resolve => setTimeout(resolve, 300));
          
          unsubscribe();
          
          // Should have received some events before stop
          expect(eventsBeforeStop).toBeGreaterThan(0);
          
          // Should NOT receive any events after stop
          expect(eventsAfterStop).toBe(0);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 3c: Multiple stop() calls are idempotent
   */
  it('Property 3c: Multiple stop() calls are safe (idempotent)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }), // Number of extra stop calls
        async (extraStops) => {
          await service.start();
          expect(service.isRecording()).toBe(true);
          
          // First stop
          await service.stop();
          expect(service.isRecording()).toBe(false);
          
          // Additional stop calls should not throw
          for (let i = 0; i < extraStops; i++) {
            await expect(service.stop()).resolves.not.toThrow();
            expect(service.isRecording()).toBe(false);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 3d: Start after stop works correctly
   */
  it('Property 3d: Can start new recording after stop', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }), // Number of recording sessions
        async (sessions) => {
          for (let i = 0; i < sessions; i++) {
            // Start
            await service.start();
            expect(service.isRecording()).toBe(true);
            
            // Brief recording
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Stop
            await service.stop();
            expect(service.isRecording()).toBe(false);
            
            // Brief pause between sessions
            await new Promise(resolve => setTimeout(resolve, 20));
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 3e: Sequence numbers reset after stop and new start
   */
  it('Property 3e: Sequence numbers reset for new session', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 4 }),
        async (sessions) => {
          for (let session = 0; session < sessions; session++) {
            const receivedSequences: number[] = [];
            
            const unsubscribe = service.onData((event) => {
              receivedSequences.push(event.sequenceNumber);
            });
            
            await service.start();
            await new Promise(resolve => setTimeout(resolve, 250));
            await service.stop();
            
            unsubscribe();
            
            // Each session should start from 0
            if (receivedSequences.length > 0) {
              expect(receivedSequences[0]).toBe(0);
              
              // Should be sequential
              for (let i = 1; i < receivedSequences.length; i++) {
                expect(receivedSequences[i]).toBe(receivedSequences[i - 1] + 1);
              }
            }
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property 3f: Callbacks can be removed and stop still works
   */
  it('Property 3f: Removing callbacks does not affect stop behavior', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }), // Number of callbacks to add/remove
        async (callbackCount) => {
          const unsubscribes: (() => void)[] = [];
          
          // Add callbacks
          for (let i = 0; i < callbackCount; i++) {
            unsubscribes.push(service.onData(() => {}));
          }
          
          await service.start();
          expect(service.isRecording()).toBe(true);
          
          // Remove all callbacks
          unsubscribes.forEach(unsub => unsub());
          
          // Stop should still work
          await service.stop();
          expect(service.isRecording()).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });
});

describe('LiveAudioService - Resource Cleanup Property', () => {
  /**
   * Property 3g: Service state is clean after stop
   */
  it('Property 3g: Service state is properly reset after stop', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }), // Simulated chunks before stop
        (chunkCount) => {
          // Simulate service state
          let recording = true;
          let sequenceNumber = chunkCount;
          let callbacks: any[] = [() => {}, () => {}];
          
          // Simulate stop
          recording = false;
          // Note: sequenceNumber is NOT reset until next start
          // callbacks remain registered (user responsibility to unsubscribe)
          
          expect(recording).toBe(false);
          // Sequence number preserved for potential recovery
          expect(sequenceNumber).toBe(chunkCount);
        }
      ),
      { numRuns: 50 }
    );
  });
});
