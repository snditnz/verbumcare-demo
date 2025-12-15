/**
 * Property-Based Tests for Error Notification
 * 
 * Feature: voice-first-ai-categorization, Property 36: Error notification
 * Validates: Requirements 9.3
 * 
 * Tests that error notifications are sent when processing fails
 */

import pkg from '@jest/globals';
const { jest } = pkg;
import fc from 'fast-check';
import backgroundProcessor from '../backgroundProcessor.js';
import db from '../../db/index.js';

// Mock the aiExtraction module
const mockProcessVoiceToStructured = jest.fn();
jest.mock('../aiExtraction.js', () => ({
  processVoiceToStructured: mockProcessVoiceToStructured,
  validateStructuredData: jest.fn()
}));

describe('Property 36: Error Notification', () => {
  let mockIO;
  let emittedEvents;

  beforeEach(() => {
    // Mock Socket.IO
    emittedEvents = [];
    mockIO = {
      emit: jest.fn((event, data) => {
        emittedEvents.push({ event, data });
      }),
      to: jest.fn(() => mockIO)
    };
    
    backgroundProcessor.setSocketIO(mockIO);
    
    // Reset mock function
    mockProcessVoiceToStructured.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property: For any processing failure, an error notification SHALL be emitted
   */
  test('Property 36: Error notifications are sent for all processing failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random recording IDs and error scenarios
        fc.record({
          recordingId: fc.uuid(),
          userId: fc.uuid(),
          errorType: fc.constantFrom(
            'transcription_failed',
            'extraction_failed',
            'categorization_failed',
            'database_error',
            'file_not_found',
            'timeout'
          ),
          errorMessage: fc.string({ minLength: 10, maxLength: 100 })
        }),
        async ({ recordingId, userId, errorType, errorMessage }) => {
          // Reset events
          emittedEvents = [];

          // Mock database to return recording with user
          jest.spyOn(db, 'query').mockImplementation((query, params) => {
            if (query.includes('SELECT vr.*, p.family_name')) {
              return Promise.resolve({
                rows: [{
                  recording_id: recordingId,
                  recorded_by: userId,
                  audio_file_path: '/fake/path/audio.m4a',
                  context_type: 'patient',
                  context_patient_id: fc.sample(fc.uuid(), 1)[0]
                }]
              });
            }
            if (query.includes('UPDATE voice_recordings')) {
              return Promise.resolve({ rows: [] });
            }
            return Promise.resolve({ rows: [] });
          });

          // Simulate processing failure by throwing error
          mockProcessVoiceToStructured.mockRejectedValue(new Error(errorMessage));

          // Trigger processing (will fail)
          try {
            await backgroundProcessor.processRecording(recordingId, { language: 'ja' });
          } catch (error) {
            // Expected to fail
          }

          // Wait for async operations
          await new Promise(resolve => setTimeout(resolve, 100));

          // Property: Error notification MUST be emitted
          const errorEvents = emittedEvents.filter(e => 
            e.event === 'voice-processing-error' || 
            (e.event === 'voice-processing-progress' && e.data.status === 'failed')
          );

          // Verify error notification was sent
          expect(errorEvents.length).toBeGreaterThan(0);

          // Verify error notification contains recording ID
          const hasRecordingId = errorEvents.some(e => 
            e.data.recording_id === recordingId || e.data.recording_id === recordingId
          );
          expect(hasRecordingId).toBe(true);

          // Verify error message is included
          const hasErrorMessage = errorEvents.some(e => 
            e.data.error || e.data.message
          );
          expect(hasErrorMessage).toBe(true);

          // Cleanup
          mockProcessVoiceToStructured.mockClear();
        }
      ),
      { numRuns: 100, timeout: 30000 }
    );
  });

  /**
   * Property: Error notifications SHALL include the recording ID
   */
  test('Property 36.1: Error notifications include recording ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.string({ minLength: 10, maxLength: 50 }),
        async (recordingId, userId, errorMsg) => {
          emittedEvents = [];

          // Mock database
          jest.spyOn(db, 'query').mockImplementation((query) => {
            if (query.includes('SELECT vr.*, p.family_name')) {
              return Promise.resolve({
                rows: [{
                  recording_id: recordingId,
                  recorded_by: userId,
                  audio_file_path: '/fake/path.m4a'
                }]
              });
            }
            return Promise.resolve({ rows: [] });
          });

          // Mock failure
          mockProcessVoiceToStructured.mockRejectedValue(new Error(errorMsg));

          try {
            await backgroundProcessor.processRecording(recordingId);
          } catch (e) {}

          await new Promise(resolve => setTimeout(resolve, 100));

          // Property: All error events MUST include recording_id
          const errorEvents = emittedEvents.filter(e => 
            e.event === 'voice-processing-error' || 
            (e.event === 'voice-processing-progress' && e.data.status === 'failed')
          );

          errorEvents.forEach(event => {
            expect(event.data.recording_id).toBeDefined();
          });

          mockProcessVoiceToStructured.mockClear();
        }
      ),
      { numRuns: 100, timeout: 30000 }
    );
  });

  /**
   * Property: Error notifications SHALL be sent to user-specific rooms
   */
  test('Property 36.2: Error notifications are sent to user-specific rooms', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        async (recordingId, userId) => {
          emittedEvents = [];
          const toRoomCalls = [];

          // Track .to() calls
          mockIO.to = jest.fn((room) => {
            toRoomCalls.push(room);
            return mockIO;
          });

          // Mock database
          jest.spyOn(db, 'query').mockImplementation((query) => {
            if (query.includes('SELECT vr.*, p.family_name')) {
              return Promise.resolve({
                rows: [{
                  recording_id: recordingId,
                  recorded_by: userId,
                  audio_file_path: '/fake/path.m4a'
                }]
              });
            }
            return Promise.resolve({ rows: [] });
          });

          // Mock failure
          mockProcessVoiceToStructured.mockRejectedValue(new Error('Test error'));

          try {
            await backgroundProcessor.processRecording(recordingId);
          } catch (e) {}

          await new Promise(resolve => setTimeout(resolve, 100));

          // Property: Error notification MUST be sent to user-specific room
          const userRoomCalled = toRoomCalls.some(room => room === `user:${userId}`);
          
          // If error notification was emitted, it should be to user room
          const errorNotificationEmitted = emittedEvents.some(e => 
            e.event === 'voice-processing-error'
          );

          if (errorNotificationEmitted) {
            expect(userRoomCalled).toBe(true);
          }

          mockProcessVoiceToStructured.mockClear();
        }
      ),
      { numRuns: 100, timeout: 30000 }
    );
  });
});
