export type WorkflowStep =
  | 'patient-list'
  | 'patient-scan'
  | 'vitals-capture'
  | 'adl-voice'
  | 'pain-assessment'
  | 'fall-risk-assessment'
  | 'kihon-checklist'
  | 'incident-report'
  | 'review-confirm';

export interface AssessmentSession {
  currentPatient: Patient | null;
  currentStep: WorkflowStep;
  vitals: VitalSigns | null;
  adlRecordingId: string | null;
  adlProcessedData: any | null;
  incidentPhotos: IncidentPhoto[];
  barthelIndex: BarthelIndex | null;
  startedAt: Date | null;
}

export interface Patient {
  patient_id: string;
  mrn: string;
  family_name: string;
  given_name: string;
  family_name_en?: string; // Romanized/English family name
  given_name_en?: string; // Romanized/English given name
  room?: string;
  bed?: string;
  age?: number;
  date_of_birth?: string; // ISO date string (YYYY-MM-DD)
  gender: 'male' | 'female' | 'other';
  blood_type?: 'A+' | 'A-' | 'B+' | 'B-' | 'O+' | 'O-' | 'AB+' | 'AB-';
  status?: 'green' | 'yellow' | 'red';
  risk_factors?: string[];

  // Physical measurements
  height?: number; // cm (legacy field)
  weight?: number; // kg (legacy field)
  height_cm?: string; // cm (from patient record)
  weight_kg?: string; // kg (from patient record)

  // Medical information
  allergies?: string[]; // Array of individual allergies
  medications?: string;
  key_notes?: string;

  // Latest assessments
  latest_barthel_index?: number; // 0-100
  latest_barthel_date?: string;
  latest_pain_score?: number; // 0-10 NRS
  latest_pain_date?: string;
  latest_fall_risk_score?: number; // 0-8
  latest_fall_risk_level?: 'low' | 'moderate' | 'high';
  latest_fall_risk_date?: string;
  latest_kihon_score?: number; // 0-25
  latest_kihon_status?: 'robust' | 'prefrail' | 'frail';
  latest_kihon_date?: string;

  // Latest vital signs (from most recent measurement)
  latest_vitals_date?: string;
  latest_bp_systolic?: number;
  latest_bp_diastolic?: number;
  latest_heart_rate?: number;
  latest_temperature?: number;
  latest_oxygen_saturation?: number;
  latest_respiratory_rate?: number;
  latest_weight_kg?: number;
  latest_height_cm?: number;
}

export interface VitalSigns {
  temperature_celsius?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  heart_rate?: number;
  oxygen_saturation?: number;
  respiratory_rate?: number;
  blood_glucose?: BloodGlucoseReading;
  weight?: WeightMeasurement;
  consciousness?: ConsciousnessAssessment;
  measured_at: Date;
}

export interface BloodGlucoseReading {
  value: number; // mg/dL (primary unit in Japan)
  unit: 'mg/dL' | 'mmol/L';
  test_type: 'fasting' | 'random' | 'postprandial' | 'bedtime';
}

export interface WeightMeasurement {
  weight_kg: number;
  previous_weight_kg?: number;
  percentage_change?: number;
  bmi?: number; // Auto-calculated if height available
}

export interface ConsciousnessAssessment {
  jcs_level: 0 | 1 | 2 | 3 | 10 | 20 | 30 | 100 | 200 | 300; // Japan Coma Scale
  jcs_category: 'alert' | 'awake' | 'arousable' | 'coma';
  notes?: string;
}

export interface IncidentPhoto {
  id: string;
  uri: string;
  annotations: PhotoAnnotation[];
}

export interface PhotoAnnotation {
  id: string;
  type: 'circle' | 'arrow' | 'text';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  color: string;
}

// Session-based data types for hub model
export interface MedicationAdmin {
  medicationId: string;
  medicationName: string;
  dosage: string;
  route: string;
  time: string;
  notes?: string;
  lot?: string;
  administeredBy?: string;
  timestamp: string;
}

export interface PatientUpdateDraft {
  height?: number;
  weight?: number;
  allergies?: string[]; // Array of individual allergies
  medications?: string;
  keyNotes?: string;
  confirmed?: boolean;
  updatedAt?: string;
}

