import { BleManager, Device, Characteristic } from 'react-native-ble-plx';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BLE_CONFIG } from '@constants/config';
import type { 
  BLEConnectionStatus, 
  DeviceReading, 
  PairedDevice, 
  DevicePlugin 
} from '@models/ble';
import { deviceRegistry, initializePlugins } from './plugins';

const PAIRED_DEVICES_KEY = '@verbumcare_paired_ble_devices_v2'; // New key for enhanced format

class EnhancedBLEService {
  private manager: BleManager;
  private activeConnections = new Map<string, { device: Device; plugin: DevicePlugin }>();
  private statusCallback: ((status: BLEConnectionStatus) => void) | null = null;
  private scanTimeoutId: NodeJS.Timeout | null = null;
  private readingDebounceTimers = new Map<string, NodeJS.Timeout>();
  private readingListeners: Array<(reading: DeviceReading) => void> = [];
  private pairedDevices: Map<string, PairedDevice> = new Map();
  private isInitialized = false;

  constructor() {
    this.manager = new BleManager();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('[EnhancedBLE] Initializing enhanced BLE service...');
    
    // Initialize plugins
    initializePlugins();
    
    // Load paired devices
    await this.loadPairedDevices();
    
    this.isInitialized = true;
    console.log('[EnhancedBLE] ✅ Enhanced BLE service initialized');
  }

  setStatusCallback(callback: (status: BLEConnectionStatus) => void): void {
    this.statusCallback = callback;
  }

  // Subscribe to BLE reading events (persistent across screen unmounts)
  onReading(callback: (reading: DeviceReading) => void): () => void {
    this.readingListeners.push(callback);
    // Return unsubscribe function
    return () => {
      const index = this.readingListeners.indexOf(callback);
      if (index > -1) {
        this.readingListeners.splice(index, 1);
      }
    };
  }

  // Load paired devices from storage with migration support
  private async loadPairedDevices(): Promise<void> {
    try {
      // Try to load enhanced format first
      let stored = await AsyncStorage.getItem(PAIRED_DEVICES_KEY);
      
      if (!stored) {
        // Try to migrate from old format
        console.log('[EnhancedBLE] Attempting to migrate paired devices from old format...');
        await this.migratePairedDevices();
        stored = await AsyncStorage.getItem(PAIRED_DEVICES_KEY);
      }
      
      if (stored) {
        const devices: PairedDevice[] = JSON.parse(stored);
        devices.forEach(device => {
          this.pairedDevices.set(device.id, device);
        });
        console.log('[EnhancedBLE] Loaded', this.pairedDevices.size, 'paired devices');
      }
    } catch (error) {
      console.error('[EnhancedBLE] Failed to load paired devices:', error);
    }
  }

  // Migrate old paired devices format to new format
  private async migratePairedDevices(): Promise<void> {
    try {
      const oldKey = '@verbumcare_paired_ble_devices';
      const oldStored = await AsyncStorage.getItem(oldKey);
      
      if (oldStored) {
        const oldDevices = JSON.parse(oldStored);
        const migratedDevices: PairedDevice[] = oldDevices.map((device: any) => ({
          id: device.id,
          name: device.name,
          deviceType: 'blood_pressure_monitor', // Assume old devices are BP monitors
          pluginId: 'ad-bp-monitor',
          serviceUUID: device.serviceUUID,
          pairedAt: device.pairedAt,
          lastConnectedAt: device.lastConnectedAt,
          metadata: {}
        }));
        
        await AsyncStorage.setItem(PAIRED_DEVICES_KEY, JSON.stringify(migratedDevices));
        console.log('[EnhancedBLE] ✅ Migrated', migratedDevices.length, 'devices from old format');
        
        // Remove old format
        await AsyncStorage.removeItem(oldKey);
      }
    } catch (error) {
      console.error('[EnhancedBLE] Failed to migrate paired devices:', error);
    }
  }

  // Save paired devices to storage
  private async savePairedDevices(): Promise<void> {
    try {
      const devices = Array.from(this.pairedDevices.values());
      await AsyncStorage.setItem(PAIRED_DEVICES_KEY, JSON.stringify(devices));
      console.log('[EnhancedBLE] Saved', devices.length, 'paired devices');
    } catch (error) {
      console.error('[EnhancedBLE] Failed to save paired devices:', error);
    }
  }

