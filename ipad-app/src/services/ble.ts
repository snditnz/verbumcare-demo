import type { BLEConnectionStatus, BPReading, DeviceReading } from '@models/ble';
import { enhancedBleService } from './enhancedBle';

/**
 * Legacy BLE Service - Maintains backward compatibility
 * Delegates to enhancedBleService for actual functionality
 */
class BLEService {
  private statusCallback: ((status: BLEConnectionStatus) => void) | null = null;
  private readingListeners: Array<(reading: BPReading) => void> = [];

  constructor() {
    // Set up delegation to enhanced service
    this.setupDelegation();
  }

  private setupDelegation(): void {
    // Forward status updates from enhanced service
    enhancedBleService.setStatusCallback((status) => {
      this.statusCallback?.(status);
    });

    // Convert enhanced readings to legacy format for backward compatibility
    enhancedBleService.onReading((reading: DeviceReading) => {
      // Only forward BP readings to maintain backward compatibility
      if (reading.type === 'blood_pressure') {
        const bpReading = reading as any; // Cast to bypass type issues
        // Convert to legacy format
        const legacyReading: BPReading = {
          systolic: bpReading.data.systolic,
          diastolic: bpReading.data.diastolic,
          pulse: bpReading.data.pulse,
          timestamp: bpReading.timestamp,
          deviceId: bpReading.deviceId,
          deviceModel: bpReading.deviceModel,
        } as any;

        // Notify legacy listeners
        this.readingListeners.forEach(listener => {
          try {
            listener(legacyReading);
          } catch (error) {
            console.error('[BLEService] Error in legacy reading listener:', error);
          }
        });
      }
    });
  }

  setStatusCallback(callback: (status: BLEConnectionStatus) => void): void {
    this.statusCallback = callback;
  }

  // Legacy callback method - converts to new listener format
  setReadingCallback(callback: (reading: BPReading) => void): void {
    this.readingListeners.push(callback);
  }

  // New persistent listener method
  onReading(callback: (reading: BPReading) => void): () => void {
    this.readingListeners.push(callback);
    // Return unsubscribe function
    return () => {
      const index = this.readingListeners.indexOf(callback);
      if (index > -1) {
        this.readingListeners.splice(index, 1);
      }
    };
  }

  async requestPermissions(): Promise<boolean> {
    return enhancedBleService.requestPermissions();
  }

  async startScan(useTimeout: boolean = false): Promise<void> {
    return enhancedBleService.startScan(useTimeout);
  }

  async stopScan(): Promise<void> {
    return enhancedBleService.stopScan();
  }

  async disconnect(): Promise<void> {
    return enhancedBleService.disconnect();
  }

  async destroy(): Promise<void> {
    return enhancedBleService.destroy();
  }

  // Legacy methods for backward compatibility
  isPaired(deviceId: string): boolean {
    return enhancedBleService.isPaired(deviceId);
  }

  getPairedDevices(): any[] {
    return enhancedBleService.getPairedDevices();
  }

  async unpairDevice(deviceId: string): Promise<void> {
    return enhancedBleService.unpairDevice(deviceId);
  }
}

// Export singleton instance
export const bleService = new BLEService();
export default bleService;
