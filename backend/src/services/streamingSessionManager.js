/**
 * StreamingSessionManager
 * 
 * Manages active streaming sessions for real-time voice transcription.
 * Handles session lifecycle, resource allocation, and cleanup.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5 (Session management)
 */

import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';

// Configuration
const MAX_CONCURRENT_SESSIONS = parseInt(process.env.MAX_STREAMING_SESSIONS || '10', 10);
const SESSION_IDLE_TIMEOUT_MS = 60000; // 60 seconds
const SESSION_CLEANUP_INTERVAL_MS = 30000; // 30 seconds

/**
 * Session status enum
 */
const SessionStatus = {
  ACTIVE: 'active',
  IDLE: 'idle',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error',
};

/**
 * Audio chunk structure
 * @typedef {Object} AudioChunk
 * @property {number} sequenceNumber
 * @property {Buffer} data
 * @property {Date} receivedAt
 * @property {boolean} processed
 */

/**
 * Session structure
 * @typedef {Object} Session
 * @property {string} sessionId
 * @property {string} socketId
 * @property {string} userId
 * @property {string|null} patientId
 * @property {string} contextType
 * @property {string} language
 * @property {Date} createdAt
 * @property {Date} lastActivityAt
 * @property {string} transcriptionBuffer
 * @property {AudioChunk[]} audioChunks
 * @property {string} status
 * @property {boolean} contextLocked - Whether context is locked (immutable after first chunk)
 */

class StreamingSessionManager {
  constructor() {
    /** @type {Map<string, Session>} */
    this.sessions = new Map();
    
    /** @type {string[]} */
    this.sessionQueue = [];
    
    /** @type {NodeJS.Timeout|null} */
    this.cleanupInterval = null;
    
    /** @type {import('socket.io').Server|null} */
    this.io = null;
  }

  /**
   * Initialize the session manager
   * @param {import('socket.io').Server} io - Socket.IO server instance
   */
  initialize(io) {
    this.io = io;
    this.startCleanupInterval();
    console.log('✅ StreamingSessionManager initialized');
    console.log(`   Max concurrent sessions: ${MAX_CONCURRENT_SESSIONS}`);
    console.log(`   Idle timeout: ${SESSION_IDLE_TIMEOUT_MS}ms`);
  }

