/**
 * Property-Based Tests for AudioStreamerService - State Transitions
 * 
 * Property 3: Recording State Transitions
 * For any recording session, the state machine SHALL follow valid transitions only:
 * `idle → streaming → paused → streaming → stopped` or `idle → streaming → stopped`.
 * Pausing SHALL halt chunk transmission, and resuming SHALL continue from the exact
 * point where pausing occurred with no audio loss.
 * 
 * Validates: Requirements 1.5, 1.6
 */

import fc from 'fast-check';
import { io, Socket } from 'socket.io-client';
import { networkService } from '../networkService';

// Mock socket.io-client
jest.mock('socket.io-client');

// Mock networkService
jest.mock('../networkService', () => ({
  networkService: {
    isConnected: jest.fn(),
    onConnectivityChange: jest.fn(),
    offConnectivityChange: jest.fn(),
  },
}));

// Mock settingsStore
jest.mock('../../stores/settingsStore', () => ({
  getCurrentServer: jest.fn(() => ({
    id: 'test-server',
    displayName: 'Test Server',
    baseUrl: 'https://test.local/api',
    wsUrl: 'wss://test.local',
    healthCheckEndpoints: ['/health'],
    connectionTimeout: 5000,
    retryAttempts: 3,
    retryDelay: 1000,
  })),
}));

// Mock config
jest.mock('@constants/config', () => ({
  API_CONFIG: {
    WS_URL: 'wss://test.local',
  },
}));

// Import after mocks
import {
  audioStreamerService,
  ConnectionStatus,
  StreamingSessionStatus,
  StreamingSessionConfig,
} from '../audioStreamerService';

// ============================================================================
// Test Helpers
// ============================================================================

type StateTransition = 'connect' | 'start' | 'pause' | 'resume' | 'stop' | 'disconnect';

interface StateTransitionResult {
  action: StateTransition;
  connectionStatus: ConnectionStatus;
  sessionStatus: StreamingSessionStatus | null;
  isStreaming: boolean;
  isPaused: boolean;
  success: boolean;
}

const validTransitions: Record<string, StateTransition[]> = {
  'disconnected': ['connect'],
  'connecting': [],
  'connected': ['start', 'disconnect'],
  'streaming': ['pause', 'stop', 'disconnect'],
  'paused': ['resume', 'stop', 'disconnect'],
  'stopped': ['disconnect'],
  'offline': ['start', 'disconnect'],
};

// Create a fresh instance for each test
const createFreshService = () => {
  // Reset the singleton by accessing internal state
  // In a real scenario, we'd refactor to allow instance creation
  audioStreamerService.disconnect();
  return audioStreamerService;
};

const createMockSocket = () => {
  const mockSocket = {
    id: 'test-socket-id',
    connected: true,
    on: jest.fn(),
    once: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    removeAllListeners: jest.fn(),
  };
  
  // Store event handlers for later triggering
  const eventHandlers: Record<string, Function[]> = {};
  
  // Setup behavior for 'on' - stores handlers
  mockSocket.on.mockImplementation((event: string, callback: Function) => {
    if (!eventHandlers[event]) {
      eventHandlers[event] = [];
    }
    eventHandlers[event].push(callback);
    return mockSocket;
  });
  
  // Setup behavior for 'once' - triggers connect immediately
  mockSocket.once.mockImplementation((event: string, callback: Function) => {
    if (event === 'connect') {
      // Simulate immediate connection - also trigger 'on' handlers
      setTimeout(() => {
        callback();
        // Trigger any 'on' connect handlers too
        if (eventHandlers['connect']) {
          eventHandlers['connect'].forEach(handler => handler());
        }
      }, 0);
    }
    return mockSocket;
  });
  
  return mockSocket as unknown as Socket;
};

// ============================================================================
// Property Tests
// ============================================================================

