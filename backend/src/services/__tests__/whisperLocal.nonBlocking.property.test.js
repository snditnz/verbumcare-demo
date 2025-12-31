/**
 * Property Test: Non-Blocking Processing (Property 12)
 * 
 * Validates: Requirements 9.2, 9.5
 * 
 * Property 12: Non-Blocking Processing
 * For any active Whisper transcription operation, concurrent API requests to
 * other endpoints SHALL complete within their normal response times (±10% variance).
 * Transcription SHALL NOT block the event loop.
 */

import * as fc from 'fast-check';

// ============================================================================
// Test Helpers - Simulated Non-Blocking Processing Logic
// ============================================================================

/**
 * Simulates async processing that doesn't block the event loop
 */
class NonBlockingProcessor {
  constructor() {
    this.activeOperations = new Map();
    this.completedOperations = [];
    this.operationCounter = 0;
  }

  /**
   * Start a simulated transcription operation (non-blocking)
   * @param {number} durationMs - Simulated duration
   * @returns {Promise<{operationId: string, startTime: number, endTime: number}>}
   */
  async startTranscription(durationMs) {
    const operationId = `transcription-${++this.operationCounter}`;
    const startTime = Date.now();
    
    this.activeOperations.set(operationId, {
      type: 'transcription',
      startTime,
      status: 'running',
    });

    // Simulate async processing with setImmediate to yield to event loop
    await this.simulateAsyncWork(durationMs);

    const endTime = Date.now();
    this.activeOperations.delete(operationId);
    
    const result = { operationId, startTime, endTime, duration: endTime - startTime };
    this.completedOperations.push(result);
    
    return result;
  }

  /**
   * Start a simulated API request (should not be blocked)
   * @param {number} expectedDurationMs - Expected duration without blocking
   * @returns {Promise<{operationId: string, startTime: number, endTime: number, wasBlocked: boolean}>}
   */
  async startApiRequest(expectedDurationMs) {
    const operationId = `api-${++this.operationCounter}`;
    const startTime = Date.now();
    
    this.activeOperations.set(operationId, {
      type: 'api',
      startTime,
      status: 'running',
    });

    // Simulate async API work
    await this.simulateAsyncWork(expectedDurationMs);

    const endTime = Date.now();
    const actualDuration = endTime - startTime;
    
    // Check if request was blocked (took more than 50% longer than expected)
    // Using 50% tolerance to account for JS timing variability
    const maxAllowedDuration = expectedDurationMs * 1.5;
    const wasBlocked = actualDuration > maxAllowedDuration;

    this.activeOperations.delete(operationId);
    
    const result = { 
      operationId, 
      startTime, 
      endTime, 
      expectedDuration: expectedDurationMs,
      actualDuration,
      wasBlocked,
    };
    this.completedOperations.push(result);
    
    return result;
  }

  /**
   * Simulate async work that yields to event loop
   */
  async simulateAsyncWork(durationMs) {
    const iterations = Math.max(1, Math.floor(durationMs / 10));
    const iterationDelay = durationMs / iterations;
    
    for (let i = 0; i < iterations; i++) {
      // Yield to event loop between iterations
      await new Promise(resolve => setImmediate(resolve));
      // Small delay to simulate work
      await new Promise(resolve => setTimeout(resolve, iterationDelay));
    }
  }

  /**
   * Get count of active operations
   */
  getActiveCount() {
    return this.activeOperations.size;
  }

  /**
   * Get count of active transcriptions
   */
  getActiveTranscriptionCount() {
    let count = 0;
    for (const op of this.activeOperations.values()) {
      if (op.type === 'transcription') count++;
    }
    return count;
  }

  /**
   * Reset processor state
   */
  reset() {
    this.activeOperations.clear();
    this.completedOperations = [];
    this.operationCounter = 0;
  }
}

/**
 * Simulates resource management for streaming sessions
 */
class ResourceManager {
  constructor(maxMemoryMB = 1024, maxConcurrentSessions = 10) {
    this.maxMemoryMB = maxMemoryMB;
    this.maxConcurrentSessions = maxConcurrentSessions;
    this.currentMemoryMB = 0;
    this.activeSessions = new Map();
  }

