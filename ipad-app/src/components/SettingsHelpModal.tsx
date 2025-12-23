/**
 * Settings Help Modal Component
 * 
 * Provides comprehensive help and guidance for backend switching settings.
 * Includes server descriptions, troubleshooting information, and user guides.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '@constants/theme';
import { translations } from '@constants/translations';
import { Language } from '@types/app';
import { OnboardingModal } from '@components/ui/UserGuidance';

interface SettingsHelpModalProps {
  visible: boolean;
  onClose: () => void;
  language: Language;
}

export function SettingsHelpModal({ visible, onClose, language }: SettingsHelpModalProps) {
  const [activeTab, setActiveTab] = useState<'guide' | 'servers' | 'troubleshooting'>('guide');
  const t = translations[language];

  const tabs = [
    { id: 'guide' as const, title: language === 'ja' ? 'ガイド' : language === 'zh-TW' ? '指南' : 'Guide', icon: 'book' },
    { id: 'servers' as const, title: language === 'ja' ? 'サーバー' : language === 'zh-TW' ? '伺服器' : 'Servers', icon: 'server' },
    { id: 'troubleshooting' as const, title: language === 'ja' ? 'トラブルシューティング' : language === 'zh-TW' ? '故障排除' : 'Troubleshooting', icon: 'construct' },
  ];

  const renderGuideContent = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>{t['settings.serverSwitchingTitle']}</Text>
      <Text style={styles.sectionDescription}>{t['settings.serverSwitchingDescription']}</Text>
      
      <View style={styles.tipsContainer}>
        <Text style={styles.tipsTitle}>💡 {language === 'ja' ? 'ヒント' : language === 'zh-TW' ? '提示' : 'Tips'}:</Text>
        <View style={styles.tipsList}>
          <Text style={styles.tipItem}>• {t['settings.serverSwitchingTip1']}</Text>
          <Text style={styles.tipItem}>• {t['settings.serverSwitchingTip2']}</Text>
          <Text style={styles.tipItem}>• {t['settings.serverSwitchingTip3']}</Text>
          <Text style={styles.tipItem}>• {t['settings.serverSwitchingTip4']}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>{t['settings.connectionStatusTitle']}</Text>
      <Text style={styles.sectionDescription}>{t['settings.connectionStatusDescription']}</Text>
      
      <View style={styles.statusList}>
        <StatusItem
          icon="checkmark-circle"
          color={COLORS.success}
          text={t['settings.connectionStatusConnected']}
        />
        <StatusItem
          icon="close-circle"
          color={COLORS.text.disabled}
          text={t['settings.connectionStatusDisconnected']}
        />
        <StatusItem
          icon="time"
          color={COLORS.warning}
          text={t['settings.connectionStatusTesting']}
        />
        <StatusItem
          icon="swap-horizontal"
          color={COLORS.info}
          text={t['settings.connectionStatusSwitching']}
        />
        <StatusItem
          icon="warning"
          color={COLORS.error}
          text={t['settings.connectionStatusError']}
        />
      </View>
    </View>
  );

  const renderServersContent = () => (
    <View style={styles.tabContent}>
      {/* Mac Mini Server */}
      <View style={styles.serverCard}>
        <View style={styles.serverHeader}>
          <Ionicons name="desktop" size={24} color={COLORS.primary} />
          <Text style={styles.serverTitle}>{t['settings.macMiniTitle']}</Text>
        </View>
        <Text style={styles.serverDescription}>{t['settings.macMiniDescription']}</Text>
        <Text style={styles.serverRecommendation}>{t['settings.macMiniRecommendation']}</Text>
        
        <View style={styles.featuresList}>
          <Text style={styles.featuresTitle}>{language === 'ja' ? '特徴' : language === 'zh-TW' ? '特色' : 'Features'}:</Text>
          <Text style={styles.featureItem}>• {t['settings.macMiniFeature1']}</Text>
          <Text style={styles.featureItem}>• {t['settings.macMiniFeature2']}</Text>
          <Text style={styles.featureItem}>• {t['settings.macMiniFeature3']}</Text>
          <Text style={styles.featureItem}>• {t['settings.macMiniFeature4']}</Text>
        </View>
      </View>

      {/* pn51 Legacy Server */}
      <View style={styles.serverCard}>
        <View style={styles.serverHeader}>
          <Ionicons name="server" size={24} color={COLORS.accent} />
          <Text style={styles.serverTitle}>{t['settings.pn51Title']}</Text>
        </View>
        <Text style={styles.serverDescription}>{t['settings.pn51Description']}</Text>
        <Text style={styles.serverRecommendation}>{t['settings.pn51Recommendation']}</Text>
        
        <View style={styles.featuresList}>
          <Text style={styles.featuresTitle}>{language === 'ja' ? '特徴' : language === 'zh-TW' ? '特色' : 'Features'}:</Text>
          <Text style={styles.featureItem}>• {t['settings.pn51Feature1']}</Text>
          <Text style={styles.featureItem}>• {t['settings.pn51Feature2']}</Text>
          <Text style={styles.featureItem}>• {t['settings.pn51Feature3']}</Text>
          <Text style={styles.featureItem}>• {t['settings.pn51Feature4']}</Text>
        </View>
      </View>
    </View>
  );

  const renderTroubleshootingContent = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>{t['settings.troubleshootingTitle']}</Text>
      <Text style={styles.sectionDescription}>{t['settings.troubleshootingDescription']}</Text>

      {/* Connection Failed */}
      <View style={styles.troubleshootingCard}>
        <View style={styles.troubleshootingHeader}>
          <Ionicons name="wifi-off" size={20} color={COLORS.error} />
          <Text style={styles.troubleshootingTitle}>{t['settings.connectionFailedTitle']}</Text>
        </View>
        <Text style={styles.troubleshootingDescription}>{t['settings.connectionFailedDescription']}</Text>
        <View style={styles.solutionsList}>
          <Text style={styles.solutionItem}>1. {t['settings.connectionFailedSolution1']}</Text>
          <Text style={styles.solutionItem}>2. {t['settings.connectionFailedSolution2']}</Text>
          <Text style={styles.solutionItem}>3. {t['settings.connectionFailedSolution3']}</Text>
          <Text style={styles.solutionItem}>4. {t['settings.connectionFailedSolution4']}</Text>
        </View>
      </View>

      {/* Slow Response */}
      <View style={styles.troubleshootingCard}>
        <View style={styles.troubleshootingHeader}>
          <Ionicons name="time" size={20} color={COLORS.warning} />
          <Text style={styles.troubleshootingTitle}>{t['settings.slowResponseTitle']}</Text>
        </View>
        <Text style={styles.troubleshootingDescription}>{t['settings.slowResponseDescription']}</Text>
        <View style={styles.solutionsList}>
          <Text style={styles.solutionItem}>1. {t['settings.slowResponseSolution1']}</Text>
          <Text style={styles.solutionItem}>2. {t['settings.slowResponseSolution2']}</Text>
          <Text style={styles.solutionItem}>3. {t['settings.slowResponseSolution3']}</Text>
          <Text style={styles.solutionItem}>4. {t['settings.slowResponseSolution4']}</Text>
        </View>
      </View>

      {/* Authentication Error */}
      <View style={styles.troubleshootingCard}>
        <View style={styles.troubleshootingHeader}>
          <Ionicons name="lock-closed" size={20} color={COLORS.error} />
          <Text style={styles.troubleshootingTitle}>{t['settings.authenticationErrorTitle']}</Text>
        </View>
        <Text style={styles.troubleshootingDescription}>{t['settings.authenticationErrorDescription']}</Text>
        <View style={styles.solutionsList}>
          <Text style={styles.solutionItem}>1. {t['settings.authenticationErrorSolution1']}</Text>
          <Text style={styles.solutionItem}>2. {t['settings.authenticationErrorSolution2']}</Text>
          <Text style={styles.solutionItem}>3. {t['settings.authenticationErrorSolution3']}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t['settings.helpTitle']}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={COLORS.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabNavigation}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.activeTab]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons
                name={tab.icon as any}
                size={20}
                color={activeTab === tab.id ? COLORS.primary : COLORS.text.secondary}
              />
              <Text style={[
                styles.tabText,
                activeTab === tab.id && styles.activeTabText
              ]}>
                {tab.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === 'guide' && renderGuideContent()}
          {activeTab === 'servers' && renderServersContent()}
          {activeTab === 'troubleshooting' && renderTroubleshootingContent()}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

