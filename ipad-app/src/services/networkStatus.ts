/**
 * Network Status Service
 *
 * Detects online/offline state and provides status to UI
 */

import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
}

let currentStatus: NetworkStatus = {
  isConnected: false,
  isInternetReachable: null,
  type: null,
};

let listeners: Array<(status: NetworkStatus) => void> = [];

/**
 * Initialize network monitoring
 */
export function initNetworkMonitoring() {
  const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    currentStatus = {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
    };

    // Notify all listeners
    listeners.forEach(listener => listener(currentStatus));

    console.log('[NetworkStatus]', currentStatus.isConnected ? '🟢 Online' : '🔴 Offline');
  });

  return unsubscribe;
}

/**
 * Get current network status
 */
export async function getNetworkStatus(): Promise<NetworkStatus> {
  const state = await NetInfo.fetch();
  return {
    isConnected: state.isConnected ?? false,
    isInternetReachable: state.isInternetReachable,
    type: state.type,
  };
}

/**
 * Check if device is online
 */
export async function isOnline(): Promise<boolean> {
  const status = await getNetworkStatus();
  return status.isConnected;
}

/**
 * Subscribe to network status changes
 */
export function subscribeToNetworkStatus(callback: (status: NetworkStatus) => void) {
  listeners.push(callback);

  // Return unsubscribe function
  return () => {
    listeners = listeners.filter(l => l !== callback);
  };
}

/**
 * React hook for network status
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(currentStatus);

  useEffect(() => {
    // Get initial status
    getNetworkStatus().then(setStatus);

    // Subscribe to changes
    const unsubscribe = subscribeToNetworkStatus(setStatus);

    return unsubscribe;
  }, []);

  return status;
}
