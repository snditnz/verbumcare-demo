import { Device } from 'react-native-ble-plx';
import { DevicePlugin, DeviceRegistry, PluginRegistration } from '@models/ble';

class DeviceRegistryImpl implements DeviceRegistry {
  private plugins = new Map<string, DevicePlugin>();
  private registrations = new Map<string, PluginRegistration>();

  registerPlugin(plugin: DevicePlugin): void {
    console.log(`[DeviceRegistry] Registering plugin: ${plugin.pluginId} (${plugin.deviceType})`);
    
    // Validate plugin implements all required methods
    this.validatePlugin(plugin);
    
    // Register the plugin
    this.plugins.set(plugin.pluginId, plugin);
    
    // Create registration record
    const registration: PluginRegistration = {
      pluginId: plugin.pluginId,
      deviceType: plugin.deviceType,
      version: '1.0.0', // TODO: Get from plugin metadata
      registeredAt: new Date().toISOString(),
      isActive: true,
    };
    this.registrations.set(plugin.pluginId, registration);
    
    console.log(`[DeviceRegistry] ✅ Plugin registered successfully: ${plugin.pluginId}`);
  }

  unregisterPlugin(pluginId: string): void {
    console.log(`[DeviceRegistry] Unregistering plugin: ${pluginId}`);
    
    this.plugins.delete(pluginId);
    this.registrations.delete(pluginId);
    
    console.log(`[DeviceRegistry] ✅ Plugin unregistered: ${pluginId}`);
  }

  getPlugin(pluginId: string): DevicePlugin | null {
    return this.plugins.get(pluginId) || null;
  }

  async getPluginForDevice(device: Device): Promise<DevicePlugin | null> {
    console.log(`[DeviceRegistry] Finding plugin for device: ${device.name} (${device.id})`);
    
    // Find all plugins that can handle this device
    const candidatePlugins: { plugin: DevicePlugin; specificity: number }[] = [];
    
    for (const plugin of this.plugins.values()) {
      try {
        const canHandle = await plugin.canHandleDevice(device);
        if (canHandle) {
          // Calculate specificity score (more specific patterns get higher scores)
          const specificity = this.calculateSpecificity(plugin, device);
          candidatePlugins.push({ plugin, specificity });
          console.log(`[DeviceRegistry] Plugin ${plugin.pluginId} can handle device (specificity: ${specificity})`);
        }
      } catch (error) {
        console.error(`[DeviceRegistry] Error checking plugin ${plugin.pluginId}:`, error);
      }
    }
    
    if (candidatePlugins.length === 0) {
      console.log(`[DeviceRegistry] ❌ No plugin found for device: ${device.name}`);
      return null;
    }
    
    // Sort by specificity (highest first) and return the most specific match
    candidatePlugins.sort((a, b) => b.specificity - a.specificity);
    const selectedPlugin = candidatePlugins[0].plugin;
    
    console.log(`[DeviceRegistry] ✅ Selected plugin: ${selectedPlugin.pluginId} for device: ${device.name}`);
    return selectedPlugin;
  }

  getAllPlugins(): DevicePlugin[] {
    return Array.from(this.plugins.values());
  }

  getPluginsByType(deviceType: string): DevicePlugin[] {
    return Array.from(this.plugins.values()).filter(plugin => plugin.deviceType === deviceType);
  }

  getRegistrations(): PluginRegistration[] {
    return Array.from(this.registrations.values());
  }

  private validatePlugin(plugin: DevicePlugin): void {
    const requiredMethods = [
      'canHandleDevice',
      'verifyDeviceIdentity', 
      'connect',
      'disconnect',
      'parseReading',
      'validateReading',
      'handleError'
    ];
    
    for (const method of requiredMethods) {
      if (typeof (plugin as any)[method] !== 'function') {
        throw new Error(`Plugin ${plugin.pluginId} missing required method: ${method}`);
      }
    }
    
    // Validate metadata
    if (!plugin.pluginId || typeof plugin.pluginId !== 'string') {
      throw new Error(`Plugin missing or invalid pluginId`);
    }
    
    if (!plugin.deviceType || typeof plugin.deviceType !== 'string') {
      throw new Error(`Plugin ${plugin.pluginId} missing or invalid deviceType`);
    }
    
    if (!Array.isArray(plugin.supportedDevices) || plugin.supportedDevices.length === 0) {
      throw new Error(`Plugin ${plugin.pluginId} missing or empty supportedDevices array`);
    }
    
    console.log(`[DeviceRegistry] ✅ Plugin validation passed: ${plugin.pluginId}`);
  }

  private calculateSpecificity(plugin: DevicePlugin, device: Device): number {
    let specificity = 0;
    
    // More specific device name patterns get higher scores
    for (const identifier of plugin.supportedDevices) {
      if (device.name && identifier.deviceNamePattern.test(device.name)) {
        // Longer patterns are more specific
        const patternLength = identifier.deviceNamePattern.source.length;
        specificity += patternLength;
        
        // Exact matches get bonus points
        if (identifier.deviceNamePattern.source === device.name) {
          specificity += 100;
        }
      }
    }
    
    return specificity;
  }
}

// Export singleton instance
export const deviceRegistry = new DeviceRegistryImpl();
export default deviceRegistry;