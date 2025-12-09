import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card } from './Card';
import { NoteBadge } from './NoteBadge';
import { COLORS, TYPOGRAPHY, SPACING } from '@constants/theme';
import { ClinicalNote, NoteCategory } from '@stores/clinicalNotesStore';
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';

interface NoteCardProps {
  note: ClinicalNote;
  onPress?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  showApprovalButtons?: boolean;
}

const getCategoryLabel = (category: NoteCategory): { en: string; ja: string; icon: string } => {
  const categories = {
    symptom_observation: { en: 'Symptom Observation', ja: '症状観察', icon: '👁️' },
    treatment: { en: 'Treatment', ja: '処置', icon: '💉' },
    consultation: { en: 'Consultation', ja: '相談', icon: '💬' },
    fall_incident: { en: 'Fall Incident', ja: '転倒', icon: '⚠️' },
    medication: { en: 'Medication', ja: '投薬', icon: '💊' },
    vital_signs: { en: 'Vital Signs', ja: 'バイタルサイン', icon: '📊' },
    behavioral: { en: 'Behavioral', ja: '行動観察', icon: '👀' },
    other: { en: 'Other', ja: 'その他', icon: '📝' },
  };
  return categories[category] || categories.other;
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'approved':
      return COLORS.success;
    case 'submitted':
      return COLORS.warning;
    case 'rejected':
      return COLORS.error;
    case 'draft':
      return COLORS.neutral;
    default:
      return COLORS.neutral;
  }
};

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  onPress,
  onApprove,
  onReject,
  showApprovalButtons = false,
}) => {
  const categoryInfo = getCategoryLabel(note.note_category);
  const noteDate = parseISO(note.note_datetime);
  const authorFullName = note.author_family_name && note.author_given_name
    ? `${note.author_family_name} ${note.author_given_name}`
    : note.author_name;

  return (
    <Card
      onPress={onPress}
      variant="outlined"
      statusColor={getStatusColor(note.status)}
      padding="md"
    >
      <View style={styles.container}>
        {/* Header: Badge and Timestamp */}
        <View style={styles.header}>
          <NoteBadge noteType={note.note_type} size="medium" />
          <Text style={styles.timestamp}>
            {format(noteDate, 'M月d日 HH:mm', { locale: ja })}
          </Text>
        </View>

        {/* Author and Category */}
        <View style={styles.metadata}>
          <Text style={styles.author}>{authorFullName}</Text>
          <View style={styles.categoryTag}>
            <Text style={styles.categoryIcon}>{categoryInfo.icon}</Text>
            <Text style={styles.categoryText}>{categoryInfo.ja}</Text>
          </View>
        </View>

        {/* Note Text */}
        <Text style={styles.noteText} numberOfLines={onPress ? 3 : undefined}>
          {note.note_text}
        </Text>

        {/* Voice Recording Indicator */}
        {note.voice_recording_id && (
          <View style={styles.voiceIndicator}>
            <Text style={styles.voiceIcon}>🎤</Text>
            <Text style={styles.voiceText}>
              音声記録 {note.duration_seconds ? `(${Math.round(note.duration_seconds)}秒)` : ''}
            </Text>
          </View>
        )}

        {/* Follow-up Indicator */}
        {note.follow_up_required && (
          <View style={styles.followUpIndicator}>
            <Text style={styles.followUpIcon}>📌</Text>
            <Text style={styles.followUpText}>
              要フォローアップ
              {note.follow_up_date && ` - ${format(parseISO(note.follow_up_date), 'M月d日', { locale: ja })}`}
            </Text>
          </View>
        )}

        {/* Approval Status */}
        {note.requires_approval && (
          <View style={styles.approvalStatus}>
            {note.status === 'submitted' && (
              <Text style={[styles.statusText, { color: COLORS.warning }]}>
                ⏳ 承認待ち
              </Text>
            )}
            {note.status === 'approved' && note.approved_by_name && (
              <Text style={[styles.statusText, { color: COLORS.success }]}>
                ✅ 承認済み - {note.approved_by_name}
              </Text>
            )}
            {note.status === 'rejected' && (
              <Text style={[styles.statusText, { color: COLORS.error }]}>
                ❌ 却下
              </Text>
            )}
          </View>
        )}

        {/* Approval Buttons */}
        {showApprovalButtons && note.status === 'submitted' && note.requires_approval && (
          <View style={styles.approvalButtons}>
            <TouchableOpacity
              style={[styles.approvalButton, styles.approveButton]}
              onPress={onApprove}
            >
              <Text style={styles.approveButtonText}>✅ 承認</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.approvalButton, styles.rejectButton]}
              onPress={onReject}
            >
              <Text style={styles.rejectButtonText}>❌ 却下</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  metadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  author: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs / 2,
    borderRadius: 12,
  },
  categoryIcon: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginRight: SPACING.xs / 2,
  },
  categoryText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  noteText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.fontSize.base * 1.5,
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  voiceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    padding: SPACING.xs,
    backgroundColor: COLORS.accent + '20', // 20% opacity
    borderRadius: 8,
  },
  voiceIcon: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginRight: SPACING.xs,
  },
  voiceText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  followUpIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    padding: SPACING.xs,
    backgroundColor: COLORS.warning + '20',
    borderRadius: 8,
  },
  followUpIcon: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginRight: SPACING.xs,
  },
  followUpText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.warning,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  approvalStatus: {
    marginTop: SPACING.xs,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  approvalButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  approvalButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: COLORS.success,
  },
  rejectButton: {
    backgroundColor: COLORS.error,
  },
  approveButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  rejectButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
});
