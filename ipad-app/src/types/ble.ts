export interface BLEDeviceInfo {
  id: string;
  name: string | null;
  rssi?: number;
}

export interface BPReading {
  systolic: number;
  diastolic: number;
  pulse: number;
  timestamp: Date;
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
