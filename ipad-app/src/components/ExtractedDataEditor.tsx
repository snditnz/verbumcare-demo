import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
} from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '@constants/theme';
import { translations } from '@constants/translations';
import { Language } from '@models';
import { DataCategory, ExtractedData } from '@services/voiceReviewService';

/**
 * ExtractedDataEditor Component
 * 
 * Renders category-specific forms for extracted voice data.
 * Features:
 * - Category-specific forms (vitals, medication, clinical_note, adl, incident, care_plan, pain)
 * - Editable fields for all extracted data
 * - Validation error display
 * - Confidence indicators (color-coded: green >0.8, yellow 0.6-0.8, orange <0.6)
 * 
 * Requirements: 5.4, 5.5, 5.6
 */

interface ExtractedDataEditorProps {
  extractedData: ExtractedData;
  language: Language;
  disabled?: boolean;
  validationErrors?: Record<string, string[]>;
  onDataChange: (categoryIndex: number, field: string, value: any) => void;
}

export default function ExtractedDataEditor({
  extractedData,
  language,
  disabled = false,
  validationErrors = {},
  onDataChange,
}: ExtractedDataEditorProps) {
  const t = (key: string) => translations[language][key] || key;

  if (!extractedData?.categories || extractedData.categories.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyText}>{t('voiceReview.noExtractedData')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {extractedData.categories.map((category, index) => (
        <CategoryForm
          key={`${category.type}-${index}`}
          category={category}
          categoryIndex={index}
          language={language}
          disabled={disabled}
          validationErrors={validationErrors[`category_${index}`] || []}
          onDataChange={onDataChange}
        />
      ))}
    </View>
  );
}

/**
 * CategoryForm Component
 * 
 * Renders a form for a specific data category with appropriate fields
 */
interface CategoryFormProps {
  category: DataCategory;
  categoryIndex: number;
  language: Language;
  disabled: boolean;
  validationErrors: string[];
  onDataChange: (categoryIndex: number, field: string, value: any) => void;
}

function CategoryForm({
  category,
  categoryIndex,
  language,
  disabled,
  validationErrors,
  onDataChange,
}: CategoryFormProps) {
  const t = (key: string) => translations[language][key] || key;

  // Get category display name
  const getCategoryName = (type: string): string => {
    const categoryNames: Record<string, string> = {
      vitals: t('voiceReview.category.vitals'),
      medication: t('voiceReview.category.medication'),
      clinical_note: t('voiceReview.category.clinicalNote'),
      adl: t('voiceReview.category.adl'),
      incident: t('voiceReview.category.incident'),
      care_plan: t('voiceReview.category.carePlan'),
      pain: t('voiceReview.category.pain'),
    };
    return categoryNames[type] || type;
  };

  // Get confidence color based on score
  const getConfidenceColor = (confidence: number): string => {
    if (confidence > 0.8) return COLORS.success;
    if (confidence > 0.6) return COLORS.warning;
    return COLORS.error;
  };

  const confidenceColor = getConfidenceColor(category.confidence);

  return (
    <View style={styles.categoryContainer}>
      {/* Category Header */}
      <View style={styles.categoryHeader}>
        <Text style={styles.categoryTitle}>{getCategoryName(category.type)}</Text>
        <ConfidenceIndicator
          confidence={category.confidence}
          color={confidenceColor}
        />
      </View>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <View style={styles.validationErrorContainer}>
          {validationErrors.map((error, idx) => (
            <Text key={idx} style={styles.validationErrorText}>
              ⚠️ {error}
            </Text>
          ))}
        </View>
      )}

      {/* Category-specific fields */}
      <View style={styles.fieldsContainer}>
        {category.type === 'vitals' && (
          <VitalsFields
            data={category.data}
            fieldConfidences={category.fieldConfidences}
            categoryIndex={categoryIndex}
            language={language}
            disabled={disabled}
            onDataChange={onDataChange}
          />
        )}
        {category.type === 'medication' && (
          <MedicationFields
            data={category.data}
            fieldConfidences={category.fieldConfidences}
            categoryIndex={categoryIndex}
            language={language}
            disabled={disabled}
            onDataChange={onDataChange}
          />
        )}
        {category.type === 'clinical_note' && (
          <ClinicalNoteFields
            data={category.data}
            fieldConfidences={category.fieldConfidences}
            categoryIndex={categoryIndex}
            language={language}
            disabled={disabled}
            onDataChange={onDataChange}
          />
        )}
        {category.type === 'adl' && (
          <ADLFields
            data={category.data}
            fieldConfidences={category.fieldConfidences}
            categoryIndex={categoryIndex}
            language={language}
            disabled={disabled}
            onDataChange={onDataChange}
          />
        )}
        {category.type === 'incident' && (
          <IncidentFields
            data={category.data}
            fieldConfidences={category.fieldConfidences}
            categoryIndex={categoryIndex}
            language={language}
            disabled={disabled}
            onDataChange={onDataChange}
          />
        )}
        {category.type === 'care_plan' && (
          <CarePlanFields
            data={category.data}
            fieldConfidences={category.fieldConfidences}
            categoryIndex={categoryIndex}
            language={language}
            disabled={disabled}
            onDataChange={onDataChange}
          />
        )}
        {category.type === 'pain' && (
          <PainFields
            data={category.data}
            fieldConfidences={category.fieldConfidences}
            categoryIndex={categoryIndex}
            language={language}
            disabled={disabled}
            onDataChange={onDataChange}
          />
        )}
      </View>
    </View>
  );
}

