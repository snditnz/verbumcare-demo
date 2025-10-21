/**
 * Network Status Service
 *
 * Detects online/offline state and provides status to UI
 * Fallback version without native NetInfo dependency
 */

import { useState, useEffect } from 'react';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
}

// Default to optimistic "online" state
let currentStatus: NetworkStatus = {
  isConnected: true,
  isInternetReachable: true,
  type: 'wifi',
};

let listeners: Array<(status: NetworkStatus) => void> = [];

/**
 * Initialize network monitoring
 * Fallback: assumes always online (for Expo Go compatibility)
 */
export function initNetworkMonitoring() {
  console.log('[NetworkStatus] Using fallback mode (NetInfo not available)');
  console.log('[NetworkStatus] 🟢 Assuming online');

  // Return no-op unsubscribe function
  return () => {};
}

/**
 * Get current network status
 * Fallback: returns optimistic online state
 */
export async function getNetworkStatus(): Promise<NetworkStatus> {
  // TODO: When app is built with dev build, use actual NetInfo
  // For now, assume online to not block functionality
  return currentStatus;
}

/**
 * Check if device is online
 * Fallback: returns true
 */
export async function isOnline(): Promise<boolean> {
  return currentStatus.isConnected;
}

/**
 * Subscribe to network status changes
 * Fallback: no-op
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
 * Fallback: returns optimistic online state
 */
export function useNetworkStatus(): NetworkStatus {
  const [status] = useState<NetworkStatus>(currentStatus);

  // No actual monitoring in fallback mode
  // Component will always show "online" state

  return status;
}
