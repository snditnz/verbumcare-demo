/**
 * useStreamingNavigationGuard
 * 
 * Hook to prevent accidental navigation away from screens with active streaming sessions.
 * Displays a confirmation dialog when user attempts to navigate during streaming.
 * 
 * Requirements: 8.5 (Navigation warning for active sessions)
 */

import { useEffect, useCallback, useRef } from 'react';
import { Alert, BackHandler } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { audioStreamerService } from '../services/audioStreamerService';

interface NavigationGuardOptions {
  /** Whether the guard is enabled */
  enabled?: boolean;
  /** Custom title for the confirmation dialog */
  title?: string;
  /** Custom message for the confirmation dialog */
  message?: string;
  /** Custom text for the cancel button */
  cancelText?: string;
  /** Custom text for the confirm button */
  confirmText?: string;
  /** Callback when user confirms navigation */
  onConfirmNavigation?: () => void;
  /** Callback when user cancels navigation */
  onCancelNavigation?: () => void;
}

interface NavigationGuardResult {
  /** Whether streaming is currently active */
  isStreamingActive: boolean;
  /** Function to check if navigation should be blocked */
  shouldBlockNavigation: () => boolean;
  /** Function to show confirmation dialog manually */
  showNavigationWarning: (onConfirm: () => void) => void;
}

const DEFAULT_OPTIONS: Required<Omit<NavigationGuardOptions, 'onConfirmNavigation' | 'onCancelNavigation'>> = {
  enabled: true,
  title: '録音中です',
  message: '録音を中断してこの画面を離れますか？録音データは保存されます。',
  cancelText: 'キャンセル',
  confirmText: '離れる',
};

/**
 * Hook to guard navigation during active streaming sessions
 * 
 * @param options - Configuration options for the navigation guard
 * @returns Navigation guard state and utilities
 */
export function useStreamingNavigationGuard(
  options: NavigationGuardOptions = {}
): NavigationGuardResult {
  const navigation = useNavigation();
  const pendingNavigationRef = useRef<(() => void) | null>(null);
  
  const {
    enabled = DEFAULT_OPTIONS.enabled,
    title = DEFAULT_OPTIONS.title,
    message = DEFAULT_OPTIONS.message,
    cancelText = DEFAULT_OPTIONS.cancelText,
    confirmText = DEFAULT_OPTIONS.confirmText,
    onConfirmNavigation,
    onCancelNavigation,
  } = options;

  /**
   * Check if streaming is currently active
   */
  const isStreamingActive = useCallback((): boolean => {
    return audioStreamerService.getIsStreaming();
  }, []);

  /**
   * Check if navigation should be blocked
   */
  const shouldBlockNavigation = useCallback((): boolean => {
    return enabled && isStreamingActive();
  }, [enabled, isStreamingActive]);

  /**
   * Show navigation warning dialog
   */
  const showNavigationWarning = useCallback((onConfirm: () => void) => {
    Alert.alert(
      title,
      message,
      [
        {
          text: cancelText,
          style: 'cancel',
          onPress: () => {
            onCancelNavigation?.();
          },
        },
        {
          text: confirmText,
          style: 'destructive',
          onPress: () => {
            onConfirmNavigation?.();
            onConfirm();
          },
        },
      ],
      { cancelable: true }
    );
  }, [title, message, cancelText, confirmText, onConfirmNavigation, onCancelNavigation]);

  /**
   * Handle hardware back button (Android)
   */
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (shouldBlockNavigation()) {
        showNavigationWarning(() => {
          navigation.goBack();
        });
        return true; // Prevent default back behavior
      }
      return false; // Allow default back behavior
    });

    return () => backHandler.remove();
  }, [shouldBlockNavigation, showNavigationWarning, navigation]);

  /**
   * Add navigation listener to intercept navigation events
   */
  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!isStreamingActive()) {
        // Not streaming, allow navigation
        return;
      }

      // Prevent default navigation
      e.preventDefault();

      // Store the navigation action for later
      pendingNavigationRef.current = () => {
        navigation.dispatch(e.data.action);
      };

      // Show confirmation dialog
      showNavigationWarning(() => {
        if (pendingNavigationRef.current) {
          pendingNavigationRef.current();
          pendingNavigationRef.current = null;
        }
      });
    });

    return unsubscribe;
  }, [enabled, navigation, isStreamingActive, showNavigationWarning]);

  return {
    isStreamingActive: isStreamingActive(),
    shouldBlockNavigation,
    showNavigationWarning,
  };
}

export default useStreamingNavigationGuard;
