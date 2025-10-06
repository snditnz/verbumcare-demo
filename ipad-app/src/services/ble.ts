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

  constructor() {
    this.manager = new BleManager();
  }

  setStatusCallback(callback: (status: BLEConnectionStatus) => void): void {
    this.statusCallback = callback;
  }

  setReadingCallback(callback: (reading: BPReading) => void): void {
    this.readingCallback = callback;
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      // Android 12+ requires BLUETOOTH_SCAN and BLUETOOTH_CONNECT permissions
      // These are handled by the app.json permissions configuration
      return true;
    }
    return true;
  }

  async startScan(): Promise<void> {
    this.statusCallback?.('scanning');
    
    await this.manager.startDeviceScan(
      [AD_BP_SERVICE_UUID],
      { allowDuplicates: false },
      async (error, device) => {
        if (error) {
          console.error('BLE Scan error:', error);
          this.statusCallback?.('error');
          return;
        }

        if (device && device.name?.includes(AD_DEVICE_NAME)) {
          console.log('Found A&D BP monitor:', device.name);
          await this.manager.stopDeviceScan();
          await this.connectToDevice(device);
        }
      }
    );

    // Timeout after configured duration
    setTimeout(async () => {
      await this.manager.stopDeviceScan();
      if (!this.device) {
        this.statusCallback?.('disconnected');
      }
    }, BLE_CONFIG.SCAN_TIMEOUT);
  }

  private async connectToDevice(device: Device): Promise<void> {
    try {
      this.statusCallback?.('connecting');
      
      this.device = await device.connect({
        timeout: BLE_CONFIG.CONNECT_TIMEOUT,
      });

      await this.device.discoverAllServicesAndCharacteristics();
      
      this.statusCallback?.('connected');
      
      // Start monitoring BP characteristic
      await this.monitorBPCharacteristic();
      
    } catch (error) {
      console.error('Connection error:', error);
      this.statusCallback?.('error');
      await this.retry();
    }
  }

  private async monitorBPCharacteristic(): Promise<void> {
    if (!this.device) return;

    try {
      this.device.monitorCharacteristicForService(
        AD_BP_SERVICE_UUID,
        AD_BP_CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error) {
            console.error('Monitor error:', error);
            return;
          }

          if (characteristic?.value) {
            const reading = this.parseBPData(characteristic);
            if (reading) {
              this.readingCallback?.(reading);
            }
          }
        }
      );
    } catch (error) {
      console.error('Monitor setup error:', error);
    }
  }

  private parseBPData(characteristic: Characteristic): BPReading | null {
    try {
      const base64 = characteristic.value;
      if (!base64) return null;

      // Decode base64 to buffer
      const buffer = Buffer.from(base64, 'base64');
      
      // A&D UA-656BLE data format:
      // Byte 2: Systolic BP
      // Byte 4: Diastolic BP
      // Byte 6: Pulse
      const systolic = buffer[2];
      const diastolic = buffer[4];
      const pulse = buffer[6];

      if (systolic > 0 && diastolic > 0 && pulse > 0) {
        return {
          systolic,
          diastolic,
          pulse,
          timestamp: new Date(),
        };
      }

      return null;
    } catch (error) {
      console.error('Parse BP data error:', error);
      return null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.device) {
      try {
        await this.device.cancelConnection();
      } catch (error) {
        console.error('Disconnect error:', error);
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
    await this.disconnect();
    await this.manager.destroy();
  }
}

export const bleService = new BLEService();
export default bleService;
