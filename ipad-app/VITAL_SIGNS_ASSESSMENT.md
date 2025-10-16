# Vital Signs Assessment System

## Overview
Implemented comprehensive vital signs color-coding system compliant with Japanese medical standards (JSH 2019, JASSO 2022) with age, gender, and condition awareness.

## Implementation

### Files Created/Modified

#### New Files:
1. **`src/utils/vitalSignsAssessment.ts`** - Core assessment module
2. **`src/utils/__tests__/vitalSignsAssessment.test.ts`** - Comprehensive test suite
3. **`src/utils/index.ts`** - Module exports

#### Modified Files:
1. **`src/screens/VitalsCaptureScreen.tsx`** - Integrated new assessment system

## Medical Guidelines Implemented

### Blood Pressure (JSH 2019 - Japanese Society of Hypertension)

**Adults 18-74 years:**
- 🟢 GREEN: < 120 mmHg (Optimal)
- 🟡 YELLOW: 120-139 mmHg (Elevated/High-Normal)
- 🔴 RED: ≥ 140 mmHg or < 90 mmHg (Hypertension/Hypotension)

**Adults ≥75 years:**
- 🟢 GREEN: < 140 mmHg (Optimal for elderly)
- 🟡 YELLOW: 140-159 mmHg (Elevated for elderly)
- 🔴 RED: ≥ 160 mmHg or < 90 mmHg (Hypertension/Hypotension)

**Key Difference:** Elderly patients have higher acceptable BP targets

### Heart Rate (Gender-Specific, International Standards)

**Adult Men (18+):**
- 🟢 GREEN: 60-90 bpm
- 🟡 YELLOW: 45-59 bpm or 91-105 bpm
- 🔴 RED: < 45 bpm or > 105 bpm

**Adult Women (18+):**
- 🟢 GREEN: 65-95 bpm
- 🟡 YELLOW: 50-64 bpm or 96-110 bpm
- 🔴 RED: < 50 bpm or > 110 bpm

**Athletes (when `isAthlete: true`):**
- 🟢 GREEN: 40-90 bpm (men) / 40-95 bpm (women)
- Bradycardia 40-59 bpm is considered normal

### BMI (JASSO 2022 - Japan Society for the Study of Obesity)

**Japanese Standards (ALL ages):**
- 🔵 BLUE: < 18.5 kg/m² (Underweight)
- 🟢 GREEN: 18.5-22.9 kg/m² (Normal - optimal for Japanese)
- 🟡 YELLOW: 23.0-24.9 kg/m² (Overweight - **LOWER than Western!**)
- 🟠 ORANGE: 25.0-29.9 kg/m² (Obese Class I)
- 🔴 RED: ≥ 30.0 kg/m² (Obese Class II+)

**Critical Difference:**
- Japanese obesity threshold: BMI ≥ 25 (vs Western ≥ 30)
- Reason: Japanese individuals develop obesity-related disorders at lower BMI
- Example: BMI 24.5 = 🟡 YELLOW in Japan, GREEN in Western standards

### SpO2 (COPD-Aware)

**Standard (All ages):**
- 🟢 GREEN: 95-100%
- 🟡 YELLOW: 90-94%
- 🔴 RED: < 90%

**COPD Patients (when `hasCOPD: true`):**
- 🟢 GREEN: 88-100% (lower acceptable range)
- 🟡 YELLOW: 85-87%
- 🔴 RED: < 85%
- Note: "Baseline 88-92% may be normal for COPD patients"

### Temperature (Elderly Baseline-Aware)

**Standard (Adults 18-64):**
- 🟢 GREEN: 36.0-37.5°C
- 🟡 YELLOW: 35.0-35.9°C or 37.6-38.4°C
- 🔴 RED: < 35.0°C or ≥ 38.5°C

**Elderly ≥65 (with personal baseline):**
- 🟡 YELLOW: ≥ 1.0°C above personal baseline
- 🔴 RED: ≥ 1.5°C above personal baseline
- Note: "Elderly patients may not mount typical fever responses"

### Respiratory Rate (Universal for Adults)

