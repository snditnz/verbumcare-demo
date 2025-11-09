import { BleManager, Device, Characteristic } from 'react-native-ble-plx';
import { Platform } from 'react-native';
import { BLE_CONFIG } from '@constants/config';
import { AD_BP_SERVICE_UUID, AD_BP_CHARACTERISTIC_UUID, AD_DEVICE_NAME } from '@models/ble';
import type { BLEConnectionStatus, BPReading } from '@models/ble';

class BLEService {
  private manager: BleManager;
  private device: Device | null = null;
  private statusCallback: ((status: BLEConnectionStatus) => void) | null = null;
  private readingCallback: ((reading: BPReading) => void) | null = null;
  private scanTimeoutId: NodeJS.Timeout | null = null;
  private receivedDataSuccessfully: boolean = false;
  private lastReading: BPReading | null = null;
  private readingDebounceTimer: NodeJS.Timeout | null = null;
  private readingListeners: Array<(reading: BPReading) => void> = [];

  constructor() {
    this.manager = new BleManager();
  }

  setStatusCallback(callback: (status: BLEConnectionStatus) => void): void {
    this.statusCallback = callback;
  }

  setReadingCallback(callback: (reading: BPReading) => void): void {
    this.readingCallback = callback;
  }

  // Subscribe to BLE reading events (persistent across screen unmounts)
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
    if (Platform.OS === 'android') {
      // Android 12+ requires BLUETOOTH_SCAN and BLUETOOTH_CONNECT permissions
      // These are handled by the app.json permissions configuration
      return true;
    }

    // Check if Bluetooth is powered on
    const state = await this.manager.state();
    console.log('[BLE] Bluetooth state:', state);

    if (state !== 'PoweredOn') {
      console.error('[BLE] Bluetooth is not powered on. Current state:', state);
      return false;
    }

