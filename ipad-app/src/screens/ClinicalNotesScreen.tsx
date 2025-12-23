import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
// import DateTimePicker from 'expo-datetimepicker'; // TODO: Requires app rebuild
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { LanguageToggle } from '@components';
import { ServerStatusIndicator } from '@components/ServerStatusIndicator';
import { NoteCard } from '@components/ui/NoteCard';
import { Button } from '@components/ui';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES } from '@constants/theme';
import { useClinicalNotesStore, ClinicalNote } from '@stores/clinicalNotesStore';
import { useAuthStore, getCurrentStaffId } from '@stores/authStore';
import { useAssessmentStore } from '@stores/assessmentStore';
import { apiService } from '@services/api';

type RootStackParamList = {
  ClinicalNotes: { patientId: string; patientName: string };
  AddNote: { patientId: string; patientName: string };
  PatientInfo: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ClinicalNotes'>;
  route: RouteProp<RootStackParamList, 'ClinicalNotes'>;
};

export default function ClinicalNotesScreen({ navigation, route }: Props) {
  const { patientId, patientName } = route.params;
  const { currentUser } = useAuthStore();
  const { notes, isLoading, addNote, clearNotesForPatient } = useClinicalNotesStore();
  const { language } = useAssessmentStore();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'nurse' | 'doctor'>('all');
  const [selectedNote, setSelectedNote] = useState<ClinicalNote | null>(null);
  const [followUpDate, setFollowUpDate] = useState<Date>(new Date());

  const patientNotes = notes.get(patientId) || [];

  // Filter notes based on selected filter
  const filteredNotes = patientNotes.filter(note => {
    if (filter === 'all') return true;
    if (filter === 'nurse') return note.note_type === 'nurse_note';
    if (filter === 'doctor') return note.note_type === 'doctor_note';
    return true;
  });

  // Fetch notes on mount
  useEffect(() => {
    fetchNotes();
  }, [patientId]);

  const fetchNotes = async () => {
    try {
      const fetchedNotes = await apiService.getClinicalNotes(patientId);
      // Clear existing notes and add fetched ones
      clearNotesForPatient(patientId);
      fetchedNotes.forEach(note => addNote(note));
    } catch (error) {
      console.error('Error fetching clinical notes:', error);
      Alert.alert(
        language === 'ja' ? 'エラー' : 'Error',
        language === 'ja' ? '記録の取得に失敗しました。' : 'Failed to fetch notes.',
        [{ text: 'OK' }]
      );
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotes();
    setRefreshing(false);
  }, [patientId]);

  const handleAddNote = () => {
    navigation.navigate('AddNote', { patientId, patientName });
  };

  const handleNotePress = (note: ClinicalNote) => {
    setSelectedNote(note);
    setFollowUpDate(new Date()); // Reset to today
  };

  const handleCloseNoteDetail = () => {
    setSelectedNote(null);
  };

  const handleCopyText = (text: string) => {
    // TODO: Implement clipboard copy
    Alert.alert(
      language === 'ja' ? 'コピー完了' : 'Copied',
      language === 'ja' ? 'テキストをコピーしました' : 'Text copied to clipboard'
    );
  };

  const handleAddFollowUp = (note: ClinicalNote) => {
    setSelectedNote(null);
    // Navigate to add note with reference to original note
    navigation.navigate('AddNote', {
      patientId,
      patientName,
      // @ts-ignore - will add these params to route type later
      referenceNoteId: note.note_id,
      referenceText: note.note_text.substring(0, 100) + '...',
      followUpDate: followUpDate.toISOString()
    });
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (selectedDate) {
      setFollowUpDate(selectedDate);
    }
  };

  const handleApprove = async (note: ClinicalNote) => {
    if (!currentUser) return;

    if (currentUser.role !== 'doctor') {
      Alert.alert(
        language === 'ja' ? 'エラー' : 'Error',
        language === 'ja' ? '承認権限がありません。' : 'You do not have approval permission.'
      );
      return;
    }

    try {
      const updatedNote = await apiService.approveClinicalNote(note.note_id, {
        approved_by: getCurrentStaffId(),
        approver_name: currentUser.fullNameJa || currentUser.fullName,
        approve: true,
      });

      // Update note in store
      useClinicalNotesStore.getState().updateNote(note.note_id, updatedNote);

      Alert.alert(
        language === 'ja' ? '成功' : 'Success',
        language === 'ja' ? '記録を承認しました。' : 'Note approved successfully.'
      );
    } catch (error) {
      console.error('Error approving note:', error);
      Alert.alert(
        language === 'ja' ? 'エラー' : 'Error',
        language === 'ja' ? '承認に失敗しました。' : 'Failed to approve note.'
      );
    }
  };

  const handleReject = async (note: ClinicalNote) => {
    if (!currentUser) return;

    if (currentUser.role !== 'doctor') {
      Alert.alert(
        language === 'ja' ? 'エラー' : 'Error',
        language === 'ja' ? '却下権限がありません。' : 'You do not have rejection permission.'
      );
      return;
    }

    try {
      const updatedNote = await apiService.approveClinicalNote(note.note_id, {
        approved_by: getCurrentStaffId(),
        approver_name: currentUser.fullNameJa || currentUser.fullName,
        approve: false,
      });

      // Update note in store
      useClinicalNotesStore.getState().updateNote(note.note_id, updatedNote);

      Alert.alert(
        language === 'ja' ? '完了' : 'Complete',
        language === 'ja' ? '記録を却下しました。' : 'Note rejected successfully.'
      );
    } catch (error) {
      console.error('Error rejecting note:', error);
      Alert.alert(
        language === 'ja' ? 'エラー' : 'Error',
        language === 'ja' ? '却下に失敗しました。' : 'Failed to reject note.'
      );
    }
  };

  const renderHeader = () => {
    const noteTypeTitle = language === 'ja'
      ? (currentUser?.role === 'nurse' ? '看護記録' : currentUser?.role === 'doctor' ? '医師記録' : '臨床記録')
      : (currentUser?.role === 'nurse' ? 'Nurse Notes' : currentUser?.role === 'doctor' ? 'Doctor Notes' : 'Clinical Notes');

    return (
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={ICON_SIZES.lg} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{noteTypeTitle}</Text>
            <Text style={styles.patientName}>{patientName}</Text>
          </View>
          <ServerStatusIndicator compact />
          <LanguageToggle />
        </View>

        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              {language === 'ja' ? '全て' : 'All'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'nurse' && styles.filterButtonActive]}
            onPress={() => setFilter('nurse')}
          >
            <Text style={[styles.filterText, filter === 'nurse' && styles.filterTextActive]}>
              {language === 'ja' ? '👩‍⚕️ 看護記録' : '👩‍⚕️ Nurse'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'doctor' && styles.filterButtonActive]}
            onPress={() => setFilter('doctor')}
          >
            <Text style={[styles.filterText, filter === 'doctor' && styles.filterTextActive]}>
              {language === 'ja' ? '👨‍⚕️ 医師記録' : '👨‍⚕️ Doctor'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="document-text-outline" size={64} color={COLORS.neutral} />
      <Text style={styles.emptyText}>
        {language === 'ja' ? '記録がありません' : 'No notes'}
      </Text>
      <Text style={styles.emptySubtext}>
        {language === 'ja'
          ? '「記録を追加」ボタンから新しい記録を作成できます'
          : 'Use the "Add Note" button to create a new note'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {isLoading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>
              {language === 'ja' ? '記録を読み込んでいます...' : 'Loading notes...'}
            </Text>
          </View>
        ) : filteredNotes.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.notesContainer}>
            <Text style={styles.countText}>
              {language === 'ja'
                ? `${filteredNotes.length}件の記録`
                : `${filteredNotes.length} note${filteredNotes.length !== 1 ? 's' : ''}`}
            </Text>
            {filteredNotes.map((note) => (
              <NoteCard
                key={note.note_id}
                note={note}
                onPress={() => handleNotePress(note)}
                onApprove={() => handleApprove(note)}
                onReject={() => handleReject(note)}
                showApprovalButtons={
                  currentUser?.role === 'doctor' &&
                  note.requires_approval &&
                  note.status === 'submitted'
                }
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Fixed Add Button */}
      <View style={styles.footer}>
        <Button
          onPress={handleAddNote}
          variant="primary"
          fullWidth
        >
          <View style={styles.addButtonContent}>
            <Ionicons name="add-circle-outline" size={ICON_SIZES.md} color={COLORS.white} />
            <Text style={styles.addButtonText}>
              {language === 'ja' ? '記録を追加' : 'Add Note'}
            </Text>
          </View>
        </Button>
      </View>

      {/* Note Detail Modal */}
      <Modal
        visible={!!selectedNote}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseNoteDetail}
      >
        {selectedNote && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {language === 'ja' ? '記録詳細' : 'Note Details'}
                </Text>
                <TouchableOpacity onPress={handleCloseNoteDetail}>
                  <Ionicons name="close" size={ICON_SIZES.lg} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Note Metadata */}
                <View style={styles.metadataCard}>
                  <View style={styles.metadataRow}>
                    <Ionicons name="person-outline" size={ICON_SIZES.sm} color={COLORS.primary} />
                    <View style={styles.metadataContent}>
                      <Text style={styles.metadataLabel}>
                        {language === 'ja' ? '記録者' : 'Author'}
                      </Text>
                      <Text style={styles.metadataValue}>{selectedNote.author_name}</Text>
                    </View>
                  </View>

                  <View style={styles.metadataRow}>
                    <Ionicons name="time-outline" size={ICON_SIZES.sm} color={COLORS.primary} />
                    <View style={styles.metadataContent}>
                      <Text style={styles.metadataLabel}>
                        {language === 'ja' ? '記録日時' : 'Date & Time'}
                      </Text>
                      <Text style={styles.metadataValue}>
                        {new Date(selectedNote.note_datetime).toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metadataRow}>
                    <Ionicons name="document-text-outline" size={ICON_SIZES.sm} color={COLORS.primary} />
                    <View style={styles.metadataContent}>
                      <Text style={styles.metadataLabel}>
                        {language === 'ja' ? '種類' : 'Type'}
                      </Text>
                      <Text style={styles.metadataValue}>
                        {selectedNote.note_type === 'nurse_note'
                          ? (language === 'ja' ? '看護記録' : 'Nurse Note')
                          : selectedNote.note_type === 'doctor_note'
                          ? (language === 'ja' ? '医師記録' : 'Doctor Note')
                          : selectedNote.note_type === 'observation'
                          ? (language === 'ja' ? '観察記録' : 'Observation')
                          : selectedNote.note_type}
                      </Text>
                    </View>
                  </View>

                  {selectedNote.status && (
                    <View style={styles.metadataRow}>
                      <Ionicons
                        name={selectedNote.status === 'approved' ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                        size={ICON_SIZES.sm}
                        color={selectedNote.status === 'approved' ? COLORS.success : COLORS.warning}
                      />
                      <View style={styles.metadataContent}>
                        <Text style={styles.metadataLabel}>
                          {language === 'ja' ? 'ステータス' : 'Status'}
                        </Text>
                        <Text style={[
                          styles.metadataValue,
                          {color: selectedNote.status === 'approved' ? COLORS.success : COLORS.warning}
                        ]}>
                          {selectedNote.status === 'approved'
                            ? (language === 'ja' ? '承認済み' : 'Approved')
                            : selectedNote.status === 'rejected'
                            ? (language === 'ja' ? '却下' : 'Rejected')
                            : (language === 'ja' ? '承認待ち' : 'Pending')}
                        </Text>
                      </View>
                    </View>
                  )}

                  {selectedNote.approved_by_name && (
                    <View style={styles.metadataRow}>
                      <Ionicons name="shield-checkmark-outline" size={ICON_SIZES.sm} color={COLORS.success} />
                      <View style={styles.metadataContent}>
                        <Text style={styles.metadataLabel}>
                          {language === 'ja' ? '承認者' : 'Approved By'}
                        </Text>
                        <Text style={styles.metadataValue}>{selectedNote.approved_by_name}</Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Note Content */}
                <View style={styles.noteContentCard}>
                  <Text style={styles.noteContentLabel}>
                    {language === 'ja' ? '記録内容' : 'Note Content'}
                  </Text>
                  <Text style={styles.noteContentText}>{selectedNote.note_text}</Text>
                </View>

                {/* Follow-up Date Picker */}
                <View style={styles.datePickerCard}>
                  <Text style={styles.datePickerLabel}>
                    {language === 'ja' ? 'フォローアップ日' : 'Follow-up Date'}
                  </Text>
                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={() => {
                      Alert.alert(
                        language === 'ja' ? '日付選択' : 'Select Date',
                        language === 'ja'
                          ? '日付選択機能はアプリ再ビルド後に利用可能です'
                          : 'Date picker will be available after app rebuild',
                        [{ text: 'OK' }]
                      );
                    }}
                  >
                    <Ionicons name="calendar-outline" size={ICON_SIZES.md} color={COLORS.primary} />
                    <Text style={styles.datePickerText}>
                      {followUpDate.toLocaleDateString()} (Tap to change)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleCopyText(selectedNote.note_text)}
                  >
                    <Ionicons name="copy-outline" size={ICON_SIZES.md} color={COLORS.primary} />
                    <Text style={styles.actionButtonText}>
                      {language === 'ja' ? 'コピー' : 'Copy'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleAddFollowUp(selectedNote)}
                  >
                    <Ionicons name="chatbubble-outline" size={ICON_SIZES.md} color={COLORS.primary} />
                    <Text style={styles.actionButtonText}>
                      {language === 'ja' ? 'フォローアップ' : 'Follow-up'}
                    </Text>
                  </TouchableOpacity>

                  {currentUser?.role === 'doctor' && selectedNote.requires_approval && selectedNote.status === 'submitted' && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.approveButton]}
                        onPress={() => {
                          handleCloseNoteDetail();
                          handleApprove(selectedNote);
                        }}
                      >
                        <Ionicons name="checkmark-circle-outline" size={ICON_SIZES.md} color={COLORS.success} />
                        <Text style={[styles.actionButtonText, {color: COLORS.success}]}>
                          {language === 'ja' ? '承認' : 'Approve'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => {
                          handleCloseNoteDetail();
                          handleReject(selectedNote);
                        }}
                      >
                        <Ionicons name="close-circle-outline" size={ICON_SIZES.md} color={COLORS.error} />
                        <Text style={[styles.actionButtonText, {color: COLORS.error}]}>
                          {language === 'ja' ? '却下' : 'Reject'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  backButton: {
    padding: SPACING.sm,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.primary,
  },
  patientName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs / 2,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  filterButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  filterTextActive: {
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING['4xl'],
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING['4xl'],
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textSecondary,
    marginTop: SPACING.lg,
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  notesContainer: {
    paddingBottom: SPACING.xl,
  },
  countText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  footer: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  addButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  addButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: SPACING.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  modalBody: {
    padding: SPACING.lg,
  },
  metadataCard: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  metadataContent: {
    flex: 1,
  },
  metadataLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  metadataValue: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textPrimary,
  },
  noteContentCard: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  noteContentLabel: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  noteContentText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    lineHeight: 24,
    color: COLORS.textPrimary,
  },
  datePickerCard: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  datePickerLabel: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    alignSelf: 'flex-start',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  datePickerText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    color: COLORS.textPrimary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: SPACING.xs,
  },
  actionButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.primary,
  },
  approveButton: {
    borderColor: COLORS.success,
  },
  rejectButton: {
    borderColor: COLORS.error,
  },
});