**All Ages 18+:**
- 🟢 GREEN: 12-20 breaths/min
- 🟡 YELLOW: 10-11 or 21-24 breaths/min (Early warning sign)
- 🔴 RED: < 10 or ≥ 25 breaths/min (Impending crisis)

## Usage Example

```typescript
import { assessVitalSigns, PatientDemographics, VitalSigns } from '@utils';

// Example 1: 35-year-old male athlete with low HR
const patient1: PatientDemographics = {
  age: 35,
  gender: 'male',
  isAthlete: true,
};

const vitals1: VitalSigns = {
  heartRate: 48, // Low, but normal for athlete
};

const result1 = assessVitalSigns(patient1, vitals1);
// result1.heartRate.status = 'green' ✅

// Example 2: 28-year-old with BMI 24.5 (Japanese standard)
const patient2: PatientDemographics = {
  age: 28,
  gender: 'female',
};

const vitals2: VitalSigns = {
  weight: 70,  // kg
  height: 169, // cm
};

const result2 = assessVitalSigns(patient2, vitals2);
// result2.bmi.status = 'yellow' (BMI 24.5)
// result2.bmi.clinicalNote = "...Western classification: Normal weight."

// Example 3: 78-year-old with elevated temp from baseline
const patient3: PatientDemographics = {
  age: 78,
  gender: 'female',
  personalBaselineTemp: 36.2,
};

const vitals3: VitalSigns = {
  temperature: 37.5, // 1.3°C above baseline
};

const result3 = assessVitalSigns(patient3, vitals3);
// result3.temperature.status = 'yellow'
// result3.temperature.statusLabel = "Elevated from Baseline (Elderly)"
```

## Integration in VitalsCaptureScreen

The system is automatically integrated:
1. Reads patient age/gender from `currentPatient`
2. Assesses vitals in real-time as they're entered
3. Updates card colors using JSH 2019, JASSO 2022, and international standards
4. Handles missing demographics gracefully (defaults to age 40, gender from patient)

## Test Coverage

Comprehensive test suite with 40+ test cases covering:
- ✅ All 5 requested test cases from requirements
- ✅ Age-dependent BP assessment (72-year-old, 45-year-old)
- ✅ Gender-specific HR (female athlete with 48 bpm)
- ✅ Japanese BMI standards (24.5 = YELLOW)
- ✅ COPD-aware SpO2 (91% = GREEN for COPD)
- ✅ Elderly baseline temperature tracking
- ✅ Edge cases and validation

Run tests:
```bash
npm test src/utils/__tests__/vitalSignsAssessment.test.ts
```

## PMDA Compliance

- **JSH 2019:** All blood pressure ranges cite Japanese guidelines
- **JASSO 2022:** BMI classification follows Japanese obesity standards
- **Documentation:** Each function includes JSDoc with medical guideline references
- **Traceability:** Guideline name included in every assessment result
- **Validation:** Data entry errors flagged (e.g., temperature > 45°C)

## Benefits

1. **Clinical Accuracy:** Age and gender-appropriate ranges
2. **Cultural Relevance:** Japanese BMI thresholds prevent underdiagnosis
3. **Patient Safety:** Early warning signs (RR > 20, fever in elderly)
4. **Regulatory Compliance:** PMDA-ready with guideline citations
5. **Multilingual:** Both English and Japanese labels/notes

## Key Fixes from Previous System

| Issue | Old System | New System |
|-------|-----------|------------|
| Low HR (48 bpm) shows RED | Fixed range 51-110 | 🟢 GREEN for male athlete |
| BMI 24.5 shows GREEN | Western standards | 🟡 YELLOW per JASSO 2022 |
| Same BP for all ages | 90-140 universal | Age-specific (JSH 2019) |
| Same HR for both genders | Universal range | Gender-specific ranges |
| SpO2 91% always YELLOW | Fixed 95-100 | 🟢 GREEN for COPD |
| No baseline temp tracking | Static ranges | Elderly baseline awareness |

## Future Enhancements (Optional)

- Waist circumference for visceral fat risk (JASSO 2022)
- Pediatric percentile charts integration
- Trend analysis (deteriorating vitals over time)
- NEWS2 score calculation (UK early warning score)
- Integration with patient risk factors from EHR
