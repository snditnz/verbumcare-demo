import { create } from 'zustand';
import { CarePlan, CarePlanItem, ProblemTemplate } from '@models/app';
import { apiService } from '@services/api';
import { cacheService } from '@services/cacheService';

/**
 * Convert date strings from API to Date objects
 */
const deserializeCarePlan = (plan: any): CarePlan => {
  return {
    ...plan,
    createdDate: plan.createdDate ? new Date(plan.createdDate) : new Date(),
    lastReviewDate: plan.lastReviewDate ? new Date(plan.lastReviewDate) : undefined,
    nextReviewDate: new Date(plan.nextReviewDate),
    lastMonitoringDate: plan.lastMonitoringDate ? new Date(plan.lastMonitoringDate) : undefined,
    nextMonitoringDate: new Date(plan.nextMonitoringDate),
    familySignature: plan.familySignature ? {
      ...plan.familySignature,
      date: new Date(plan.familySignature.date)
    } : undefined,
    carePlanItems: (plan.carePlanItems || []).map((item: any) => ({
      ...item,
      problem: {
        ...item.problem,
        identifiedDate: new Date(item.problem.identifiedDate)
      },
      longTermGoal: item.longTermGoal ? {
        ...item.longTermGoal,
        targetDate: new Date(item.longTermGoal.targetDate)
      } : undefined,
      shortTermGoal: item.shortTermGoal ? {
        ...item.shortTermGoal,
        targetDate: new Date(item.shortTermGoal.targetDate)
      } : undefined,
      interventions: (item.interventions || []).map((intervention: any) => ({
        ...intervention,
        createdDate: new Date(intervention.createdDate)
      })),
      progressNotes: (item.progressNotes || []).map((note: any) => ({
        ...note,
        date: new Date(note.date)
      })),
      lastUpdated: new Date(item.lastUpdated)
    })),
    auditLog: (plan.auditLog || []).map((log: any) => ({
      ...log,
      timestamp: new Date(log.timestamp)
    })),
    monitoringRecords: (plan.monitoringRecords || []).map((record: any) => ({
      ...record,
      monitoringDate: new Date(record.monitoringDate),
      nextMonitoringDate: new Date(record.nextMonitoringDate)
    }))
  };
};