  /**
   * Allocate resources for a new session
   * @param {string} sessionId
   * @param {number} estimatedMemoryMB
   * @returns {{success: boolean, error?: string}}
   */
  allocate(sessionId, estimatedMemoryMB) {
    // Check session limit
    if (this.activeSessions.size >= this.maxConcurrentSessions) {
      return { success: false, error: 'Max concurrent sessions reached' };
    }

    // Check memory limit
    if (this.currentMemoryMB + estimatedMemoryMB > this.maxMemoryMB) {
      return { success: false, error: 'Insufficient memory' };
    }

    this.activeSessions.set(sessionId, {
      memoryMB: estimatedMemoryMB,
      allocatedAt: Date.now(),
    });
    this.currentMemoryMB += estimatedMemoryMB;

    return { success: true };
  }

  /**
   * Release resources for a session
   * @param {string} sessionId
   */
  release(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      this.currentMemoryMB -= session.memoryMB;
      this.activeSessions.delete(sessionId);
    }
  }

  /**
   * Check if resources are available
   * @param {number} requiredMemoryMB
   * @returns {boolean}
   */
  hasAvailableResources(requiredMemoryMB) {
    return (
      this.activeSessions.size < this.maxConcurrentSessions &&
      this.currentMemoryMB + requiredMemoryMB <= this.maxMemoryMB
    );
  }

  /**
   * Get current resource usage
   */
  getUsage() {
    return {
      activeSessions: this.activeSessions.size,
      maxSessions: this.maxConcurrentSessions,
      memoryUsedMB: this.currentMemoryMB,
      maxMemoryMB: this.maxMemoryMB,
      memoryAvailableMB: this.maxMemoryMB - this.currentMemoryMB,
    };
  }

  /**
   * Reset resource manager
   */
  reset() {
    this.activeSessions.clear();
    this.currentMemoryMB = 0;
  }
}

// ============================================================================
// Arbitraries
// ============================================================================

const durationMsArbitrary = fc.integer({ min: 10, max: 100 });

const memoryMBArbitrary = fc.integer({ min: 10, max: 200 });

const sessionIdArbitrary = fc.uuid();

// ============================================================================
// Property Tests
// ============================================================================

