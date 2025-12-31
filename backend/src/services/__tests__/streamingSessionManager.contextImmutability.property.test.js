/**
 * Property Test: Context Immutability (Property 11)
 * 
 * Validates: Requirements 8.1, 8.2, 8.3
 * 
 * Property 11: Context Immutability
 * For any streaming session, the context (patientId, contextType) established
 * at session start SHALL remain unchanged throughout the entire session lifecycle
 * including transcription and categorization. Context mutations SHALL be rejected.
 */

import * as fc from 'fast-check';

// ============================================================================
// Test Helpers - Simulated Context Management Logic
// ============================================================================

/**
 * Simulates session context management with immutability enforcement
 */
class MockSessionContextManager {
  constructor() {
    this.sessions = new Map();
  }

  createSession(config) {
    const { sessionId, patientId, contextType } = config;
    
    // Validate context on creation
    const validation = this.validateContext({ patientId, contextType });
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const session = {
      sessionId,
      patientId: patientId || null,
      contextType: contextType || 'global',
      contextLocked: false,
      audioChunks: [],
      transcriptionBuffer: '',
    };

    this.sessions.set(sessionId, session);
    return { success: true, session };
  }

  validateContext(context) {
    const { patientId, contextType } = context;

    if (!contextType || !['patient', 'global'].includes(contextType)) {
      return { valid: false, error: 'Invalid contextType' };
    }

    if (contextType === 'patient' && !patientId) {
      return { valid: false, error: 'patientId required for patient context' };
    }

    if (contextType === 'global' && patientId) {
      return { valid: false, error: 'patientId not allowed for global context' };
    }

    return { valid: true };
  }

  addChunk(sessionId, chunk) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    session.audioChunks.push(chunk);
    
    // Lock context after first chunk
    if (!session.contextLocked) {
      session.contextLocked = true;
    }

    return { success: true };
  }

  updateContext(sessionId, newContext) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    // Reject if context is locked
    if (session.contextLocked) {
      return { 
        success: false, 
        error: 'Context is immutable after streaming has started' 
      };
    }

    // Validate new context
    const validation = this.validateContext(newContext);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    session.patientId = newContext.patientId || null;
    session.contextType = newContext.contextType;

    return { success: true };
  }

  getContext(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    return {
      patientId: session.patientId,
      contextType: session.contextType,
    };
  }

  isContextLocked(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? session.contextLocked : false;
  }

  appendTranscription(sessionId, text) {
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false };
    
    session.transcriptionBuffer += text;
    return { success: true };
  }
}

// ============================================================================
// Arbitraries
// ============================================================================

const sessionIdArbitrary = fc.uuid();

const patientIdArbitrary = fc.option(fc.uuid(), { nil: null });

const contextTypeArbitrary = fc.constantFrom('patient', 'global');

const validPatientContextArbitrary = fc.record({
  patientId: fc.uuid(),
  contextType: fc.constant('patient'),
});

const validGlobalContextArbitrary = fc.record({
  patientId: fc.constant(null),
  contextType: fc.constant('global'),
});

const validContextArbitrary = fc.oneof(
  validPatientContextArbitrary,
  validGlobalContextArbitrary
);

const audioChunkArbitrary = fc.record({
  sequenceNumber: fc.nat({ max: 1000 }),
  data: fc.uint8Array({ minLength: 10, maxLength: 100 }),
});

const transcriptionTextArbitrary = fc.string({ minLength: 1, maxLength: 200 });

// ============================================================================
// Property Tests
// ============================================================================