    return true;
  }

  async startScan(useTimeout: boolean = false): Promise<void> {
    console.log('[BLE] Starting scan for A&D BP monitors...');
    console.log('[BLE] Looking for device name containing:', AD_DEVICE_NAME);
    console.log('[BLE] Service UUID:', AD_BP_SERVICE_UUID);
    this.statusCallback?.('scanning');

    // Clear any existing timeout
    if (this.scanTimeoutId) {
      clearTimeout(this.scanTimeoutId);
      this.scanTimeoutId = null;
    }

    await this.manager.startDeviceScan(
      null, // Scan for ALL devices to see what's available
      { allowDuplicates: false },
      async (error, device) => {
        if (error) {
          console.error('[BLE] Scan error:', error);
          this.statusCallback?.('error');
          return;
        }

        if (device) {
          // Check if device name contains our target (case-insensitive, partial match)
          if (device.name && device.name.toUpperCase().includes('UA-651')) {
            console.log('[BLE] ✅ Found matching A&D BP monitor:', device.name);
            await this.manager.stopDeviceScan();
            if (this.scanTimeoutId) {
              clearTimeout(this.scanTimeoutId);
              this.scanTimeoutId = null;
            }
            await this.connectToDevice(device);
          }
        }
      }
    );

    // Only use timeout if explicitly requested (for testing/debugging)
    if (useTimeout) {
      this.scanTimeoutId = setTimeout(async () => {
        console.log('[BLE] Scan timeout reached');
        await this.manager.stopDeviceScan();
        this.scanTimeoutId = null;
        if (!this.device) {
          console.log('[BLE] No device found after timeout');
          this.statusCallback?.('disconnected');
        }
      }, BLE_CONFIG.SCAN_TIMEOUT);
    } else {
      console.log('[BLE] Scanning continuously (no timeout)...');
    }
  }

  private async connectToDevice(device: Device): Promise<void> {
    try {
      this.statusCallback?.('connecting');

      this.device = await device.connect({
        timeout: BLE_CONFIG.CONNECT_TIMEOUT,
      });

      console.log('[BLE] Connected to device, discovering services...');
      await this.device.discoverAllServicesAndCharacteristics();

      this.statusCallback?.('connected');
      console.log('[BLE] Device connected, waiting for device to be ready...');

      // Give device a moment to be ready to transmit (A&D devices need this)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Start monitoring BP characteristic
      await this.monitorBPCharacteristic();

    } catch (error: any) {
      const errorMsg = error.message || '';

      // Expected errors - silently handle
      if (errorMsg.includes('Operation was cancelled') ||
          errorMsg.includes('Operation timed out') ||
          errorMsg.includes('is not connected')) {
        console.log('[BLE] Device connection attempt ended (cancelled, timed out, or disconnected)');
      } else {
        // Unexpected errors - log details
        console.error('[BLE] Connection error:', error);
        console.error('[BLE] Error details:', error.message, error.code);
      }

      this.statusCallback?.('disconnected');
      await this.disconnect();

      // Restart scanning after connection failure
      console.log('[BLE] Waiting 2s before resuming scan...');
      setTimeout(() => {
        console.log('[BLE] Resuming scan...');
        this.startScan();
      }, 2000);
    }
  }

  private async monitorBPCharacteristic(): Promise<void> {
    if (!this.device) return;

    try {
      console.log('[BLE] Setting up characteristic monitoring...');
      console.log('[BLE] Service:', AD_BP_SERVICE_UUID);
      console.log('[BLE] Characteristic:', AD_BP_CHARACTERISTIC_UUID);

      this.device.monitorCharacteristicForService(
        AD_BP_SERVICE_UUID,
        AD_BP_CHARACTERISTIC_UUID,
        async (error, characteristic) => {
          if (error) {
            // Check if this is an expected disconnect after successful data receipt
            const errorMsg = error.message || '';
            const isExpectedDisconnect = this.receivedDataSuccessfully ||
              errorMsg.includes('was disconnected') ||
              errorMsg.includes('Operation was cancelled') ||
              errorMsg.includes('Device disconnected');

            if (isExpectedDisconnect) {
              if (this.receivedDataSuccessfully) {
                console.log('[BLE] ✅ Device disconnected after successful data transmission');
                this.receivedDataSuccessfully = false;
                // Go back to scanning for next reading
                await this.disconnect();
                // Wait 3 seconds before resuming scan to allow device to be ready
                console.log('[BLE] Waiting 3s before resuming scan for next reading...');
                setTimeout(() => {
                  this.startScan();
                }, 3000);
              }
              // Silently ignore expected disconnects
              return;
            }

            // Only log truly unexpected errors (not cancellation/disconnect errors)
            if (!errorMsg.includes('cancel') && !errorMsg.includes('disconnect')) {
              console.error('[BLE] ❌ Unexpected monitor error:', error);
              console.error('[BLE] Error details:', error.message, error.code);
            }
            return;
          }

          if (characteristic?.value) {
            console.log('[BLE] 📦 Received data:', characteristic.value);
            const reading = this.parseBPData(characteristic);
            if (reading) {
              console.log('[BLE] ✅ Parsed BP reading:', reading);
              this.receivedDataSuccessfully = true; // Mark successful receipt

              // Store this reading and debounce - only save the last reading from a batch
              this.lastReading = reading;

              // Clear existing timer
              if (this.readingDebounceTimer) {
                clearTimeout(this.readingDebounceTimer);
              }

              // Set new timer - if no new readings in 500ms, this is the final reading
              this.readingDebounceTimer = setTimeout(() => {
                if (this.lastReading) {
                  console.log('[BLE] 📤 Sending final reading from batch:', this.lastReading);
                  // Notify all persistent listeners first
                  this.readingListeners.forEach(listener => {
                    try {
                      listener(this.lastReading!);
                    } catch (error) {
                      console.error('[BLE] Error in reading listener:', error);
                    }
                  });
                  // Then call callback if it exists (for backwards compatibility)
                  this.readingCallback?.(this.lastReading);
                  this.lastReading = null;
                }
                this.readingDebounceTimer = null;
              }, 500);

              // Device will disconnect shortly - this is normal for A&D BP monitors
            } else {
              console.log('[BLE] ⚠️ Failed to parse BP data');
            }
          }
        }
      );
      console.log('[BLE] ✅ Monitor setup complete, waiting for BP reading...');
    } catch (error) {
      console.error('[BLE] ❌ Monitor setup error:', error);
    }
  }

  private parseBPData(characteristic: Characteristic): BPReading | null {
    try {
      const base64 = characteristic.value;
      console.log('[BLE] 🔍 Parsing base64:', base64);

      if (!base64) {
        console.log('[BLE] ⚠️ No base64 data');
        return null;
      }

      // Decode base64 to Uint8Array (React Native compatible)
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      console.log('[BLE] 🔍 Buffer length:', bytes.length);
      console.log('[BLE] 🔍 Buffer bytes:', Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '));

      // Standard Bluetooth Blood Pressure Measurement format (GATT Specification)
      // Byte 0: Flags
      //   Bit 0: Blood pressure units (0=mmHg, 1=kPa)
      //   Bit 1: Time stamp present
      //   Bit 2: Pulse rate present
      //   Bit 3: User ID present
      //   Bit 4: Measurement status present
      // Bytes 1-2: Systolic (IEEE 11073 SFLOAT, little-endian)
      // Bytes 3-4: Diastolic (IEEE 11073 SFLOAT, little-endian)
      // Bytes 5-6: Mean Arterial Pressure (IEEE 11073 SFLOAT, little-endian)
      // If Pulse rate present (Bit 2 set):
      //   Bytes 7-8: Pulse Rate (IEEE 11073 SFLOAT, little-endian)

      const flags = bytes[0];
      console.log('[BLE] 🔍 Flags:', flags.toString(2).padStart(8, '0'));

      const hasPulseRate = (flags & 0x04) !== 0;
      console.log('[BLE] 🔍 Has pulse rate:', hasPulseRate);

      // Parse IEEE 11073 SFLOAT (16-bit float)
      const parseSFloat = (byte1: number, byte2: number): number => {
        // Combine two bytes (little-endian)
        const value = byte1 | (byte2 << 8);

        // SFLOAT format: 4-bit exponent, 12-bit mantissa
        const mantissa = value & 0x0FFF;
        const exponent = (value >> 12) & 0x0F;

        // Handle signed mantissa (12-bit two's complement)
        const signedMantissa = mantissa & 0x0800 ? mantissa | 0xFFFFF000 : mantissa;

        // Calculate final value
        return signedMantissa * Math.pow(10, exponent);
      };

      const systolic = Math.round(parseSFloat(bytes[1], bytes[2]));
      const diastolic = Math.round(parseSFloat(bytes[3], bytes[4]));

      let pulse = 0;
      if (hasPulseRate && bytes.length >= 9) {
        pulse = Math.round(parseSFloat(bytes[7], bytes[8]));
      }

      console.log('[BLE] 🔍 Extracted values - Systolic:', systolic, 'Diastolic:', diastolic, 'Pulse:', pulse);

      // Validate readings are within physiological ranges
      // 2047 is a sentinel value in SFLOAT indicating invalid/missing data
      const isValidBP = systolic > 0 && systolic < 300 &&
                        diastolic > 0 && diastolic < 200 &&
                        systolic !== 2047 && diastolic !== 2047;

      const isValidPulse = pulse === 0 || (pulse > 0 && pulse < 250 && pulse !== 2047);

      if (isValidBP && isValidPulse) {
        const reading = {
          systolic,
          diastolic,
          pulse: pulse > 0 ? pulse : 0, // Pulse is optional
          timestamp: new Date(),
        };
        console.log('[BLE] ✅ Valid reading:', reading);
        return reading;
      }

      console.log('[BLE] ⚠️ Invalid values - out of physiological range or sentinel value detected');
      console.log('[BLE] BP valid:', isValidBP, 'Pulse valid:', isValidPulse);
      return null;
    } catch (error) {
      console.error('[BLE] ❌ Parse BP data error:', error);
      return null;
    }
  }

  async stopScan(): Promise<void> {
    console.log('[BLE] Stopping scan...');
    if (this.scanTimeoutId) {
      clearTimeout(this.scanTimeoutId);
      this.scanTimeoutId = null;
    }
    if (this.readingDebounceTimer) {
      clearTimeout(this.readingDebounceTimer);
      this.readingDebounceTimer = null;
    }
    await this.manager.stopDeviceScan();
  }

  async disconnect(): Promise<void> {
    if (this.readingDebounceTimer) {
      clearTimeout(this.readingDebounceTimer);
      this.readingDebounceTimer = null;
    }
    if (this.device) {
      try {
        await this.device.cancelConnection();
      } catch (error: any) {
        // Ignore "Operation was cancelled" - device already disconnected
        if (!error.message?.includes('Operation was cancelled')) {
          console.error('Disconnect error:', error);
        }
      } finally {
        this.device = null;
        this.statusCallback?.('disconnected');
      }
    }
  }

  private async retry(): Promise<void> {
    await this.disconnect();
    
    setTimeout(() => {
      this.startScan();
    }, BLE_CONFIG.RETRY_DELAY);
  }

  async destroy(): Promise<void> {
    await this.stopScan();
    await this.disconnect();
    await this.manager.destroy();
  }
}

export const bleService = new BLEService();
export default bleService;