/**
 * ConfidenceIndicator Component
 * 
 * Visual indicator for AI confidence scores
 */
interface ConfidenceIndicatorProps {
  confidence: number;
  color: string;
  size?: 'small' | 'medium';
}

function ConfidenceIndicator({ confidence, color, size = 'medium' }: ConfidenceIndicatorProps) {
  const isSmall = size === 'small';
  
  return (
    <View style={[
      styles.confidenceBadge,
      { backgroundColor: color + '20' },
      isSmall && styles.confidenceBadgeSmall
    ]}>
      <Text style={[
        styles.confidenceBadgeText,
        { color },
        isSmall && styles.confidenceBadgeTextSmall
      ]}>
        {Math.round(confidence * 100)}%
      </Text>
    </View>
  );
}

/**
 * DataField Component
 * 
 * Generic editable field with confidence indicator
 */
interface DataFieldProps {
  label: string;
  value: any;
  confidence: number;
  categoryIndex: number;
  fieldName: string;
  disabled: boolean;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  onDataChange: (categoryIndex: number, field: string, value: any) => void;
}

function DataField({
  label,
  value,
  confidence,
  categoryIndex,
  fieldName,
  disabled,
  multiline = false,
  keyboardType = 'default',
  onDataChange,
}: DataFieldProps) {
  const getConfidenceColor = (conf: number): string => {
    if (conf > 0.8) return COLORS.success;
    if (conf > 0.6) return COLORS.warning;
    return COLORS.error;
  };

  const confidenceColor = getConfidenceColor(confidence);
  const isLowConfidence = confidence < 0.6;

  return (
    <View style={styles.fieldContainer}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <ConfidenceIndicator
          confidence={confidence}
          color={confidenceColor}
          size="small"
        />
      </View>
      <TextInput
        style={[
          styles.fieldInput,
          multiline && styles.fieldInputMultiline,
          isLowConfidence && styles.fieldInputLowConfidence,
          disabled && styles.fieldInputDisabled
        ]}
        value={String(value || '')}
        onChangeText={(text) => onDataChange(categoryIndex, fieldName, text)}
        editable={!disabled}
        multiline={multiline}
        keyboardType={keyboardType}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholder="..."
        placeholderTextColor={COLORS.text.disabled}
      />
    </View>
  );
}

/**
 * Category-specific field components
 */

interface FieldsProps {
  data: any;
  fieldConfidences: Record<string, number>;
  categoryIndex: number;
  language: Language;
  disabled: boolean;
  onDataChange: (categoryIndex: number, field: string, value: any) => void;
}

