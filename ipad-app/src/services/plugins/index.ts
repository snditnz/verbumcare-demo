// Plugin exports
export { BPMonitorPlugin, bpMonitorPlugin } from './bpMonitorPlugin';
export { ThermometerPlugin, thermometerPlugin } from './thermometerPlugin';

// Plugin registry
import { deviceRegistry } from '../deviceRegistry';
import { bpMonitorPlugin } from './bpMonitorPlugin';
import { thermometerPlugin } from './thermometerPlugin';

// Auto-register all plugins
export const initializePlugins = () => {
  console.log('[Plugins] Initializing device plugins...');
  
  try {
    // Register BP monitor plugin
    deviceRegistry.registerPlugin(bpMonitorPlugin);
    
    // Register thermometer plugin
    deviceRegistry.registerPlugin(thermometerPlugin);
    
    console.log('[Plugins] ✅ All plugins initialized successfully');
    console.log('[Plugins] Registered plugins:', deviceRegistry.getAllPlugins().map(p => p.pluginId));
  } catch (error) {
    console.error('[Plugins] ❌ Failed to initialize plugins:', error);
    throw error;
  }
};

// Export registry for external use
export { deviceRegistry } from '../deviceRegistry';