export interface IncidentReport {
  id: string;
  type: 'fall' | 'medication-error' | 'behavioral' | 'injury' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  datetime: string;
  description: string;
  voiceRecordingId?: string;
  photos?: string[];
  reportedBy?: string;
  timestamp: string;
}

export interface BarthelIndex {
  total_score: number; // 0-100
  scores: Record<string, number>; // Individual category scores
  additional_notes?: string;
  recorded_at: Date;
}

// Pain Assessment - "6th Vital Sign"
export interface PainLocation {
  location: string; // Body location (head, neck, shoulder, etc.)
  intensity: number; // 0-10 NRS scale for this specific location
  pain_type?: 'rest' | 'movement' | 'both';
  notes?: string; // Context-specific notes for this location
}

export interface PainAssessment {
  pain_score: number; // Highest pain score across all locations (0-10 NRS scale)
  locations: PainLocation[]; // Multiple pain locations with individual intensities
  general_notes?: string; // Overall assessment notes
  previous_score?: number; // For trend comparison
  recorded_at: Date;
}

// Kihon Checklist - MHLW 25-item frailty assessment
export interface KihonChecklist {
  // 7 Domain scores
  iadl_score: number; // Instrumental ADL (0-5)
  physical_score: number; // Physical strength (0-5)
  nutrition_score: number; // Nutrition (0-2)
  oral_score: number; // Oral function (0-3)
  housebound_score: number; // Social isolation (0-2)
  cognitive_score: number; // Cognition (0-3)
  depressive_score: number; // Mood (0-5)

  // Individual question responses (25 questions, true = at risk)
  questions: Record<string, boolean>;

  // Calculated totals
  total_score: number; // 0-25
  frailty_status: 'robust' | 'prefrail' | 'frail'; // <4, 4-7, >=8

  // Risk flags per domain
  iadl_risk: boolean; // >=3
  physical_risk: boolean; // >=3
  nutrition_risk: boolean; // >=2
  oral_risk: boolean; // >=2
  housebound_risk: boolean; // >=1
  cognitive_risk: boolean; // >=1
  depressive_risk: boolean; // >=2

  notes?: string;
  recorded_at: Date;
}

// Fall Risk Assessment
export interface FallRiskAssessment {
  // Risk factors (1 point each)
  history_of_falls: boolean;
  uses_assistive_device: boolean;
  unsteady_gait: boolean;
  cognitive_impairment: boolean;
  high_risk_medications: boolean;

  // Optional additional factors
  vision_problems?: boolean;
  environmental_hazards?: boolean;
  urinary_incontinence?: boolean;

  // Calculated
  risk_score: number; // 0-5+
  risk_level: 'low' | 'moderate' | 'high'; // 0-1, 2-3, 4-5

  interventions_recommended: string[];
  notes?: string;
  recorded_at: Date;
}

export type Language = 'ja' | 'en' | 'zh-TW';

// ============================================================================
// CARE PLAN MODULE - Japanese Long-Term Care Insurance Compliant
// ============================================================================

// Care level types (Japanese Long-Term Care Insurance)
export type CareLevel = '要支援1' | '要支援2' | '要介護1' | '要介護2' | '要介護3' | '要介護4' | '要介護5';
export type CarePlanStatus = 'active' | 'draft' | 'archived';
export type ProblemCategory = 'ADL' | 'fall_prevention' | 'pain_management' | 'nutrition' | 'skin_integrity' | 'cognition' | 'psychosocial' | 'medical' | 'other';
export type ProblemPriority = 'urgent' | 'high' | 'medium' | 'low';
export type ProblemStatus = 'active' | 'resolved' | 'monitoring';
export type GoalDuration = '1_month' | '3_months' | '6_months' | '12_months';
export type InterventionType = 'observation' | 'care' | 'education';
export type ObservationFrequency = 'continuous' | 'hourly' | 'every_shift' | 'daily' | 'weekly';
export type ResponsibleRole = 'nurse' | 'care_worker' | 'therapist' | 'dietitian' | 'doctor' | 'care_manager';
export type EducationTarget = 'patient' | 'family' | 'both';
export type ServiceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'as_needed';
export type MonitoringType = 'routine_3month' | 'formal_6month' | 'condition_change';
export type InterventionEffectiveness = 'very_effective' | 'effective' | 'somewhat_effective' | 'not_effective';
export type ConferenceType = 'initial' | 'routine_review' | 'condition_change' | 'family_request';
export type ActionItemStatus = 'pending' | 'in_progress' | 'completed';