  // Add a device to paired devices list with plugin metadata
  private async addPairedDevice(device: Device, plugin: DevicePlugin): Promise<void> {
    const pairedDevice: PairedDevice = {
      id: device.id,
      name: device.name,
      deviceType: plugin.deviceType,
      pluginId: plugin.pluginId,
      serviceUUID: plugin.supportedDevices[0]?.serviceUUID || '',
      pairedAt: new Date().toISOString(),
      lastConnectedAt: new Date().toISOString(),
      metadata: {
        deviceModel: device.name || 'Unknown'
      }
    };
    
    this.pairedDevices.set(device.id, pairedDevice);
    await this.savePairedDevices();
    console.log('[EnhancedBLE] Device paired:', device.name, device.id, 'with plugin:', plugin.pluginId);
  }

  // Update last connected time for a paired device
  private async updatePairedDeviceConnection(deviceId: string): Promise<void> {
    const pairedDevice = this.pairedDevices.get(deviceId);
    if (pairedDevice) {
      pairedDevice.lastConnectedAt = new Date().toISOString();
      await this.savePairedDevices();
    }
  }

  // Check if a device is paired
  isPaired(deviceId: string): boolean {
    return this.pairedDevices.has(deviceId);
  }

  // Get all paired devices
  getPairedDevices(): PairedDevice[] {
    return Array.from(this.pairedDevices.values());
  }

  // Remove a paired device
  async unpairDevice(deviceId: string): Promise<void> {
    this.pairedDevices.delete(deviceId);
    await this.savePairedDevices();
    console.log('[EnhancedBLE] Device unpaired:', deviceId);
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      // Android 12+ requires BLUETOOTH_SCAN and BLUETOOTH_CONNECT permissions
      // These are handled by the app.json permissions configuration
      return true;
    }

    // Check if Bluetooth is powered on
    const state = await this.manager.state();
    console.log('[EnhancedBLE] Bluetooth state:', state);

    if (state !== 'PoweredOn') {
      console.error('[EnhancedBLE] Bluetooth is not powered on. Current state:', state);
      return false;
    }