  /**
   * Create a new streaming session
   * Requirement 4.1: Create unique session identifier
   * 
   * @param {Object} config - Session configuration
   * @param {string} config.socketId - Socket.IO socket ID
   * @param {string} config.userId - User ID
   * @param {string|null} config.patientId - Patient ID (optional)
   * @param {string} config.contextType - 'patient' or 'global'
   * @param {string} config.language - Language code
   * @returns {Promise<Session>}
   */
  async createSession(config) {
    const { socketId, userId, patientId, contextType, language } = config;

    // Check if we can accept new sessions
    // Requirement 4.4, 4.5: Concurrent session limiting
    if (!this.canAcceptNewSession()) {
      // Queue the session request
      return this.queueSession(config);
    }

    const sessionId = uuidv4();
    const now = new Date();

    /** @type {Session} */
    const session = {
      sessionId,
      socketId,
      userId,
      patientId: patientId || null,
      contextType: contextType || 'global',
      language: language || 'ja',
      createdAt: now,
      lastActivityAt: now,
      transcriptionBuffer: '',
      audioChunks: [],
      status: SessionStatus.ACTIVE,
      contextLocked: false, // Context becomes locked after first chunk
    };

    // Store in memory
    this.sessions.set(sessionId, session);

    // Persist to database for recovery
    try {
      await db.query(
        `INSERT INTO streaming_sessions 
         (session_id, user_id, patient_id, context_type, language, status, created_at, last_activity_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [sessionId, userId, patientId, contextType, language, SessionStatus.ACTIVE, now, now]
      );
    } catch (error) {
      console.error('Failed to persist session to database:', error);
      // Continue anyway - in-memory session is still valid
    }

    console.log(`📡 Created streaming session: ${sessionId} for user ${userId}`);
    return session;
  }

  /**
   * Queue a session when at capacity
   * Requirement 4.5: Queue new sessions and notify user
   * 
   * @param {Object} config - Session configuration
   * @returns {Promise<{queued: true, position: number}>}
   */
  async queueSession(config) {
    const queueEntry = {
      ...config,
      queuedAt: new Date(),
    };
    
    this.sessionQueue.push(JSON.stringify(queueEntry));
    const position = this.sessionQueue.length;

    console.log(`📋 Session queued at position ${position} for user ${config.userId}`);

    return {
      queued: true,
      position,
      estimatedWaitMs: position * 30000, // Rough estimate
    };
  }

  /**
   * Get a session by ID
   * @param {string} sessionId
   * @returns {Session|null}
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get session by socket ID
   * @param {string} socketId
   * @returns {Session|null}
   */
  getSessionBySocketId(socketId) {
    for (const session of this.sessions.values()) {
      if (session.socketId === socketId) {
        return session;
      }
    }
    return null;
  }

  /**
   * Update session activity timestamp
   * @param {string} sessionId
   */
  updateActivity(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = new Date();
    }
  }

  /**
   * Add audio chunk to session buffer
   * @param {string} sessionId
   * @param {Object} chunk - Audio chunk data
   * @param {number} chunk.sequenceNumber
   * @param {Buffer|ArrayBuffer|Uint8Array|Object} chunk.data - Can be various formats from Socket.IO
   */
  addChunk(sessionId, chunk) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Convert chunk data to Buffer, handling various formats from Socket.IO
    let dataBuffer;
    const chunkData = chunk.data;
    
    if (Buffer.isBuffer(chunkData)) {
      dataBuffer = chunkData;
    } else if (chunkData instanceof ArrayBuffer) {
      dataBuffer = Buffer.from(chunkData);
    } else if (chunkData instanceof Uint8Array) {
      dataBuffer = Buffer.from(chunkData);
    } else if (typeof chunkData === 'object' && chunkData !== null) {
      // Socket.IO may serialize ArrayBuffer as an object with numeric keys
      // or as { type: 'Buffer', data: [...] }
      if (chunkData.type === 'Buffer' && Array.isArray(chunkData.data)) {
        dataBuffer = Buffer.from(chunkData.data);
      } else if (Object.keys(chunkData).every(k => !isNaN(parseInt(k)))) {
        // Object with numeric keys (serialized ArrayBuffer)
        const values = Object.values(chunkData);
        dataBuffer = Buffer.from(values);
      } else {
        console.warn(`[StreamingSessionManager] Unknown chunk data format:`, typeof chunkData, Object.keys(chunkData).slice(0, 5));
        dataBuffer = Buffer.from([]);
      }
    } else {
      console.warn(`[StreamingSessionManager] Unexpected chunk data type:`, typeof chunkData);
      dataBuffer = Buffer.from([]);
    }

    const audioChunk = {
      sequenceNumber: chunk.sequenceNumber,
      data: dataBuffer,
      receivedAt: new Date(),
      processed: false,
    };

    session.audioChunks.push(audioChunk);
    session.lastActivityAt = new Date();
    session.status = SessionStatus.ACTIVE;
    
    // Log chunk info for debugging
    if (session.audioChunks.length <= 3 || session.audioChunks.length % 10 === 0) {
      console.log(`[StreamingSessionManager] Chunk #${chunk.sequenceNumber} added to session ${sessionId}: ${dataBuffer.length} bytes (total chunks: ${session.audioChunks.length})`);
    }
    
    // Lock context after first chunk - Requirement 8.2
    if (!session.contextLocked) {
      session.contextLocked = true;
    }

    // Sort chunks by sequence number to handle out-of-order arrival
    // Requirement 6.5: Reorder chunks using sequence numbers
    session.audioChunks.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  /**
   * Validate context for a session
   * Requirement 8.1: Validate context on session creation
   * 
   * @param {Object} context - Context to validate
   * @param {string|null} context.patientId
   * @param {string} context.contextType
   * @returns {{valid: boolean, error?: string}}
   */
  validateContext(context) {
    const { patientId, contextType } = context;

    // Validate contextType
    if (!contextType || !['patient', 'global'].includes(contextType)) {
      return { valid: false, error: 'Invalid contextType. Must be "patient" or "global".' };
    }

    // If contextType is 'patient', patientId is required
    if (contextType === 'patient' && !patientId) {
      return { valid: false, error: 'patientId is required when contextType is "patient".' };
    }

    // If contextType is 'global', patientId should be null
    if (contextType === 'global' && patientId) {
      return { valid: false, error: 'patientId should not be provided when contextType is "global".' };
    }

    return { valid: true };
  }

  /**
   * Attempt to update session context
   * Requirement 8.2, 8.3: Reject context mutations during session
   * 
   * @param {string} sessionId
   * @param {Object} newContext - New context values
   * @param {string|null} newContext.patientId
   * @param {string} newContext.contextType
   * @returns {{success: boolean, error?: string}}
   */
  updateContext(sessionId, newContext) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    // Reject if context is locked (after first chunk)
    if (session.contextLocked) {
      return { 
        success: false, 
        error: 'Context is immutable after streaming has started. Cannot modify patientId or contextType.' 
      };
    }

    // Validate new context
    const validation = this.validateContext(newContext);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Update context (only allowed before first chunk)
    session.patientId = newContext.patientId || null;
    session.contextType = newContext.contextType;

    return { success: true };
  }

  /**
   * Check if session context is locked
   * @param {string} sessionId
   * @returns {boolean}
   */
  isContextLocked(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? session.contextLocked : false;
  }

  /**
   * Get session context
   * @param {string} sessionId
   * @returns {{patientId: string|null, contextType: string}|null}
   */
  getContext(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    return {
      patientId: session.patientId,
      contextType: session.contextType,
    };
  }

  /**
   * Append transcription text to session buffer
   * @param {string} sessionId
   * @param {string} text
   */
  appendTranscription(sessionId, text) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.transcriptionBuffer += text;
      session.lastActivityAt = new Date();
    }
  }

  /**
   * Get unprocessed chunks for a session
   * @param {string} sessionId
   * @returns {AudioChunk[]}
   */
  getUnprocessedChunks(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    return session.audioChunks.filter(chunk => !chunk.processed);
  }

  /**
   * Mark chunks as processed
   * @param {string} sessionId
   * @param {number[]} sequenceNumbers
   */
  markChunksProcessed(sessionId, sequenceNumbers) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    for (const chunk of session.audioChunks) {
      if (sequenceNumbers.includes(chunk.sequenceNumber)) {
        chunk.processed = true;
      }
    }
  }

  /**
   * Close a session
   * Requirement 4.3: Preserve partial transcription for recovery
   * 
   * @param {string} sessionId
   * @param {string} [reason='completed']
   * @returns {Promise<Session|null>}
   */
  async closeSession(sessionId, reason = 'completed') {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    session.status = reason === 'error' ? SessionStatus.ERROR : SessionStatus.COMPLETED;

    // Persist final state to database
    try {
      await db.query(
        `UPDATE streaming_sessions 
         SET status = $1, 
             transcription_buffer = $2, 
             chunk_count = $3,
             completed_at = NOW(),
             error_message = $4
         WHERE session_id = $5`,
        [
          session.status,
          session.transcriptionBuffer,
          session.audioChunks.length,
          reason === 'error' ? 'Session closed due to error' : null,
          sessionId,
        ]
      );
    } catch (error) {
      console.error('Failed to update session in database:', error);
    }

    // Remove from active sessions
    this.sessions.delete(sessionId);

    console.log(`📡 Closed streaming session: ${sessionId} (${reason})`);

    // Process queued sessions if any
    this.processQueue();

    return session;
  }

  /**
   * Process queued sessions when capacity becomes available
   */
  async processQueue() {
    while (this.sessionQueue.length > 0 && this.canAcceptNewSession()) {
      const configJson = this.sessionQueue.shift();
      if (configJson) {
        try {
          const config = JSON.parse(configJson);
          const session = await this.createSession(config);
          
          // Notify the client that their session is ready
          if (this.io && config.socketId) {
            this.io.to(config.socketId).emit('stream:ready', {
              sessionId: session.sessionId,
              message: 'Your streaming session is now ready',
            });
          }
        } catch (error) {
          console.error('Failed to process queued session:', error);
        }
      }
    }
  }

  /**
   * Check if we can accept new sessions
   * Requirement 4.4: Process concurrently up to configurable limit
   * 
   * @returns {boolean}
   */
  canAcceptNewSession() {
    return this.sessions.size < MAX_CONCURRENT_SESSIONS;
  }

  /**
   * Get count of active sessions
   * @returns {number}
   */
  getActiveSessionCount() {
    return this.sessions.size;
  }

  /**
   * Get queue length
   * @returns {number}
   */
  getQueueLength() {
    return this.sessionQueue.length;
  }

  /**
   * Start the cleanup interval
   * Requirement 4.2: Auto-close idle sessions after 60 seconds
   */
  startCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleSessions();
    }, SESSION_CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop the cleanup interval
   */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up idle sessions
   * Requirement 4.2: Auto-close after 60 seconds idle
   * 
   * @returns {Promise<number>} Number of sessions cleaned up
   */
  async cleanupIdleSessions() {
    const now = Date.now();
    const idleSessions = [];

    for (const [sessionId, session] of this.sessions) {
      const idleTime = now - session.lastActivityAt.getTime();
      if (idleTime > SESSION_IDLE_TIMEOUT_MS) {
        idleSessions.push(sessionId);
      }
    }

    for (const sessionId of idleSessions) {
      const session = this.sessions.get(sessionId);
      if (session && this.io) {
        // Notify client before closing
        this.io.to(session.socketId).emit('stream:timeout', {
          sessionId,
          message: 'Session closed due to inactivity',
        });
      }
      await this.closeSession(sessionId, 'timeout');
    }

    if (idleSessions.length > 0) {
      console.log(`🧹 Cleaned up ${idleSessions.length} idle sessions`);
    }

    return idleSessions.length;
  }

  /**
   * Clean up all sessions (for shutdown)
   * @returns {Promise<void>}
   */
  async cleanupAllSessions() {
    this.stopCleanupInterval();

    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      await this.closeSession(sessionId, 'shutdown');
    }

    this.sessionQueue = [];
    console.log('🧹 All streaming sessions cleaned up');
  }

  /**
   * Get session statistics
   * @returns {Object}
   */
  getStats() {
    return {
      activeSessions: this.sessions.size,
      maxSessions: MAX_CONCURRENT_SESSIONS,
      queueLength: this.sessionQueue.length,
      idleTimeoutMs: SESSION_IDLE_TIMEOUT_MS,
    };
  }

  /**
   * Handle unexpected client disconnect
   * Requirement 4.3: Preserve partial transcription for recovery
   * 
   * @param {string} socketId
   * @returns {Promise<Session|null>}
   */
  async handleDisconnect(socketId) {
    const session = this.getSessionBySocketId(socketId);
    if (session) {
      console.log(`📡 Client disconnected unexpectedly: ${session.sessionId}`);
      // Don't delete immediately - preserve for potential recovery
      session.status = SessionStatus.IDLE;
      
      // Update database
      try {
        await db.query(
          `UPDATE streaming_sessions 
           SET status = $1, last_activity_at = NOW()
           WHERE session_id = $2`,
          [SessionStatus.IDLE, session.sessionId]
        );
      } catch (error) {
        console.error('Failed to update disconnected session:', error);
      }

      return session;
    }
    return null;
  }
}

// Singleton instance
const streamingSessionManager = new StreamingSessionManager();

export { StreamingSessionManager, SessionStatus };
export default streamingSessionManager;