// Main care plan interface
export interface CarePlan {
  id: string;
  patientId: string;
  careLevel: CareLevel;
  status: CarePlanStatus;
  version: number;
  createdDate: Date;
  lastReviewDate: Date;
  nextReviewDate: Date;
  createdBy: string; // userId

  // Table 1 - Basic Info & Policy
  patientIntent: string; // 利用者の意向
  familyIntent: string; // 家族の意向
  comprehensivePolicy: string; // 総合的な援助の方針

  // Table 2 - Problems, Goals, Interventions
  carePlanItems: CarePlanItem[];

  // Table 3 - Weekly Schedule
  weeklySchedule: WeeklyScheduleItem[];

  // Team & Family
  careManagerId: string; // userId
  teamMembers: TeamMember[];
  familySignature?: FamilySignature;

  // Monitoring
  lastMonitoringDate?: Date;
  nextMonitoringDate: Date;
  monitoringRecords: MonitoringRecord[];

  // Audit trail
  auditLog: AuditLogEntry[];
}

// Care plan with patient info (for "All Care Plans" page)
export interface CarePlanWithPatient extends Omit<CarePlan, 'carePlanItems' | 'weeklySchedule' | 'monitoringRecords' | 'auditLog'> {
  patient: Patient;
  activeItemsCount: number;
  avgProgress: number;
  overdueMonitoring: boolean;
  hasHighPriority: boolean;
  hasStuckGoals: boolean;
  lastItemUpdate?: Date;
  lastUpdatedBy?: string;
}

// Team member
export interface TeamMember {
  userId: string;
  name: string;
  role: ResponsibleRole;
  assigned: boolean;
}

// Family signature
export interface FamilySignature {
  signedBy: string;
  relationship: string;
  date: Date;
}

// Care plan item (Problem → Goals → Interventions)
export interface CarePlanItem {
  id: string;
  carePlanId: string;

  // Problem/Need (生活全般の解決すべき課題・ニーズ)
  problem: {
    category: ProblemCategory;
    description: string;
    priority: ProblemPriority;
    identifiedDate: Date;
    status: ProblemStatus;
  };

  // Long-term Goal (長期目標)
  longTermGoal: {
    description: string;
    targetDate: Date;
    duration: GoalDuration;
    achievementStatus: number; // 0-100 percentage
  };

  // Short-term Goal (短期目標)
  shortTermGoal: {
    description: string;
    targetDate: Date;
    duration: GoalDuration;
    achievementStatus: number; // 0-100
    measurableCriteria: string; // 具体的な達成基準
  };

  // Interventions (援助内容)
  interventions: Intervention[];

  // Links to assessments
  linkedAssessments: {
    adlId?: string;
    fallRiskId?: string;
    painAssessmentId?: string;
    nutritionId?: string;
  };

  // Progress tracking
  progressNotes: ProgressNote[];
  lastUpdated: Date;
  updatedBy: string; // userId
}

// Intervention (援助内容)
export interface Intervention {
  id: string;
  carePlanItemId: string;
  type: InterventionType; // 観察計画・ケア計画・指導計画

  // Observation Plan (観察計画)
  observationPlan?: {
    whatToMonitor: string[]; // 観察項目
    frequency: ObservationFrequency;
    alertThresholds?: any; // 異常値の基準
    responsibleRole: ResponsibleRole;
  };

  // Care Plan (ケア計画)
  carePlan?: {
    serviceType: string; // サービス種類
    specificActions: string[]; // 具体的な援助内容
    frequency: string;
    duration: string;
    equipment: string[]; // 必要な用具
    provider: string; // サービス提供者
    responsibleRole: ResponsibleRole;
  };

  // Education Plan (指導・教育計画)
  educationPlan?: {
    targetAudience: EducationTarget;
    educationGoals: string[];
    methods: string[]; // 指導方法
    materials: string[];
  };

  // Schedule integration
  scheduledTimes?: {
    dayOfWeek: number[]; // 0=Sunday
    times: string[];
    linkedToService?: string; // e.g., "medication", "bathing", "meals"
  };

  createdDate: Date;
  createdBy: string; // userId
}

// Progress note
export interface ProgressNote {
  id: string;
  carePlanItemId: string;
  date: Date;
  note: string;
  author: string; // userId
  authorName: string;
}

