/**
 * Property-Based Tests for Network Service
 * 
 * Tests universal properties that should hold across all network state transitions
 */

import fc from 'fast-check';
import NetInfo from '@react-native-community/netinfo';
import { networkService } from '../networkService';
import { cacheService } from '../cacheService';

// Mock NetInfo
jest.mock('@react-native-community/netinfo');

// Mock cacheService
jest.mock('../cacheService', () => ({
  cacheService: {
    getPendingSync: jest.fn(),
    clearPendingSync: jest.fn(),
  },
}));

describe('NetworkService Property Tests', () => {
  let mockUnsubscribe: jest.Mock;
  let mockEventListener: ((state: any) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset network service state
    networkService.cleanup();
    
    // Setup NetInfo mocks
    mockUnsubscribe = jest.fn();
    
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });

    (NetInfo.addEventListener as jest.Mock).mockImplementation((listener) => {
      mockEventListener = listener;
      return mockUnsubscribe;
    });

    (cacheService.getPendingSync as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    networkService.cleanup();
    mockEventListener = null;
  });

  /**
   * Feature: code-consistency-security-offline, Property 19: Connectivity change notifications
   * Validates: Requirements 6.2
   */
  describe('Property 19: Connectivity change notifications', () => {
    it('should notify all registered listeners when connectivity changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a sequence of connectivity states
          fc.array(fc.boolean(), { minLength: 2, maxLength: 10 }),
          async (connectivityStates) => {
            // Initialize network service
            await networkService.initialize();

            // Track notifications for multiple listeners
            const listener1Calls: boolean[] = [];
            const listener2Calls: boolean[] = [];
            const listener3Calls: boolean[] = [];

            const listener1 = (isConnected: boolean) => listener1Calls.push(isConnected);
            const listener2 = (isConnected: boolean) => listener2Calls.push(isConnected);
            const listener3 = (isConnected: boolean) => listener3Calls.push(isConnected);

            // Register listeners
            networkService.onConnectivityChange(listener1);
            networkService.onConnectivityChange(listener2);
            networkService.onConnectivityChange(listener3);

            // Simulate connectivity state changes
            let previousState = true; // Initial state from mock
            for (const isConnected of connectivityStates) {
              if (isConnected !== previousState && mockEventListener) {
                mockEventListener({
                  isConnected,
                  isInternetReachable: isConnected,
                });
                previousState = isConnected;
              }
            }

            // Property: All listeners should receive the same notifications
            expect(listener1Calls).toEqual(listener2Calls);
            expect(listener2Calls).toEqual(listener3Calls);

            // Property: Number of notifications should match number of actual state changes
            const actualChanges = connectivityStates.filter((state, idx) => {
              if (idx === 0) return state !== true; // Compare with initial state
              return state !== connectivityStates[idx - 1];
            });
            expect(listener1Calls.length).toBe(actualChanges.length);

            // Cleanup
            networkService.offConnectivityChange(listener1);
            networkService.offConnectivityChange(listener2);
            networkService.offConnectivityChange(listener3);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not notify unregistered listeners', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(),
          async (newState) => {
            await networkService.initialize();

            const listener1Calls: boolean[] = [];
            const listener2Calls: boolean[] = [];

            const listener1 = (isConnected: boolean) => listener1Calls.push(isConnected);
            const listener2 = (isConnected: boolean) => listener2Calls.push(isConnected);

            // Register both listeners
            networkService.onConnectivityChange(listener1);
            networkService.onConnectivityChange(listener2);

            // Unregister listener2
            networkService.offConnectivityChange(listener2);

            // Trigger state change (ensure it's different from initial state)
            if (mockEventListener) {
              mockEventListener({
                isConnected: newState,
                isInternetReachable: newState,
              });
            }

            // Property: listener2 should never be notified (it was unregistered)
            expect(listener2Calls.length).toBe(0);
            
            // Property: If state actually changed, listener1 should be notified
            // Initial state is true, so only notify if newState is false
            if (newState === false) {
              expect(listener1Calls.length).toBeGreaterThan(0);
            }

            // Cleanup
            networkService.offConnectivityChange(listener1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle listener registration idempotently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          fc.boolean(),
          async (registrationCount, newState) => {
            await networkService.initialize();

            const listenerCalls: boolean[] = [];
            const listener = (isConnected: boolean) => listenerCalls.push(isConnected);

            // Register the same listener multiple times
            for (let i = 0; i < registrationCount; i++) {
              networkService.onConnectivityChange(listener);
            }

            // Trigger state change
            if (mockEventListener) {
              mockEventListener({
                isConnected: newState,
                isInternetReachable: newState,
              });
            }

            // Property: Listener should only be called once per state change
            // (duplicate registrations should be prevented)
            expect(listenerCalls.length).toBeLessThanOrEqual(1);

            // Cleanup
            networkService.offConnectivityChange(listener);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 20: Reconnection triggers sync
   * Validates: Requirements 6.3
   */
  describe('Property 20: Reconnection triggers sync', () => {
    it('should trigger sync when transitioning from offline to online', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate pending sync items
          fc.array(
            fc.record({
              id: fc.string(),
              type: fc.constantFrom('care_plan', 'clinical_note', 'vital_signs', 'medication'),
              data: fc.object(),
              timestamp: fc.integer({ min: Date.now() - 86400000, max: Date.now() }),
            }),
            { minLength: 0, maxLength: 10 }
          ),
          async (pendingItems) => {
            // Setup: Mock pending sync items
            (cacheService.getPendingSync as jest.Mock).mockResolvedValue(pendingItems);

            await networkService.initialize();

            // Track reconnection callbacks
            const reconnectionCalls: number[] = [];
            const reconnectionCallback = () => {
              reconnectionCalls.push(Date.now());
            };

            networkService.onReconnection(reconnectionCallback);

            // Simulate offline → online transition
            if (mockEventListener) {
              // First go offline
              mockEventListener({
                isConnected: false,
                isInternetReachable: false,
              });

              // Then go online (reconnection)
              mockEventListener({
                isConnected: true,
                isInternetReachable: true,
              });
            }

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 100));

            // Property: Reconnection callback should be invoked exactly once
            expect(reconnectionCalls.length).toBe(1);

            // Property: getPendingSync should be called to check for pending items
            expect(cacheService.getPendingSync).toHaveBeenCalled();

            // Cleanup
            networkService.offReconnection(reconnectionCallback);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not trigger sync when transitioning from online to offline', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            await networkService.initialize();

            const reconnectionCalls: number[] = [];
            const reconnectionCallback = () => {
              reconnectionCalls.push(Date.now());
            };

            networkService.onReconnection(reconnectionCallback);

            // Simulate online → offline transition (NOT a reconnection)
            if (mockEventListener) {
              mockEventListener({
                isConnected: false,
                isInternetReachable: false,
              });
            }

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 100));

            // Property: Reconnection callback should NOT be invoked
            expect(reconnectionCalls.length).toBe(0);

            // Cleanup
            networkService.offReconnection(reconnectionCallback);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not trigger sync when staying online', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            await networkService.initialize();

            const reconnectionCalls: number[] = [];
            const reconnectionCallback = () => {
              reconnectionCalls.push(Date.now());
            };

            networkService.onReconnection(reconnectionCallback);

            // Simulate staying online (no state change)
            if (mockEventListener) {
              mockEventListener({
                isConnected: true,
                isInternetReachable: true,
              });
            }

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 100));

            // Property: Reconnection callback should NOT be invoked
            expect(reconnectionCalls.length).toBe(0);

            // Cleanup
            networkService.offReconnection(reconnectionCallback);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple reconnection listeners', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (listenerCount) => {
            await networkService.initialize();

            const allCalls: number[][] = [];
            const listeners: (() => void)[] = [];

            // Register multiple reconnection listeners
            for (let i = 0; i < listenerCount; i++) {
              const calls: number[] = [];
              allCalls.push(calls);
              const listener = () => calls.push(Date.now());
              listeners.push(listener);
              networkService.onReconnection(listener);
            }

            // Simulate offline → online transition
            if (mockEventListener) {
              mockEventListener({
                isConnected: false,
                isInternetReachable: false,
              });

              mockEventListener({
                isConnected: true,
                isInternetReachable: true,
              });
            }

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 100));

            // Property: All listeners should be invoked exactly once
            for (const calls of allCalls) {
              expect(calls.length).toBe(1);
            }

            // Cleanup
            listeners.forEach(listener => networkService.offReconnection(listener));
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
