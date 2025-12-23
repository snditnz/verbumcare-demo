/**
 * Orientation Utilities
 * 
 * Provides safe access to orientation control functionality with graceful fallbacks
 * for environments where native modules are not available (Expo Go, web, etc.)
 */

import * as ScreenOrientation from 'expo-screen-orientation';

/**
 * Check if the native screen orientation module is available
 */
export const isOrientationModuleAvailable = (): boolean => {
  try {
    // Check if the native module methods are available
    return (
      typeof ScreenOrientation.lockAsync === 'function' &&
      typeof ScreenOrientation.OrientationLock !== 'undefined'
    );
  } catch (error) {
    return false;
  }
};

/**
 * Safely attempt to lock orientation to landscape
 * Returns true if successful, false if not available or failed
 */
export const safeLockToLandscape = async (): Promise<boolean> => {
  try {
    if (!isOrientationModuleAvailable()) {
      console.log('[OrientationUtils] Native module not available, relying on static configuration');
      return false;
    }

    await Promise.race([
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Orientation lock timeout')), 3000)
      )
    ]);

    console.log('[OrientationUtils] ✅ Successfully locked orientation to landscape');
    return true;
  } catch (error: any) {
    if (error.message?.includes('ExpoScreenOrientation')) {
      console.log('[OrientationUtils] Native module not found - using static configuration fallback');
    } else {
      console.warn('[OrientationUtils] Failed to lock orientation:', error);
    }
    return false;
  }
};

/**
 * Get current orientation if module is available
 */
export const getCurrentOrientation = async (): Promise<string | null> => {
  try {
    if (!isOrientationModuleAvailable()) {
      return null;
    }

    const orientation = await ScreenOrientation.getOrientationAsync();
    return orientation.toString();
  } catch (error) {
    console.warn('[OrientationUtils] Failed to get current orientation:', error);
    return null;
  }
};

/**
 * Check if device supports orientation locking
 */
export const supportsOrientationLock = (): boolean => {
  return isOrientationModuleAvailable();
};

/**
 * Get orientation support status for debugging
 */
export const getOrientationSupportInfo = () => {
  const moduleAvailable = isOrientationModuleAvailable();
  
  return {
    nativeModuleAvailable: moduleAvailable,
    lockSupported: moduleAvailable,
    fallbackMethod: 'Static configuration in app.json',
    environment: moduleAvailable ? 'Native build' : 'Expo Go/Web/Development',
    recommendation: moduleAvailable 
      ? 'Full orientation control available'
      : 'Use npx expo run:ios --device for full native functionality'
  };
};