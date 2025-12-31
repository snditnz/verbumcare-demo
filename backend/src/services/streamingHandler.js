/**
 * StreamingHandler
 * 
 * WebSocket event handlers for real-time audio streaming and transcription.
 * Integrates with StreamingSessionManager and Whisper service.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.5, 1.6 (Real-time streaming)
 */

import streamingSessionManager, { SessionStatus } from './streamingSessionManager.js';
import whisperService from './whisperLocal.js';
import categorizationService from './categorizationService.js';
import reviewQueueService from './reviewQueueService.js';

/**
 * Processing lock to prevent concurrent Whisper calls
 * Key: sessionId, Value: boolean (true = processing)
 */
const processingLocks = new Map();

/**
 * Pending processing flag - indicates chunks accumulated while processing
 * Key: sessionId, Value: boolean (true = needs reprocessing after current batch)
 */
const pendingProcessing = new Map();

/**
 * Minimum chunks required before processing (reduced from 5 to 3 for faster initial feedback)
 */
const MIN_CHUNKS_FOR_PROCESSING = 3;

/**
 * Error codes for streaming
 */
const StreamingErrorCode = {
  CONNECTION_FAILED: 'STREAM_001',
  SESSION_LIMIT_REACHED: 'STREAM_002',
  CHUNK_TRANSMISSION_FAILED: 'STREAM_003',
  TRANSCRIPTION_FAILED: 'STREAM_004',
  CATEGORIZATION_FAILED: 'STREAM_005',
  SESSION_TIMEOUT: 'STREAM_006',
  INVALID_AUDIO_FORMAT: 'STREAM_007',
  AUDIO_QUALITY_INSUFFICIENT: 'STREAM_008',
  RESOURCE_EXHAUSTED: 'STREAM_009',
  SESSION_NOT_FOUND: 'STREAM_010',
};

/**
 * Initialize streaming handlers on Socket.IO server
 * @param {import('socket.io').Server} io - Socket.IO server instance
 */