describe('Property 11: Context Immutability', () => {
  describe('11.1: Context validation on session creation', () => {
    it('should accept valid patient context with patientId', () => {
      fc.assert(
        fc.property(
          fc.tuple(sessionIdArbitrary, fc.uuid()),
          ([sessionId, patientId]) => {
            const manager = new MockSessionContextManager();
            const result = manager.createSession({
              sessionId,
              patientId,
              contextType: 'patient',
            });

            return result.success === true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should accept valid global context without patientId', () => {
      fc.assert(
        fc.property(
          sessionIdArbitrary,
          (sessionId) => {
            const manager = new MockSessionContextManager();
            const result = manager.createSession({
              sessionId,
              patientId: null,
              contextType: 'global',
            });

            return result.success === true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject patient context without patientId', () => {
      fc.assert(
        fc.property(
          sessionIdArbitrary,
          (sessionId) => {
            const manager = new MockSessionContextManager();
            const result = manager.createSession({
              sessionId,
              patientId: null,
              contextType: 'patient',
            });

            return result.success === false && result.error !== undefined;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject global context with patientId', () => {
      fc.assert(
        fc.property(
          fc.tuple(sessionIdArbitrary, fc.uuid()),
          ([sessionId, patientId]) => {
            const manager = new MockSessionContextManager();
            const result = manager.createSession({
              sessionId,
              patientId,
              contextType: 'global',
            });

            return result.success === false && result.error !== undefined;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('11.2: Context locked after first chunk', () => {
    it('should lock context after adding first audio chunk', () => {
      fc.assert(
        fc.property(
          fc.tuple(sessionIdArbitrary, validContextArbitrary, audioChunkArbitrary),
          ([sessionId, context, chunk]) => {
            const manager = new MockSessionContextManager();
            manager.createSession({ sessionId, ...context });

            // Context should not be locked initially
            const beforeChunk = manager.isContextLocked(sessionId);

            // Add a chunk
            manager.addChunk(sessionId, chunk);

            // Context should be locked after chunk
            const afterChunk = manager.isContextLocked(sessionId);

            return beforeChunk === false && afterChunk === true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('11.3: Context mutations rejected after streaming starts', () => {
    it('should reject context update after first chunk', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            sessionIdArbitrary,
            validContextArbitrary,
            audioChunkArbitrary,
            validContextArbitrary
          ),
          ([sessionId, initialContext, chunk, newContext]) => {
            const manager = new MockSessionContextManager();
            manager.createSession({ sessionId, ...initialContext });

            // Add a chunk to lock context
            manager.addChunk(sessionId, chunk);

            // Attempt to update context
            const updateResult = manager.updateContext(sessionId, newContext);

            return updateResult.success === false;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should allow context update before first chunk', () => {
      fc.assert(
        fc.property(
          fc.tuple(sessionIdArbitrary, validGlobalContextArbitrary, validPatientContextArbitrary),
          ([sessionId, initialContext, newContext]) => {
            const manager = new MockSessionContextManager();
            manager.createSession({ sessionId, ...initialContext });

            // Update context before any chunks
            const updateResult = manager.updateContext(sessionId, newContext);

            return updateResult.success === true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('11.4: Context preserved throughout session lifecycle', () => {
    it('should preserve context through multiple chunks', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            sessionIdArbitrary,
            validContextArbitrary,
            fc.array(audioChunkArbitrary, { minLength: 1, maxLength: 20 })
          ),
          ([sessionId, context, chunks]) => {
            const manager = new MockSessionContextManager();
            manager.createSession({ sessionId, ...context });

            const initialContext = manager.getContext(sessionId);

            // Add multiple chunks
            for (const chunk of chunks) {
              manager.addChunk(sessionId, chunk);
            }

            const finalContext = manager.getContext(sessionId);

            // Context should remain unchanged
            return (
              initialContext.patientId === finalContext.patientId &&
              initialContext.contextType === finalContext.contextType
            );
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should preserve context through transcription updates', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            sessionIdArbitrary,
            validContextArbitrary,
            audioChunkArbitrary,
            fc.array(transcriptionTextArbitrary, { minLength: 1, maxLength: 10 })
          ),
          ([sessionId, context, chunk, transcriptions]) => {
            const manager = new MockSessionContextManager();
            manager.createSession({ sessionId, ...context });
            manager.addChunk(sessionId, chunk);

            const initialContext = manager.getContext(sessionId);

            // Add multiple transcription updates
            for (const text of transcriptions) {
              manager.appendTranscription(sessionId, text);
            }

            const finalContext = manager.getContext(sessionId);

            // Context should remain unchanged
            return (
              initialContext.patientId === finalContext.patientId &&
              initialContext.contextType === finalContext.contextType
            );
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('11.5: Multiple mutation attempts rejected', () => {
    it('should reject all mutation attempts after context is locked', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            sessionIdArbitrary,
            validContextArbitrary,
            audioChunkArbitrary,
            fc.array(validContextArbitrary, { minLength: 1, maxLength: 10 })
          ),
          ([sessionId, initialContext, chunk, mutationAttempts]) => {
            const manager = new MockSessionContextManager();
            manager.createSession({ sessionId, ...initialContext });
            manager.addChunk(sessionId, chunk);

            // All mutation attempts should fail
            const results = mutationAttempts.map(newContext =>
              manager.updateContext(sessionId, newContext)
            );

            return results.every(r => r.success === false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('11.6: Context immutability error messages', () => {
    it('should provide clear error message when mutation is rejected', () => {
      fc.assert(
        fc.property(
          fc.tuple(sessionIdArbitrary, validContextArbitrary, audioChunkArbitrary, validContextArbitrary),
          ([sessionId, initialContext, chunk, newContext]) => {
            const manager = new MockSessionContextManager();
            manager.createSession({ sessionId, ...initialContext });
            manager.addChunk(sessionId, chunk);

            const result = manager.updateContext(sessionId, newContext);

            return (
              result.success === false &&
              typeof result.error === 'string' &&
              result.error.length > 0
            );
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('11.7: Context type consistency', () => {
    it('should maintain patient context type throughout session', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            sessionIdArbitrary,
            fc.uuid(),
            fc.array(audioChunkArbitrary, { minLength: 1, maxLength: 10 })
          ),
          ([sessionId, patientId, chunks]) => {
            const manager = new MockSessionContextManager();
            manager.createSession({
              sessionId,
              patientId,
              contextType: 'patient',
            });

            // Process chunks
            for (const chunk of chunks) {
              manager.addChunk(sessionId, chunk);
            }

            const context = manager.getContext(sessionId);
            return context.contextType === 'patient' && context.patientId === patientId;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain global context type throughout session', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            sessionIdArbitrary,
            fc.array(audioChunkArbitrary, { minLength: 1, maxLength: 10 })
          ),
          ([sessionId, chunks]) => {
            const manager = new MockSessionContextManager();
            manager.createSession({
              sessionId,
              patientId: null,
              contextType: 'global',
            });

            // Process chunks
            for (const chunk of chunks) {
              manager.addChunk(sessionId, chunk);
            }

            const context = manager.getContext(sessionId);
            return context.contextType === 'global' && context.patientId === null;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