interface StatusItemProps {
  icon: string;
  color: string;
  text: string;
}

const StatusItem: React.FC<StatusItemProps> = ({ icon, color, text }) => (
  <View style={styles.statusItem}>
    <Ionicons name={icon as any} size={16} color={color} />
    <Text style={styles.statusText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  closeButton: {
    padding: SPACING.sm,
  },
  tabNavigation: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginLeft: SPACING.xs,
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: SPACING.lg,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  sectionDescription: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed,
    marginBottom: SPACING.lg,
  },
  tipsContainer: {
    backgroundColor: COLORS.accentLight,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  tipsTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  tipsList: {
    gap: SPACING.xs,
  },
  tipItem: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    lineHeight: TYPOGRAPHY.lineHeight.normal,
  },
  statusList: {
    gap: SPACING.sm,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  serverCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  serverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  serverTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginLeft: SPACING.sm,
  },
  serverDescription: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    lineHeight: TYPOGRAPHY.lineHeight.normal,
    marginBottom: SPACING.sm,
  },
  serverRecommendation: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.md,
  },
  featuresList: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.md,
  },
  featuresTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  featureItem: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    lineHeight: TYPOGRAPHY.lineHeight.normal,
    marginBottom: SPACING.xs,
  },
  troubleshootingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  troubleshootingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  troubleshootingTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginLeft: SPACING.sm,
  },
  troubleshootingDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    lineHeight: TYPOGRAPHY.lineHeight.normal,
    marginBottom: SPACING.md,
  },
  solutionsList: {
    gap: SPACING.xs,
  },
  solutionItem: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    lineHeight: TYPOGRAPHY.lineHeight.normal,
  },
});