function VitalsFields({ data, fieldConfidences, categoryIndex, language, disabled, onDataChange }: FieldsProps) {
  const t = (key: string) => translations[language][key] || key;
  
  return (
    <>
      {data.blood_pressure && (
        <DataField
          label={t('vitals.bloodPressure')}
          value={`${data.blood_pressure.systolic || ''}/${data.blood_pressure.diastolic || ''}`}
          confidence={fieldConfidences.blood_pressure || 0.5}
          categoryIndex={categoryIndex}
          fieldName="blood_pressure"
          disabled={disabled}
          onDataChange={onDataChange}
        />
      )}
      {data.heart_rate !== undefined && (
        <DataField
          label={t('vitals.heartRate')}
          value={data.heart_rate}
          confidence={fieldConfidences.heart_rate || 0.5}
          categoryIndex={categoryIndex}
          fieldName="heart_rate"
          disabled={disabled}
          keyboardType="numeric"
          onDataChange={onDataChange}
        />
      )}
      {data.temperature !== undefined && (
        <DataField
          label={t('vitals.temperature')}
          value={data.temperature}
          confidence={fieldConfidences.temperature || 0.5}
          categoryIndex={categoryIndex}
          fieldName="temperature"
          disabled={disabled}
          keyboardType="numeric"
          onDataChange={onDataChange}
        />
      )}
      {data.respiratory_rate !== undefined && (
        <DataField
          label={t('vitals.respiratoryRate')}
          value={data.respiratory_rate}
          confidence={fieldConfidences.respiratory_rate || 0.5}
          categoryIndex={categoryIndex}
          fieldName="respiratory_rate"
          disabled={disabled}
          keyboardType="numeric"
          onDataChange={onDataChange}
        />
      )}
      {data.oxygen_saturation !== undefined && (
        <DataField
          label={t('vitals.oxygenSaturation')}
          value={data.oxygen_saturation}
          confidence={fieldConfidences.oxygen_saturation || 0.5}
          categoryIndex={categoryIndex}
          fieldName="oxygen_saturation"
          disabled={disabled}
          keyboardType="numeric"
          onDataChange={onDataChange}
        />
      )}
      {data.weight_kg !== undefined && (
        <DataField
          label={t('vitals.weight')}
          value={data.weight_kg}
          confidence={fieldConfidences.weight_kg || 0.5}
          categoryIndex={categoryIndex}
          fieldName="weight_kg"
          disabled={disabled}
          keyboardType="numeric"
          onDataChange={onDataChange}
        />
      )}
      {data.height_cm !== undefined && (
        <DataField
          label={t('vitals.height')}
          value={data.height_cm}
          confidence={fieldConfidences.height_cm || 0.5}
          categoryIndex={categoryIndex}
          fieldName="height_cm"
          disabled={disabled}
          keyboardType="numeric"
          onDataChange={onDataChange}
        />
      )}
    </>
  );
}

function MedicationFields({ data, fieldConfidences, categoryIndex, language, disabled, onDataChange }: FieldsProps) {
  const t = (key: string) => translations[language][key] || key;
  
  return (
    <>
      <DataField
        label={t('medications.medicationName')}
        value={data.medication_name}
        confidence={fieldConfidences.medication_name || 0.5}
        categoryIndex={categoryIndex}
        fieldName="medication_name"
        disabled={disabled}
        onDataChange={onDataChange}
      />
      <DataField
        label={t('medications.dose')}
        value={data.dose}
        confidence={fieldConfidences.dose || 0.5}
        categoryIndex={categoryIndex}
        fieldName="dose"
        disabled={disabled}
        onDataChange={onDataChange}
      />
      <DataField
        label={t('medications.route')}
        value={data.route}
        confidence={fieldConfidences.route || 0.5}
        categoryIndex={categoryIndex}
        fieldName="route"
        disabled={disabled}
        onDataChange={onDataChange}
      />
      <DataField
        label={t('medications.time')}
        value={data.time}
        confidence={fieldConfidences.time || 0.5}
        categoryIndex={categoryIndex}
        fieldName="time"
        disabled={disabled}
        onDataChange={onDataChange}
      />
      {data.response && (
        <DataField
          label={t('medications.response')}
          value={data.response}
          confidence={fieldConfidences.response || 0.5}
          categoryIndex={categoryIndex}
          fieldName="response"
          disabled={disabled}
          multiline
          onDataChange={onDataChange}
        />
      )}
    </>
  );
}

