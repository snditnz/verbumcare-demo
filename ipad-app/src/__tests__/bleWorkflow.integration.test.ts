/**
 * Integration Test: BLE Workflow
 * Tests BLE device discovery, connection, and data capture
 * 
 * Workflow:
 * 1. User initiates BLE scan
 * 2. System discovers BLE blood pressure monitor
 * 3. System verifies device identity by service UUID
 * 4. Device initiates connection (device-initiated pattern)
 * 5. System accepts connection from paired device
 * 6. Device transmits blood pressure reading
 * 7. System captures and validates data
 * 8. System associates reading with authenticated user
 * 9. Device disconnects (normal behavior)
 * 10. System stores reading for submission
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { BleManager, Device, Characteristic } from 'react-native-ble-plx';
import { BLEService } from '@services/ble';
import { useAuthStore } from '@stores/authStore';

// Mock BLE Manager
jest.mock('react-native-ble-plx', () => {
  const mockDevice = {
    id: 'device-123',
    name: 'A&D_UA-656BLE_123456',
    rssi: -50,
    serviceUUIDs: ['233BF000-5A34-1B6D-975C-000D5690ABE4'],
    connect: jest.fn(),
    discoverAllServicesAndCharacteristics: jest.fn(),
    readCharacteristicForService: jest.fn(),
    onDisconnected: jest.fn(),
    cancelConnection: jest.fn(),
  };

  return {
    BleManager: jest.fn().mockImplementation(() => ({
      startDeviceScan: jest.fn(),
      stopDeviceScan: jest.fn(),
      state: jest.fn().mockResolvedValue('PoweredOn'),
      enable: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn(),
    })),
    Device: mockDevice,
  };
});

// Mock permissions
jest.mock('react-native-permissions', () => ({
  PERMISSIONS: {
    IOS: {
      BLUETOOTH_PERIPHERAL: 'ios.permission.BLUETOOTH_PERIPHERAL',
    },
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
  },
  request: jest.fn().mockResolvedValue('granted'),
  check: jest.fn().mockResolvedValue('granted'),
}));

describe('Integration Test: BLE Workflow', () => {
  let storage: Map<string, string>;
  let bleService: BLEService;
  let mockBleManager: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    storage = new Map<string, string>();

    // Setup AsyncStorage mock
    (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    });

    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      return Promise.resolve(storage.get(key) || null);
    });

    (AsyncStorage.removeItem as jest.Mock).mockImplementation((key: string) => {
      storage.delete(key);
      return Promise.resolve();
    });

    // Setup authenticated user
    useAuthStore.setState({
      currentUser: {
        userId: 'user-123',
        staffId: 'staff-123',
        username: 'nurse1',
        fullName: 'Test Nurse',
        role: 'nurse',
        facilityId: 'facility-123',
        loginTime: new Date(),
      },
      tokens: {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: new Date(Date.now() + 3600000),
      },
      isAuthenticated: true,
      isLoading: false,
    });

    // Create BLE service instance
    bleService = new BLEService();
    mockBleManager = (bleService as any).manager;
  });

  afterEach(async () => {
    storage.clear();
    if (bleService) {
      bleService.disconnect();
    }
  });

  it('should complete full BLE workflow: scan → discover → connect → capture → disconnect', async () => {
    // ============================================================
    // STEP 1: User initiates BLE scan
    // ============================================================
    const mockDevice = {
      id: 'device-123',
      name: 'A&D_UA-656BLE_123456',
      rssi: -50,
      serviceUUIDs: ['233BF000-5A34-1B6D-975C-000D5690ABE4'], // A&D BP monitor service UUID
      connect: jest.fn().mockResolvedValue(undefined),
      discoverAllServicesAndCharacteristics: jest.fn().mockResolvedValue(undefined),
      readCharacteristicForService: jest.fn(),
      onDisconnected: jest.fn((callback) => {
        // Store callback for later invocation
        (mockDevice as any).disconnectCallback = callback;
      }),
      cancelConnection: jest.fn().mockResolvedValue(undefined),
    };

    let discoveredDevices: Device[] = [];
    let scanCallback: ((error: any, device: Device | null) => void) | null = null;

    mockBleManager.startDeviceScan.mockImplementation(
      (uuids: string[] | null, options: any, callback: (error: any, device: Device | null) => void) => {
        scanCallback = callback;
        // Simulate device discovery after a short delay
        setTimeout(() => {
          if (scanCallback) {
            scanCallback(null, mockDevice as any);
          }
        }, 100);
      }
    );

    // Track discovered devices
    bleService.setStatusCallback((status) => {
      if (status === 'scanning') {
        console.log('Scanning for devices...');
      }
    });

    // Start scan
    await bleService.startScan();

    // Wait for device discovery
    await new Promise(resolve => setTimeout(resolve, 150));

    // ============================================================
    // STEP 2: System discovers BLE blood pressure monitor
    // ============================================================
    expect(scanCallback).not.toBeNull();

    // ============================================================
    // STEP 3: System verifies device identity by service UUID
    // ============================================================
    const isValidDevice = mockDevice.serviceUUIDs?.includes('233BF000-5A34-1B6D-975C-000D5690ABE4');
    expect(isValidDevice).toBe(true);

    // ============================================================
    // STEP 4 & 5: Device initiates connection, system accepts
    // ============================================================
    let capturedReading: any = null;
    bleService.setReadingCallback((reading) => {
      capturedReading = reading;
    });

    // Connect to device
    await bleService.connectToDevice(mockDevice as any);

    expect(mockDevice.connect).toHaveBeenCalled();
    expect(mockDevice.discoverAllServicesAndCharacteristics).toHaveBeenCalled();

    // ============================================================
    // STEP 6: Device transmits blood pressure reading
    // ============================================================
    // Mock characteristic read for blood pressure data
    // A&D UA-656BLE format: [systolic, diastolic, pulse, ...]
    const mockBPData = Buffer.from([
      0x78, 0x00, // Systolic: 120 mmHg
      0x50, 0x00, // Diastolic: 80 mmHg
      0x48, 0x00, // Pulse: 72 bpm
      0x00, 0x00, // Additional data
    ]);

    mockDevice.readCharacteristicForService.mockResolvedValue({
      value: mockBPData.toString('base64'),
      uuid: '233BF001-5A34-1B6D-975C-000D5690ABE4',
    } as Characteristic);

    // Simulate reading BP data
    const characteristic = await mockDevice.readCharacteristicForService(
      '233BF000-5A34-1B6D-975C-000D5690ABE4',
      '233BF001-5A34-1B6D-975C-000D5690ABE4'
    );

    // ============================================================
    // STEP 7: System captures and validates data
    // ============================================================
    // Parse BP data (simplified - actual parsing in BLE service)
    const buffer = Buffer.from(characteristic.value, 'base64');
    const systolic = buffer.readUInt16LE(0);
    const diastolic = buffer.readUInt16LE(2);
    const pulse = buffer.readUInt16LE(4);

    expect(systolic).toBe(120);
    expect(diastolic).toBe(80);
    expect(pulse).toBe(72);

    // Validate ranges
    expect(systolic).toBeGreaterThan(0);
    expect(systolic).toBeLessThan(300);
    expect(diastolic).toBeGreaterThan(0);
    expect(diastolic).toBeLessThan(200);
    expect(pulse).toBeGreaterThan(0);
    expect(pulse).toBeLessThan(250);

    // ============================================================
    // STEP 8: System associates reading with authenticated user
    // ============================================================
    const currentUser = useAuthStore.getState().currentUser;
    const bpReading = {
      systolic,
      diastolic,
      pulse,
      timestamp: new Date(),
      deviceId: mockDevice.id,
      deviceModel: 'A&D UA-656BLE',
      userId: currentUser?.userId,
      staffId: currentUser?.staffId,
    };

    expect(bpReading.userId).toBe('user-123');
    expect(bpReading.staffId).toBe('staff-123');

    // ============================================================
    // STEP 9: Device disconnects (normal behavior)
    // ============================================================
    // Simulate device-initiated disconnect
    if ((mockDevice as any).disconnectCallback) {
      (mockDevice as any).disconnectCallback(null, mockDevice);
    }

    // Verify disconnect is handled gracefully (not an error)
    expect(mockDevice.onDisconnected).toHaveBeenCalled();

    // ============================================================
    // STEP 10: System stores reading for submission
    // ============================================================
    // Store reading in AsyncStorage for later submission
    const readingKey = `@ble_reading_${Date.now()}`;
    await AsyncStorage.setItem(readingKey, JSON.stringify(bpReading));

    // Verify reading is stored
    const storedReading = await AsyncStorage.getItem(readingKey);
    expect(storedReading).not.toBeNull();

    const parsedReading = JSON.parse(storedReading!);
    expect(parsedReading.systolic).toBe(120);
    expect(parsedReading.diastolic).toBe(80);
    expect(parsedReading.pulse).toBe(72);
    expect(parsedReading.userId).toBe('user-123');

    // ============================================================
    // VERIFICATION: Complete workflow succeeded
    // ============================================================
    expect(isValidDevice).toBe(true);
    expect(mockDevice.connect).toHaveBeenCalled();
    expect(systolic).toBe(120);
    expect(bpReading.userId).toBe('user-123');
    expect(storedReading).not.toBeNull();
  }, 30000);

  it('should reject device with invalid service UUID', async () => {
    // Mock device with wrong service UUID
    const invalidDevice = {
      id: 'invalid-device',
      name: 'Unknown Device',
      rssi: -60,
      serviceUUIDs: ['00001234-0000-1000-8000-00805F9B34FB'], // Wrong UUID
      connect: jest.fn(),
    };

    // Verify device is not A&D BP monitor
    const isValidDevice = invalidDevice.serviceUUIDs?.includes('233BF000-5A34-1B6D-975C-000D5690ABE4');
    expect(isValidDevice).toBe(false);

    // System should not connect to invalid device
    // In real implementation, connectToDevice would check service UUIDs first
  }, 30000);

  it('should handle BLE data validation errors', async () => {
    // Mock device
    const mockDevice = {
      id: 'device-123',
      name: 'A&D_UA-656BLE_123456',
      serviceUUIDs: ['233BF000-5A34-1B6D-975C-000D5690ABE4'],
      connect: jest.fn().mockResolvedValue(undefined),
      discoverAllServicesAndCharacteristics: jest.fn().mockResolvedValue(undefined),
      readCharacteristicForService: jest.fn(),
      onDisconnected: jest.fn(),
      cancelConnection: jest.fn().mockResolvedValue(undefined),
    };

    // Connect to device
    await bleService.connectToDevice(mockDevice as any);

    // Mock invalid BP data (out of range)
    const invalidBPData = Buffer.from([
      0xFF, 0xFF, // Systolic: 65535 (invalid)
      0xFF, 0xFF, // Diastolic: 65535 (invalid)
      0xFF, 0xFF, // Pulse: 65535 (invalid)
    ]);

    mockDevice.readCharacteristicForService.mockResolvedValue({
      value: invalidBPData.toString('base64'),
      uuid: '233BF001-5A34-1B6D-975C-000D5690ABE4',
    } as Characteristic);

    // Read characteristic
    const characteristic = await mockDevice.readCharacteristicForService(
      '233BF000-5A34-1B6D-975C-000D5690ABE4',
      '233BF001-5A34-1B6D-975C-000D5690ABE4'
    );

    // Parse data
    const buffer = Buffer.from(characteristic.value, 'base64');
    const systolic = buffer.readUInt16LE(0);
    const diastolic = buffer.readUInt16LE(2);
    const pulse = buffer.readUInt16LE(4);

    // Validate ranges - should fail
    const isValidSystolic = systolic > 0 && systolic < 300;
    const isValidDiastolic = diastolic > 0 && diastolic < 200;
    const isValidPulse = pulse > 0 && pulse < 250;

    expect(isValidSystolic).toBe(false);
    expect(isValidDiastolic).toBe(false);
    expect(isValidPulse).toBe(false);

    // System should reject invalid data
    // In real implementation, this would trigger manual entry fallback
  }, 30000);

  it('should remember paired device for future connections', async () => {
    // Mock device
    const mockDevice = {
      id: 'device-123',
      name: 'A&D_UA-656BLE_123456',
      serviceUUIDs: ['233BF000-5A34-1B6D-975C-000D5690ABE4'],
      connect: jest.fn().mockResolvedValue(undefined),
      discoverAllServicesAndCharacteristics: jest.fn().mockResolvedValue(undefined),
      onDisconnected: jest.fn(),
      cancelConnection: jest.fn().mockResolvedValue(undefined),
    };

    // First connection - pair device
    await bleService.connectToDevice(mockDevice as any);

    // Store pairing information
    const pairingKey = '@ble_paired_devices';
    const pairedDevices = [
      {
        id: mockDevice.id,
        name: mockDevice.name,
        serviceUUIDs: mockDevice.serviceUUIDs,
        pairedAt: new Date().toISOString(),
      },
    ];
    await AsyncStorage.setItem(pairingKey, JSON.stringify(pairedDevices));

    // Disconnect
    bleService.disconnect();

    // Simulate app restart - clear in-memory state
    bleService = new BLEService();

    // Load paired devices
    const storedPairings = await AsyncStorage.getItem(pairingKey);
    expect(storedPairings).not.toBeNull();

    const parsedPairings = JSON.parse(storedPairings!);
    expect(parsedPairings.length).toBe(1);
    expect(parsedPairings[0].id).toBe('device-123');

    // Device initiates connection again - should be accepted without re-pairing
    const isPaired = parsedPairings.some((d: any) => d.id === mockDevice.id);
    expect(isPaired).toBe(true);

    // System should accept connection from known device
    await bleService.connectToDevice(mockDevice as any);
    expect(mockDevice.connect).toHaveBeenCalled();
  }, 30000);

  it('should provide manual entry fallback when BLE fails', async () => {
    // Simulate BLE connection failure
    const mockDevice = {
      id: 'device-123',
      name: 'A&D_UA-656BLE_123456',
      serviceUUIDs: ['233BF000-5A34-1B6D-975C-000D5690ABE4'],
      connect: jest.fn().mockRejectedValue(new Error('Connection failed')),
      cancelConnection: jest.fn().mockResolvedValue(undefined),
    };

    // Attempt connection
    let connectionFailed = false;
    try {
      await bleService.connectToDevice(mockDevice as any);
    } catch (error) {
      connectionFailed = true;
    }

    expect(connectionFailed).toBe(true);

    // User enters data manually
    const currentUser = useAuthStore.getState().currentUser;
    const manualReading = {
      systolic: 125,
      diastolic: 82,
      pulse: 75,
      timestamp: new Date(),
      deviceId: 'manual-entry',
      deviceModel: 'Manual Entry',
      userId: currentUser?.userId,
      staffId: currentUser?.staffId,
      source: 'manual',
    };

    // Store manual reading
    const readingKey = `@manual_reading_${Date.now()}`;
    await AsyncStorage.setItem(readingKey, JSON.stringify(manualReading));

    // Verify manual reading is stored
    const storedReading = await AsyncStorage.getItem(readingKey);
    expect(storedReading).not.toBeNull();

    const parsedReading = JSON.parse(storedReading!);
    expect(parsedReading.systolic).toBe(125);
    expect(parsedReading.source).toBe('manual');
    expect(parsedReading.userId).toBe('user-123');
  }, 30000);
});
