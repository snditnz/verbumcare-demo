import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, RefreshControl, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { useCarePlanStore } from '@stores/carePlanStore';
import { LanguageToggle } from '@components';
import { Card } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { CarePlanWithPatient, CareLevel } from '@models/app';

type RootStackParamList = {
  Dashboard: undefined;
  CarePlanHub: undefined;
  AllCarePlans: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AllCarePlans'>;
};

type SortOption = 'lastUpdated' | 'nextReview' | 'patientName';

const CARE_LEVELS: CareLevel[] = ['要支援1', '要支援2', '要介護1', '要介護2', '要介護3', '要介護4', '要介護5'];

export default function AllCarePlansScreen({ navigation }: Props) {
  const { language, setCurrentPatient } = useAssessmentStore();
  const { allCarePlans, loadAllCarePlans, isLoading, error } = useCarePlanStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCareLevel, setSelectedCareLevel] = useState<CareLevel | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<'active' | 'draft' | null>('active');
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('lastUpdated');
  const [refreshing, setRefreshing] = useState(false);

  const t = translations[language];

  // Load care plans on mount
  useEffect(() => {
    loadAllCarePlans();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllCarePlans();
    setRefreshing(false);
  };

  const handleCarePlanPress = (carePlan: CarePlanWithPatient) => {
    // Set current patient and navigate to their CarePlanHub
    setCurrentPatient(carePlan.patient);
    navigation.navigate('CarePlanHub');
  };

  // Get unique rooms
  const rooms = Array.from(new Set(allCarePlans.map(cp => cp.patient.room).filter((room): room is string => !!room)));

  // Filter care plans
  const filteredPlans = allCarePlans.filter(carePlan => {
    // Search filter
    const patientName = `${carePlan.patient.family_name} ${carePlan.patient.given_name}`.toLowerCase();
    const matchesSearch = searchQuery === '' || patientName.includes(searchQuery.toLowerCase()) || carePlan.patient.mrn.toLowerCase().includes(searchQuery.toLowerCase());

    // Care level filter
    const matchesCareLevel = selectedCareLevel === null || carePlan.careLevel === selectedCareLevel;

    // Status filter
    const matchesStatus = selectedStatus === null || carePlan.status === selectedStatus;

    // Room filter
    const matchesRoom = selectedRoom === null || carePlan.patient.room === selectedRoom;

    return matchesSearch && matchesCareLevel && matchesStatus && matchesRoom;
  });

  // Sort care plans
  const sortedPlans = [...filteredPlans].sort((a, b) => {
    switch (sortBy) {
      case 'lastUpdated':
        const aDate = a.lastItemUpdate || a.lastReviewDate || a.createdDate;
        const bDate = b.lastItemUpdate || b.lastReviewDate || b.createdDate;
        return bDate.getTime() - aDate.getTime(); // Newest first
      case 'nextReview':
        return a.nextReviewDate.getTime() - b.nextReviewDate.getTime(); // Soonest first
      case 'patientName':
        return `${a.patient.family_name}${a.patient.given_name}`.localeCompare(`${b.patient.family_name}${b.patient.given_name}`);
      default:
        return 0;
    }
  });

  // Get time ago string
  const getTimeAgo = (date: Date | undefined) => {
    if (!date) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return language === 'ja' ? '今日' : 'Today';
    if (diffDays === 1) return language === 'ja' ? '昨日' : 'Yesterday';
    if (diffDays < 7) return language === 'ja' ? `${diffDays}日前` : `${diffDays} days ago`;
    if (diffDays < 30) return language === 'ja' ? `${Math.floor(diffDays / 7)}週間前` : `${Math.floor(diffDays / 7)} weeks ago`;
    return language === 'ja' ? `${Math.floor(diffDays / 30)}ヶ月前` : `${Math.floor(diffDays / 30)} months ago`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          <Text style={styles.backText}>{language === 'ja' ? 'ダッシュボード' : 'Dashboard'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {language === 'ja' ? '全てのケアプラン' : 'All Care Plans'}
        </Text>
        <LanguageToggle />
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={ICON_SIZES.md} color={COLORS.text.secondary} />
          <TextInput
            style={styles.searchInput}
            placeholder={language === 'ja' ? '患者を検索' : 'Search patient'}
            placeholderTextColor={COLORS.text.disabled}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={ICON_SIZES.md} color={COLORS.text.secondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Sort Dropdown */}
        <View style={styles.sortContainer}>
          <Text style={styles.sortLabel}>{language === 'ja' ? '並び替え:' : 'Sort by:'}</Text>
          <TouchableOpacity style={styles.sortButton} onPress={() => {
            const options: SortOption[] = ['lastUpdated', 'nextReview', 'patientName'];
            const currentIndex = options.indexOf(sortBy);
            setSortBy(options[(currentIndex + 1) % options.length]);
          }}>
            <Text style={styles.sortButtonText}>
              {sortBy === 'lastUpdated' && (language === 'ja' ? '更新日時' : 'Last Updated')}
              {sortBy === 'nextReview' && (language === 'ja' ? '次回レビュー' : 'Next Review')}
              {sortBy === 'patientName' && (language === 'ja' ? '患者名' : 'Patient Name')}
            </Text>
            <Ionicons name="swap-vertical" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filters with Groups */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterChips}
        contentContainerStyle={styles.filterChipsContent}
      >
        {/* Status Group */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>{language === 'ja' ? 'ステータス' : 'Status'}</Text>
          <View style={styles.filterGroupChips}>
            <TouchableOpacity
              style={[styles.filterChip, selectedStatus === 'active' && styles.filterChipActive]}
              onPress={() => setSelectedStatus(selectedStatus === 'active' ? null : 'active')}
            >
              <Text style={[styles.filterChipText, selectedStatus === 'active' && styles.filterChipTextActive]}>
                {language === 'ja' ? '有効' : 'Active'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, selectedStatus === 'draft' && styles.filterChipActive]}
              onPress={() => setSelectedStatus(selectedStatus === 'draft' ? null : 'draft')}
            >
              <Text style={[styles.filterChipText, selectedStatus === 'draft' && styles.filterChipTextActive]}>
                {language === 'ja' ? '下書き' : 'Draft'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Separator */}
        <View style={styles.filterSeparator} />

        {/* Care Level Group */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>{language === 'ja' ? '介護度' : 'Care Level'}</Text>
          <View style={styles.filterGroupChips}>
            {CARE_LEVELS.map(level => (
              <TouchableOpacity
                key={level}
                style={[styles.filterChip, selectedCareLevel === level && styles.filterChipActive]}
                onPress={() => setSelectedCareLevel(selectedCareLevel === level ? null : level)}
              >
                <Text style={[styles.filterChipText, selectedCareLevel === level && styles.filterChipTextActive]}>
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Separator */}
        <View style={styles.filterSeparator} />

        {/* Room Dropdown */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>{language === 'ja' ? '部屋' : 'Room'}</Text>
          <TouchableOpacity
            style={[styles.roomDropdown, selectedRoom && styles.roomDropdownActive]}
            onPress={() => {
              // Cycle through rooms or clear
              if (!selectedRoom) {
                setSelectedRoom(rooms[0] || null);
              } else {
                const currentIndex = rooms.indexOf(selectedRoom);
                if (currentIndex < rooms.length - 1) {
                  setSelectedRoom(rooms[currentIndex + 1]);
                } else {
                  setSelectedRoom(null);
                }
              }
            }}
          >
            <Text style={[styles.roomDropdownText, selectedRoom && styles.roomDropdownTextActive]}>
              {selectedRoom || (language === 'ja' ? '全部' : 'All')}
            </Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={selectedRoom ? COLORS.white : COLORS.text.secondary}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Care Plans List */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {isLoading && !refreshing ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
        ) : error ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={64} color={COLORS.error} />
            <Text style={styles.emptyText}>{error}</Text>
          </View>
        ) : sortedPlans.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={COLORS.text.disabled} />
            <Text style={styles.emptyText}>
              {language === 'ja' ? 'ケアプランが見つかりません' : 'No care plans found'}
            </Text>
          </View>
        ) : (
          <View style={styles.carePlansList}>
            {sortedPlans.map(carePlan => (
              <TouchableOpacity
                key={carePlan.id}
                style={styles.carePlanCard}
                onPress={() => handleCarePlanPress(carePlan)}
              >
                <Card style={{ flex: 1, padding: SPACING.xs }}>
                  <View style={styles.cardHeader}>
                    {/* Patient Info */}
                    <View style={styles.patientInfo}>
                      <Text style={styles.patientName}>
                        {carePlan.patient.family_name} {carePlan.patient.given_name}
                        {carePlan.patient.room && (
                          <Text style={styles.roomText}> • {carePlan.patient.room}</Text>
                        )}
                      </Text>
                    </View>

                    {/* Stats */}
                    <View style={styles.statsInline}>
                      <Text style={styles.statsText}>
                        {carePlan.activeItemsCount} {language === 'ja' ? '課題' : 'items'} • {carePlan.avgProgress}%
                      </Text>
                    </View>

                    {/* Status Badges */}
                    <View style={styles.badges}>
                      {carePlan.overdueMonitoring && (
                        <View style={[styles.badge, { backgroundColor: COLORS.error }]}>
                          <Ionicons name="time" size={12} color={COLORS.white} />
                        </View>
                      )}
                      {carePlan.hasStuckGoals && (
                        <View style={[styles.badge, { backgroundColor: COLORS.status.warning }]}>
                          <Ionicons name="trending-down" size={12} color={COLORS.white} />
                        </View>
                      )}
                      {carePlan.hasHighPriority && (
                        <View style={[styles.badge, { backgroundColor: COLORS.error }]}>
                          <Ionicons name="warning" size={12} color={COLORS.white} />
                        </View>
                      )}
                    </View>

                    {/* Care Level Badge */}
                    <View style={[styles.careLevelBadge, { backgroundColor: `${COLORS.primary}20` }]}>
                      <Text style={[styles.careLevelText, { color: COLORS.primary }]}>
                        {carePlan.careLevel}
                      </Text>
                    </View>
                  </View>

                  {/* Last Updated */}
                  <Text style={styles.lastUpdated}>
                    {language === 'ja' ? '更新: ' : 'Updated: '}
                    {getTimeAgo(carePlan.lastItemUpdate || carePlan.lastReviewDate)}
                    {carePlan.lastUpdatedBy && ` • ${carePlan.lastUpdatedBy}`}
                  </Text>

                  {/* Progress Bar */}
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBar, { width: `${carePlan.avgProgress}%` }]} />
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  backText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.white,
  },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 3,
    gap: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    minHeight: 32,
    maxHeight: 32,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 0,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.md,
    height: 26,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text.primary,
    height: 26,
    paddingVertical: 0,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  sortLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: 0,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.sm,
    height: 26,
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.primary,
  },
  filterChips: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    maxHeight: 32,
  },
  filterChipsContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 3,
    gap: SPACING.md,
    height: 28,
    alignItems: 'center',
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  filterGroupLabel: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    marginRight: SPACING.xs,
  },
  filterGroupChips: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  filterSeparator: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.xs,
  },
  filterChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 0,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 24,
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 11,
    color: COLORS.text.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  filterChipTextActive: {
    color: COLORS.white,
  },
  roomDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    height: 24,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 60,
  },
  roomDropdownActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  roomDropdownText: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
  },
  roomDropdownTextActive: {
    color: COLORS.white,
  },
  resultsCount: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  resultsCountText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  content: {
    flex: 1,
  },
  loader: {
    marginTop: SPACING.xl,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING['3xl'],
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    marginTop: SPACING.md,
  },
  carePlansList: {
    padding: SPACING.lg,
    gap: SPACING.xs,
  },
  carePlanCard: {
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    gap: SPACING.xs,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  roomText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeight.normal,
  },
  statsInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  badges: {
    flexDirection: 'row',
    gap: 4,
  },
  badge: {
    width: 20,
    height: 20,
    borderRadius: BORDER_RADIUS.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  careLevelBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  careLevelText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  lastUpdated: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.accent,
  },
});