export function initializeStreamingHandlers(io) {
  // Initialize session manager with Socket.IO
  streamingSessionManager.initialize(io);

  io.on('connection', (socket) => {
    console.log(`📡 Streaming client connected: ${socket.id}`);

    // =========================================================================
    // Stream Start Handler
    // Requirement 1.1: Establish WebSocket connection for streaming
    // =========================================================================
    socket.on('stream:start', async (config) => {
      try {
        console.log(`📡 Stream start request from ${socket.id}:`, config);

        const sessionConfig = {
          socketId: socket.id,
          userId: config.userId,
          patientId: config.patientId || null,
          contextType: config.contextType || 'global',
          language: config.language || 'ja',
        };

        const result = await streamingSessionManager.createSession(sessionConfig);

        if (result.queued) {
          // Session was queued due to capacity limits
          socket.emit('stream:queued', {
            position: result.position,
            estimatedWaitMs: result.estimatedWaitMs,
            message: 'Session queued - waiting for capacity',
          });
        } else {
          // Session created successfully
          socket.emit('stream:started', {
            sessionId: result.sessionId,
            status: 'connected',
          });

          // Join session-specific room for targeted events
          socket.join(`session:${result.sessionId}`);
        }
      } catch (error) {
        console.error('Stream start error:', error);
        socket.emit('stream:error', {
          code: StreamingErrorCode.CONNECTION_FAILED,
          message: 'Failed to start streaming session',
        });
      }
    });

    // =========================================================================
    // Stream Chunk Handler
    // Requirement 1.2: Transmit audio chunks every 2-3 seconds
    // Requirement 1.3: Process chunks incrementally
    // Requirement 2.3: Mark uncertain segments with confidence < 0.7
    // =========================================================================
    socket.on('stream:chunk', async (chunk) => {
      try {
        console.log(`[StreamingHandler] 📦 Received chunk #${chunk.sequenceNumber} from ${socket.id}`);
        console.log(`[StreamingHandler] 📦 Chunk data type: ${typeof chunk.data}, size: ${chunk.data?.length || chunk.data?.byteLength || 'unknown'}`);
        
        const session = streamingSessionManager.getSessionBySocketId(socket.id);
        if (!session) {
          console.log(`[StreamingHandler] ❌ No session found for socket ${socket.id}`);
          socket.emit('stream:error', {
            code: StreamingErrorCode.SESSION_NOT_FOUND,
            message: 'No active session found',
          });
          return;
        }

        // Add chunk to session buffer
        streamingSessionManager.addChunk(session.sessionId, chunk);

        // Process chunk for transcription (pass socket for accumulated chunk emissions)
        const transcriptionResult = await processChunkForTranscription(
          session,
          chunk,
          socket
        );

        console.log(`[StreamingHandler] 🔍 processChunkForTranscription returned:`, transcriptionResult ? `text="${transcriptionResult.text?.substring(0, 30)}..."` : 'null');

        if (transcriptionResult) {
          console.log(`[StreamingHandler] ✅ Got transcription result, preparing to emit...`);
          // Process segments with confidence-based marking
          // Requirement 2.3: Mark segments with confidence < 0.7 as uncertain
          const processedSegments = (transcriptionResult.segments || []).map(seg => ({
            id: seg.id,
            text: seg.text,
            confidence: seg.confidence,
            isUncertain: seg.confidence < 0.7,
            start: seg.start,
            end: seg.end,
          }));

          // Emit partial transcription result with segments
          const transcriptionPayload = {
            text: transcriptionResult.text,
            confidence: transcriptionResult.confidence,
            isFinal: false,
            segmentId: `seg-${chunk.sequenceNumber}`,
            segments: processedSegments,
            isUncertain: transcriptionResult.confidence < 0.7,
          };
          
          console.log(`[StreamingHandler] 📤 Emitting stream:transcription to ${socket.id}:`, transcriptionPayload.text?.substring(0, 50));
          socket.emit('stream:transcription', transcriptionPayload);

          // Append to session buffer
          streamingSessionManager.appendTranscription(
            session.sessionId,
            transcriptionResult.text
          );
        }
      } catch (error) {
        console.error('Stream chunk error:', error);
        socket.emit('stream:error', {
          code: StreamingErrorCode.CHUNK_TRANSMISSION_FAILED,
          message: 'Failed to process audio chunk',
        });
      }
    });

    // =========================================================================
    // Stream Pause Handler
    // Requirement 1.5: Pause chunk transmission while maintaining connection
    // =========================================================================
    socket.on('stream:pause', () => {
      const session = streamingSessionManager.getSessionBySocketId(socket.id);
      if (session) {
        session.status = 'paused';
        streamingSessionManager.updateActivity(session.sessionId);
        console.log(`📡 Stream paused: ${session.sessionId}`);
      }
    });

    // =========================================================================
    // Stream Resume Handler
    // Requirement 1.6: Resume chunk transmission seamlessly
    // =========================================================================
    socket.on('stream:resume', () => {
      const session = streamingSessionManager.getSessionBySocketId(socket.id);
      if (session) {
        session.status = SessionStatus.ACTIVE;
        streamingSessionManager.updateActivity(session.sessionId);
        console.log(`📡 Stream resumed: ${session.sessionId}`);
      }
    });

    // =========================================================================
    // Stream Stop Handler
    // Finalizes session and triggers categorization
    // =========================================================================
    socket.on('stream:stop', async () => {
      try {
        const session = streamingSessionManager.getSessionBySocketId(socket.id);
        if (!session) {
          socket.emit('stream:error', {
            code: StreamingErrorCode.SESSION_NOT_FOUND,
            message: 'No active session found',
          });
          return;
        }

        console.log(`📡 Stream stop received: ${session.sessionId}`);
        console.log(`📡 Socket still connected: ${socket.connected}`);

        // Process any remaining chunks
        const unprocessedChunks = streamingSessionManager.getUnprocessedChunks(
          session.sessionId
        );
        
        console.log(`📡 Unprocessed chunks to finalize: ${unprocessedChunks.length}`);
        
        if (unprocessedChunks.length > 0) {
          console.log(`📡 Processing final chunks...`);
          const finalTranscription = await processFinalChunks(session, unprocessedChunks);
          if (finalTranscription) {
            console.log(`📡 Final transcription from chunks: "${finalTranscription.text?.substring(0, 50)}..."`);
            streamingSessionManager.appendTranscription(
              session.sessionId,
              finalTranscription.text
            );
          }
        }

        // Get final transcription
        const finalText = session.transcriptionBuffer;
        console.log(`📡 Total transcription buffer: "${finalText?.substring(0, 100)}..."`);
        console.log(`📡 Socket still connected before emit: ${socket.connected}`);

        // Emit final transcription
        socket.emit('stream:transcription', {
          text: finalText,
          confidence: 0.9, // Final confidence
          isFinal: true,
        });

        // Emit completion
        socket.emit('stream:complete', {
          sessionId: session.sessionId,
          transcription: finalText,
        });

        // Trigger automatic categorization
        // Requirement 3.1: Auto-start categorization when recording stops
        await triggerCategorization(socket, session, finalText);

        // Close the session
        await streamingSessionManager.closeSession(session.sessionId, 'completed');

      } catch (error) {
        console.error('Stream stop error:', error);
        socket.emit('stream:error', {
          code: StreamingErrorCode.TRANSCRIPTION_FAILED,
          message: 'Failed to finalize transcription',
        });
      }
    });

    // =========================================================================
    // Stream Cancel Handler
    // Cancels session without processing
    // =========================================================================
    socket.on('stream:cancel', async () => {
      const session = streamingSessionManager.getSessionBySocketId(socket.id);
      if (session) {
        console.log(`📡 Stream cancelled: ${session.sessionId}`);
        await streamingSessionManager.closeSession(session.sessionId, 'cancelled');
        socket.emit('stream:cancelled', {
          sessionId: session.sessionId,
        });
      }
    });

    // =========================================================================
    // Disconnect Handler
    // Requirement 4.3: Preserve partial transcription for recovery
    // =========================================================================
    socket.on('disconnect', async (reason) => {
      console.log(`📡 Streaming client disconnected: ${socket.id} (${reason})`);
      await streamingSessionManager.handleDisconnect(socket.id);
    });
  });

  console.log('✅ Streaming handlers initialized');
}

