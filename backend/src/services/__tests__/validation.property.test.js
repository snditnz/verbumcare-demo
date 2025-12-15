/**
 * Property-Based Tests for Validation Functions
 * Tests Property 4 from design document
 */

import { describe, it, expect } from '@jest/globals';
import fc from 'fast-check';
import categorizationService from '../categorizationService.js';

describe('Validation - Property-Based Tests', () => {

  /**
   * Property 4: Vital signs validation
   * Validates: Requirements 1.5
   * 
   * For any extracted vital signs data, values SHALL pass clinical range
   * validation before database insertion
   */
  describe('Property 4: Vital Signs Validation', () => {

    // Arbitraries for generating vital signs data
    const validBloodPressureArb = fc.record({
      systolic: fc.integer({ min: 70, max: 250 }),
      diastolic: fc.integer({ min: 40, max: 150 })
    }).filter(bp => bp.systolic > bp.diastolic); // Systolic must be > diastolic

    const invalidBloodPressureArb = fc.oneof(
      // Out of range systolic
      fc.record({
        systolic: fc.oneof(
          fc.integer({ min: -100, max: 69 }),
          fc.integer({ min: 251, max: 500 })
        ),
        diastolic: fc.integer({ min: 40, max: 150 })
      }),
      // Out of range diastolic
      fc.record({
        systolic: fc.integer({ min: 70, max: 250 }),
        diastolic: fc.oneof(
          fc.integer({ min: -100, max: 39 }),
          fc.integer({ min: 151, max: 300 })
        )
      }),
      // Systolic <= diastolic
      fc.record({
        systolic: fc.integer({ min: 70, max: 150 }),
        diastolic: fc.integer({ min: 70, max: 150 })
      }).filter(bp => bp.systolic <= bp.diastolic)
    );

    const validHeartRateArb = fc.integer({ min: 30, max: 250 });
    const invalidHeartRateArb = fc.oneof(
      fc.integer({ min: -100, max: 29 }),
      fc.integer({ min: 251, max: 500 })
    );

    const validTemperatureArb = fc.double({ min: 34, max: 42, noNaN: true });
    const invalidTemperatureArb = fc.oneof(
      fc.double({ min: -10, max: 33.9, noNaN: true }),
      fc.double({ min: 42.1, max: 50, noNaN: true })
    );

    const validRespiratoryRateArb = fc.integer({ min: 8, max: 40 });
    const invalidRespiratoryRateArb = fc.oneof(
      fc.integer({ min: -50, max: 7 }),
      fc.integer({ min: 41, max: 100 })
    );

    const validOxygenSaturationArb = fc.integer({ min: 50, max: 100 });
    const invalidOxygenSaturationArb = fc.oneof(
      fc.integer({ min: -50, max: 49 }),
      fc.integer({ min: 101, max: 200 })
    );

    const validWeightArb = fc.double({ min: 20, max: 300, noNaN: true });
    const invalidWeightArb = fc.oneof(
      fc.double({ min: -50, max: 19.9, noNaN: true }),
      fc.double({ min: 300.1, max: 500, noNaN: true })
    );

    const validHeightArb = fc.double({ min: 100, max: 250, noNaN: true });
    const invalidHeightArb = fc.oneof(
      fc.double({ min: -50, max: 99.9, noNaN: true }),
      fc.double({ min: 250.1, max: 400, noNaN: true })
    );

    it('Property 4.1: Valid blood pressure should pass validation', () => {
      fc.assert(
        fc.property(validBloodPressureArb, (bp) => {
          const vitalsData = { blood_pressure: bp };
          const result = categorizationService.validateVitalSigns(vitalsData);

          // Should have no errors for valid BP
          expect(result.errors.filter(e => e.includes('Blood pressure'))).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 4.2: Invalid blood pressure should fail validation', () => {
      fc.assert(
        fc.property(invalidBloodPressureArb, (bp) => {
          const vitalsData = { blood_pressure: bp };
          const result = categorizationService.validateVitalSigns(vitalsData);

          // Should have at least one error for invalid BP
          expect(result.valid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 4.3: Valid heart rate should pass validation', () => {
      fc.assert(
        fc.property(validHeartRateArb, (hr) => {
          const vitalsData = { heart_rate: hr };
          const result = categorizationService.validateVitalSigns(vitalsData);

          // Should have no errors for valid HR
          expect(result.errors.filter(e => e.includes('Heart rate'))).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 4.4: Invalid heart rate should fail validation', () => {
      fc.assert(
        fc.property(invalidHeartRateArb, (hr) => {
          const vitalsData = { heart_rate: hr };
          const result = categorizationService.validateVitalSigns(vitalsData);

          // Should have at least one error for invalid HR
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.includes('Heart rate'))).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 4.5: Valid temperature should pass validation', () => {
      fc.assert(
        fc.property(validTemperatureArb, (temp) => {
          const vitalsData = { temperature: temp };
          const result = categorizationService.validateVitalSigns(vitalsData);

          // Should have no errors for valid temperature
          expect(result.errors.filter(e => e.includes('Temperature'))).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 4.6: Invalid temperature should fail validation', () => {
      fc.assert(
        fc.property(invalidTemperatureArb, (temp) => {
          const vitalsData = { temperature: temp };
          const result = categorizationService.validateVitalSigns(vitalsData);

          // Should have at least one error for invalid temperature
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.includes('Temperature'))).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 4.7: Valid respiratory rate should pass validation', () => {
      fc.assert(
        fc.property(validRespiratoryRateArb, (rr) => {
          const vitalsData = { respiratory_rate: rr };
          const result = categorizationService.validateVitalSigns(vitalsData);

          // Should have no errors for valid RR
          expect(result.errors.filter(e => e.includes('Respiratory rate'))).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 4.8: Invalid respiratory rate should fail validation', () => {
      fc.assert(
        fc.property(invalidRespiratoryRateArb, (rr) => {
          const vitalsData = { respiratory_rate: rr };
          const result = categorizationService.validateVitalSigns(vitalsData);

          // Should have at least one error for invalid RR
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.includes('Respiratory rate'))).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 4.9: Valid oxygen saturation should pass validation', () => {
      fc.assert(
        fc.property(validOxygenSaturationArb, (spo2) => {
          const vitalsData = { oxygen_saturation: spo2 };
          const result = categorizationService.validateVitalSigns(vitalsData);

          // Should have no errors for valid SpO2
          expect(result.errors.filter(e => e.includes('Oxygen saturation') && !e.includes('Low'))).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 4.10: Invalid oxygen saturation should fail validation', () => {
      fc.assert(
        fc.property(invalidOxygenSaturationArb, (spo2) => {
          const vitalsData = { oxygen_saturation: spo2 };
          const result = categorizationService.validateVitalSigns(vitalsData);

          // Should have at least one error for invalid SpO2
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.includes('Oxygen saturation'))).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 4.11: Valid weight should pass validation', () => {
      fc.assert(
        fc.property(validWeightArb, (weight) => {
          const vitalsData = { weight_kg: weight };
          const result = categorizationService.validateVitalSigns(vitalsData);

          // Should have no errors for valid weight
          expect(result.errors.filter(e => e.includes('Weight'))).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 4.12: Invalid weight should fail validation', () => {
      fc.assert(
        fc.property(invalidWeightArb, (weight) => {
          const vitalsData = { weight_kg: weight };
          const result = categorizationService.validateVitalSigns(vitalsData);

          // Should have at least one error for invalid weight
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.includes('Weight'))).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 4.13: Valid height should pass validation', () => {
      fc.assert(
        fc.property(validHeightArb, (height) => {
          const vitalsData = { height_cm: height };
          const result = categorizationService.validateVitalSigns(vitalsData);

          // Should have no errors for valid height
          expect(result.errors.filter(e => e.includes('Height'))).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 4.14: Invalid height should fail validation', () => {
      fc.assert(
        fc.property(invalidHeightArb, (height) => {
          const vitalsData = { height_cm: height };
          const result = categorizationService.validateVitalSigns(vitalsData);

          // Should have at least one error for invalid height
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.includes('Height'))).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 4.15: Null/undefined values should not cause validation errors', () => {
      fc.assert(
        fc.property(fc.constant(null), fc.constant(undefined), (nullVal, undefinedVal) => {
          const vitalsData = {
            blood_pressure: { systolic: nullVal, diastolic: undefinedVal },
            heart_rate: nullVal,
            temperature: undefinedVal,
            respiratory_rate: nullVal,
            oxygen_saturation: undefinedVal
          };
          const result = categorizationService.validateVitalSigns(vitalsData);

          // Null/undefined should not cause errors (just missing data)
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Additional validation tests for other data types
   */
  describe('Medication Validation', () => {
    
    it('Should require medication name, dose, route, and time', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          fc.constantFrom('oral', 'IV', 'IM', 'SC'),
          fc.string({ minLength: 5, maxLength: 5 }).filter(s => s.trim().length > 0), // HH:MM
          (name, dose, route, time) => {
            const medicationData = {
              medication_name: name,
              dose: dose,
              route: route,
              time: time
            };
            const result = categorizationService.validateMedication(medicationData);

            // Should pass validation with all required fields
            expect(result.valid).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Should fail validation when required fields are missing', () => {
      const incompleteMedication = {
        medication_name: '', // Empty
        dose: 'test',
        route: 'oral',
        time: '09:00'
      };
      const result = categorizationService.validateMedication(incompleteMedication);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('name'))).toBe(true);
    });
  });

  describe('Incident Validation', () => {
    
    it('Should validate severity levels', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('low', 'medium', 'high', 'critical'),
          (severity) => {
            const incidentData = {
              type: 'fall',
              severity: severity,
              description: 'Test incident',
              follow_up_required: true
            };
            const result = categorizationService.validateIncident(incidentData);

            // Should pass validation with valid severity
            expect(result.valid).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('Should reject invalid severity levels', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !['low', 'medium', 'high', 'critical'].includes(s.toLowerCase())),
          (invalidSeverity) => {
            const incidentData = {
              type: 'fall',
              severity: invalidSeverity,
              description: 'Test incident',
              follow_up_required: true
            };
            const result = categorizationService.validateIncident(incidentData);

            // Should fail validation with invalid severity
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('severity'))).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Pain Validation', () => {
    
    it('Should validate pain intensity 0-10', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),
          (intensity) => {
            const painData = {
              intensity: intensity,
              location: 'lower back'
            };
            const result = categorizationService.validatePain(painData);

            // Should pass validation for 0-10 range
            expect(result.valid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Should reject pain intensity outside 0-10', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer({ min: -100, max: -1 }),
            fc.integer({ min: 11, max: 100 })
          ),
          (invalidIntensity) => {
            const painData = {
              intensity: invalidIntensity,
              location: 'lower back'
            };
            const result = categorizationService.validatePain(painData);

            // Should fail validation for out-of-range intensity
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('intensity'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