function ClinicalNoteFields({ data, fieldConfidences, categoryIndex, language, disabled, onDataChange }: FieldsProps) {
  const t = (key: string) => translations[language][key] || key;
  
  return (
    <>
      {data.subjective && (
        <DataField
          label={t('clinicalNotes.subjective')}
          value={data.subjective}
          confidence={fieldConfidences.subjective || 0.5}
          categoryIndex={categoryIndex}
          fieldName="subjective"
          disabled={disabled}
          multiline
          onDataChange={onDataChange}
        />
      )}
      {data.objective && (
        <DataField
          label={t('clinicalNotes.objective')}
          value={data.objective}
          confidence={fieldConfidences.objective || 0.5}
          categoryIndex={categoryIndex}
          fieldName="objective"
          disabled={disabled}
          multiline
          onDataChange={onDataChange}
        />
      )}
      {data.assessment && (
        <DataField
          label={t('clinicalNotes.assessment')}
          value={data.assessment}
          confidence={fieldConfidences.assessment || 0.5}
          categoryIndex={categoryIndex}
          fieldName="assessment"
          disabled={disabled}
          multiline
          onDataChange={onDataChange}
        />
      )}
      {data.plan && (
        <DataField
          label={t('clinicalNotes.plan')}
          value={data.plan}
          confidence={fieldConfidences.plan || 0.5}
          categoryIndex={categoryIndex}
          fieldName="plan"
          disabled={disabled}
          multiline
          onDataChange={onDataChange}
        />
      )}
      {data.category && (
        <DataField
          label={t('clinicalNotes.category')}
          value={data.category}
          confidence={fieldConfidences.category || 0.5}
          categoryIndex={categoryIndex}
          fieldName="category"
          disabled={disabled}
          onDataChange={onDataChange}
        />
      )}
    </>
  );
}

function ADLFields({ data, fieldConfidences, categoryIndex, language, disabled, onDataChange }: FieldsProps) {
  const t = (key: string) => translations[language][key] || key;
  
  return (
    <>
      <DataField
        label={t('assessments.activity')}
        value={data.activity}
        confidence={fieldConfidences.activity || 0.5}
        categoryIndex={categoryIndex}
        fieldName="activity"
        disabled={disabled}
        onDataChange={onDataChange}
      />
      <DataField
        label={t('assessments.score')}
        value={data.score}
        confidence={fieldConfidences.score || 0.5}
        categoryIndex={categoryIndex}
        fieldName="score"
        disabled={disabled}
        keyboardType="numeric"
        onDataChange={onDataChange}
      />
      <DataField
        label={t('assessments.assistanceRequired')}
        value={data.assistance_required ? 'Yes' : 'No'}
        confidence={fieldConfidences.assistance_required || 0.5}
        categoryIndex={categoryIndex}
        fieldName="assistance_required"
        disabled={disabled}
        onDataChange={onDataChange}
      />
      {data.notes && (
        <DataField
          label={t('common.notes')}
          value={data.notes}
          confidence={fieldConfidences.notes || 0.5}
          categoryIndex={categoryIndex}
          fieldName="notes"
          disabled={disabled}
          multiline
          onDataChange={onDataChange}
        />
      )}
    </>
  );
}

function IncidentFields({ data, fieldConfidences, categoryIndex, language, disabled, onDataChange }: FieldsProps) {
  const t = (key: string) => translations[language][key] || key;
  
  return (
    <>
      <DataField
        label={t('incidents.type')}
        value={data.type}
        confidence={fieldConfidences.type || 0.5}
        categoryIndex={categoryIndex}
        fieldName="type"
        disabled={disabled}
        onDataChange={onDataChange}
      />
      <DataField
        label={t('incidents.severity')}
        value={data.severity}
        confidence={fieldConfidences.severity || 0.5}
        categoryIndex={categoryIndex}
        fieldName="severity"
        disabled={disabled}
        onDataChange={onDataChange}
      />
      <DataField
        label={t('incidents.description')}
        value={data.description}
        confidence={fieldConfidences.description || 0.5}
        categoryIndex={categoryIndex}
        fieldName="description"
        disabled={disabled}
        multiline
        onDataChange={onDataChange}
      />
      {data.actions_taken && (
        <DataField
          label={t('incidents.actionsTaken')}
          value={data.actions_taken}
          confidence={fieldConfidences.actions_taken || 0.5}
          categoryIndex={categoryIndex}
          fieldName="actions_taken"
          disabled={disabled}
          multiline
          onDataChange={onDataChange}
        />
      )}
      <DataField
        label={t('incidents.followUpRequired')}
        value={data.follow_up_required ? 'Yes' : 'No'}
        confidence={fieldConfidences.follow_up_required || 0.5}
        categoryIndex={categoryIndex}
        fieldName="follow_up_required"
        disabled={disabled}
        onDataChange={onDataChange}
      />
    </>
  );
}