    return true;
  }

  async startScan(useTimeout: boolean = false): Promise<void> {
    await this.initialize();
    
    const plugins = deviceRegistry.getAllPlugins();
    console.log('[EnhancedBLE] Starting scan for devices...');
    console.log('[EnhancedBLE] Available plugins:', plugins.map(p => `${p.pluginId} (${p.deviceType})`));
    console.log('[EnhancedBLE] Paired devices:', this.pairedDevices.size);
    
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
          console.error('[EnhancedBLE] Scan error:', error);
          this.statusCallback?.('error');
          return;
        }

        if (device) {
          await this.handleDiscoveredDevice(device);
        }
      }
    );

    // Only use timeout if explicitly requested (for testing/debugging)
    if (useTimeout) {
      this.scanTimeoutId = setTimeout(async () => {
        console.log('[EnhancedBLE] Scan timeout reached');
        await this.manager.stopDeviceScan();
        this.scanTimeoutId = null;
        if (this.activeConnections.size === 0) {
          console.log('[EnhancedBLE] No devices connected after timeout');
          this.statusCallback?.('disconnected');
        }
      }, BLE_CONFIG.SCAN_TIMEOUT);
    } else {
      console.log('[EnhancedBLE] Scanning continuously (no timeout)...');
    }
  }

  private async handleDiscoveredDevice(device: Device): Promise<void> {
    try {
      console.log('[EnhancedBLE] 🔍 Discovered device:', device.name, device.id);
      
      // Find plugin that can handle this device
      const plugin = await deviceRegistry.getPluginForDevice(device);
      
      if (!plugin) {
        // Not a supported device, continue scanning
        return;
      }
      
      console.log('[EnhancedBLE] ✅ Found supported device:', device.name, 'with plugin:', plugin.pluginId);
      
      // Stop scanning temporarily while handling this device
      await this.manager.stopDeviceScan();
      if (this.scanTimeoutId) {
        clearTimeout(this.scanTimeoutId);
        this.scanTimeoutId = null;
      }
      
      // Check if this is a previously paired device
      const isPaired = this.isPaired(device.id);
      
      if (isPaired) {
        console.log('[EnhancedBLE] 🔗 Device is already paired - accepting device-initiated connection');
        await this.updatePairedDeviceConnection(device.id);
        await this.connectToDevice(device, plugin, true); // Skip identity verification for paired devices
      } else {
        console.log('[EnhancedBLE] 🆕 New device - verifying identity before pairing');
        
        // Verify device identity before first connection
        const isValid = await plugin.verifyDeviceIdentity(device);
        if (isValid) {
          // Device is verified, add to paired devices
          await this.addPairedDevice(device, plugin);
          // Device is already connected from verification, continue with monitoring
          this.activeConnections.set(device.id, { device, plugin });
          this.statusCallback?.('connected');
          await this.monitorDevice(device, plugin);
        } else {
          console.log('[EnhancedBLE] ❌ Device identity verification failed - not connecting');
          this.statusCallback?.('disconnected');
          // Resume scanning for valid devices
          setTimeout(() => {
            this.startScan();
          }, 2000);
        }
      }
    } catch (error) {
      console.error('[EnhancedBLE] Error handling discovered device:', error);
      // Resume scanning after error
      setTimeout(() => {
        this.startScan();
      }, 2000);
    }
  }

  private async connectToDevice(device: Device, plugin: DevicePlugin, _skipVerification: boolean = false): Promise<void> {
    try {
      this.statusCallback?.('connecting');

      // Use plugin's connect method
      await plugin.connect(device);
      
      // Store active connection
      this.activeConnections.set(device.id, { device, plugin });
      
      this.statusCallback?.('connected');
      console.log('[EnhancedBLE] Device connected via plugin:', plugin.pluginId);

      // Start monitoring the device
      await this.monitorDevice(device, plugin);

    } catch (error: any) {
      const errorMsg = error.message || '';

      // Expected errors - silently handle (graceful disconnect handling)
      if (errorMsg.includes('Operation was cancelled') ||
          errorMsg.includes('Operation timed out') ||
          errorMsg.includes('is not connected')) {
        console.log('[EnhancedBLE] Device connection attempt ended (cancelled, timed out, or disconnected) - this is normal behavior');
      } else {
        // Unexpected errors - log details and let plugin handle
        console.error('[EnhancedBLE] Connection error:', error);
        plugin.handleError(error, 'connection');
      }

      this.statusCallback?.('disconnected');
      await this.disconnectDevice(device.id);

      // Restart scanning after connection failure
      console.log('[EnhancedBLE] Waiting 2s before resuming scan...');
      setTimeout(() => {
        console.log('[EnhancedBLE] Resuming scan...');
        this.startScan();
      }, 2000);
    }
  }

  private async monitorDevice(device: Device, plugin: DevicePlugin): Promise<void> {
    try {
      console.log('[EnhancedBLE] Setting up device monitoring with plugin:', plugin.pluginId);
      
      const serviceUUID = plugin.supportedDevices[0]?.serviceUUID;
      const characteristicUUID = plugin.supportedDevices[0]?.characteristicUUID;
      
      if (!serviceUUID || !characteristicUUID) {
        throw new Error(`Plugin ${plugin.pluginId} missing service or characteristic UUID`);
      }

      device.monitorCharacteristicForService(
        serviceUUID,
        characteristicUUID,
        async (error, characteristic) => {
          if (error) {
            await this.handleMonitorError(error, device, plugin);
            return;
          }

          if (characteristic?.value) {
            await this.handleCharacteristicData(characteristic, device, plugin);
          }
        }
      );
      
      console.log('[EnhancedBLE] ✅ Monitor setup complete for plugin:', plugin.pluginId);
    } catch (error) {
      console.error('[EnhancedBLE] ❌ Monitor setup error:', error);
      plugin.handleError(error as Error, 'monitoring');
    }
  }

  private async handleMonitorError(error: any, device: Device, plugin: DevicePlugin): Promise<void> {
    const errorMsg = error.message || '';
    const connection = this.activeConnections.get(device.id);
    
    // Check if this is an expected disconnect after successful data transmission
    const isExpectedDisconnect = errorMsg.includes('was disconnected') ||
      errorMsg.includes('Operation was cancelled') ||
      errorMsg.includes('Device disconnected');

    if (isExpectedDisconnect && connection) {
      console.log('[EnhancedBLE] ✅ Device disconnected after data transmission (normal behavior for', plugin.pluginId, ')');
      
      // Clean up connection but DON'T set status to 'disconnected' immediately
      // This prevents the confusing "disconnection error" message after successful reading
      this.activeConnections.delete(device.id);
      
      // Set status to 'scanning' instead of 'disconnected' to indicate we're ready for next device
      this.statusCallback?.('scanning');
      
      // Wait before resuming scan to allow device to be ready for next connection
      console.log('[EnhancedBLE] Waiting 3s before resuming scan for next device-initiated connection...');
      setTimeout(() => {
        this.startScan();
      }, 3000);
      return;
    }

    // Handle unexpected errors
    if (!errorMsg.includes('cancel') && !errorMsg.includes('disconnect')) {
      console.error('[EnhancedBLE] ❌ Unexpected monitor error for plugin', plugin.pluginId, ':', error);
      plugin.handleError(error, 'monitoring');
    }
  }

  private async handleCharacteristicData(characteristic: Characteristic, device: Device, plugin: DevicePlugin): Promise<void> {
    try {
      console.log('[EnhancedBLE] 📦 Received data from device via plugin:', plugin.pluginId);
      
      // Parse reading using plugin
      const reading = await plugin.parseReading(characteristic);
      
      if (!reading) {
        console.log('[EnhancedBLE] ⚠️ Plugin failed to parse reading');
        return;
      }
      
      // Validate reading using plugin
      if (!plugin.validateReading(reading)) {
        console.log('[EnhancedBLE] ⚠️ Plugin rejected reading as invalid');
        return;
      }
      
      console.log('[EnhancedBLE] ✅ Parsed and validated reading from plugin:', plugin.pluginId, reading);
      
      // Debounce readings per device to handle rapid multiple readings
      const existingTimer = this.readingDebounceTimers.get(device.id);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set new timer - if no new readings in 500ms, this is the final reading
      const timer = setTimeout(() => {
        console.log('[EnhancedBLE] 📤 Sending final reading from device:', device.id);
        
        // Notify all persistent listeners
        this.readingListeners.forEach(listener => {
          try {
            listener(reading);
          } catch (error) {
            console.error('[EnhancedBLE] Error in reading listener:', error);
          }
        });
        
        this.readingDebounceTimers.delete(device.id);
      }, 500);
      
      this.readingDebounceTimers.set(device.id, timer);
      
    } catch (error) {
      console.error('[EnhancedBLE] Error handling characteristic data:', error);
      plugin.handleError(error as Error, 'data_parsing');
    }
  }

  async stopScan(): Promise<void> {
    console.log('[EnhancedBLE] Stopping scan...');
    
    if (this.scanTimeoutId) {
      clearTimeout(this.scanTimeoutId);
      this.scanTimeoutId = null;
    }
    
    // Clear all debounce timers
    this.readingDebounceTimers.forEach(timer => clearTimeout(timer));
    this.readingDebounceTimers.clear();
    
    await this.manager.stopDeviceScan();
  }

  async disconnect(): Promise<void> {
    console.log('[EnhancedBLE] Disconnecting all devices...');
    
    // Disconnect all active connections
    const connectionIds = Array.from(this.activeConnections.keys());
    for (const deviceId of connectionIds) {
      await this.disconnectDevice(deviceId);
    }
  }

  private async disconnectDevice(deviceId: string): Promise<void> {
    const connection = this.activeConnections.get(deviceId);
    if (connection) {
      try {
        await connection.plugin.disconnect(connection.device);
      } catch (error: any) {
        // Ignore "Operation was cancelled" - device already disconnected
        if (!error.message?.includes('Operation was cancelled')) {
          console.error('[EnhancedBLE] Disconnect error:', error);
          connection.plugin.handleError(error, 'disconnect');
        }
      } finally {
        this.activeConnections.delete(deviceId);
        
        // Update status if no more connections
        if (this.activeConnections.size === 0) {
          this.statusCallback?.('disconnected');
        }
      }
    }
  }

  async destroy(): Promise<void> {
    await this.stopScan();
    await this.disconnect();
    await this.manager.destroy();
  }

  // Backward compatibility methods for existing code
  setReadingCallback(callback: (reading: any) => void): void {
    // Convert to new format for backward compatibility
    this.onReading(callback);
  }
}

// Export singleton instance
export const enhancedBleService = new EnhancedBLEService();
export default enhancedBleService;