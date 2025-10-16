/**
 * Test suite for Vital Signs Assessment Module
 * Tests compliance with JSH 2019, JASSO 2022, and international standards
 */

import { assessVitalSigns, PatientDemographics, VitalSigns } from '../vitalSignsAssessment';

describe('Vital Signs Assessment', () => {
  describe('Blood Pressure Assessment (JSH 2019)', () => {
    test('72-year-old male with BP 145 mmHg should be YELLOW (elderly range)', () => {
      const patient: PatientDemographics = { age: 72, gender: 'male' };
      const vitals: VitalSigns = { systolicBP: 145 };

      const result = assessVitalSigns(patient, vitals);

      expect(result.bloodPressure?.status).toBe('yellow');
      expect(result.bloodPressure?.statusLabel).toContain('Elevated');
      expect(result.bloodPressure?.guideline).toBe('JSH 2019');
    });

    test('45-year-old with BP 145 mmHg should be RED (adult <75 range)', () => {
      const patient: PatientDemographics = { age: 45, gender: 'female' };
      const vitals: VitalSigns = { systolicBP: 145 };

      const result = assessVitalSigns(patient, vitals);

      expect(result.bloodPressure?.status).toBe('red');
      expect(result.bloodPressure?.statusLabel).toContain('Hypertension');
    });

    test('78-year-old with BP 165 mmHg should be RED (elderly hypertension)', () => {
      const patient: PatientDemographics = { age: 78, gender: 'male' };
      const vitals: VitalSigns = { systolicBP: 165 };

      const result = assessVitalSigns(patient, vitals);

      expect(result.bloodPressure?.status).toBe('red');
      expect(result.bloodPressure?.statusLabel).toContain('Hypertension');
    });

    test('30-year-old with optimal BP 115 mmHg should be GREEN', () => {
      const patient: PatientDemographics = { age: 30, gender: 'male' };
      const vitals: VitalSigns = { systolicBP: 115 };

      const result = assessVitalSigns(patient, vitals);

      expect(result.bloodPressure?.status).toBe('green');
      expect(result.bloodPressure?.statusLabel).toContain('Optimal');
    });

    test('Pediatric patient should return warning', () => {
      const patient: PatientDemographics = { age: 12, gender: 'male' };
      const vitals: VitalSigns = { systolicBP: 110 };

      const result = assessVitalSigns(patient, vitals);

      expect(result.bloodPressure?.status).toBe('yellow');
      expect(result.bloodPressure?.statusLabel).toContain('Pediatric');
    });
  });

  describe('Heart Rate Assessment (Gender-Specific)', () => {
    test('35-year-old female athlete with HR 48 bpm should be GREEN', () => {
      const patient: PatientDemographics = {
        age: 35,
        gender: 'female',
        isAthlete: true,
      };
      const vitals: VitalSigns = { heartRate: 48 };

      const result = assessVitalSigns(patient, vitals);

      expect(result.heartRate?.status).toBe('green');
      expect(result.heartRate?.statusLabel).toContain('Normal');
    });

    test('35-year-old non-athlete female with HR 48 bpm should be YELLOW', () => {
      const patient: PatientDemographics = {
        age: 35,
        gender: 'female',
        isAthlete: false,
      };
      const vitals: VitalSigns = { heartRate: 48 };

      const result = assessVitalSigns(patient, vitals);

      expect(result.heartRate?.status).toBe('yellow');
      expect(result.heartRate?.statusLabel).toContain('Bradycardia');
    });

    test('40-year-old male with HR 75 bpm should be GREEN', () => {
      const patient: PatientDemographics = { age: 40, gender: 'male' };
      const vitals: VitalSigns = { heartRate: 75 };

      const result = assessVitalSigns(patient, vitals);

      expect(result.heartRate?.status).toBe('green');
      expect(result.heartRate?.statusLabel).toContain('Normal');
    });

    test('25-year-old female with HR 72 bpm should be GREEN', () => {
      const patient: PatientDemographics = { age: 25, gender: 'female' };
      const vitals: VitalSigns = { heartRate: 72 };

      const result = assessVitalSigns(patient, vitals);

      expect(result.heartRate?.status).toBe('green');
    });

    test('50-year-old male with HR 120 bpm should be RED', () => {
      const patient: PatientDemographics = { age: 50, gender: 'male' };
      const vitals: VitalSigns = { heartRate: 120 };

      const result = assessVitalSigns(patient, vitals);

      expect(result.heartRate?.status).toBe('red');
      expect(result.heartRate?.statusLabel).toContain('Severe Tachycardia');
    });
  });

  describe('BMI Assessment (JASSO 2022)', () => {
    test('28-year-old male with BMI 24.5 should be YELLOW (Japanese standard)', () => {
      const patient: PatientDemographics = { age: 28, gender: 'male' };
      const vitals: VitalSigns = {
        weight: 70,
        height: 169, // BMI = 24.5
      };

      const result = assessVitalSigns(patient, vitals);

      expect(result.bmi?.status).toBe('yellow');
      expect(result.bmi?.statusLabel).toContain('Overweight');
      expect(result.bmi?.clinicalNote).toContain('Western classification: Normal');
      expect(result.bmi?.guideline).toBe('JASSO 2022');
    });

    test('BMI 22.0 should be GREEN (optimal for Japanese)', () => {
      const patient: PatientDemographics = { age: 35, gender: 'female' };
      const vitals: VitalSigns = {
        weight: 55,
        height: 158, // BMI = 22.0
      };

      const result = assessVitalSigns(patient, vitals);

      expect(result.bmi?.status).toBe('green');
      expect(result.bmi?.statusLabel).toContain('Normal Weight');
    });

    test('BMI 26.0 should be ORANGE (Obese Class I)', () => {
      const patient: PatientDemographics = { age: 45, gender: 'male' };
      const vitals: VitalSigns = {
        weight: 75,
        height: 170, // BMI = 26.0
      };

      const result = assessVitalSigns(patient, vitals);

      expect(result.bmi?.status).toBe('orange');
      expect(result.bmi?.statusLabel).toContain('Obese Class I');
      expect(result.bmi?.guideline).toBe('JASSO 2022');
    });

    test('BMI 17.0 should be BLUE (underweight)', () => {
      const patient: PatientDemographics = { age: 25, gender: 'female' };
      const vitals: VitalSigns = {
        weight: 45,
        height: 163, // BMI = 16.9
      };

      const result = assessVitalSigns(patient, vitals);

      expect(result.bmi?.status).toBe('blue');
      expect(result.bmi?.statusLabel).toContain('Underweight');
    });

    test('BMI 36.0 should be RED (high-degree obesity)', () => {
      const patient: PatientDemographics = { age: 50, gender: 'male' };
      const vitals: VitalSigns = {
        weight: 100,
        height: 167, // BMI = 35.9
      };

      const result = assessVitalSigns(patient, vitals);

      expect(result.bmi?.status).toBe('red');
      expect(result.bmi?.statusLabel).toContain('High-Degree Obesity');
    });
  });

  describe('SpO2 Assessment (COPD-Aware)', () => {
    test('68-year-old with COPD and SpO2 91% should be GREEN', () => {
      const patient: PatientDemographics = {
        age: 68,
        gender: 'male',
        hasCOPD: true,
      };
      const vitals: VitalSigns = { spO2: 91 };

      const result = assessVitalSigns(patient, vitals);

      expect(result.spO2?.status).toBe('green');
      expect(result.spO2?.statusLabel).toContain('Acceptable for COPD');
      expect(result.spO2?.clinicalNote).toContain('88-92% may be normal');
    });

    test('40-year-old without COPD and SpO2 91% should be YELLOW', () => {
      const patient: PatientDemographics = {
        age: 40,
        gender: 'female',
        hasCOPD: false,
      };
      const vitals: VitalSigns = { spO2: 91 };

      const result = assessVitalSigns(patient, vitals);

      expect(result.spO2?.status).toBe('yellow');
      expect(result.spO2?.statusLabel).toContain('Mild Hypoxemia');
    });

    test('SpO2 98% should be GREEN (normal)', () => {
      const patient: PatientDemographics = { age: 50, gender: 'male' };
      const vitals: VitalSigns = { spO2: 98 };

      const result = assessVitalSigns(patient, vitals);

      expect(result.spO2?.status).toBe('green');
    });

    test('SpO2 85% should be RED even with COPD', () => {
      const patient: PatientDemographics = {
        age: 70,
        gender: 'male',
        hasCOPD: true,
      };
      const vitals: VitalSigns = { spO2: 84 };

      const result = assessVitalSigns(patient, vitals);

      expect(result.spO2?.status).toBe('red');
      expect(result.spO2?.statusLabel).toContain('Critical Hypoxemia');
    });
  });

  describe('Temperature Assessment (Elderly Baseline-Aware)', () => {
    test('78-year-old with baseline 36.2°C, current 37.5°C should flag potential fever', () => {
      const patient: PatientDemographics = {
        age: 78,
        gender: 'female',
        personalBaselineTemp: 36.2,
      };
      const vitals: VitalSigns = { temperature: 37.5 };

      const result = assessVitalSigns(patient, vitals);

      expect(result.temperature?.status).toBe('yellow');
      expect(result.temperature?.statusLabel).toContain('Elevated from Baseline');
      expect(result.temperature?.clinicalNote).toContain('1.0°C above personal baseline');
    });

    test('78-year-old with baseline 36.2°C, current 37.8°C should be RED', () => {
      const patient: PatientDemographics = {
        age: 78,
        gender: 'male',
        personalBaselineTemp: 36.2,
      };
      const vitals: VitalSigns = { temperature: 37.8 };

      const result = assessVitalSigns(patient, vitals);

      expect(result.temperature?.status).toBe('red');
      expect(result.temperature?.statusLabel).toContain('Significant Fever');
    });

    test('40-year-old with temp 37.0°C should be GREEN', () => {
      const patient: PatientDemographics = { age: 40, gender: 'female' };
      const vitals: VitalSigns = { temperature: 37.0 };

      const result = assessVitalSigns(patient, vitals);

      expect(result.temperature?.status).toBe('green');
    });

    test('Temperature 34.5°C should be RED (hypothermia)', () => {
      const patient: PatientDemographics = { age: 30, gender: 'male' };
      const vitals: VitalSigns = { temperature: 34.5 };

      const result = assessVitalSigns(patient, vitals);

      expect(result.temperature?.status).toBe('red');
      expect(result.temperature?.statusLabel).toContain('Hypothermia');
    });

    test('Impossible temperature 50°C should be flagged as data error', () => {
      const patient: PatientDemographics = { age: 30, gender: 'male' };
      const vitals: VitalSigns = { temperature: 50 };

      const result = assessVitalSigns(patient, vitals);

      expect(result.temperature?.status).toBe('red');
      expect(result.temperature?.statusLabel).toContain('Data Entry Error');
    });
  });

  describe('Respiratory Rate Assessment', () => {
    test('RR 16/min should be GREEN', () => {
      const patient: PatientDemographics = { age: 35, gender: 'female' };
      const vitals: VitalSigns = { respiratoryRate: 16 };

      const result = assessVitalSigns(patient, vitals);

      expect(result.respiratoryRate?.status).toBe('green');
    });

    test('RR 22/min should be YELLOW (early warning)', () => {
      const patient: PatientDemographics = { age: 45, gender: 'male' };
      const vitals: VitalSigns = { respiratoryRate: 22 };

      const result = assessVitalSigns(patient, vitals);

      expect(result.respiratoryRate?.status).toBe('yellow');
      expect(result.respiratoryRate?.statusLabel).toContain('Early Warning');
    });

    test('RR 28/min should be RED (impending crisis)', () => {
      const patient: PatientDemographics = { age: 50, gender: 'female' };
      const vitals: VitalSigns = { respiratoryRate: 28 };

      const result = assessVitalSigns(patient, vitals);

      expect(result.respiratoryRate?.status).toBe('red');
      expect(result.respiratoryRate?.statusLabel).toContain('Severe Tachypnea');
      expect(result.respiratoryRate?.clinicalNote).toContain('impending crisis');
    });

    test('RR 8/min should be RED (severe bradypnea)', () => {
      const patient: PatientDemographics = { age: 40, gender: 'male' };
      const vitals: VitalSigns = { respiratoryRate: 8 };

      const result = assessVitalSigns(patient, vitals);

      expect(result.respiratoryRate?.status).toBe('red');
      expect(result.respiratoryRate?.statusLabel).toContain('Severe Bradypnea');
    });
  });

  describe('Multiple Vitals Assessment', () => {
    test('Should assess all provided vitals simultaneously', () => {
      const patient: PatientDemographics = { age: 45, gender: 'male' };
      const vitals: VitalSigns = {
        systolicBP: 125,
        heartRate: 75,
        temperature: 36.8,
        spO2: 97,
        respiratoryRate: 16,
        weight: 70,
        height: 170,
      };

      const result = assessVitalSigns(patient, vitals);

      expect(result.bloodPressure).toBeDefined();
      expect(result.heartRate).toBeDefined();
      expect(result.temperature).toBeDefined();
      expect(result.spO2).toBeDefined();
      expect(result.respiratoryRate).toBeDefined();
      expect(result.bmi).toBeDefined();

      // BP should be YELLOW (elevated for age <75)
      expect(result.bloodPressure?.status).toBe('yellow');
      // HR should be GREEN for male 60-90 range
      expect(result.heartRate?.status).toBe('green');
      // All others should be GREEN
      expect(result.temperature?.status).toBe('green');
      expect(result.spO2?.status).toBe('green');
      expect(result.respiratoryRate?.status).toBe('green');
      // BMI 24.2 should be YELLOW for Japanese
      expect(result.bmi?.status).toBe('yellow');
    });

    test('Should handle partial vitals (only some values provided)', () => {
      const patient: PatientDemographics = { age: 35, gender: 'female' };
      const vitals: VitalSigns = {
        heartRate: 80,
        spO2: 98,
      };

      const result = assessVitalSigns(patient, vitals);

      expect(result.bloodPressure).toBeUndefined();
      expect(result.heartRate).toBeDefined();
      expect(result.temperature).toBeUndefined();
      expect(result.spO2).toBeDefined();
      expect(result.respiratoryRate).toBeUndefined();
      expect(result.bmi).toBeUndefined();
    });
  });

  describe('Edge Cases and Validation', () => {
    test('BMI calculation requires both weight and height', () => {
      const patient: PatientDemographics = { age: 30, gender: 'male' };
      const vitals1: VitalSigns = { weight: 70 }; // Missing height
      const vitals2: VitalSigns = { height: 170 }; // Missing weight

      const result1 = assessVitalSigns(patient, vitals1);
      const result2 = assessVitalSigns(patient, vitals2);

      expect(result1.bmi).toBeUndefined();
      expect(result2.bmi).toBeUndefined();
    });

    test('Elderly patient without baseline temp uses standard ranges', () => {
      const patient: PatientDemographics = {
        age: 75,
        gender: 'female',
        // No personalBaselineTemp provided
      };
      const vitals: VitalSigns = { temperature: 37.0 };

      const result = assessVitalSigns(patient, vitals);

      expect(result.temperature?.status).toBe('green');
      expect(result.temperature?.statusLabel).toContain('Normal');
    });
  });
});
