/**
 * Property-Based Tests for ServerStatusIndicator Real-Time Updates
 * 
 * **Feature: backend-switching-settings, Property 4: Real-time connection status updates**
 * **Validates: Requirements 2.2, 2.3, 2.4, 2.5**
 * 
 * Property 4: Real-time connection status updates
 * For any connection status change, all status indicators should update immediately 
 * and consistently across the application
 */

import * as fc from 'fast-check';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useSettingsStore } from '@stores/settingsStore';
import { ConnectionStatus } from '@types/settings';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock axios for connectivity tests
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock network service
jest.mock('@services/networkService', () => ({
  networkService: {
    isConnected: jest.fn().mockResolvedValue(true),
    getConnectionType: jest.fn().mockResolvedValue('wifi'),
  },
}));

// Mock cache service
jest.mock('@services/cacheService', () => ({
  cacheService: {
    clearServerSpecificCache: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock auth store
jest.mock('@stores/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({
      isAuthenticated: false,
    })),
  },
}));

describe('ServerStatusIndicator Real-Time Updates - Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    useSettingsStore.setState({
      connectionStatus: 'disconnected',
      detailedStatus: undefined,
      serverSwitchState: {
        isInProgress: false,
        fromServerId: undefined,
        toServerId: undefined,
        progress: '',
        startedAt: undefined,
        error: undefined,
      },
    });
  });

  /**
   * Property 4: Real-time connection status updates
   * 
   * This property verifies that when the connection status changes in the store,
   * all components observing the status receive the update immediately and consistently.
   */
  it('Property 4: Connection status updates propagate immediately to all observers', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a sequence of connection status changes
        fc.array(
          fc.constantFrom<ConnectionStatus>(
            'connected',
            'disconnected',
            'testing',
            'switching',
            'error'
          ),
          { minLength: 2, maxLength: 5 } // Reduced complexity
        ),
        async (statusChanges) => {
          // Create multiple observers (simulating multiple components)
          const observer1 = renderHook(() => useSettingsStore((state) => state.connectionStatus));
          const observer2 = renderHook(() => useSettingsStore((state) => state.connectionStatus));
          const observer3 = renderHook(() => useSettingsStore((state) => state.connectionStatus));

          try {
            // Apply each status change
            for (const status of statusChanges) {
              await act(async () => {
                // Simulate status change
                useSettingsStore.setState({ connectionStatus: status });
              });

              // Verify all observers see the same status immediately
              await waitFor(() => {
                expect(observer1.result.current).toBe(status);
                expect(observer2.result.current).toBe(status);
                expect(observer3.result.current).toBe(status);
              }, { timeout: 1000 });

              // Verify consistency - all observers must have identical values
              expect(observer1.result.current).toBe(observer2.result.current);
              expect(observer2.result.current).toBe(observer3.result.current);
            }
          } finally {
            // Cleanup
            observer1.unmount();
            observer2.unmount();
            observer3.unmount();
          }
        }
      ),
      { numRuns: 50, timeout: 10000 } // Reduced runs and timeout
    );
  });

  /**
   * Property 4.1: Server switch state updates propagate immediately
   * 
   * Verifies that server switching state changes are immediately visible
   * to all components observing the state.
   */
  it('Property 4.1: Server switch state updates propagate immediately to all observers', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            isInProgress: fc.boolean(),
            progress: fc.constantFrom(
              'Starting server switch...',
              'Testing connectivity...',
              'Clearing cache...',
              'Updating configuration...',
              'Finalizing...',
              'Completed'
            ),
          }),
          { minLength: 2, maxLength: 5 } // Reduced complexity
        ),
        async (stateChanges) => {
          // Create multiple observers
          const observer1 = renderHook(() => useSettingsStore((state) => state.serverSwitchState));
          const observer2 = renderHook(() => useSettingsStore((state) => state.serverSwitchState));
          const observer3 = renderHook(() => useSettingsStore((state) => state.serverSwitchState));

          try {
            // Apply each state change
            for (const change of stateChanges) {
              await act(async () => {
                useSettingsStore.setState({
                  serverSwitchState: {
                    isInProgress: change.isInProgress,
                    fromServerId: 'mac-mini',
                    toServerId: 'pn51',
                    progress: change.progress,
                    startedAt: new Date(),
                  },
                });
              });

              // Verify all observers see the same state immediately
              await waitFor(() => {
                expect(observer1.result.current.isInProgress).toBe(change.isInProgress);
                expect(observer1.result.current.progress).toBe(change.progress);
                
                expect(observer2.result.current.isInProgress).toBe(change.isInProgress);
                expect(observer2.result.current.progress).toBe(change.progress);
                
                expect(observer3.result.current.isInProgress).toBe(change.isInProgress);
                expect(observer3.result.current.progress).toBe(change.progress);
              }, { timeout: 1000 });

              // Verify consistency across all observers
              expect(observer1.result.current.isInProgress).toBe(observer2.result.current.isInProgress);
              expect(observer2.result.current.isInProgress).toBe(observer3.result.current.isInProgress);
              expect(observer1.result.current.progress).toBe(observer2.result.current.progress);
              expect(observer2.result.current.progress).toBe(observer3.result.current.progress);
            }
          } finally {
            // Cleanup
            observer1.unmount();
            observer2.unmount();
            observer3.unmount();
          }
        }
      ),
      { numRuns: 50, timeout: 10000 } // Reduced runs and timeout
    );
  });

  /**
   * Property 4.2: Detailed status updates propagate with connection status
   * 
   * Verifies that when detailed connection status is updated, it propagates
   * immediately along with the connection status.
   */
  it('Property 4.2: Detailed status updates propagate with connection status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            status: fc.constantFrom<ConnectionStatus>('connected', 'error', 'disconnected'),
            responseTime: fc.option(fc.integer({ min: 10, max: 5000 }), { nil: undefined }),
            errorMessage: fc.option(fc.string({ minLength: 5, maxLength: 50 }), { nil: undefined }),
          }),
          { minLength: 2, maxLength: 8 }
        ),
        async (statusUpdates) => {
          // Create multiple observers
          const statusObserver = renderHook(() => useSettingsStore((state) => state.connectionStatus));
          const detailObserver = renderHook(() => useSettingsStore((state) => state.detailedStatus));

          try {
            // Apply each status update
            for (const update of statusUpdates) {
              await act(async () => {
                useSettingsStore.setState({
                  connectionStatus: update.status,
                  detailedStatus: {
                    serverId: 'mac-mini',
                    status: update.status,
                    lastChecked: new Date(),
                    responseTime: update.responseTime,
                    errorMessage: update.errorMessage,
                    healthChecks: [],
                  },
                });
              });

              // Verify both status and detailed status are updated immediately
              await waitFor(() => {
                expect(statusObserver.result.current).toBe(update.status);
                expect(detailObserver.result.current).toBeDefined();
                expect(detailObserver.result.current?.status).toBe(update.status);
              }, { timeout: 1000 });

              // Verify detailed status matches the update
              if (update.responseTime !== undefined) {
                expect(detailObserver.result.current?.responseTime).toBe(update.responseTime);
              }
              if (update.errorMessage !== undefined) {
                expect(detailObserver.result.current?.errorMessage).toBe(update.errorMessage);
              }
            }
          } finally {
            // Cleanup
            statusObserver.unmount();
            detailObserver.unmount();
          }
        }
      ),
      { numRuns: 50, timeout: 10000 } // Reduced runs and timeout
    );
  });

  /**
   * Property 4.3: Current server updates propagate immediately
   * 
   * Verifies that when the current server changes, all observers
   * see the update immediately and consistently.
   */
  it('Property 4.3: Current server updates propagate immediately to all observers', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.constantFrom('mac-mini', 'pn51'),
          { minLength: 2, maxLength: 6 }
        ),
        async (serverIds) => {
          // Create multiple observers
          const observer1 = renderHook(() => useSettingsStore((state) => state.currentServer));
          const observer2 = renderHook(() => useSettingsStore((state) => state.currentServer));
          const observer3 = renderHook(() => useSettingsStore((state) => state.currentServer));

          try {
            // Apply each server change
            for (const serverId of serverIds) {
              await act(async () => {
                const server = useSettingsStore.getState().availableServers.find(s => s.id === serverId);
                if (server) {
                  useSettingsStore.setState({ currentServer: server });
                }
              });

              // Verify all observers see the same server immediately
              await waitFor(() => {
                expect(observer1.result.current.id).toBe(serverId);
                expect(observer2.result.current.id).toBe(serverId);
                expect(observer3.result.current.id).toBe(serverId);
              }, { timeout: 1000 });

              // Verify consistency - all observers must have identical server IDs
              expect(observer1.result.current.id).toBe(observer2.result.current.id);
              expect(observer2.result.current.id).toBe(observer3.result.current.id);
            }
          } finally {
            // Cleanup
            observer1.unmount();
            observer2.unmount();
            observer3.unmount();
          }
        }
      ),
      { numRuns: 50, timeout: 10000 } // Reduced runs and timeout
    );
  });

  /**
   * Property 4.4: Multiple simultaneous observers receive consistent updates
   * 
   * Verifies that when many components observe the same state,
   * they all receive updates immediately and consistently.
   */
  it('Property 4.4: Multiple simultaneous observers receive consistent updates', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          numObservers: fc.integer({ min: 3, max: 10 }),
          statusChanges: fc.array(
            fc.constantFrom<ConnectionStatus>('connected', 'disconnected', 'testing', 'error'),
            { minLength: 3, maxLength: 8 }
          ),
        }),
        async ({ numObservers, statusChanges }) => {
          // Create multiple observers
          const observers = Array.from({ length: numObservers }, () =>
            renderHook(() => useSettingsStore((state) => state.connectionStatus))
          );

          try {
            // Apply each status change
            for (const status of statusChanges) {
              await act(async () => {
                useSettingsStore.setState({ connectionStatus: status });
              });

              // Verify all observers see the same status
              await waitFor(() => {
                const statuses = observers.map(obs => obs.result.current);
                const allSame = statuses.every(s => s === status);
                expect(allSame).toBe(true);
              }, { timeout: 1000 });

              // Verify pairwise consistency
              for (let i = 0; i < observers.length - 1; i++) {
                expect(observers[i].result.current).toBe(observers[i + 1].result.current);
              }
            }
          } finally {
            // Cleanup
            observers.forEach(obs => obs.unmount());
          }
        }
      ),
      { numRuns: 30, timeout: 10000 } // Reduced runs due to many observers
    );
  });

  /**
   * Property 4.5: Status updates during rapid changes remain consistent
   * 
   * Verifies that even during rapid status changes, all observers
   * eventually converge to the same final state.
   */
  it('Property 4.5: Status updates during rapid changes remain consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.constantFrom<ConnectionStatus>('connected', 'disconnected', 'testing', 'switching', 'error'),
          { minLength: 5, maxLength: 15 }
        ),
        async (rapidStatusChanges) => {
          // Create multiple observers
          const observer1 = renderHook(() => useSettingsStore((state) => state.connectionStatus));
          const observer2 = renderHook(() => useSettingsStore((state) => state.connectionStatus));
          const observer3 = renderHook(() => useSettingsStore((state) => state.connectionStatus));

          try {
            // Apply rapid status changes
            await act(async () => {
              for (const status of rapidStatusChanges) {
                useSettingsStore.setState({ connectionStatus: status });
                // No delay - rapid changes
              }
            });

            // After all changes, verify all observers converge to the final state
            const finalStatus = rapidStatusChanges[rapidStatusChanges.length - 1];
            
            await waitFor(() => {
              expect(observer1.result.current).toBe(finalStatus);
              expect(observer2.result.current).toBe(finalStatus);
              expect(observer3.result.current).toBe(finalStatus);
            }, { timeout: 1000 });

            // Verify final consistency
            expect(observer1.result.current).toBe(observer2.result.current);
            expect(observer2.result.current).toBe(observer3.result.current);
          } finally {
            // Cleanup
            observer1.unmount();
            observer2.unmount();
            observer3.unmount();
          }
        }
      ),
      { numRuns: 50, timeout: 10000 } // Reduced runs and timeout
    );
  });
});