// Weekly schedule item (週間サービス計画表)
export interface WeeklyScheduleItem {
  id: string;
  carePlanId: string;
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  timeSlot: 'morning' | 'afternoon' | 'evening' | 'night' | 'specific_time';
  specificTime?: string; // "09:00"

  service: {
    type: 'vital_signs' | 'medication' | 'bathing' | 'meals' | 'rehabilitation' | 'recreation' | 'doctor_visit' | 'family_visit' | 'other';
    description: string;
    duration: number; // minutes
    provider: string;
    location: string;
  };

  linkedToCarePlanItem?: string; // Reference to specific goal/intervention
  frequency: ServiceFrequency;
}

// Monitoring record (モニタリング記録)
export interface MonitoringRecord {
  id: string;
  carePlanId: string;
  monitoringDate: Date;
  monitoringType: MonitoringType;
  conductedBy: string; // userId
  conductedByName: string;

  // Assessment of each care plan item
  itemReviews: ItemReview[];

  // Overall assessment
  overallStatus: string;
  patientFeedback: string; // 利用者の意見
  familyFeedback: string; // 家族の意見
  staffObservations: string; // 職員の観察

  // Changes needed
  proposedChanges: {
    newProblems: string[];
    resolvedProblems: string[];
    goalAdjustments: string[];
    interventionChanges: string[];
  };

  // Next steps
  nextMonitoringDate: Date;
  actionItems: string[];
}

// Item review for monitoring
export interface ItemReview {
  carePlanItemId: string;
  goalProgress: {
    longTermStatus: number; // 0-100
    shortTermStatus: number; // 0-100
    comments: string;
  };
  interventionEffectiveness: InterventionEffectiveness;
  needsModification: boolean;
  modifications: string;
}

// Care conference (サービス担当者会議)
export interface CareConference {
  id: string;
  carePlanId: string;
  conferenceDate: Date;
  conferenceType: ConferenceType;

  attendees: ConferenceAttendee[];

  discussion: {
    currentStatus: string;
    concerns: string[];
    suggestions: string[];
    decisions: string[];
  };

  minutes: string; // 会議の要点
  actionItems: ConferenceActionItem[];

  carePlanApproved: boolean;
  nextConferenceDate?: Date;
}

// Conference attendee
export interface ConferenceAttendee {
  userId?: string;
  role: ResponsibleRole | 'family';
  name: string;
  attended: boolean;
}

// Conference action item
export interface ConferenceActionItem {
  id: string;
  description: string;
  assignedTo: string; // userId
  assignedToName: string;
  dueDate: Date;
  status: ActionItemStatus;
}

// Audit log entry
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  action: string;
  changes?: any;
  version: number;
}

// Problem templates for quick entry (multilingual support)
export interface ProblemTemplate {
  category: ProblemCategory;
  japanese: string;
  english: string;
  chinese?: string; // Traditional Chinese

  // New multilingual format: {ja: [], en: [], zh: []}
  // Old format (backward compatibility): string[]
  suggestedLongTermGoals:
    | { ja: string[]; en: string[]; zh: string[] }
    | string[];

  suggestedShortTermGoals:
    | { ja: string[]; en: string[]; zh: string[] }
    | string[];

  suggestedInterventions:
    | { ja: Array<{type: InterventionType; description: string}>;
        en: Array<{type: InterventionType; description: string}>;
        zh: Array<{type: InterventionType; description: string}> }
    | Array<{type: InterventionType; description: string}>;
}

// Today's Schedule types
export interface ScheduleItem {
  id: string;
  type: 'medication' | 'service' | 'vitals' | 'assessment';
  title: string;
  time: string; // HH:MM:SS or time slot
  details: string;
  status: 'pending' | 'completed' | 'prn' | 'scheduled' | 'due';
  completed: boolean;
  completedAt?: string | null;
  isPRN?: boolean;
  timeSlot?: string;
  lastRecorded?: string | null;
}

export interface TodaySchedule {
  patientId: string;
  date: string;
  dayOfWeek: number;
  allItems: ScheduleItem[];
  grouped: {
    morning: ScheduleItem[];
    afternoon: ScheduleItem[];
    evening: ScheduleItem[];
    night: ScheduleItem[];
  };
  summary: {
    total: number;
    completed: number;
    pending: number;
    medications: number;
    services: number;
    vitals: number;
    assessments: number;
  };
}
