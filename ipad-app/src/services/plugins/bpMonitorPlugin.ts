import { Device, Characteristic } from 'react-native-ble-plx';
import { DevicePlugin, DeviceIdentifier, BPReading, PluginError } from '@models/ble';
import { AD_BP_SERVICE_UUID, AD_BP_CHARACTERISTIC_UUID } from '@models/ble';
import { BLE_CONFIG } from '@constants/config';

export class BPMonitorPlugin implements DevicePlugin {
  readonly pluginId = 'ad-bp-monitor';
  readonly deviceType = 'blood_pressure_monitor';
  readonly supportedDevices: DeviceIdentifier[] = [{
    serviceUUID: AD_BP_SERVICE_UUID,
    characteristicUUID: AD_BP_CHARACTERISTIC_UUID,
    deviceNamePattern: /UA-651/i
  }];

  async canHandleDevice(device: Device): Promise<boolean> {
    // Check device name pattern
    if (!device.name) return false;
    
    const nameMatches = device.name.toUpperCase().includes('UA-651');
    console.log(`[BPMonitorPlugin] Device name check: ${device.name} -> ${nameMatches}`);
    
    return nameMatches;
  }

  async verifyDeviceIdentity(device: Device): Promise<boolean> {
    try {
      console.log('[BPMonitorPlugin] Verifying device identity for:', device.name, device.id);
      
      // Check if device name matches expected pattern
      if (!device.name || !device.name.toUpperCase().includes('UA-651')) {
        console.log('[BPMonitorPlugin] Device name does not match expected pattern');
        return false;
      }

      // Connect temporarily to verify service UUID
      const connectedDevice = await device.connect({ timeout: BLE_CONFIG.CONNECT_TIMEOUT });
      await connectedDevice.discoverAllServicesAndCharacteristics();
      
      // Check if device has the expected service UUID
      const services = await connectedDevice.services();
      const hasExpectedService = services.some(service => 
        service.uuid.toUpperCase() === AD_BP_SERVICE_UUID.toUpperCase()
      );

      if (hasExpectedService) {
        console.log('[BPMonitorPlugin] ✅ Device identity verified - has expected service UUID');
        return true;
      } else {
        console.log('[BPMonitorPlugin] ❌ Device identity verification failed - missing expected service UUID');
        await connectedDevice.cancelConnection();
        return false;
      }
    } catch (error) {
      console.error('[BPMonitorPlugin] Device identity verification error:', error);
      return false;
    }
  }

  async connect(device: Device): Promise<void> {
    try {
      console.log('[BPMonitorPlugin] Connecting to BP monitor:', device.name);
      
      const connectedDevice = await device.connect({
        timeout: BLE_CONFIG.CONNECT_TIMEOUT,
      });

      console.log('[BPMonitorPlugin] Connected to device, discovering services...');
      await connectedDevice.discoverAllServicesAndCharacteristics();

      console.log('[BPMonitorPlugin] Device connected, waiting for device to be ready...');
      
      // Give device a moment to be ready to transmit (A&D devices need this)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('[BPMonitorPlugin] ✅ BP monitor connection complete');
    } catch (error) {
      console.error('[BPMonitorPlugin] Connection error:', error);
      throw error;
    }
  }

  async disconnect(device: Device): Promise<void> {
    try {
      await device.cancelConnection();
      console.log('[BPMonitorPlugin] ✅ BP monitor disconnected');
    } catch (error) {
      console.error('[BPMonitorPlugin] Disconnect error:', error);
      throw error;
    }
  }

  async parseReading(characteristic: Characteristic): Promise<BPReading | null> {
    try {
      const base64 = characteristic.value;
      console.log('[BPMonitorPlugin] 🔍 Parsing base64:', base64);

      if (!base64) {
        console.log('[BPMonitorPlugin] ⚠️ No base64 data');
        return null;
      }

      // Decode base64 to Uint8Array (React Native compatible)
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      console.log('[BPMonitorPlugin] 🔍 Buffer length:', bytes.length);
      console.log('[BPMonitorPlugin] 🔍 Buffer bytes:', Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '));

      // Standard Bluetooth Blood Pressure Measurement format (GATT Specification)
      const flags = bytes[0];
      console.log('[BPMonitorPlugin] 🔍 Flags:', flags.toString(2).padStart(8, '0'));

      const hasPulseRate = (flags & 0x04) !== 0;
      console.log('[BPMonitorPlugin] 🔍 Has pulse rate:', hasPulseRate);

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

      console.log('[BPMonitorPlugin] 🔍 Extracted values - Systolic:', systolic, 'Diastolic:', diastolic, 'Pulse:', pulse);

      // Create BP reading object
      const reading: BPReading = {
        type: 'blood_pressure',
        timestamp: new Date(),
        deviceId: characteristic.deviceID || 'unknown',
        deviceModel: 'A&D UA-651BLE',
        data: {
          systolic,
          diastolic,
          pulse: pulse > 0 ? pulse : 0, // Pulse is optional
        }
      };

      console.log('[BPMonitorPlugin] ✅ Created BP reading:', reading);
      return reading;
    } catch (error) {
      console.error('[BPMonitorPlugin] ❌ Parse BP data error:', error);
      return null;
    }
  }

  validateReading(reading: BPReading): boolean {
    const { systolic, diastolic, pulse } = reading.data;
    
    // Validate readings are within physiological ranges
    // 2047 is a sentinel value in SFLOAT indicating invalid/missing data
    const isValidBP = systolic > 50 && systolic < 300 &&
                      diastolic > 30 && diastolic < 200 &&
                      systolic !== 2047 && diastolic !== 2047;

    const isValidPulse = pulse === 0 || (pulse > 30 && pulse < 250 && pulse !== 2047);

    const isValid = isValidBP && isValidPulse;
    
    if (!isValid) {
      console.log('[BPMonitorPlugin] ⚠️ Invalid values - out of physiological range or sentinel value detected');
      console.log('[BPMonitorPlugin] BP valid:', isValidBP, 'Pulse valid:', isValidPulse);
    } else {
      console.log('[BPMonitorPlugin] ✅ Reading validation passed');
    }

    return isValid;
  }

  handleError(error: Error, context: string): void {
    const pluginError: PluginError = {
      ...error,
      pluginId: this.pluginId,
      context,
      recoverable: this.isRecoverableError(error),
    };

    console.error(`[BPMonitorPlugin] Error in ${context}:`, pluginError);

    // TODO: Implement error recovery strategies
    if (pluginError.recoverable) {
      console.log('[BPMonitorPlugin] Error is recoverable, attempting recovery...');
      // Implement recovery logic here
    }
  }

  private isRecoverableError(error: Error): boolean {
    const errorMsg = error.message || '';
    
    // These are typically recoverable connection issues
    const recoverableErrors = [
      'Operation was cancelled',
      'Operation timed out',
      'is not connected',
      'was disconnected'
    ];

    return recoverableErrors.some(msg => errorMsg.includes(msg));
  }
}

// Export singleton instance
export const bpMonitorPlugin = new BPMonitorPlugin();
export default bpMonitorPlugin;