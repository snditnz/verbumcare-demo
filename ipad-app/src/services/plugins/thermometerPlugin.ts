import { Device, Characteristic } from 'react-native-ble-plx';
import { DevicePlugin, DeviceIdentifier, TemperatureReading, PluginError } from '@models/ble';
import { AD_THERMO_SERVICE_UUID, AD_THERMO_CHARACTERISTIC_UUID } from '@models/ble';
import { BLE_CONFIG } from '@constants/config';

export class ThermometerPlugin implements DevicePlugin {
  readonly pluginId = 'ad-thermometer';
  readonly deviceType = 'thermometer';
  readonly supportedDevices: DeviceIdentifier[] = [{
    serviceUUID: AD_THERMO_SERVICE_UUID,
    characteristicUUID: AD_THERMO_CHARACTERISTIC_UUID,
    deviceNamePattern: /UT-201/i
  }];

  async canHandleDevice(device: Device): Promise<boolean> {
    // Check device name pattern - be more flexible with matching
    if (!device.name) return false;
    
    const deviceNameUpper = device.name.toUpperCase();
    // Match various A&D thermometer naming patterns
    const nameMatches = deviceNameUpper.includes('UT-201') || 
                        deviceNameUpper.includes('UT201') ||
                        deviceNameUpper.includes('A&D_UT') ||
                        deviceNameUpper.includes('A&D UT') ||
                        deviceNameUpper.includes('THERMO');
    
    if (nameMatches) {
      console.log(`[ThermometerPlugin] ✅ Device name MATCHES: ${device.name}`);
    }
    
    return nameMatches;
  }

  async verifyDeviceIdentity(device: Device): Promise<boolean> {
    try {
      console.log('[ThermometerPlugin] Verifying device identity for:', device.name, device.id);
      
      // Check if device name matches expected pattern (more flexible)
      const deviceNameUpper = device.name?.toUpperCase() || '';
      const nameMatches = deviceNameUpper.includes('UT-201') || 
                          deviceNameUpper.includes('UT201') ||
                          deviceNameUpper.includes('A&D_UT') ||
                          deviceNameUpper.includes('A&D UT') ||
                          deviceNameUpper.includes('THERMO');
      
      if (!nameMatches) {
        console.log('[ThermometerPlugin] Device name does not match expected pattern');
        return false;
      }

      // Connect temporarily to verify service UUID
      console.log('[ThermometerPlugin] Connecting to verify service UUID...');
      const connectedDevice = await device.connect({ timeout: BLE_CONFIG.CONNECT_TIMEOUT });
      await connectedDevice.discoverAllServicesAndCharacteristics();
      
      // Check if device has the expected service UUID
      const services = await connectedDevice.services();
      console.log('[ThermometerPlugin] Available services:', services.map(s => s.uuid));
      
      const hasExpectedService = services.some(service => 
        service.uuid.toUpperCase() === AD_THERMO_SERVICE_UUID.toUpperCase()
      );

      if (hasExpectedService) {
        console.log('[ThermometerPlugin] ✅ Device identity verified - has expected service UUID');
        return true;
      } else {
        console.log('[ThermometerPlugin] ❌ Device identity verification failed - missing expected service UUID');
        console.log('[ThermometerPlugin] Expected:', AD_THERMO_SERVICE_UUID);
        await connectedDevice.cancelConnection();
        return false;
      }
    } catch (error) {
      console.error('[ThermometerPlugin] Device identity verification error:', error);
      return false;
    }
  }

  async connect(device: Device): Promise<void> {
    try {
      console.log('[ThermometerPlugin] Connecting to thermometer:', device.name);
      
      const connectedDevice = await device.connect({
        timeout: BLE_CONFIG.CONNECT_TIMEOUT,
      });

      console.log('[ThermometerPlugin] Connected to device, discovering services...');
      await connectedDevice.discoverAllServicesAndCharacteristics();

      console.log('[ThermometerPlugin] Device connected, waiting for device to be ready...');
      
      // Give device a moment to be ready to transmit
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('[ThermometerPlugin] ✅ Thermometer connection complete');
    } catch (error) {
      console.error('[ThermometerPlugin] Connection error:', error);
      throw error;
    }
  }

  async disconnect(device: Device): Promise<void> {
    try {
      await device.cancelConnection();
      console.log('[ThermometerPlugin] ✅ Thermometer disconnected');
    } catch (error) {
      console.error('[ThermometerPlugin] Disconnect error:', error);
      throw error;
    }
  }

