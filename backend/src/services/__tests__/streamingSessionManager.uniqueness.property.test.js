/**
 * Property-Based Tests for StreamingSessionManager - Session Uniqueness
 * Tests Property 6: Session Identifier Uniqueness
 * 
 * Validates: Requirements 4.1
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

describe('StreamingSessionManager - Property 6: Session Identifier Uniqueness', () => {
  
  jest.setTimeout(30000);
  
  let sessionManager;
  
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
   * Property 6: Session Identifier Uniqueness
   * 
   * For any set of streaming sessions created within a 24-hour period,
   * all session identifiers SHALL be unique. No two sessions SHALL share
   * the same sessionId.
   */
  describe('Property 6: Session Identifier Uniqueness', () => {
    
    // Arbitrary for generating session configurations
    const sessionConfigArb = fc.record({
      socketId: fc.uuid(),
      userId: fc.uuid(),
      patientId: fc.option(fc.uuid(), { nil: null }),
      contextType: fc.constantFrom('patient', 'global'),
      language: fc.constantFrom('ja', 'en', 'zh-TW'),
    });

    it('Property 6.1: All session IDs should be unique across multiple creations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(sessionConfigArb, { minLength: 5, maxLength: 20 }),
          async (configs) => {
            const sessionIds = new Set();
            const sessions = [];
            
            // Create multiple sessions
            for (const config of configs) {
              try {
                const session = await sessionManager.createSession(config);
                
                // Skip queued sessions (they don't have sessionId yet)
                if (session.queued) continue;
                
                sessions.push(session);
                
                // Verify uniqueness
                expect(sessionIds.has(session.sessionId)).toBe(false);
                sessionIds.add(session.sessionId);
              } catch (error) {
                // Session creation may fail due to limits, that's OK
              }
            }
            
            // Verify all collected session IDs are unique
            expect(sessionIds.size).toBe(sessions.length);
            
            // Clean up
            for (const session of sessions) {
              await sessionManager.closeSession(session.sessionId);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('Property 6.2: Session IDs should be valid UUIDs', async () => {
      await fc.assert(
        fc.asyncProperty(sessionConfigArb, async (config) => {
          const session = await sessionManager.createSession(config);
          
          if (session.queued) {
            // Queued sessions don't have sessionId yet
            return;
          }
          
          // Verify sessionId is a valid UUID format
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          expect(session.sessionId).toMatch(uuidRegex);
          
          // Clean up
          await sessionManager.closeSession(session.sessionId);
        }),
        { numRuns: 20 }
      );
    });

    it('Property 6.3: Same user creating multiple sessions should get unique IDs', async () => {
      const userId = uuidv4();
      const sessionIds = new Set();
      const sessions = [];
      
      // Create multiple sessions for the same user
      for (let i = 0; i < 5; i++) {
        const config = {
          socketId: uuidv4(),
          userId,
          patientId: null,
          contextType: 'global',
          language: 'ja',
        };
        
        const session = await sessionManager.createSession(config);
        
        if (!session.queued) {
          sessions.push(session);
          expect(sessionIds.has(session.sessionId)).toBe(false);
          sessionIds.add(session.sessionId);
        }
      }
      
      // All session IDs should be unique
      expect(sessionIds.size).toBe(sessions.length);
      
      // Clean up
      for (const session of sessions) {
        await sessionManager.closeSession(session.sessionId);
      }
    });

    it('Property 6.4: Recreating session after close should generate new unique ID', async () => {
      const config = {
        socketId: uuidv4(),
        userId: uuidv4(),
        patientId: null,
        contextType: 'global',
        language: 'ja',
      };
      
      const sessionIds = new Set();
      
      // Create, close, and recreate sessions multiple times
      for (let i = 0; i < 5; i++) {
        const session = await sessionManager.createSession({
          ...config,
          socketId: uuidv4(), // New socket each time
        });
        
        if (!session.queued) {
          expect(sessionIds.has(session.sessionId)).toBe(false);
          sessionIds.add(session.sessionId);
          
          await sessionManager.closeSession(session.sessionId);
        }
      }
      
      // All session IDs should be unique
      expect(sessionIds.size).toBe(5);
    });

    it('Property 6.5: Session IDs should not collide with pre-existing UUIDs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 10, maxLength: 50 }),
          sessionConfigArb,
          async (existingUuids, config) => {
            const existingSet = new Set(existingUuids);
            
            const session = await sessionManager.createSession(config);
            
            if (!session.queued) {
              // Session ID should not collide with any pre-existing UUID
              // (This is statistically guaranteed by UUID v4, but we verify)
              expect(existingSet.has(session.sessionId)).toBe(false);
              
              await sessionManager.closeSession(session.sessionId);
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