/**
 * Process a single chunk for transcription
 * Accumulates chunks and processes in batches for better transcription quality
 * Uses a processing lock to prevent concurrent Whisper calls
 * When lock is held, marks session for reprocessing after current batch completes
 * 
 * @param {Object} session - Session object
 * @param {Object} chunk - Audio chunk
 * @param {import('socket.io').Socket} socket - Socket for emitting results
 * @returns {Promise<{text: string, confidence: number, segments: Array}|null>}
 */
async function processChunkForTranscription(session, chunk, socket) {
  try {
    // Check if we have enough chunks to process
    const unprocessedChunks = streamingSessionManager.getUnprocessedChunks(
      session.sessionId
    );

    if (unprocessedChunks.length < MIN_CHUNKS_FOR_PROCESSING) {
      // Not enough chunks yet, wait for more
      console.log(`[StreamingHandler] Waiting for more chunks: ${unprocessedChunks.length}/${MIN_CHUNKS_FOR_PROCESSING}`);
      return null;
    }

    // Check if already processing for this session (prevent concurrent Whisper calls)
    if (processingLocks.get(session.sessionId)) {
      // Mark that we have pending chunks to process after current batch
      pendingProcessing.set(session.sessionId, true);
      console.log(`[StreamingHandler] Session ${session.sessionId} already processing, marked for reprocessing (${unprocessedChunks.length} chunks waiting)`);
      return null;
    }

    // Acquire processing lock
    processingLocks.set(session.sessionId, true);
    pendingProcessing.delete(session.sessionId); // Clear pending flag
    console.log(`[StreamingHandler] 🔒 Acquired processing lock for session ${session.sessionId}`);

    try {
      // Process current batch
      const result = await processChunkBatch(session, unprocessedChunks);
      
      return result;
    } finally {
      // Always release the processing lock
      processingLocks.delete(session.sessionId);
      console.log(`[StreamingHandler] 🔓 Released processing lock for session ${session.sessionId}`);
      
      // Check if more chunks accumulated while we were processing
      if (pendingProcessing.get(session.sessionId)) {
        pendingProcessing.delete(session.sessionId);
        const newUnprocessedChunks = streamingSessionManager.getUnprocessedChunks(session.sessionId);
        
        if (newUnprocessedChunks.length >= MIN_CHUNKS_FOR_PROCESSING) {
          console.log(`[StreamingHandler] 🔄 Processing ${newUnprocessedChunks.length} accumulated chunks...`);
          
          // Process accumulated chunks asynchronously and emit results
          setImmediate(async () => {
            try {
              const accumulatedResult = await processChunkForTranscription(session, null, socket);
              if (accumulatedResult && socket && socket.connected) {
                const transcriptionPayload = {
                  text: accumulatedResult.text,
                  confidence: accumulatedResult.confidence,
                  isFinal: false,
                  segmentId: `seg-accumulated-${Date.now()}`,
                  segments: (accumulatedResult.segments || []).map(seg => ({
                    id: seg.id,
                    text: seg.text,
                    confidence: seg.confidence,
                    isUncertain: seg.confidence < 0.7,
                    start: seg.start,
                    end: seg.end,
                  })),
                  isUncertain: accumulatedResult.confidence < 0.7,
                };
                
                console.log(`[StreamingHandler] 📤 Emitting accumulated transcription: "${accumulatedResult.text?.substring(0, 50)}..."`);
                socket.emit('stream:transcription', transcriptionPayload);
                
                // Append to session buffer
                streamingSessionManager.appendTranscription(
                  session.sessionId,
                  accumulatedResult.text
                );
              }
            } catch (error) {
              console.error('[StreamingHandler] Error processing accumulated chunks:', error.message);
            }
          });
        }
      }
    }
  } catch (error) {
    console.error('[StreamingHandler] Chunk processing error:', error.message);
    return null;
  }
}

