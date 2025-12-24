import { Device, Characteristic } from 'react-native-ble-plx';

export interface BLEDeviceInfo {
  id: string;
  name: string | null;
  rssi?: number;
}

// Base interface for all device readings
export interface DeviceReading {
  type: string;
  timestamp: Date;
  deviceId: string;
  deviceModel: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface BPReading extends DeviceReading {
  type: 'blood_pressure';
  data: {
    systolic: number;
    diastolic: number;
    pulse: number;
  };
}

export interface TemperatureReading extends DeviceReading {
  type: 'temperature';
  data: {
    temperature_celsius: number;
    unit: 'celsius' | 'fahrenheit';
    precision: number;
  };
}

// Enhanced pairing data with plugin support
export interface PairedDevice {
  id: string;
  name: string | null;
  deviceType: string;
  pluginId: string;
  serviceUUID: string;
  pairedAt: string;
  lastConnectedAt: string;
  metadata?: Record<string, any>;
}

// Plugin registration data
export interface PluginRegistration {
  pluginId: string;
  deviceType: string;
  version: string;
  registeredAt: string;
  isActive: boolean;
}

// Device identification criteria
export interface DeviceIdentifier {
  serviceUUID: string;
  characteristicUUID: string;
  deviceNamePattern: RegExp;
  manufacturerData?: string;
}

// Plugin interface that all device plugins must implement
export interface DevicePlugin {
  // Plugin metadata
  readonly pluginId: string;
  readonly deviceType: string;
  readonly supportedDevices: DeviceIdentifier[];
  
  // Device identification
  canHandleDevice(device: Device): Promise<boolean>;
  verifyDeviceIdentity(device: Device): Promise<boolean>;
  
  // Connection management
  connect(device: Device): Promise<void>;
  disconnect(device: Device): Promise<void>;
  
  // Data processing
  parseReading(characteristic: Characteristic): Promise<DeviceReading | null>;
  validateReading(reading: DeviceReading): boolean;
  
  // Error handling
  handleError(error: Error, context: string): void;
}

// Plugin error interface
export interface PluginError extends Error {
  pluginId: string;
  deviceId?: string;
  context: string;
  recoverable: boolean;
}

// Device registry interface
export interface DeviceRegistry {
  registerPlugin(plugin: DevicePlugin): void;
  unregisterPlugin(pluginId: string): void;
  getPlugin(pluginId: string): DevicePlugin | null;
  getPluginForDevice(device: Device): DevicePlugin | null;
  getAllPlugins(): DevicePlugin[];
  getPluginsByType(deviceType: string): DevicePlugin[];
}

export type BLEConnectionStatus =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'pairing'
  | 'connected'
  | 'error';

// Standard Bluetooth Blood Pressure Profile (for A&D UA-651BLE and compatible devices)
// The UA-651BLE uses the standard Bluetooth SIG Blood Pressure Profile
export const AD_BP_SERVICE_UUID = '00001810-0000-1000-8000-00805F9B34FB'; // Blood Pressure Service
export const AD_BP_CHARACTERISTIC_UUID = '00002A35-0000-1000-8000-00805F9B34FB'; // Blood Pressure Measurement
export const AD_DEVICE_NAME = 'UA-651BLE'; // Supports UA-651BLE-Plus

// Standard Bluetooth Health Thermometer Profile (for A&D UT-201BLE Plus and compatible devices)
// The UT-201BLE Plus uses the standard Bluetooth SIG Health Thermometer Profile
export const AD_THERMO_SERVICE_UUID = '00001809-0000-1000-8000-00805F9B34FB'; // Health Thermometer Service
export const AD_THERMO_CHARACTERISTIC_UUID = '00002A1C-0000-1000-8000-00805F9B34FB'; // Temperature Measurement
export const AD_THERMO_DEVICE_NAME = 'UT-201'; // Supports UT-201BLE-Plus
