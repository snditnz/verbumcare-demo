/**
 * UI Optimization Service for Performance Enhancement
 * 
 * This service optimizes UI updates during server switches by implementing
 * debouncing, batching, and intelligent update scheduling to improve user experience.
 */

import { Animated, InteractionManager } from 'react-native';
import { 
  loggingService, 
  LogCategory 
} from './loggingService';

interface UIUpdateBatch {
  id: string;
  updates: UIUpdate[];
  priority: number;
  timestamp: Date;
  callback?: () => void;
}

interface UIUpdate {
  type: 'status' | 'progress' | 'error' | 'success' | 'server_info';
  data: any;
  component?: string;
  priority: number;
}

interface OptimizationConfig {
  debounceDelay: number; // milliseconds
  batchSize: number;
  maxBatchAge: number; // milliseconds
  enableAnimations: boolean;
  priorityThreshold: number;
  interactionDelay: number; // milliseconds to wait after interactions
}

interface PerformanceMetrics {
  totalUpdates: number;
  batchedUpdates: number;
  debouncedUpdates: number;
  averageUpdateTime: number;
  droppedUpdates: number;
  animationFrameRate: number;
}

class UIOptimizationService {
  private updateQueue: UIUpdateBatch[] = [];
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private animationValues: Map<string, Animated.Value> = new Map();
  private config: OptimizationConfig;
  private metrics: PerformanceMetrics = {
    totalUpdates: 0,
    batchedUpdates: 0,
    debouncedUpdates: 0,
    averageUpdateTime: 0,
    droppedUpdates: 0,
    animationFrameRate: 60
  };
  private updateTimes: number[] = [];
  private processingBatch = false;
  private frameCallbacks: Map<string, () => void> = new Map();

  constructor(config?: Partial<OptimizationConfig>) {
    this.config = {
      debounceDelay: 150, // 150ms debounce
      batchSize: 10,
      maxBatchAge: 500, // 500ms max batch age
      enableAnimations: true,
      priorityThreshold: 7, // Updates with priority >= 7 are processed immediately
      interactionDelay: 100, // Wait 100ms after interactions
      ...config
    };

    this.startBatchProcessor();
  }

  /**
   * Schedule a UI update with optimization
   */
  scheduleUpdate(
    updateType: UIUpdate['type'],
    data: any,
    options?: {
      component?: string;
      priority?: number;
      immediate?: boolean;
      debounceKey?: string;
      callback?: () => void;
    }
  ): void {
    const priority = options?.priority || 5;
    const immediate = options?.immediate || priority >= this.config.priorityThreshold;
    const debounceKey = options?.debounceKey || `${updateType}_${options?.component || 'global'}`;

    const update: UIUpdate = {
      type: updateType,
      data,
      component: options?.component,
      priority
    };

    this.metrics.totalUpdates++;

    if (immediate) {
      // High priority updates are processed immediately
      this.processImmediateUpdate(update, options?.callback);
      return;
    }

    // Handle debouncing for frequent updates
    if (this.shouldDebounce(updateType, debounceKey)) {
      this.scheduleDebounced(update, debounceKey, options?.callback);
      return;
    }

    // Add to batch queue
    this.addToBatch(update, options?.callback);
  }

  /**
   * Schedule server switch progress updates with smooth animations
   */
  scheduleServerSwitchProgress(
    progress: string,
    percentage?: number,
    options?: {
      animate?: boolean;
      duration?: number;
      callback?: () => void;
    }
  ): void {
    const animationKey = 'server_switch_progress';
    
    if (options?.animate && this.config.enableAnimations && percentage !== undefined) {
      this.animateProgress(animationKey, percentage, options.duration || 300);
    }

    this.scheduleUpdate('progress', {
      message: progress,
      percentage,
      animated: options?.animate
    }, {
      component: 'server_switch',
      priority: 8, // High priority for progress updates
      immediate: false,
      debounceKey: 'server_switch_progress',
      callback: options?.callback
    });
  }

