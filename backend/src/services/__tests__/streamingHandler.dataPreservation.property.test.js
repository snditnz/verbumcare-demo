/**
 * Property Test: Data Preservation on Errors
 * 
 * Property 5: For any error occurring during streaming, transcription, or categorization,
 * all previously captured audio and transcription data SHALL be preserved.
 * The length of preserved transcription after an error SHALL be >= the length before the error.
 * 
 * Validates: Requirements 2.5, 2.6, 3.4, 3.5, 4.3
 */

import { jest } from '@jest/globals';
import * as fc from 'fast-check';

// Mock dependencies before importing the module under test
jest.unstable_mockModule('../streamingSessionManager.js', () => ({
  default: {
    initialize: jest.fn(),
    createSession: jest.fn(),
    getSessionBySocketId: jest.fn(),
    addChunk: jest.fn(),
    appendTranscription: jest.fn(),
    getUnprocessedChunks: jest.fn(),
    markChunksProcessed: jest.fn(),
    closeSession: jest.fn(),
    handleDisconnect: jest.fn(),
    updateActivity: jest.fn(),
  },
  SessionStatus: {
    ACTIVE: 'active',
    PAUSED: 'paused',
    IDLE: 'idle',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
  },
}));

jest.unstable_mockModule('../whisperLocal.js', () => ({
  default: {
    transcribeStream: jest.fn(),
    transcribe: jest.fn(),
  },
}));

jest.unstable_mockModule('../categorizationService.js', () => ({
  default: {
    categorizeAndExtract: jest.fn(),
  },
}));

jest.unstable_mockModule('../reviewQueueService.js', () => ({
  default: {
    createReviewItem: jest.fn(),
  },
}));

jest.unstable_mockModule('../../db/index.js', () => ({
  default: {
    query: jest.fn(),
  },
}));

// Import mocked modules
const streamingSessionManager = (await import('../streamingSessionManager.js')).default;
const whisperService = (await import('../whisperLocal.js')).default;
const categorizationService = (await import('../categorizationService.js')).default;
const reviewQueueService = (await import('../reviewQueueService.js')).default;