  async parseReading(characteristic: Characteristic): Promise<TemperatureReading | null> {
    try {
      const base64 = characteristic.value;
      console.log('[ThermometerPlugin] 🔍 Parsing base64:', base64);

      if (!base64) {
        console.log('[ThermometerPlugin] ⚠️ No base64 data');
        return null;
      }

      // Decode base64 to bytes
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      console.log('[ThermometerPlugin] 🔍 Buffer length:', bytes.length);
      console.log('[ThermometerPlugin] 🔍 Buffer bytes:', Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '));

      // Health Thermometer Measurement format (GATT Specification)
      // Byte 0: Flags
      //   Bit 0: Temperature units (0=Celsius, 1=Fahrenheit)
      //   Bit 1: Time stamp present
      //   Bit 2: Temperature type present
      // Bytes 1-4: Temperature (IEEE 11073 FLOAT, little-endian)
      
      const flags = bytes[0];
      const isFahrenheit = (flags & 0x01) !== 0;
      
      console.log('[ThermometerPlugin] 🔍 Flags:', flags.toString(2).padStart(8, '0'));
      console.log('[ThermometerPlugin] 🔍 Is Fahrenheit:', isFahrenheit);
      
      // Parse IEEE 11073 FLOAT (32-bit) or SFLOAT (16-bit)
      let temperature: number;
      
      if (bytes.length >= 5) {
        // 32-bit FLOAT format
        temperature = this.parseFloat32(bytes[1], bytes[2], bytes[3], bytes[4]);
        console.log('[ThermometerPlugin] 🔍 Parsed as 32-bit FLOAT:', temperature);
      } else if (bytes.length >= 3) {
        // 16-bit SFLOAT format
        temperature = this.parseSFloat16(bytes[1], bytes[2]);
        console.log('[ThermometerPlugin] 🔍 Parsed as 16-bit SFLOAT:', temperature);
      } else {
        console.log('[ThermometerPlugin] ⚠️ Insufficient data length');
        return null;
      }

      // Convert to Celsius if needed
      if (isFahrenheit) {
        temperature = (temperature - 32) * 5 / 9;
        console.log('[ThermometerPlugin] 🔍 Converted to Celsius:', temperature);
      }

      // Round to 0.1°C precision
      temperature = Math.round(temperature * 10) / 10;

      console.log('[ThermometerPlugin] 🔍 Final temperature:', temperature, '°C');

      // Create temperature reading object
      const reading: TemperatureReading = {
        type: 'temperature',
        timestamp: new Date(),
        deviceId: characteristic.deviceID || 'unknown',
        deviceModel: 'A&D UT-201BLE Plus',
        data: {
          temperature_celsius: temperature,
          unit: 'celsius',
          precision: 0.1
        }
      };

      console.log('[ThermometerPlugin] ✅ Created temperature reading:', reading);
      return reading;
    } catch (error) {
      console.error('[ThermometerPlugin] ❌ Parse temperature data error:', error);
      return null;
    }
  }

  validateReading(reading: TemperatureReading): boolean {
    const temp = reading.data.temperature_celsius;
    
    // Validate temperature is within physiological range (30.0-45.0°C)
    // Also check for sentinel values
    const isValid = temp >= 30.0 && temp <= 45.0 && temp !== 2047;
    
    if (!isValid) {
      console.log('[ThermometerPlugin] ⚠️ Invalid temperature value:', temp, '°C');
    } else {
      console.log('[ThermometerPlugin] ✅ Temperature validation passed:', temp, '°C');
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

    console.error(`[ThermometerPlugin] Error in ${context}:`, pluginError);

    // TODO: Implement error recovery strategies
    if (pluginError.recoverable) {
      console.log('[ThermometerPlugin] Error is recoverable, attempting recovery...');
      // Implement recovery logic here
    }
  }

  private parseSFloat16(byte1: number, byte2: number): number {
    // IEEE 11073 SFLOAT: 4-bit exponent, 12-bit mantissa
    const value = byte1 | (byte2 << 8);
    let mantissa = value & 0x0FFF;
    let exponent = (value >> 12) & 0x0F;
    
    // Handle signed mantissa (12-bit two's complement)
    if (mantissa & 0x0800) {
      mantissa = mantissa - 0x1000;
    }
    
    // Handle signed exponent (4-bit two's complement)
    if (exponent & 0x08) {
      exponent = exponent - 0x10;
    }
    
    return mantissa * Math.pow(10, exponent);
  }

  private parseFloat32(byte1: number, byte2: number, byte3: number, byte4: number): number {
    // IEEE 11073 FLOAT: 8-bit exponent, 24-bit mantissa (little-endian)
    // Format: mantissa (3 bytes) + exponent (1 byte)
    let mantissa = byte1 | (byte2 << 8) | (byte3 << 16);
    let exponent = byte4;
    
    console.log('[ThermometerPlugin] 🔍 Raw mantissa:', mantissa, 'exponent byte:', exponent);
    
    // Handle signed mantissa (24-bit two's complement)
    if (mantissa & 0x800000) {
      mantissa = mantissa - 0x1000000;
    }
    
    // Handle signed exponent (8-bit two's complement)
    if (exponent & 0x80) {
      exponent = exponent - 0x100;
    }
    
    console.log('[ThermometerPlugin] 🔍 Signed mantissa:', mantissa, 'signed exponent:', exponent);
    
    const result = mantissa * Math.pow(10, exponent);
    console.log('[ThermometerPlugin] 🔍 Calculated result:', result);
    
    return result;
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
export const thermometerPlugin = new ThermometerPlugin();
export default thermometerPlugin;