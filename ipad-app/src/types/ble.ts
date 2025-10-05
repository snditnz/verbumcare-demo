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
  | 'connected'
  | 'error';

// A&D UA-656BLE Blood Pressure Monitor UUIDs
export const AD_BP_SERVICE_UUID = '233BF000-5A34-1B6D-975C-000D5690ABE4';
export const AD_BP_CHARACTERISTIC_UUID = '233BF001-5A34-1B6D-975C-000D5690ABE4';
export const AD_DEVICE_NAME = 'UA-656BLE';