  /**
   * Schedule connection status updates with debouncing
   */
  scheduleConnectionStatusUpdate(
    serverId: string,
    status: string,
    details?: any,
    options?: {
      component?: string;
      callback?: () => void;
    }
  ): void {
    this.scheduleUpdate('status', {
      serverId,
      status,
      details,
      timestamp: new Date()
    }, {
      component: options?.component || 'status_indicator',
      priority: 6,
      debounceKey: `connection_status_${serverId}`,
      callback: options?.callback
    });
  }

  /**
   * Schedule error display with immediate processing
   */
  scheduleErrorDisplay(
    error: string,
    details?: any,
    options?: {
      component?: string;
      persistent?: boolean;
      callback?: () => void;
    }
  ): void {
    this.scheduleUpdate('error', {
      message: error,
      details,
      persistent: options?.persistent || false,
      timestamp: new Date()
    }, {
      component: options?.component,
      priority: 9, // Highest priority for errors
      immediate: true,
      callback: options?.callback
    });
  }

  /**
   * Schedule success notification with animation
   */
  scheduleSuccessNotification(
    message: string,
    details?: any,
    options?: {
      component?: string;
      duration?: number;
      animate?: boolean;
      callback?: () => void;
    }
  ): void {
    if (options?.animate && this.config.enableAnimations) {
      this.animateSuccess(options.component || 'global', options.duration || 2000);
    }

    this.scheduleUpdate('success', {
      message,
      details,
      duration: options?.duration || 3000,
      animated: options?.animate
    }, {
      component: options?.component,
      priority: 7,
      immediate: true,
      callback: options?.callback
    });
  }

  /**
   * Batch multiple updates for efficient processing
   */
  batchUpdates(
    updates: Array<{
      type: UIUpdate['type'];
      data: any;
      component?: string;
      priority?: number;
    }>,
    callback?: () => void
  ): void {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const batch: UIUpdateBatch = {
      id: batchId,
      updates: updates.map(update => ({
        type: update.type,
        data: update.data,
        component: update.component,
        priority: update.priority || 5
      })),
      priority: Math.max(...updates.map(u => u.priority || 5)),
      timestamp: new Date(),
      callback
    };

    this.updateQueue.push(batch);
    this.metrics.batchedUpdates += updates.length;

    loggingService.logDebug(
      LogCategory.USER_INTERFACE,
      'ui_batch_scheduled',
      `Scheduled batch update with ${updates.length} updates`,
      { 
        batchId,
        updatesCount: updates.length,
        priority: batch.priority,
        queueSize: this.updateQueue.length
      }
    );
  }

  /**
   * Optimize animations for server switching
   */
  optimizeServerSwitchAnimations(
    enable: boolean,
    customConfig?: {
      fadeInDuration?: number;
      fadeOutDuration?: number;
      progressAnimationDuration?: number;
      springConfig?: any;
    }
  ): void {
    this.config.enableAnimations = enable;

    if (enable && customConfig) {
      // Store custom animation config for server switch
      this.storeAnimationConfig('server_switch', customConfig);
    }

    loggingService.logDebug(
      LogCategory.USER_INTERFACE,
      'server_switch_animations_optimized',
      `Server switch animations ${enable ? 'enabled' : 'disabled'}`,
      { 
        enabled: enable,
        customConfig: customConfig || null
      }
    );
  }