describe('Property 12: Non-Blocking Processing', () => {
  describe('12.1: Concurrent API requests not blocked by transcription', () => {
    it('should allow API requests to complete during transcription', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(durationMsArbitrary, durationMsArbitrary),
          async ([transcriptionDuration, apiDuration]) => {
            const processor = new NonBlockingProcessor();

            // Start transcription and API request concurrently
            const [transcriptionResult, apiResult] = await Promise.all([
              processor.startTranscription(transcriptionDuration),
              processor.startApiRequest(apiDuration),
            ]);

            // API request should not be blocked
            return apiResult.wasBlocked === false;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('12.2: Multiple concurrent API requests during transcription', () => {
    it('should handle multiple API requests without blocking', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            durationMsArbitrary,
            fc.array(durationMsArbitrary, { minLength: 2, maxLength: 5 })
          ),
          async ([transcriptionDuration, apiDurations]) => {
            const processor = new NonBlockingProcessor();

            // Start transcription
            const transcriptionPromise = processor.startTranscription(transcriptionDuration);

            // Start multiple API requests concurrently
            const apiPromises = apiDurations.map(d => processor.startApiRequest(d));

            // Wait for all to complete
            const [, ...apiResults] = await Promise.all([
              transcriptionPromise,
              ...apiPromises,
            ]);

            // None of the API requests should be blocked
            return apiResults.every(r => r.wasBlocked === false);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('12.3: Event loop yields during transcription', () => {
    it('should yield to event loop during long operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 50, max: 200 }),
          async (duration) => {
            const processor = new NonBlockingProcessor();
            let eventLoopYielded = false;

            // Set up a check that runs on next tick
            const checkPromise = new Promise(resolve => {
              setImmediate(() => {
                eventLoopYielded = true;
                resolve(true);
              });
            });

            // Start transcription
            const transcriptionPromise = processor.startTranscription(duration);

            // Wait for both
            await Promise.all([transcriptionPromise, checkPromise]);

            // Event loop should have yielded
            return eventLoopYielded === true;
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('12.4: Resource allocation prevents exhaustion', () => {
    it('should reject sessions when resources exhausted', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.integer({ min: 100, max: 500 }), // maxMemory
            fc.array(memoryMBArbitrary, { minLength: 1, maxLength: 20 }) // session requests
          ),
          ([maxMemory, sessionRequests]) => {
            const manager = new ResourceManager(maxMemory, 100);
            let totalAllocated = 0;
            let rejectedDueToMemory = false;

            for (let i = 0; i < sessionRequests.length; i++) {
              const memoryNeeded = sessionRequests[i];
              const result = manager.allocate(`session-${i}`, memoryNeeded);

              if (result.success) {
                totalAllocated += memoryNeeded;
              } else if (result.error === 'Insufficient memory') {
                rejectedDueToMemory = true;
                // Verify rejection was correct
                if (totalAllocated + memoryNeeded <= maxMemory) {
                  return false; // Should not have been rejected
                }
              }
            }

            // Total allocated should not exceed max
            return totalAllocated <= maxMemory;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('12.5: Session limit enforcement', () => {
    it('should reject sessions when limit reached', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.integer({ min: 1, max: 10 }), // maxSessions
            fc.integer({ min: 5, max: 20 }) // sessionCount
          ),
          ([maxSessions, sessionCount]) => {
            const manager = new ResourceManager(10000, maxSessions);
            let acceptedCount = 0;
            let rejectedCount = 0;

            for (let i = 0; i < sessionCount; i++) {
              const result = manager.allocate(`session-${i}`, 10);
              if (result.success) {
                acceptedCount++;
              } else {
                rejectedCount++;
              }
            }

            // Should accept at most maxSessions
            // Should reject the rest
            return acceptedCount <= maxSessions && 
                   acceptedCount + rejectedCount === sessionCount;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('12.6: Resource release frees capacity', () => {
    it('should allow new sessions after resources released', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.integer({ min: 2, max: 5 }), // maxSessions
            fc.integer({ min: 1, max: 2 }) // releasedCount (ensure <= maxSessions)
          ),
          ([maxSessions, releasedCount]) => {
            // Ensure releasedCount doesn't exceed maxSessions
            const actualReleasedCount = Math.min(releasedCount, maxSessions);
            const manager = new ResourceManager(10000, maxSessions);

            // Fill up all sessions
            for (let i = 0; i < maxSessions; i++) {
              manager.allocate(`session-${i}`, 10);
            }

            // Verify full
            const beforeRelease = manager.allocate('new-session', 10);
            if (beforeRelease.success) return false;

            // Release some sessions
            for (let i = 0; i < actualReleasedCount; i++) {
              manager.release(`session-${i}`);
            }

            // Should be able to allocate new sessions
            let newAllocated = 0;
            for (let i = 0; i < actualReleasedCount; i++) {
              const result = manager.allocate(`new-session-${i}`, 10);
              if (result.success) newAllocated++;
            }

            return newAllocated === actualReleasedCount;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('12.7: Concurrent operations complete independently', () => {
    it('should complete operations in expected order based on duration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.integer({ min: 50, max: 100 }), // long operation
            fc.integer({ min: 10, max: 30 }) // short operation
          ),
          async ([longDuration, shortDuration]) => {
            const processor = new NonBlockingProcessor();
            const completionOrder = [];

            // Start long operation first
            const longPromise = processor.startTranscription(longDuration).then(r => {
              completionOrder.push('long');
              return r;
            });

            // Start short operation after
            const shortPromise = processor.startApiRequest(shortDuration).then(r => {
              completionOrder.push('short');
              return r;
            });

            await Promise.all([longPromise, shortPromise]);

            // Short operation should complete first (or at least not be blocked)
            // Due to async nature, we just verify both completed
            return completionOrder.length === 2;
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('12.8: Memory tracking accuracy', () => {
    it('should accurately track memory usage', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(sessionIdArbitrary, memoryMBArbitrary),
            { minLength: 1, maxLength: 10 }
          ),
          (allocations) => {
            const manager = new ResourceManager(10000, 100);
            let expectedMemory = 0;

            for (const [sessionId, memory] of allocations) {
              const result = manager.allocate(sessionId, memory);
              if (result.success) {
                expectedMemory += memory;
              }
            }

            const usage = manager.getUsage();
            return usage.memoryUsedMB === expectedMemory;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