/**
 * Process a batch of chunks through Whisper
 * 
 * @param {Object} session - Session object
 * @param {Object[]} unprocessedChunks - Chunks to process
 * @returns {Promise<{text: string, confidence: number, segments: Array}|null>}
 */
async function processChunkBatch(session, unprocessedChunks) {
  console.log(`[StreamingHandler] Processing ${unprocessedChunks.length} chunks for transcription`);
  
  // Log chunk details (only first few to avoid spam)
  const chunksToLog = unprocessedChunks.slice(0, 3);
  for (const c of chunksToLog) {
    console.log(`[StreamingHandler] Chunk #${c.sequenceNumber}: ${c.data?.length || 0} bytes`);
  }
  if (unprocessedChunks.length > 3) {
    console.log(`[StreamingHandler] ... and ${unprocessedChunks.length - 3} more chunks`);
  }

  // Combine chunks into a single audio buffer with WAV headers
  const combinedBuffer = combineAudioChunks(unprocessedChunks);
  
  // Save to temporary file for Whisper processing
  const tempFilePath = `/tmp/stream_${session.sessionId}_${Date.now()}.wav`;
  const fs = await import('fs/promises');
  await fs.writeFile(tempFilePath, combinedBuffer);
  
  console.log(`[StreamingHandler] Saved WAV file: ${tempFilePath} (${combinedBuffer.length} bytes)`);

  try {
    // Transcribe with Whisper using streaming method for confidence scores
    console.log(`[StreamingHandler] Calling Whisper transcribeStream for language: ${session.language}`);
    const result = await whisperService.transcribeStream(
      tempFilePath,
      session.language
    );

    console.log(`[StreamingHandler] Whisper result: "${result.text?.substring(0, 50)}..." (confidence: ${result.confidence})`);

    // Mark chunks as processed
    const processedSequences = unprocessedChunks.map(c => c.sequenceNumber);
    streamingSessionManager.markChunksProcessed(session.sessionId, processedSequences);

    // Clean up temp file
    await fs.unlink(tempFilePath).catch(() => {});

    return {
      text: result.text,
      confidence: result.confidence,
      segments: result.segments || [],
    };
  } catch (error) {
    console.error('[StreamingHandler] Whisper transcription error:', error.message);
    // Clean up temp file on error
    await fs.unlink(tempFilePath).catch(() => {});
    throw error;
  }
}

/**
 * Process final chunks when stream stops
 * 
 * @param {Object} session - Session object
 * @param {Object[]} chunks - Remaining chunks
 * @returns {Promise<{text: string, confidence: number, segments: Array}|null>}
 */