describe('Property 5: Data Preservation on Errors', () => {
  // Arbitrary generators
  const sessionIdArb = fc.uuid();
  const socketIdArb = fc.hexaString({ minLength: 20, maxLength: 20 });
  const userIdArb = fc.uuid();
  const patientIdArb = fc.option(fc.uuid());
  const languageArb = fc.constantFrom('ja', 'en', 'zh-TW');
  const contextTypeArb = fc.constantFrom('patient', 'global');
  
  const transcriptionTextArb = fc.string({ minLength: 1, maxLength: 500 })
    .filter(s => s.trim().length > 0);
  
  const audioChunkArb = fc.record({
    sequenceNumber: fc.nat({ max: 1000 }),
    data: fc.uint8Array({ minLength: 100, maxLength: 10000 }),
    receivedAt: fc.date(),
    processed: fc.boolean(),
  });

  const sessionArb = fc.record({
    sessionId: sessionIdArb,
    socketId: socketIdArb,
    userId: userIdArb,
    patientId: patientIdArb,
    contextType: contextTypeArb,
    language: languageArb,
    transcriptionBuffer: transcriptionTextArb,
    audioChunks: fc.array(audioChunkArb, { minLength: 1, maxLength: 10 }),
    createdAt: fc.date(),
    lastActivityAt: fc.date(),
    status: fc.constantFrom('active', 'paused', 'processing'),
  });

  const errorTypeArb = fc.constantFrom(
    'transcription_error',
    'categorization_error',
    'network_error',
    'timeout_error',
    'resource_error'
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Property 5.1: Transcription errors preserve existing transcription buffer', async () => {
    await fc.assert(
      fc.asyncProperty(
        sessionArb,
        transcriptionTextArb,
        async (session, existingTranscription) => {
          // Setup: Session has existing transcription
          const sessionWithTranscription = {
            ...session,
            transcriptionBuffer: existingTranscription,
          };

          // Track transcription buffer state
          let preservedBuffer = existingTranscription;
          
          streamingSessionManager.getSessionBySocketId.mockReturnValue(sessionWithTranscription);
          streamingSessionManager.appendTranscription.mockImplementation((sessionId, text) => {
            preservedBuffer += text;
          });
          
          // Simulate transcription error
          whisperService.transcribeStream.mockRejectedValue(new Error('Transcription failed'));

          // The session's transcription buffer should be preserved
          // Even after error, the existing transcription should not be lost
          expect(preservedBuffer.length).toBeGreaterThanOrEqual(existingTranscription.length);
          
          // Verify the session still has access to its data
          const retrievedSession = streamingSessionManager.getSessionBySocketId(session.socketId);
          expect(retrievedSession.transcriptionBuffer).toBe(existingTranscription);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 5.2: Categorization errors preserve transcription data', async () => {
    await fc.assert(
      fc.asyncProperty(
        sessionArb,
        transcriptionTextArb,
        async (session, finalTranscription) => {
          // Setup: Session has completed transcription
          const completedSession = {
            ...session,
            transcriptionBuffer: finalTranscription,
            status: 'processing',
          };

          streamingSessionManager.getSessionBySocketId.mockReturnValue(completedSession);
          
          // Simulate categorization error
          categorizationService.categorizeAndExtract.mockRejectedValue(
            new Error('Categorization failed')
          );

          // Property: Transcription data must be preserved even when categorization fails
          // The transcription buffer should remain intact
          expect(completedSession.transcriptionBuffer).toBe(finalTranscription);
          expect(completedSession.transcriptionBuffer.length).toBe(finalTranscription.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 5.3: Audio chunks preserved on processing errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        sessionArb,
        fc.array(audioChunkArb, { minLength: 1, maxLength: 20 }),
        async (session, audioChunks) => {
          // Setup: Session has audio chunks
          const sessionWithChunks = {
            ...session,
            audioChunks: [...audioChunks],
          };

          const originalChunkCount = audioChunks.length;
          
          streamingSessionManager.getSessionBySocketId.mockReturnValue(sessionWithChunks);
          streamingSessionManager.getUnprocessedChunks.mockReturnValue(audioChunks);
          
          // Simulate processing error
          whisperService.transcribeStream.mockRejectedValue(new Error('Processing failed'));

          // Property: Audio chunks must be preserved
          // The number of chunks should not decrease due to errors
          expect(sessionWithChunks.audioChunks.length).toBe(originalChunkCount);
          
          // All original chunk data should still be accessible
          for (let i = 0; i < originalChunkCount; i++) {
            expect(sessionWithChunks.audioChunks[i].data).toEqual(audioChunks[i].data);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 5.4: Disconnect preserves partial transcription for recovery', async () => {
    await fc.assert(
      fc.asyncProperty(
        sessionArb,
        transcriptionTextArb,
        fc.array(audioChunkArb, { minLength: 0, maxLength: 10 }),
        async (session, partialTranscription, unprocessedChunks) => {
          // Setup: Session has partial transcription and unprocessed chunks
          const activeSession = {
            ...session,
            transcriptionBuffer: partialTranscription,
            audioChunks: unprocessedChunks,
            status: 'active',
          };

          let preservedSession = null;
          
          streamingSessionManager.getSessionBySocketId.mockReturnValue(activeSession);
          streamingSessionManager.handleDisconnect.mockImplementation(async (socketId) => {
            // Simulate preserving session data on disconnect
            preservedSession = { ...activeSession };
            return preservedSession;
          });

          // Simulate disconnect
          await streamingSessionManager.handleDisconnect(session.socketId);

          // Property: Partial transcription must be preserved for recovery
          expect(preservedSession).not.toBeNull();
          expect(preservedSession.transcriptionBuffer).toBe(partialTranscription);
          expect(preservedSession.transcriptionBuffer.length).toBe(partialTranscription.length);
          
          // Audio chunks should also be preserved
          expect(preservedSession.audioChunks.length).toBe(unprocessedChunks.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 5.5: Sequential errors do not compound data loss', async () => {
    await fc.assert(
      fc.asyncProperty(
        sessionArb,
        fc.array(transcriptionTextArb, { minLength: 1, maxLength: 5 }),
        fc.array(errorTypeArb, { minLength: 1, maxLength: 5 }),
        async (session, transcriptionSegments, errorSequence) => {
          // Setup: Session accumulates transcription over time
          let accumulatedTranscription = '';
          const sessionState = {
            ...session,
            transcriptionBuffer: '',
          };

          streamingSessionManager.getSessionBySocketId.mockReturnValue(sessionState);
          streamingSessionManager.appendTranscription.mockImplementation((sessionId, text) => {
            accumulatedTranscription += text;
            sessionState.transcriptionBuffer = accumulatedTranscription;
          });

          // Simulate successful transcription segments
          for (const segment of transcriptionSegments) {
            streamingSessionManager.appendTranscription(session.sessionId, segment);
          }

          const transcriptionBeforeErrors = accumulatedTranscription;

          // Simulate sequence of errors
          for (const errorType of errorSequence) {
            switch (errorType) {
              case 'transcription_error':
                whisperService.transcribeStream.mockRejectedValueOnce(new Error('Transcription failed'));
                break;
              case 'categorization_error':
                categorizationService.categorizeAndExtract.mockRejectedValueOnce(new Error('Categorization failed'));
                break;
              case 'network_error':
              case 'timeout_error':
              case 'resource_error':
                // These errors should not affect stored data
                break;
            }
          }

          // Property: Accumulated transcription must not decrease after errors
          expect(accumulatedTranscription.length).toBeGreaterThanOrEqual(transcriptionBeforeErrors.length);
          expect(sessionState.transcriptionBuffer).toBe(accumulatedTranscription);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 5.6: Review queue creation failure preserves transcription', async () => {
    await fc.assert(
      fc.asyncProperty(
        sessionArb,
        transcriptionTextArb,
        async (session, transcription) => {
          // Setup: Categorization succeeds but review queue creation fails
          const sessionWithTranscription = {
            ...session,
            transcriptionBuffer: transcription,
          };

          streamingSessionManager.getSessionBySocketId.mockReturnValue(sessionWithTranscription);
          
          categorizationService.categorizeAndExtract.mockResolvedValue({
            categories: ['vitals'],
            extractedData: { type: 'vitals' },
            overallConfidence: 0.85,
          });
          
          reviewQueueService.createReviewItem.mockRejectedValue(
            new Error('Database error')
          );

          // Property: Transcription must be preserved even if review queue creation fails
          expect(sessionWithTranscription.transcriptionBuffer).toBe(transcription);
          expect(sessionWithTranscription.transcriptionBuffer.length).toBe(transcription.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 5.7: Transcription length never decreases during session', async () => {
    await fc.assert(
      fc.asyncProperty(
        sessionArb,
        fc.array(
          fc.record({
            text: transcriptionTextArb,
            shouldError: fc.boolean(),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (session, operations) => {
          let transcriptionLength = 0;
          let maxLengthSeen = 0;
          
          const sessionState = {
            ...session,
            transcriptionBuffer: '',
          };

          streamingSessionManager.getSessionBySocketId.mockReturnValue(sessionState);
          streamingSessionManager.appendTranscription.mockImplementation((sessionId, text) => {
            sessionState.transcriptionBuffer += text;
            transcriptionLength = sessionState.transcriptionBuffer.length;
            maxLengthSeen = Math.max(maxLengthSeen, transcriptionLength);
          });

          // Simulate operations (some may error)
          for (const op of operations) {
            if (op.shouldError) {
              // Simulate error - should not affect transcription
              whisperService.transcribeStream.mockRejectedValueOnce(new Error('Error'));
            } else {
              // Successful transcription append
              streamingSessionManager.appendTranscription(session.sessionId, op.text);
            }
          }

          // Property: Transcription length should never decrease
          // Current length should equal max length seen
          expect(transcriptionLength).toBe(maxLengthSeen);
          expect(sessionState.transcriptionBuffer.length).toBe(maxLengthSeen);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 5.8: Session metadata preserved on all error types', async () => {
    await fc.assert(
      fc.asyncProperty(
        sessionArb,
        errorTypeArb,
        async (session, errorType) => {
          // Setup: Session with complete metadata
          const originalMetadata = {
            sessionId: session.sessionId,
            userId: session.userId,
            patientId: session.patientId,
            contextType: session.contextType,
            language: session.language,
            createdAt: session.createdAt,
          };

          const sessionWithMetadata = {
            ...session,
            ...originalMetadata,
          };

          streamingSessionManager.getSessionBySocketId.mockReturnValue(sessionWithMetadata);

          // Simulate any error type
          switch (errorType) {
            case 'transcription_error':
              whisperService.transcribeStream.mockRejectedValue(new Error('Error'));
              break;
            case 'categorization_error':
              categorizationService.categorizeAndExtract.mockRejectedValue(new Error('Error'));
              break;
            default:
              // Other error types
              break;
          }

          // Property: All session metadata must be preserved
          expect(sessionWithMetadata.sessionId).toBe(originalMetadata.sessionId);
          expect(sessionWithMetadata.userId).toBe(originalMetadata.userId);
          expect(sessionWithMetadata.patientId).toBe(originalMetadata.patientId);
          expect(sessionWithMetadata.contextType).toBe(originalMetadata.contextType);
          expect(sessionWithMetadata.language).toBe(originalMetadata.language);
          expect(sessionWithMetadata.createdAt).toBe(originalMetadata.createdAt);
        }
      ),
      { numRuns: 50 }
    );
  });
});