function CarePlanFields({ data, fieldConfidences, categoryIndex, language, disabled, onDataChange }: FieldsProps) {
  const t = (key: string) => translations[language][key] || key;
  
  return (
    <>
      <DataField
        label={t('carePlans.problem')}
        value={data.problem}
        confidence={fieldConfidences.problem || 0.5}
        categoryIndex={categoryIndex}
        fieldName="problem"
        disabled={disabled}
        multiline
        onDataChange={onDataChange}
      />
      <DataField
        label={t('carePlans.goal')}
        value={data.goal}
        confidence={fieldConfidences.goal || 0.5}
        categoryIndex={categoryIndex}
        fieldName="goal"
        disabled={disabled}
        multiline
        onDataChange={onDataChange}
      />
      <DataField
        label={t('carePlans.interventions')}
        value={Array.isArray(data.interventions) ? data.interventions.join(', ') : data.interventions}
        confidence={fieldConfidences.interventions || 0.5}
        categoryIndex={categoryIndex}
        fieldName="interventions"
        disabled={disabled}
        multiline
        onDataChange={onDataChange}
      />
      {data.evaluation && (
        <DataField
          label={t('carePlans.evaluation')}
          value={data.evaluation}
          confidence={fieldConfidences.evaluation || 0.5}
          categoryIndex={categoryIndex}
          fieldName="evaluation"
          disabled={disabled}
          multiline
          onDataChange={onDataChange}
        />
      )}
    </>
  );
}

function PainFields({ data, fieldConfidences, categoryIndex, language, disabled, onDataChange }: FieldsProps) {
  const t = (key: string) => translations[language][key] || key;
  
  return (
    <>
      <DataField
        label={t('assessments.painLocation')}
        value={data.location}
        confidence={fieldConfidences.location || 0.5}
        categoryIndex={categoryIndex}
        fieldName="location"
        disabled={disabled}
        onDataChange={onDataChange}
      />
      <DataField
        label={t('assessments.painIntensity')}
        value={data.intensity}
        confidence={fieldConfidences.intensity || 0.5}
        categoryIndex={categoryIndex}
        fieldName="intensity"
        disabled={disabled}
        keyboardType="numeric"
        onDataChange={onDataChange}
      />
      <DataField
        label={t('assessments.painCharacter')}
        value={data.character}
        confidence={fieldConfidences.character || 0.5}
        categoryIndex={categoryIndex}
        fieldName="character"
        disabled={disabled}
        onDataChange={onDataChange}
      />
      <DataField
        label={t('assessments.painDuration')}
        value={data.duration}
        confidence={fieldConfidences.duration || 0.5}
        categoryIndex={categoryIndex}
        fieldName="duration"
        disabled={disabled}
        onDataChange={onDataChange}
      />
      {data.aggravating_factors && (
        <DataField
          label={t('assessments.aggravatingFactors')}
          value={data.aggravating_factors}
          confidence={fieldConfidences.aggravating_factors || 0.5}
          categoryIndex={categoryIndex}
          fieldName="aggravating_factors"
          disabled={disabled}
          multiline
          onDataChange={onDataChange}
        />
      )}
      {data.relieving_factors && (
        <DataField
          label={t('assessments.relievingFactors')}
          value={data.relieving_factors}
          confidence={fieldConfidences.relieving_factors || 0.5}
          categoryIndex={categoryIndex}
          fieldName="relieving_factors"
          disabled={disabled}
          multiline
          onDataChange={onDataChange}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.lg,
  },
  emptyContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  categoryContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  categoryTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  confidenceBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  confidenceBadgeSmall: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  confidenceBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  confidenceBadgeTextSmall: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  validationErrorContainer: {
    backgroundColor: COLORS.error + '10',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
  },
  validationErrorText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.error,
    marginBottom: SPACING.xs,
  },
  fieldsContainer: {
    gap: SPACING.md,
  },
  fieldContainer: {
    marginBottom: SPACING.sm,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  fieldLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.secondary,
  },
  fieldInput: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: SPACING.touchTarget.min,
  },
  fieldInputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  fieldInputLowConfidence: {
    borderColor: COLORS.warning,
    borderWidth: 2,
    backgroundColor: COLORS.warning + '05',
  },
  fieldInputDisabled: {
    backgroundColor: COLORS.background,
    color: COLORS.text.disabled,
    opacity: 0.6,
  },
});
