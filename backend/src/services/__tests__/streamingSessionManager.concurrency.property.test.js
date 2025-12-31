/**
 * Property-Based Tests for StreamingSessionManager - Concurrent Session Limits
 * Tests Property 7: Concurrent Session Limits
 * 
 * Validates: Requirements 4.4, 4.5
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import fc from 'fast-check';
import { StreamingSessionManager } from '../streamingSessionManager.js';
import { v4 as uuidv4 } from 'uuid';

// Mock the database module
jest.unstable_mockModule('../../db/index.js', () => ({
  default: {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    testConnection: jest.fn().mockResolvedValue(true),
  },
}));

describe('StreamingSessionManager - Property 7: Concurrent Session Limits', () => {
  
  jest.setTimeout(60000);
  
  let sessionManager;
  const MAX_SESSIONS = 10; // Default from streamingSessionManager.js
  
  beforeEach(() => {
    // Create fresh instance for each test
    sessionManager = new StreamingSessionManager();
  });
  
  afterEach(async () => {
    // Clean up all sessions
    if (sessionManager) {
      await sessionManager.cleanupAllSessions();
    }
  });

  /**
   * Property 7: Concurrent Session Limits
   * 
   * For any system state where active session count equals the configured maximum,
   * new session requests SHALL be queued rather than rejected. The queue SHALL
   * process sessions in FIFO order when capacity becomes available.
   */
  describe('Property 7: Concurrent Session Limits', () => {
    
    // Arbitrary for generating session configurations
    const sessionConfigArb = fc.record({
      socketId: fc.uuid(),
      userId: fc.uuid(),
      patientId: fc.option(fc.uuid(), { nil: null }),
      contextType: fc.constantFrom('patient', 'global'),
      language: fc.constantFrom('ja', 'en', 'zh-TW'),
    });

    it('Property 7.1: Should accept sessions up to the configured maximum', async () => {
      const sessions = [];
      
      // Create sessions up to the limit
      for (let i = 0; i < MAX_SESSIONS; i++) {
        const config = {
          socketId: uuidv4(),
          userId: uuidv4(),
          patientId: null,
          contextType: 'global',
          language: 'ja',
        };
        
        const session = await sessionManager.createSession(config);
        
        // Should not be queued when under limit
        expect(session.queued).toBeFalsy();
        expect(session.sessionId).toBeDefined();
        sessions.push(session);
      }
      
      // Verify we have exactly MAX_SESSIONS active
      expect(sessionManager.getActiveSessionCount()).toBe(MAX_SESSIONS);
      
      // Clean up
      for (const session of sessions) {
        await sessionManager.closeSession(session.sessionId);
      }
    });

    it('Property 7.2: Should queue sessions when at capacity', async () => {
      const sessions = [];
      
      // Fill up to capacity
      for (let i = 0; i < MAX_SESSIONS; i++) {
        const config = {
          socketId: uuidv4(),
          userId: uuidv4(),
          patientId: null,
          contextType: 'global',
          language: 'ja',
        };
        
        const session = await sessionManager.createSession(config);
        sessions.push(session);
      }
      
      // Verify at capacity
      expect(sessionManager.getActiveSessionCount()).toBe(MAX_SESSIONS);
      expect(sessionManager.canAcceptNewSession()).toBe(false);
      
      // Try to create more sessions - they should be queued
      const queuedResults = [];
      for (let i = 0; i < 5; i++) {
        const config = {
          socketId: uuidv4(),
          userId: uuidv4(),
          patientId: null,
          contextType: 'global',
          language: 'ja',
        };
        
        const result = await sessionManager.createSession(config);
        queuedResults.push(result);
      }
      
      // All should be queued
      for (const result of queuedResults) {
        expect(result.queued).toBe(true);
        expect(result.position).toBeGreaterThan(0);
      }
      
      // Queue length should match
      expect(sessionManager.getQueueLength()).toBe(5);
      
      // Clean up
      for (const session of sessions) {
        await sessionManager.closeSession(session.sessionId);
      }
    });

    it('Property 7.3: Queue positions should be assigned in FIFO order', async () => {
      const sessions = [];
      
      // Fill up to capacity
      for (let i = 0; i < MAX_SESSIONS; i++) {
        const config = {
          socketId: uuidv4(),
          userId: uuidv4(),
          patientId: null,
          contextType: 'global',
          language: 'ja',
        };
        
        const session = await sessionManager.createSession(config);
        sessions.push(session);
      }
      
      // Queue multiple sessions and verify positions
      const queuedResults = [];
      for (let i = 0; i < 5; i++) {
        const config = {
          socketId: uuidv4(),
          userId: uuidv4(),
          patientId: null,
          contextType: 'global',
          language: 'ja',
        };
        
        const result = await sessionManager.createSession(config);
        queuedResults.push(result);
      }
      
      // Verify FIFO ordering - positions should be sequential
      for (let i = 0; i < queuedResults.length; i++) {
        expect(queuedResults[i].position).toBe(i + 1);
      }
      
      // Clean up
      for (const session of sessions) {
        await sessionManager.closeSession(session.sessionId);
      }
    });

    it('Property 7.4: Closing a session should allow queued session to be processed', async () => {
      const sessions = [];
      
      // Fill up to capacity
      for (let i = 0; i < MAX_SESSIONS; i++) {
        const config = {
          socketId: uuidv4(),
          userId: uuidv4(),
          patientId: null,
          contextType: 'global',
          language: 'ja',
        };
        
        const session = await sessionManager.createSession(config);
        sessions.push(session);
      }
      
      // Queue a session
      const queuedConfig = {
        socketId: uuidv4(),
        userId: uuidv4(),
        patientId: null,
        contextType: 'global',
        language: 'ja',
      };
      
      const queuedResult = await sessionManager.createSession(queuedConfig);
      expect(queuedResult.queued).toBe(true);
      expect(sessionManager.getQueueLength()).toBe(1);
      
      // Close one active session
      await sessionManager.closeSession(sessions[0].sessionId);
      
      // Queue should be processed (note: processQueue is called in closeSession)
      // After processing, queue should be empty
      expect(sessionManager.getQueueLength()).toBe(0);
      
      // Clean up remaining sessions
      for (let i = 1; i < sessions.length; i++) {
        await sessionManager.closeSession(sessions[i].sessionId);
      }
    });

    it('Property 7.5: Should never exceed maximum concurrent sessions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(sessionConfigArb, { minLength: 15, maxLength: 30 }),
          async (configs) => {
            const activeSessions = [];
            
            for (const config of configs) {
              const result = await sessionManager.createSession(config);
              
              if (!result.queued) {
                activeSessions.push(result);
              }
              
              // Invariant: active session count should never exceed max
              expect(sessionManager.getActiveSessionCount()).toBeLessThanOrEqual(MAX_SESSIONS);
            }
            
            // Clean up
            for (const session of activeSessions) {
              await sessionManager.closeSession(session.sessionId);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('Property 7.6: Queue should provide estimated wait time', async () => {
      const sessions = [];
      
      // Fill up to capacity
      for (let i = 0; i < MAX_SESSIONS; i++) {
        const config = {
          socketId: uuidv4(),
          userId: uuidv4(),
          patientId: null,
          contextType: 'global',
          language: 'ja',
        };
        
        const session = await sessionManager.createSession(config);
        sessions.push(session);
      }
      
      // Queue sessions and verify estimated wait time
      for (let i = 0; i < 3; i++) {
        const config = {
          socketId: uuidv4(),
          userId: uuidv4(),
          patientId: null,
          contextType: 'global',
          language: 'ja',
        };
        
        const result = await sessionManager.createSession(config);
        
        expect(result.queued).toBe(true);
        expect(result.estimatedWaitMs).toBeDefined();
        expect(result.estimatedWaitMs).toBeGreaterThan(0);
        
        // Wait time should increase with position
        expect(result.estimatedWaitMs).toBe(result.position * 30000);
      }
      
      // Clean up
      for (const session of sessions) {
        await sessionManager.closeSession(session.sessionId);
      }
    });

    it('Property 7.7: Stats should accurately reflect session state', async () => {
      const sessions = [];
      
      // Create some sessions
      for (let i = 0; i < 5; i++) {
        const config = {
          socketId: uuidv4(),
          userId: uuidv4(),
          patientId: null,
          contextType: 'global',
          language: 'ja',
        };
        
        const session = await sessionManager.createSession(config);
        sessions.push(session);
      }
      
      const stats = sessionManager.getStats();
      
      expect(stats.activeSessions).toBe(5);
      expect(stats.maxSessions).toBe(MAX_SESSIONS);
      expect(stats.queueLength).toBe(0);
      expect(stats.idleTimeoutMs).toBeDefined();
      
      // Clean up
      for (const session of sessions) {
        await sessionManager.closeSession(session.sessionId);
      }
    });
  });
});