async function processFinalChunks(session, chunks) {
  if (chunks.length === 0) return null;

  try {
    const combinedBuffer = combineAudioChunks(chunks);
    const tempFilePath = `/tmp/stream_final_${session.sessionId}_${Date.now()}.wav`;
    const fs = await import('fs/promises');
    await fs.writeFile(tempFilePath, combinedBuffer);

    try {
      // Use streaming transcription for confidence scores
      const result = await whisperService.transcribeStream(
        tempFilePath,
        session.language
      );

      // Mark all as processed
      const processedSequences = chunks.map(c => c.sequenceNumber);
      streamingSessionManager.markChunksProcessed(session.sessionId, processedSequences);

      await fs.unlink(tempFilePath).catch(() => {});

      return {
        text: result.text,
        confidence: result.confidence,
        segments: result.segments || [],
      };
    } catch (error) {
      await fs.unlink(tempFilePath).catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error('Final chunk processing error:', error);
    return null;
  }
}

/**
 * Combine multiple audio chunks into a single WAV buffer with proper headers
 * 
 * Audio format from iPad app (react-native-live-audio-stream):
 * - Sample rate: 32000 Hz
 * - Channels: 1 (mono)
 * - Bits per sample: 16
 * 
 * @param {Object[]} chunks - Audio chunks
 * @returns {Buffer} - WAV file buffer with headers
 */
function combineAudioChunks(chunks) {
  // Sort by sequence number
  const sortedChunks = [...chunks].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  
  // Calculate total PCM data size
  const pcmDataSize = sortedChunks.reduce((sum, chunk) => sum + chunk.data.length, 0);
  
  // WAV header is 44 bytes
  const wavHeaderSize = 44;
  const totalSize = wavHeaderSize + pcmDataSize;
  
  // Create buffer for WAV file
  const wavBuffer = Buffer.alloc(totalSize);
  
  // Audio format parameters (matching iPad app's liveAudioService config)
  const sampleRate = 32000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  
  // Write WAV header
  let offset = 0;
  
  // RIFF chunk descriptor
  wavBuffer.write('RIFF', offset); offset += 4;
  wavBuffer.writeUInt32LE(totalSize - 8, offset); offset += 4; // File size - 8
  wavBuffer.write('WAVE', offset); offset += 4;
  
  // fmt sub-chunk
  wavBuffer.write('fmt ', offset); offset += 4;
  wavBuffer.writeUInt32LE(16, offset); offset += 4; // Subchunk1Size (16 for PCM)
  wavBuffer.writeUInt16LE(1, offset); offset += 2; // AudioFormat (1 = PCM)
  wavBuffer.writeUInt16LE(numChannels, offset); offset += 2;
  wavBuffer.writeUInt32LE(sampleRate, offset); offset += 4;
  wavBuffer.writeUInt32LE(byteRate, offset); offset += 4;
  wavBuffer.writeUInt16LE(blockAlign, offset); offset += 2;
  wavBuffer.writeUInt16LE(bitsPerSample, offset); offset += 2;
  
  // data sub-chunk
  wavBuffer.write('data', offset); offset += 4;
  wavBuffer.writeUInt32LE(pcmDataSize, offset); offset += 4;
  
  // Copy PCM data after header
  for (const chunk of sortedChunks) {
    chunk.data.copy(wavBuffer, offset);
    offset += chunk.data.length;
  }
  
  console.log(`[StreamingHandler] Created WAV buffer: ${totalSize} bytes (${pcmDataSize} bytes PCM data, ${sortedChunks.length} chunks)`);
  
  return wavBuffer;
}

/**
 * Trigger automatic categorization after transcription
 * Requirement 3.1, 3.2, 3.3: Auto-categorization
 * 
 * @param {import('socket.io').Socket} socket
 * @param {Object} session
 * @param {string} transcription
 */
async function triggerCategorization(socket, session, transcription) {
  if (!transcription || transcription.trim().length === 0) {
    console.log('📡 Skipping categorization - empty transcription');
    return;
  }

  try {
    // Emit categorization started
    socket.emit('categorization:started');

    console.log('🔍 Starting AI categorization for streaming session...');
    
    // Use detectCategories to find what categories are present
    const categoryResult = await categorizationService.detectCategories(
      transcription,
      session.language
    );

    console.log('✅ Category detection complete:', categoryResult.categories);

    // Extract data for each detected category
    let extractedData = {};
    for (const category of categoryResult.categories) {
      try {
        const extraction = await categorizationService.extractDataForCategory(
          transcription,
          category,
          session.language
        );
        extractedData[category] = extraction.data;
      } catch (extractError) {
        console.warn(`⚠️ Failed to extract ${category} data:`, extractError.message);
      }
    }

    // Create review queue item
    const reviewItem = await reviewQueueService.createReviewItem({
      recording_id: null, // No recording ID for streaming sessions
      user_id: session.userId,
      context_type: session.contextType,
      context_patient_id: session.patientId,
      transcript: transcription,
      transcript_language: session.language,
      extracted_data: { categories: categoryResult.categories, ...extractedData },
      confidence_score: categoryResult.overallConfidence,
      processing_time_ms: Date.now() - session.createdAt.getTime(),
      model_version: 'llama3.1:8b',
      streaming_session_id: session.sessionId,
    });

    console.log('✅ Review queue item created:', reviewItem.review_id);

    // Emit categorization complete
    socket.emit('categorization:complete', {
      reviewId: reviewItem.review_id,
      categories: categoryResult.categories,
      extractedData: extractedData,
      confidence: categoryResult.overallConfidence,
    });

  } catch (error) {
    console.error('Categorization error:', error);
    socket.emit('categorization:error', {
      code: StreamingErrorCode.CATEGORIZATION_FAILED,
      message: 'Failed to categorize transcription',
    });
  }
}

export { StreamingErrorCode };
export default { initializeStreamingHandlers };
