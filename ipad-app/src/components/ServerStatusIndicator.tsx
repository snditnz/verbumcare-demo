/**
 * Server Status Indicator Component
 * 
 * A subtle indicator showing the current backend server and connection status.
 * Can be placed in headers or other locations throughout the app.
 * Provides tap-to-open-settings functionality.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSettingsStore } from '@stores/settingsStore';
import { useAssessmentStore } from '@stores/assessmentStore';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { ConnectionStatus } from '../types/settings';
import { uiOptimizationService } from '@services/uiOptimizationService';

interface ServerStatusIndicatorProps {
  /** Show server name alongside status */
  showServerName?: boolean;
  /** Compact mode - just a dot indicator */
  compact?: boolean;
  /** Enable tap to open settings */
  tapToOpenSettings?: boolean;
  /** Custom style override */
  style?: any;
  /** Test ID for testing */
  testID?: string;
}

export const ServerStatusIndicator: React.FC<ServerStatusIndicatorProps> = ({
  showServerName = false,
  compact = true,
  tapToOpenSettings = true,
  style,
  testID,
}) => {
  const navigation = useNavigation();
  const { currentServer, connectionStatus, serverSwitchState } = useSettingsStore();
  const { language } = useAssessmentStore();
  
  // Animation values for optimized UI updates
  const statusOpacity = useRef(new Animated.Value(1)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const switchingRotation = useRef(new Animated.Value(0)).current;

  // Optimize status updates with debouncing
  useEffect(() => {
    // Schedule optimized status update
    uiOptimizationService.scheduleConnectionStatusUpdate(
      currentServer.id,
      connectionStatus,
      { 
        serverName: currentServer.displayName,
        switchInProgress: serverSwitchState.isInProgress
      },
      {
        component: 'server_status_indicator',
        callback: () => {
          // Animate status change
          if (connectionStatus === 'switching') {
            startSwitchingAnimation();
          } else {
            stopSwitchingAnimation();
            if (connectionStatus === 'connected') {
              startPulseAnimation();
            }
          }
        }
      }
    );
  }, [connectionStatus, currentServer.id, serverSwitchState.isInProgress]);

  const startSwitchingAnimation = () => {
    // Continuous rotation animation for switching state
    Animated.loop(
      Animated.timing(switchingRotation, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();
  };

  const stopSwitchingAnimation = () => {
    switchingRotation.stopAnimation();
    switchingRotation.setValue(0);
  };

  const startPulseAnimation = () => {
    // Subtle pulse animation for connected state
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const handlePress = () => {
    if (tapToOpenSettings) {
      // Navigate to settings screen
      (navigation as any).navigate('Settings');
    }
  };

  const getStatusColor = (status: ConnectionStatus): string => {
    switch (status) {
      case 'connected': return COLORS.success;
      case 'disconnected': return COLORS.text.disabled;
      case 'testing': return COLORS.warning;
      case 'switching': return COLORS.info;
      case 'error': return COLORS.error;
      default: return COLORS.text.disabled;
    }
  };

  const getStatusIcon = (status: ConnectionStatus): string => {
    if (serverSwitchState.isInProgress) {
      return 'swap-horizontal';
    }
    
    switch (status) {
      case 'connected': return 'checkmark-circle';
      case 'disconnected': return 'close-circle';
      case 'testing': return 'time';
      case 'switching': return 'swap-horizontal';
      case 'error': return 'warning';
      default: return 'help-circle';
    }
  };

  const getStatusText = (status: ConnectionStatus): string => {
    if (serverSwitchState.isInProgress) {
      return language === 'ja' ? '切り替え中' : 'Switching';
    }
    
    switch (status) {
      case 'connected': return language === 'ja' ? '接続中' : 'Connected';
      case 'disconnected': return language === 'ja' ? '未接続' : 'Offline';
      case 'testing': return language === 'ja' ? 'テスト中' : 'Testing';
      case 'switching': return language === 'ja' ? '切り替え中' : 'Switching';
      case 'error': return language === 'ja' ? 'エラー' : 'Error';
      default: return language === 'ja' ? '不明' : 'Unknown';
    }
  };

  const getServerDisplayName = (): string => {
    // Show short name for compact display
    if (currentServer.id === 'mac-mini') {
      return 'Mac Mini';
    } else if (currentServer.id === 'pn51') {
      return 'pn51';
    }
    return currentServer.displayName;
  };

  if (compact) {
    const rotation = switchingRotation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <TouchableOpacity
        style={[styles.compactContainer, style]}
        onPress={handlePress}
        disabled={!tapToOpenSettings}
        activeOpacity={tapToOpenSettings ? 0.7 : 1}
        testID={testID}
      >
        <Animated.View 
          style={[
            styles.statusDot, 
            { 
              backgroundColor: getStatusColor(connectionStatus),
              transform: [
                { scale: connectionStatus === 'connected' ? pulseAnimation : 1 },
                { rotate: connectionStatus === 'switching' ? rotation : '0deg' }
              ]
            }
          ]} 
        />
        {showServerName && (
          <Text style={styles.compactServerName}>
            {getServerDisplayName()}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handlePress}
      disabled={!tapToOpenSettings}
      activeOpacity={tapToOpenSettings ? 0.7 : 1}
      testID={testID}
    >
      <View style={styles.statusSection}>
        <Animated.View
          style={{
            transform: [
              { rotate: connectionStatus === 'switching' ? switchingRotation.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              }) : '0deg' }
            ]
          }}
        >
          <Ionicons
            name={getStatusIcon(connectionStatus) as any}
            size={ICON_SIZES.sm}
            color={getStatusColor(connectionStatus)}
          />
        </Animated.View>
        <View style={styles.statusInfo}>
          <Animated.Text 
            style={[
              styles.statusText, 
              { 
                color: getStatusColor(connectionStatus),
                opacity: statusOpacity
              }
            ]}
          >
            {getStatusText(connectionStatus)}
          </Animated.Text>
          {showServerName && (
            <Text style={styles.serverName}>
              {getServerDisplayName()}
            </Text>
          )}
        </View>
      </View>
      
      {tapToOpenSettings && (
        <Ionicons
          name="chevron-forward"
          size={ICON_SIZES.xs}
          color={COLORS.text.disabled}
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: `${COLORS.surface}90`,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusInfo: {
    marginLeft: SPACING.xs,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  serverName: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  compactServerName: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginLeft: SPACING.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});