  /**
   * Wait for interactions to complete before processing updates
   */
  async waitForInteractions(): Promise<void> {
    return new Promise((resolve) => {
      InteractionManager.runAfterInteractions(() => {
        setTimeout(resolve, this.config.interactionDelay);
      });
    });
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Clear all pending updates
   */
  clearPendingUpdates(): void {
    const pendingCount = this.updateQueue.length;
    
    this.updateQueue = [];
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    this.frameCallbacks.clear();

    loggingService.logDebug(
      LogCategory.USER_INTERFACE,
      'ui_updates_cleared',
      `Cleared ${pendingCount} pending UI updates`
    );
  }

  /**
   * Update optimization configuration
   */
  updateConfig(newConfig: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    loggingService.logInfo(
      LogCategory.USER_INTERFACE,
      'ui_optimization_config_updated',
      'UI optimization configuration updated',
      { newConfig }
    );
  }

  /**
   * Destroy the service and cleanup resources
   */
  destroy(): void {
    this.clearPendingUpdates();
    this.animationValues.clear();
    
    loggingService.logInfo(
      LogCategory.USER_INTERFACE,
      'ui_optimization_service_destroyed',
      'UI optimization service destroyed'
    );
  }

  // Private methods

  private shouldDebounce(updateType: UIUpdate['type'], debounceKey: string): boolean {
    // Debounce frequent status updates and progress updates
    return (
      (updateType === 'status' || updateType === 'progress') &&
      this.debounceTimers.has(debounceKey)
    );
  }

  private scheduleDebounced(
    update: UIUpdate,
    debounceKey: string,
    callback?: () => void
  ): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(debounceKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new debounced update
    const timer = setTimeout(() => {
      this.debounceTimers.delete(debounceKey);
      this.addToBatch(update, callback);
      this.metrics.debouncedUpdates++;
    }, this.config.debounceDelay);

    this.debounceTimers.set(debounceKey, timer);
  }

  private addToBatch(update: UIUpdate, callback?: () => void): void {
    const batchId = `single_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const batch: UIUpdateBatch = {
      id: batchId,
      updates: [update],
      priority: update.priority,
      timestamp: new Date(),
      callback
    };

    this.updateQueue.push(batch);
  }

  private processImmediateUpdate(update: UIUpdate, callback?: () => void): void {
    const startTime = Date.now();
    
    // Process update immediately
    this.executeUpdate(update);
    
    if (callback) {
      callback();
    }

    const duration = Date.now() - startTime;
    this.recordUpdateTime(duration);

    loggingService.logDebug(
      LogCategory.USER_INTERFACE,
      'ui_immediate_update_processed',
      `Processed immediate UI update: ${update.type}`,
      { 
        updateType: update.type,
        component: update.component,
        priority: update.priority,
        duration
      }
    );
  }

  private startBatchProcessor(): void {
    const processBatches = async () => {
      if (this.processingBatch || this.updateQueue.length === 0) {
        requestAnimationFrame(processBatches);
        return;
      }

      this.processingBatch = true;

      try {
        // Wait for interactions to complete
        await this.waitForInteractions();

        // Process batches by priority
        this.updateQueue.sort((a, b) => b.priority - a.priority);
        
        const batchesToProcess = this.updateQueue.splice(0, this.config.batchSize);
        
        if (batchesToProcess.length > 0) {
          await this.processBatches(batchesToProcess);
        }

      } catch (error: any) {
        loggingService.logError(
          LogCategory.USER_INTERFACE,
          'ui_batch_processing_error',
          'Error processing UI update batches',
          {
            type: 'UI_ERROR' as any,
            severity: 'MEDIUM' as any,
            message: error.message,
            suggestedActions: ['Retry UI updates', 'Check component state'],
            isRetryable: true,
            timestamp: new Date()
          },
          { originalError: error.message }
        );
      } finally {
        this.processingBatch = false;
      }

      requestAnimationFrame(processBatches);
    };

    requestAnimationFrame(processBatches);
  }

  private async processBatches(batches: UIUpdateBatch[]): Promise<void> {
    const startTime = Date.now();
    
    for (const batch of batches) {
      // Check if batch is too old
      const age = Date.now() - batch.timestamp.getTime();
      if (age > this.config.maxBatchAge) {
        this.metrics.droppedUpdates += batch.updates.length;
        continue;
      }

      // Process all updates in the batch
      for (const update of batch.updates) {
        this.executeUpdate(update);
      }

      // Execute batch callback if provided
      if (batch.callback) {
        batch.callback();
      }
    }

    const duration = Date.now() - startTime;
    this.recordUpdateTime(duration);

    loggingService.logDebug(
      LogCategory.USER_INTERFACE,
      'ui_batches_processed',
      `Processed ${batches.length} UI update batches`,
      { 
        batchesCount: batches.length,
        totalUpdates: batches.reduce((sum, batch) => sum + batch.updates.length, 0),
        duration
      }
    );
  }

  private executeUpdate(update: UIUpdate): void {
    // This would typically dispatch to the appropriate UI components
    // For now, we'll just log the update execution
    
    switch (update.type) {
      case 'status':
        this.executeStatusUpdate(update);
        break;
      case 'progress':
        this.executeProgressUpdate(update);
        break;
      case 'error':
        this.executeErrorUpdate(update);
        break;
      case 'success':
        this.executeSuccessUpdate(update);
        break;
      case 'server_info':
        this.executeServerInfoUpdate(update);
        break;
    }
  }

  private executeStatusUpdate(update: UIUpdate): void {
    // Execute status update logic
    loggingService.logDebug(
      LogCategory.USER_INTERFACE,
      'ui_status_update_executed',
      `Status update executed for ${update.component}`,
      { 
        component: update.component,
        status: update.data.status,
        serverId: update.data.serverId
      }
    );
  }

  private executeProgressUpdate(update: UIUpdate): void {
    // Execute progress update logic
    loggingService.logDebug(
      LogCategory.USER_INTERFACE,
      'ui_progress_update_executed',
      `Progress update executed: ${update.data.message}`,
      { 
        component: update.component,
        message: update.data.message,
        percentage: update.data.percentage
      }
    );
  }

  private executeErrorUpdate(update: UIUpdate): void {
    // Execute error update logic
    loggingService.logDebug(
      LogCategory.USER_INTERFACE,
      'ui_error_update_executed',
      `Error update executed: ${update.data.message}`,
      { 
        component: update.component,
        message: update.data.message,
        persistent: update.data.persistent
      }
    );
  }

  private executeSuccessUpdate(update: UIUpdate): void {
    // Execute success update logic
    loggingService.logDebug(
      LogCategory.USER_INTERFACE,
      'ui_success_update_executed',
      `Success update executed: ${update.data.message}`,
      { 
        component: update.component,
        message: update.data.message,
        duration: update.data.duration
      }
    );
  }

  private executeServerInfoUpdate(update: UIUpdate): void {
    // Execute server info update logic
    loggingService.logDebug(
      LogCategory.USER_INTERFACE,
      'ui_server_info_update_executed',
      `Server info update executed`,
      { 
        component: update.component,
        serverId: update.data.serverId,
        serverName: update.data.serverName
      }
    );
  }

  private animateProgress(key: string, targetValue: number, duration: number): void {
    if (!this.config.enableAnimations) return;

    let animatedValue = this.animationValues.get(key);
    if (!animatedValue) {
      animatedValue = new Animated.Value(0);
      this.animationValues.set(key, animatedValue);
    }

    Animated.timing(animatedValue, {
      toValue: targetValue,
      duration,
      useNativeDriver: false,
    }).start();
  }

  private animateSuccess(component: string, duration: number): void {
    if (!this.config.enableAnimations) return;

    const key = `success_${component}`;
    let animatedValue = this.animationValues.get(key);
    if (!animatedValue) {
      animatedValue = new Animated.Value(0);
      this.animationValues.set(key, animatedValue);
    }

    // Fade in and out animation
    Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(duration - 600),
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start();
  }

  private storeAnimationConfig(key: string, config: any): void {
    // Store animation configuration for later use
    // This would typically be stored in a configuration map
    loggingService.logDebug(
      LogCategory.USER_INTERFACE,
      'animation_config_stored',
      `Animation configuration stored for ${key}`,
      { key, config }
    );
  }

  private recordUpdateTime(time: number): void {
    this.updateTimes.push(time);
    
    // Keep only last 100 update times for average calculation
    if (this.updateTimes.length > 100) {
      this.updateTimes = this.updateTimes.slice(-100);
    }
  }

  private updateMetrics(): void {
    if (this.updateTimes.length > 0) {
      this.metrics.averageUpdateTime = this.updateTimes.reduce((sum, time) => sum + time, 0) / this.updateTimes.length;
    }
  }
}

// Export singleton instance
export const uiOptimizationService = new UIOptimizationService();
export default uiOptimizationService;