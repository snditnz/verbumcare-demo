/**
 * Session Conflict Resolution Dialog
 * 
 * Displays when multiple unsaved sessions are detected
 * Allows user to choose which session to keep or merge
 * Implements Requirements 9.6
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '@constants/theme';

interface SessionData {
  patientId: string;
  vitals?: any;
  medications?: any[];
  patientUpdates?: any;
  incidents?: any[];
  barthelIndex?: any;
  painAssessment?: any;
  fallRiskAssessment?: any;
  kihonChecklist?: any;
  lastSaved: number;
  autoSaved: boolean;
}

interface Props {
  visible: boolean;
  sessions: SessionData[];
  onResolve: (selectedSession: SessionData) => void;
  onCancel: () => void;
}

export const SessionConflictDialog: React.FC<Props> = ({
  visible,
  sessions,
  onResolve,
  onCancel,
}) => {
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSessionSummary = (session: SessionData): string => {
    const parts: string[] = [];

    if (session.vitals) {
      parts.push('バイタルサイン');
    }
    if (session.medications && session.medications.length > 0) {
      parts.push(`投薬 (${session.medications.length}件)`);
    }
    if (session.patientUpdates) {
      parts.push('患者情報更新');
    }
    if (session.incidents && session.incidents.length > 0) {
      parts.push(`インシデント (${session.incidents.length}件)`);
    }
    if (session.barthelIndex) {
      parts.push('Barthel Index');
    }
    if (session.painAssessment) {
      parts.push('疼痛評価');
    }
    if (session.fallRiskAssessment) {
      parts.push('転倒リスク評価');
    }
    if (session.kihonChecklist) {
      parts.push('基本チェックリスト');
    }

    return parts.length > 0 ? parts.join(', ') : 'データなし';
  };

  const handleSelectSession = (session: SessionData) => {
    Alert.alert(
      'セッションの選択',
      'このセッションを使用しますか？他のセッションのデータは破棄されます。',
      [
        {
          text: 'キャンセル',
          style: 'cancel',
        },
        {
          text: '使用する',
          onPress: () => onResolve(session),
          style: 'destructive',
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <Text style={styles.title}>セッションの競合</Text>
            <Text style={styles.subtitle}>
              複数の未保存セッションが見つかりました。使用するセッションを選択してください。
            </Text>
          </View>

          <ScrollView style={styles.sessionList}>
            {sessions.map((session, index) => (
              <TouchableOpacity
                key={`${session.patientId}_${session.lastSaved}`}
                style={styles.sessionCard}
                onPress={() => handleSelectSession(session)}
              >
                <View style={styles.sessionHeader}>
                  <Text style={styles.sessionTitle}>
                    セッション {index + 1}
                  </Text>
                  <Text style={styles.sessionDate}>
                    {formatDate(session.lastSaved)}
                  </Text>
                </View>

                <Text style={styles.sessionPatient}>
                  患者ID: {session.patientId}
                </Text>

                <Text style={styles.sessionSummary}>
                  {getSessionSummary(session)}
                </Text>

                {session.autoSaved && (
                  <View style={styles.autoSaveBadge}>
                    <Text style={styles.autoSaveText}>自動保存</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  dialog: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    width: '100%',
    maxWidth: 600,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    padding: SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
  sessionList: {
    padding: SPACING.lg,
  },
  sessionCard: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sessionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
  },
  sessionDate: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  sessionPatient: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  sessionSummary: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  autoSaveBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 4,
  },
  autoSaveText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.white,
    fontWeight: '600',
  },
  footer: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cancelButton: {
    backgroundColor: COLORS.border,
    padding: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...TYPOGRAPHY.button,
    color: COLORS.text,
  },
});