interface CarePlanStore {
  carePlans: Map<string, CarePlan>; // key: patientId
  problemTemplates: ProblemTemplate[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadProblemTemplates: () => Promise<void>;
  loadCarePlan: (patientId: string) => Promise<void>;
  getCarePlanByPatientId: (patientId: string) => CarePlan | undefined;
  createCarePlan: (carePlan: Omit<CarePlan, 'id' | 'auditLog'>) => Promise<CarePlan>;
  updateCarePlan: (carePlan: CarePlan) => Promise<void>;
  addCarePlanItem: (patientId: string, item: Omit<CarePlanItem, 'id'>) => Promise<void>;
  updateCarePlanItem: (carePlanId: string, item: CarePlanItem) => Promise<void>;
  deleteCarePlanItem: (patientId: string, itemId: string) => Promise<void>;
  createMonitoringRecord: (carePlanId: string, record: any) => Promise<void>;
  clearError: () => void;
  clearStore: () => void;
}

export const useCarePlanStore = create<CarePlanStore>((set, get) => ({
  carePlans: new Map<string, CarePlan>(),
  problemTemplates: [],
  isLoading: false,
  error: null,

  clearError: () => {
    set({ error: null });
  },

  clearStore: () => {
    set({ carePlans: new Map(), problemTemplates: [], isLoading: false, error: null });
  },

  loadProblemTemplates: async () => {
    try {
      set({ isLoading: true, error: null });

      // OFFLINE-FIRST: Try cache first
      const cachedTemplates = await cacheService.getCachedProblemTemplates();
      if (cachedTemplates) {
        set({ problemTemplates: cachedTemplates, isLoading: false });
        // Try to update in background
        apiService.getProblemTemplates()
          .then(templates => {
            cacheService.cacheProblemTemplates(templates);
            set({ problemTemplates: templates });
          })
          .catch(() => {}); // Silently fail - we have cached data
        return;
      }

      // No cache - try API
      const templates = await apiService.getProblemTemplates();
      await cacheService.cacheProblemTemplates(templates);
      set({ problemTemplates: templates, isLoading: false });
    } catch (error: any) {
      console.error('Error loading problem templates:', error);
      // 🚨 FALLBACK TO MOCK DATA if both cache and API fail
      console.warn('Falling back to hardcoded problem templates');
      set({
        problemTemplates: PROBLEM_TEMPLATES,
        isLoading: false,
        error: null // Don't show error - we have templates
      });
    }
  },

  loadCarePlan: async (patientId: string) => {
    try {
      set({ isLoading: true, error: null });

      // OFFLINE-FIRST: Try cache first
      const cachedPlan = await cacheService.getCachedCarePlan(patientId);
      if (cachedPlan) {
        set((state) => {
          const newCarePlans = new Map(state.carePlans);
          newCarePlans.set(patientId, cachedPlan);
          return { carePlans: newCarePlans, isLoading: false };
        });

        // Try to update in background
        apiService.getCarePlans(patientId)
          .then(carePlans => {
            if (carePlans && Array.isArray(carePlans) && carePlans.length > 0) {
              const deserializedPlan = deserializeCarePlan(carePlans[0]);
              cacheService.cacheCarePlan(deserializedPlan);
              set((state) => {
                const newCarePlans = new Map(state.carePlans);
                newCarePlans.set(patientId, deserializedPlan);
                return { carePlans: newCarePlans };
              });
            } else {
              // API returned 0 care plans - remove stale cached data
              console.log(`[Background sync] Care plan deleted for patient ${patientId}, removing from cache and store`);
              cacheService.removeCarePlan(patientId); // Clear the stale cached care plan
              set((state) => {
                const newCarePlans = new Map(state.carePlans);
                newCarePlans.delete(patientId);
                return { carePlans: newCarePlans };
              });
            }
          })
          .catch(() => {}); // Silently fail - we have cached data
        return;
      }

      // No cache - try API
      const carePlans = await apiService.getCarePlans(patientId);

      if (carePlans && Array.isArray(carePlans) && carePlans.length > 0) {
        const deserializedPlans = carePlans.map(deserializeCarePlan);
        await cacheService.cacheCarePlan(deserializedPlans[0]);

        set((state) => {
          const newCarePlans = new Map(state.carePlans);
          deserializedPlans.forEach(plan => {
            newCarePlans.set(plan.patientId, plan);
          });
          return { carePlans: newCarePlans, isLoading: false };
        });
      } else {
        // No care plans found - remove stale data from store
        set((state) => {
          const newCarePlans = new Map(state.carePlans);
          newCarePlans.delete(patientId);
          return { carePlans: newCarePlans, isLoading: false, error: null };
        });
      }
    } catch (error: any) {
      // 404 is expected when no care plan exists - remove stale data
      if (error.response?.status === 404) {
        console.log('No care plan found for patient:', patientId);
        set((state) => {
          const newCarePlans = new Map(state.carePlans);
          newCarePlans.delete(patientId);
          return { carePlans: newCarePlans, isLoading: false, error: null };
        });
      } else {
        // Real error but we're offline-first - just log it
        console.error('Error loading care plan:', error);
        set({ isLoading: false, error: null }); // Don't show error - offline is normal
      }
    }
  },

  getCarePlanByPatientId: (patientId: string) => {
    return get().carePlans.get(patientId);
  },

  createCarePlan: async (carePlan: Omit<CarePlan, 'id' | 'auditLog'>) => {
    try {
      set({ isLoading: true, error: null });

      // OFFLINE-FIRST: Create locally immediately with temporary ID
      const tempId = `temp-${Date.now()}`;
      const localPlan: CarePlan = {
        ...carePlan,
        id: tempId,
        auditLog: [{
          id: 'audit-001',
          timestamp: new Date(),
          userId: 'current-user',
          userName: 'Local User',
          action: 'Created care plan (pending sync)',
          version: carePlan.version
        }]
      };

      // Save locally first
      await cacheService.cacheCarePlan(localPlan);

      set((state) => {
        const newCarePlans = new Map(state.carePlans);
        newCarePlans.set(localPlan.patientId, localPlan);
        return { carePlans: newCarePlans, isLoading: false };
      });

      // Try to sync with backend
      try {
        const createdPlan = await apiService.createCarePlan(carePlan);
        const deserializedPlan = deserializeCarePlan(createdPlan);
        await cacheService.cacheCarePlan(deserializedPlan);

        set((state) => {
          const newCarePlans = new Map(state.carePlans);
          newCarePlans.set(deserializedPlan.patientId, deserializedPlan);
          return { carePlans: newCarePlans };
        });

        return deserializedPlan;
      } catch (syncError: any) {
        // Offline or server error - queue for sync
        console.error('❌ Failed to sync care plan to server:', {
          status: syncError.response?.status,
          statusText: syncError.response?.statusText,
          data: syncError.response?.data,
          message: syncError.message,
        });
        await cacheService.addPendingSync('createCarePlan', carePlan);
        return localPlan; // Return local version
      }
    } catch (error: any) {
      console.error('Error creating care plan:', error);
      set({
        isLoading: false,
        error: 'Failed to create care plan locally.'
      });
      throw error;
    }
  },

  updateCarePlan: async (carePlan: CarePlan) => {
    try {
      set({ isLoading: true, error: null });
      const updated = await apiService.updateCarePlan(carePlan.id, carePlan);
      const deserializedPlan = deserializeCarePlan(updated);

      set((state) => {
        const newCarePlans = new Map(state.carePlans);
        newCarePlans.set(deserializedPlan.patientId, deserializedPlan);
        return { carePlans: newCarePlans, isLoading: false };
      });
    } catch (error: any) {
      console.error('Error updating care plan:', error);
      set({
        isLoading: false,
        error: 'Failed to update care plan.'
      });
      throw error;
    }
  },

  addCarePlanItem: async (patientId: string, item: Omit<CarePlanItem, 'id'>) => {
    try {
      set({ isLoading: true, error: null });
      const carePlan = get().carePlans.get(patientId);
      if (!carePlan) {
        throw new Error('Care plan not found');
      }

      // OFFLINE-FIRST: Add to local care plan immediately
      const tempId = `temp-item-${Date.now()}`;
      const localItem: CarePlanItem = {
        ...item,
        id: tempId,
      };

      const updatedPlan: CarePlan = {
        ...carePlan,
        carePlanItems: [...carePlan.carePlanItems, localItem],
      };

      // Save locally first
      await cacheService.cacheCarePlan(updatedPlan);

      set((state) => {
        const newCarePlans = new Map(state.carePlans);
        newCarePlans.set(patientId, updatedPlan);
        return { carePlans: newCarePlans, isLoading: false };
      });

      // Try to sync with backend
      try {
        // Only try if care plan has real ID (not temp)
        if (!carePlan.id.startsWith('temp-')) {
          const createdItem = await apiService.addCarePlanItem(carePlan.id, item);

          // Replace temp item with real one
          const syncedPlan: CarePlan = {
            ...updatedPlan,
            carePlanItems: updatedPlan.carePlanItems.map(i =>
              i.id === tempId ? createdItem : i
            ),
          };

          await cacheService.cacheCarePlan(syncedPlan);

          set((state) => {
            const newCarePlans = new Map(state.carePlans);
            newCarePlans.set(patientId, syncedPlan);
            return { carePlans: newCarePlans };
          });
        } else {
          // Care plan itself is not synced yet, queue the item for later
          console.warn('Care plan not synced yet, item will sync with care plan');
          await cacheService.addPendingSync('addCarePlanItem', { patientId, item });
        }
      } catch (syncError: any) {
        // Offline or server error - queue for sync
        console.warn('Failed to sync care plan item, will retry later:', syncError);
        await cacheService.addPendingSync('addCarePlanItem', { patientId, item, carePlanId: carePlan.id });
      }
    } catch (error: any) {
      console.error('Error adding care plan item locally:', error);
      set({
        isLoading: false,
        error: 'Failed to add care plan item locally.'
      });
      throw error;
    }
  },

  updateCarePlanItem: async (carePlanId: string, item: CarePlanItem) => {
    try {
      set({ isLoading: true, error: null });

      // Find the care plan by ID
      const carePlanEntry = Array.from(get().carePlans.entries()).find(
        ([_, plan]) => plan.id === carePlanId
      );

      if (!carePlanEntry) {
        throw new Error('Care plan not found');
      }

      const [patientId, carePlan] = carePlanEntry;

      // Update locally first (optimistic update)
      const updatedCarePlan = {
        ...carePlan,
        carePlanItems: carePlan.carePlanItems.map(i =>
          i.id === item.id ? item : i
        ),
      };

      await cacheService.cacheCarePlan(updatedCarePlan);

      set((state) => {
        const newCarePlans = new Map(state.carePlans);
        newCarePlans.set(patientId, updatedCarePlan);
        return { carePlans: newCarePlans, isLoading: false };
      });

      // Try to sync with backend
      try {
        await apiService.updateCarePlanItem(carePlan.id, item.id, item);
      } catch (syncError: any) {
        console.warn('Failed to sync care plan item update, will retry later:', syncError);
        await cacheService.addPendingSync('updateCarePlanItem', { carePlanId, item });
      }
    } catch (error: any) {
      console.error('Error updating care plan item:', error);
      set({
        isLoading: false,
        error: 'Failed to update care plan item.'
      });
      throw error;
    }
  },

  createMonitoringRecord: async (carePlanId: string, record: any) => {
    try {
      set({ isLoading: true, error: null });

      // Find the care plan by ID
      const carePlanEntry = Array.from(get().carePlans.entries()).find(
        ([_, plan]) => plan.id === carePlanId
      );

      if (!carePlanEntry) {
        throw new Error('Care plan not found');
      }

      const [patientId, carePlan] = carePlanEntry;

      // Update locally first
      const updatedCarePlan = {
        ...carePlan,
        monitoringRecords: [...carePlan.monitoringRecords, record],
        lastMonitoringDate: record.monitoringDate,
        nextMonitoringDate: record.nextMonitoringDate,
      };

      await cacheService.cacheCarePlan(updatedCarePlan);

      set((state) => {
        const newCarePlans = new Map(state.carePlans);
        newCarePlans.set(patientId, updatedCarePlan);
        return { carePlans: newCarePlans, isLoading: false };
      });

      // Try to sync with backend
      try {
        // TODO: Add API endpoint for monitoring records
        // await apiService.createMonitoringRecord(carePlanId, record);
        console.log('Monitoring record created locally:', record);
      } catch (syncError: any) {
        console.warn('Failed to sync monitoring record, will retry later:', syncError);
        await cacheService.addPendingSync('createMonitoringRecord', { carePlanId, record });
      }
    } catch (error: any) {
      console.error('Error creating monitoring record:', error);
      set({
        isLoading: false,
        error: 'Failed to create monitoring record.'
      });
      throw error;
    }
  },

  deleteCarePlanItem: async (patientId: string, itemId: string) => {
    try {
      set({ isLoading: true, error: null });
      const carePlan = get().carePlans.get(patientId);
      if (!carePlan) {
        throw new Error('Care plan not found');
      }

      await apiService.deleteCarePlanItem(carePlan.id, itemId);

      // Reload the care plan to get updated data
      await get().loadCarePlan(patientId);
      set({ isLoading: false });
    } catch (error: any) {
      console.error('Error deleting care plan item:', error);
      set({
        isLoading: false,
        error: 'Failed to delete care plan item.'
      });
      throw error;
    }
  },
}));

// 🚨 MOCK DATA - REMOVE BEFORE PRODUCTION
// TODO: Replace with API call to GET /api/care-plans/problem-templates
// See: MOCK_DATA_AUDIT.md for details
// Problem templates for common issues in Japanese aged care
const PROBLEM_TEMPLATES: ProblemTemplate[] = [
  {
    category: 'ADL',
    japanese: 'トイレ動作の自立困難',
    english: 'Difficulty with independent toileting',
    suggestedLongTermGoals: [
      '日中、見守りのみでトイレ動作ができる',
      '転倒せずにトイレ動作を完了できる'
    ],
    suggestedShortTermGoals: [
      '手すりを使用してトイレまで歩行できる',
      '座位から立位への移乗が安全にできる'
    ],
    suggestedInterventions: [
      { type: 'observation', description: 'トイレ動作時の様子、転倒リスクを毎回観察' },
      { type: 'care', description: '歩行器使用指導、手すり活用支援' },
      { type: 'education', description: '安全なトイレ動作の指導' }
    ]
  },
  {
    category: 'fall_prevention',
    japanese: '転倒リスクが高い',
    english: 'High risk of falling',
    suggestedLongTermGoals: [
      '6ヶ月間転倒事故ゼロを維持する',
      '安全な移動方法を習得する'
    ],
    suggestedShortTermGoals: [
      '歩行器を正しく使用できる',
      'ベッドからの起き上がりが安全にできる'
    ],
    suggestedInterventions: [
      { type: 'observation', description: 'ふらつき、バランス、歩行状態の継続観察' },
      { type: 'care', description: '環境整備（段差解消、手すり設置）' },
      { type: 'education', description: '転倒予防のための生活指導' }
    ]
  },
  {
    category: 'nutrition',
    japanese: '食事摂取量の低下',
    english: 'Decreased food intake',
    suggestedLongTermGoals: [
      '適正体重を維持する（BMI 18.5-25）',
      '必要栄養量の80%以上を摂取できる'
    ],
    suggestedShortTermGoals: [
      '1日3食、50%以上の摂取ができる',
      '好みの食事形態を見つける'
    ],
    suggestedInterventions: [
      { type: 'observation', description: '食事摂取量、体重変化の記録' },
      { type: 'care', description: '食事形態の工夫、間食の提供' },
      { type: 'education', description: '栄養の重要性について指導' }
    ]
  },
  {
    category: 'pain_management',
    japanese: '慢性的な腰痛がある',
    english: 'Chronic low back pain',
    suggestedLongTermGoals: [
      '痛みが日常生活に支障をきたさないレベルまで軽減する',
      '痛みのセルフマネジメントができる'
    ],
    suggestedShortTermGoals: [
      '安静時の痛みがNRS 3以下になる',
      '痛み軽減のための工夫を3つ以上実践できる'
    ],
    suggestedInterventions: [
      { type: 'observation', description: '痛みの程度、部位、性質の評価（毎日）' },
      { type: 'care', description: '体位変換、温罨法、マッサージの実施' },
      { type: 'education', description: '痛み軽減のためのポジショニング指導' }
    ]
  },
  {
    category: 'cognition',
    japanese: '認知機能の低下（見当識障害）',
    english: 'Cognitive decline (disorientation)',
    suggestedLongTermGoals: [
      '日時の見当識を維持する',
      '穏やかに施設生活を送ることができる'
    ],
    suggestedShortTermGoals: [
      '曜日と時間帯がわかる',
      '職員の顔と名前を覚える'
    ],
    suggestedInterventions: [
      { type: 'observation', description: '見当識、記憶力、判断力の定期評価' },
      { type: 'care', description: 'オリエンテーション支援（カレンダー、時計の活用）' },
      { type: 'education', description: '家族への認知症ケアの指導' }
    ]
  },
  {
    category: 'psychosocial',
    japanese: '社会的孤立・活動量の低下',
    english: 'Social isolation and decreased activity',
    suggestedLongTermGoals: [
      '施設内で親しい仲間を作る',
      '楽しみを見つけ、活動的に過ごす'
    ],
    suggestedShortTermGoals: [
      'レクリエーションに週3回以上参加する',
      '他の利用者と会話を楽しむ'
    ],
    suggestedInterventions: [
      { type: 'observation', description: '表情、活動参加状況、他者との交流の観察' },
      { type: 'care', description: 'レクリエーション参加の声かけ、趣味活動の提供' },
      { type: 'education', description: '社会参加の重要性について説明' }
    ]
  }
];

// 🚨 MOCK DATA - REMOVE BEFORE PRODUCTION
// TODO: Replace with API call to GET /api/care-plans?patient_id={id}
// See: MOCK_DATA_AUDIT.md for details
// Initialize with mock data for demo
export const initializeCarePlanMockData = () => {
  const store = useCarePlanStore.getState();

  // Only initialize if patient 1 doesn't already have a care plan
  if (store.carePlans.get('1')) {
    return;
  }

  // Create a sample care plan for Yamada Hanako (patient 1)
  const mockCarePlan: CarePlan = {
    id: 'cp-001',
    patientId: '1',
    careLevel: '要介護3',
    status: 'active',
    version: 3,
    createdDate: new Date('2025-06-20'),
    lastReviewDate: new Date('2025-06-20'),
    nextReviewDate: new Date('2025-12-20'),
    createdBy: 'cm-tanaka',

    patientIntent: 'できるだけ自分でトイレに行きたい。家族に迷惑をかけたくない',
    familyIntent: '母が安全に生活できるようサポートしてほしい（長女）',
    comprehensivePolicy: 'トイレ動作の自立支援を中心に、転倒リスクを軽減しながらADL維持を図る。家族との良好な関係を保ちながら施設生活への適応を支援する。',

    carePlanItems: [
      {
        id: 'cpi-001',
        carePlanId: 'cp-001',
        problem: {
          category: 'ADL',
          description: 'トイレ動作時にふらつきがあり、転倒の危険性がある',
          priority: 'high',
          identifiedDate: new Date('2025-06-20'),
          status: 'active'
        },
        longTermGoal: {
          description: '日中、見守りのみでトイレ動作ができる',
          targetDate: new Date('2025-12-20'),
          duration: '6_months',
          achievementStatus: 40
        },
        shortTermGoal: {
          description: '手すりを使用してトイレまで歩行できる',
          targetDate: new Date('2025-09-20'),
          duration: '3_months',
          achievementStatus: 65,
          measurableCriteria: '10m歩行可能、転倒なし'
        },
        interventions: [
          {
            id: 'int-001',
            carePlanItemId: 'cpi-001',
            type: 'observation',
            observationPlan: {
              whatToMonitor: ['トイレ動作時の様子', 'ふらつきの有無', '転倒リスク'],
              frequency: 'daily',
              responsibleRole: 'care_worker'
            },
            createdDate: new Date('2025-06-20'),
            createdBy: 'cm-tanaka'
          },
          {
            id: 'int-002',
            carePlanItemId: 'cpi-001',
            type: 'care',
            carePlan: {
              serviceType: 'ADL支援',
              specificActions: ['歩行器を準備し、使用を促す', 'トイレまでの付き添い', '手すり使用の声かけ'],
              frequency: '毎食後',
              duration: '10分',
              equipment: ['歩行器', '手すり'],
              provider: '介護職員',
              responsibleRole: 'care_worker'
            },
            scheduledTimes: {
              dayOfWeek: [0, 1, 2, 3, 4, 5, 6],
              times: ['08:30', '12:30', '18:00']
            },
            createdDate: new Date('2025-06-20'),
            createdBy: 'cm-tanaka'
          }
        ],
        linkedAssessments: {
          adlId: 'adl-001',
          fallRiskId: 'fall-001'
        },
        progressNotes: [
          {
            id: 'pn-001',
            carePlanItemId: 'cpi-001',
            date: new Date('2025-10-15'),
            note: '歩行器使用により安定性が向上。手すりへのつかまり方も上手になっている。',
            author: 'nurse-sato',
            authorName: '佐藤 看護師'
          }
        ],
        lastUpdated: new Date('2025-10-15'),
        updatedBy: 'nurse-sato'
      },
      {
        id: 'cpi-002',
        carePlanId: 'cp-001',
        problem: {
          category: 'fall_prevention',
          description: '歩行時のバランス不良、転倒歴あり',
          priority: 'high',
          identifiedDate: new Date('2025-06-20'),
          status: 'active'
        },
        longTermGoal: {
          description: '6ヶ月間転倒事故ゼロを維持する',
          targetDate: new Date('2025-12-20'),
          duration: '6_months',
          achievementStatus: 80
        },
        shortTermGoal: {
          description: '歩行器を正しく使用し、安全に移動できる',
          targetDate: new Date('2025-09-20'),
          duration: '3_months',
          achievementStatus: 85,
          measurableCriteria: '歩行器使用時の転倒ゼロ'
        },
        interventions: [],
        linkedAssessments: {
          fallRiskId: 'fall-001'
        },
        progressNotes: [],
        lastUpdated: new Date('2025-06-20'),
        updatedBy: 'cm-tanaka'
      },
      {
        id: 'cpi-003',
        carePlanId: 'cp-001',
        problem: {
          category: 'psychosocial',
          description: '他利用者との交流が少なく、部屋で過ごすことが多い',
          priority: 'medium',
          identifiedDate: new Date('2025-08-10'),
          status: 'active'
        },
        longTermGoal: {
          description: '施設内で親しい仲間を作り、楽しく過ごす',
          targetDate: new Date('2026-02-10'),
          duration: '6_months',
          achievementStatus: 30
        },
        shortTermGoal: {
          description: 'レクリエーションに週3回以上参加する',
          targetDate: new Date('2025-11-10'),
          duration: '3_months',
          achievementStatus: 45,
          measurableCriteria: '週3回以上の参加記録'
        },
        interventions: [],
        linkedAssessments: {},
        progressNotes: [],
        lastUpdated: new Date('2025-08-10'),
        updatedBy: 'cm-tanaka'
      }
    ],

    weeklySchedule: [],

    careManagerId: 'cm-tanaka',
    teamMembers: [
      { userId: 'cm-tanaka', name: '田中 ケアマネジャー', role: 'care_manager', assigned: true },
      { userId: 'nurse-sato', name: '佐藤 看護師', role: 'nurse', assigned: true },
      { userId: 'cw-suzuki', name: '鈴木 介護士', role: 'care_worker', assigned: true },
      { userId: 'pt-takahashi', name: '高橋 理学療法士', role: 'therapist', assigned: true }
    ],

    familySignature: {
      signedBy: '山田 美咲',
      relationship: '長女',
      date: new Date('2025-06-20')
    },

    lastMonitoringDate: new Date('2025-09-15'),
    nextMonitoringDate: new Date('2026-01-15'),
    monitoringRecords: [],

    auditLog: [
      {
        id: 'audit-001',
        timestamp: new Date('2025-06-20'),
        userId: 'cm-tanaka',
        userName: '田中 ケアマネジャー',
        action: 'Created care plan version 3',
        version: 3
      }
    ]
  };

  store.createCarePlan(mockCarePlan);
};