describe('AudioStreamerService State Transitions Property Tests', () => {
  let mockSocket: Socket;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup network as connected by default
    (networkService.isConnected as jest.Mock).mockReturnValue(true);
    
    // Setup socket mock
    mockSocket = createMockSocket();
    (io as jest.Mock).mockReturnValue(mockSocket);
    
    // Reset service state
    audioStreamerService.disconnect();
  });

  afterEach(() => {
    audioStreamerService.disconnect();
  });

  /**
   * Property 3.1: Valid state transitions only
   * The state machine should only allow valid transitions
   */
  describe('Property 3.1: Valid state transitions only', () => {
    it('should only allow valid state transitions from disconnected state', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<StateTransition>('connect', 'start', 'pause', 'resume', 'stop'),
          async (action) => {
            const service = createFreshService();
            
            // Initial state should be disconnected
            expect(service.getConnectionStatus()).toBe('disconnected');
            
            const config: StreamingSessionConfig = {
              contextType: 'global',
              language: 'ja',
              userId: 'test-user',
            };

            let success = false;
            try {
              switch (action) {
                case 'connect':
                  await service.connect(config);
                  success = true;
                  break;
                case 'start':
                  await service.startStreaming();
                  break;
                case 'pause':
                  service.pauseStreaming();
                  break;
                case 'resume':
                  service.resumeStreaming();
                  break;
                case 'stop':
                  await service.stopStreaming();
                  break;
              }
            } catch (error) {
              success = false;
            }

            // Property: Only 'connect' should succeed from disconnected state
            if (action === 'connect') {
              expect(success).toBe(true);
            } else {
              // Other actions should either fail or have no effect
              expect(service.getIsStreaming()).toBe(false);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should transition through valid streaming lifecycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a sequence of valid actions
          fc.array(
            fc.constantFrom<StateTransition>('pause', 'resume'),
            { minLength: 0, maxLength: 5 }
          ),
          async (pauseResumeSequence) => {
            const service = createFreshService();
            
            const config: StreamingSessionConfig = {
              contextType: 'global',
              language: 'ja',
              userId: 'test-user',
            };

            // Connect and start streaming
            await service.connect(config);
            await service.startStreaming();
            
            expect(service.getIsStreaming()).toBe(true);
            expect(service.getIsPaused()).toBe(false);

            // Apply pause/resume sequence
            let expectedPaused = false;
            for (const action of pauseResumeSequence) {
              if (action === 'pause') {
                service.pauseStreaming();
                expectedPaused = true;
              } else if (action === 'resume') {
                service.resumeStreaming();
                expectedPaused = false;
              }
              
              // Property: Pause state should match expected
              expect(service.getIsPaused()).toBe(expectedPaused);
              // Property: Should still be streaming
              expect(service.getIsStreaming()).toBe(true);
            }

            // Stop streaming
            await service.stopStreaming();
            
            // Property: After stop, should not be streaming
            expect(service.getIsStreaming()).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3.2: Pause halts chunk transmission
   * When paused, chunks should be buffered, not transmitted
   */
  describe('Property 3.2: Pause halts chunk transmission', () => {
    it('should buffer chunks when paused instead of transmitting', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate chunk data
          fc.array(
            fc.uint8Array({ minLength: 100, maxLength: 1000 }),
            { minLength: 1, maxLength: 10 }
          ),
          async (chunks) => {
            const service = createFreshService();
            
            const config: StreamingSessionConfig = {
              contextType: 'global',
              language: 'ja',
              userId: 'test-user',
            };

            await service.connect(config);
            await service.startStreaming();
            
            // Send some chunks while streaming
            const chunksBeforePause = Math.floor(chunks.length / 2);
            for (let i = 0; i < chunksBeforePause; i++) {
              service.sendChunk(chunks[i].buffer);
            }
            
            // Pause streaming
            service.pauseStreaming();
            expect(service.getIsPaused()).toBe(true);
            
            // Clear emit mock to track only post-pause emissions
            (mockSocket.emit as jest.Mock).mockClear();
            
            // Send remaining chunks while paused
            for (let i = chunksBeforePause; i < chunks.length; i++) {
              service.sendChunk(chunks[i].buffer);
            }
            
            // Property: No chunks should be emitted while paused
            const chunkEmissions = (mockSocket.emit as jest.Mock).mock.calls
              .filter(call => call[0] === 'stream:chunk');
            expect(chunkEmissions.length).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 3.3: Resume continues from exact pause point
   * No audio should be lost when resuming
   */
  describe('Property 3.3: Resume continues from exact pause point', () => {
    it('should maintain sequence numbers across pause/resume', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // chunks before pause
          fc.integer({ min: 1, max: 5 }), // chunks after resume
          async (chunksBefore, chunksAfter) => {
            const service = createFreshService();
            
            const config: StreamingSessionConfig = {
              contextType: 'global',
              language: 'ja',
              userId: 'test-user',
            };

            await service.connect(config);
            await service.startStreaming();
            
            // Track emitted sequence numbers - set up BEFORE sending chunks
            const emittedSequences: number[] = [];
            (mockSocket.emit as jest.Mock).mockImplementation((event: string, data: any) => {
              if (event === 'stream:chunk') {
                emittedSequences.push(data.sequenceNumber);
              }
            });
            
            // Send chunks before pause
            for (let i = 0; i < chunksBefore; i++) {
              service.sendChunk(new ArrayBuffer(100));
            }
            
            // Pause
            service.pauseStreaming();
            
            // Resume
            service.resumeStreaming();
            
            // Send chunks after resume
            for (let i = 0; i < chunksAfter; i++) {
              service.sendChunk(new ArrayBuffer(100));
            }
            
            // Property: Sequence numbers should be continuous
            const totalChunks = chunksBefore + chunksAfter;
            expect(emittedSequences.length).toBe(totalChunks);
            
            for (let i = 0; i < emittedSequences.length; i++) {
              expect(emittedSequences[i]).toBe(i);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3.4: State consistency after multiple transitions
   * State should remain consistent after any valid sequence of transitions
   */
  describe('Property 3.4: State consistency after multiple transitions', () => {
    it('should maintain consistent state after random valid transitions', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a random sequence of pause/resume/stop actions
          fc.array(
            fc.constantFrom<'pause' | 'resume' | 'stop'>('pause', 'resume', 'stop'),
            { minLength: 1, maxLength: 20 }
          ),
          async (actions) => {
            const service = createFreshService();
            
            const config: StreamingSessionConfig = {
              contextType: 'global',
              language: 'ja',
              userId: 'test-user',
            };

            await service.connect(config);
            await service.startStreaming();
            
            let isStreaming = true;
            let isPaused = false;
            
            for (const action of actions) {
              if (!isStreaming) break; // Can't do anything after stop
              
              switch (action) {
                case 'pause':
                  service.pauseStreaming();
                  isPaused = true;
                  break;
                case 'resume':
                  service.resumeStreaming();
                  isPaused = false;
                  break;
                case 'stop':
                  await service.stopStreaming();
                  isStreaming = false;
                  isPaused = false;
                  break;
              }
              
              // Property: Service state should match expected state
              expect(service.getIsStreaming()).toBe(isStreaming);
              if (isStreaming) {
                expect(service.getIsPaused()).toBe(isPaused);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3.5: Offline mode state transitions
   * When offline, should still allow valid state transitions
   */
  describe('Property 3.5: Offline mode state transitions', () => {
    it('should allow streaming lifecycle in offline mode', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.constantFrom<'pause' | 'resume'>('pause', 'resume'),
            { minLength: 0, maxLength: 5 }
          ),
          async (pauseResumeSequence) => {
            // Set network as disconnected
            (networkService.isConnected as jest.Mock).mockReturnValue(false);
            
            const service = createFreshService();
            
            const config: StreamingSessionConfig = {
              contextType: 'global',
              language: 'ja',
              userId: 'test-user',
            };

            // Connect should create offline session
            const session = await service.connect(config);
            
            // Property: Session should be in offline status
            expect(session.status).toBe('offline');
            expect(service.getConnectionStatus()).toBe('offline');
            
            // Start streaming in offline mode
            await service.startStreaming();
            expect(service.getIsStreaming()).toBe(true);
            
            // Apply pause/resume sequence
            for (const action of pauseResumeSequence) {
              if (action === 'pause') {
                service.pauseStreaming();
              } else {
                service.resumeStreaming();
              }
            }
            
            // Stop streaming
            const result = await service.stopStreaming();
            
            // Property: Result should indicate offline recording
            expect(result.wasOffline).toBe(true);
            expect(service.getIsStreaming()).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

describe('AudioStreamerService Connection Status Property Tests', () => {
  let mockSocket: Socket;

  beforeEach(() => {
    jest.clearAllMocks();
    (networkService.isConnected as jest.Mock).mockReturnValue(true);
    mockSocket = createMockSocket();
    (io as jest.Mock).mockReturnValue(mockSocket);
    audioStreamerService.disconnect();
  });

  afterEach(() => {
    audioStreamerService.disconnect();
  });

  /**
   * Property: Connection status callbacks are invoked on status changes
   */
  describe('Connection status callback notifications', () => {
    it('should notify all registered callbacks on status change', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (listenerCount) => {
            const service = createFreshService();
            
            const allStatusChanges: ConnectionStatus[][] = [];
            const unsubscribers: (() => void)[] = [];
            
            // Register multiple listeners
            for (let i = 0; i < listenerCount; i++) {
              const statusChanges: ConnectionStatus[] = [];
              allStatusChanges.push(statusChanges);
              const unsubscribe = service.onConnectionStatusChange((status) => {
                statusChanges.push(status);
              });
              unsubscribers.push(unsubscribe);
            }
            
            const config: StreamingSessionConfig = {
              contextType: 'global',
              language: 'ja',
              userId: 'test-user',
            };

            // Trigger connection (will change status to 'connecting' then 'connected')
            await service.connect(config);
            
            // Property: All listeners should receive the same status changes
            for (let i = 1; i < allStatusChanges.length; i++) {
              expect(allStatusChanges[i]).toEqual(allStatusChanges[0]);
            }
            
            // Cleanup
            unsubscribers.forEach(unsub => unsub());
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should not notify unsubscribed callbacks', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const service = createFreshService();
            
            const activeChanges: ConnectionStatus[] = [];
            const unsubscribedChanges: ConnectionStatus[] = [];
            
            const activeUnsub = service.onConnectionStatusChange((status) => {
              activeChanges.push(status);
            });
            
            const inactiveUnsub = service.onConnectionStatusChange((status) => {
              unsubscribedChanges.push(status);
            });
            
            // Unsubscribe one listener
            inactiveUnsub();
            
            const config: StreamingSessionConfig = {
              contextType: 'global',
              language: 'ja',
              userId: 'test-user',
            };

            await service.connect(config);
            
            // Property: Unsubscribed listener should not receive any updates
            expect(unsubscribedChanges.length).toBe(0);
            
            // Property: Active listener should receive updates
            expect(activeChanges.length).toBeGreaterThan(0);
            
            activeUnsub();
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
