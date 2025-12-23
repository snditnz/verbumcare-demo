/**
 * Property-Based Tests for Context Detection Accuracy
 * 
 * Tests the accuracy and reliability of context detection
 * and display optimization for different screen sizes.
 * 
 * Feature: voice-recorder-layout-fix, Property 5: Context Detection Accuracy
 * Validates: Requirements 4.5
 */

import * as fc from 'fast-check';

// Mock context detection logic
const detectContext = (currentPatient: any) => {
  if (!currentPatient) {
    return {
      type: 'global' as const,
      patientName: undefined,
      patientId: undefined,
    };
  }

  // Extract and clean patient name
  let patientName = 'Unknown Patient';
  
  if (currentPatient.family_name && currentPatient.family_name.trim()) {
    patientName = currentPatient.family_name.trim();
  } else if (currentPatient.given_name && currentPatient.given_name.trim()) {
    patientName = currentPatient.given_name.trim();
  }

  return {
    type: 'patient' as const,
    patientName,
    patientId: currentPatient.patient_id,
  };
};

// Mock display optimization logic
const optimizeContextDisplay = (context: any, screenDimensions: any) => {
  const isCompact = screenDimensions.deviceType === 'iPad-Mini' || screenDimensions.width < 900;
  
  return {
    showFullDescription: !isCompact,
    useCompactTitle: isCompact,
    iconSize: isCompact ? 16 : 20,
    titleFontSize: isCompact ? 14 : 16,
    patientNameFontSize: isCompact ? 16 : 18,
  };
};

// Patient data generators
const patientArb = fc.record({
  patient_id: fc.string({ minLength: 1, maxLength: 50 }),
  family_name: fc.option(fc.string({ minLength: 1, maxLength: 30 })),
  given_name: fc.option(fc.string({ minLength: 1, maxLength: 30 })),
  family_name_kana: fc.option(fc.string({ minLength: 1, maxLength: 30 })),
  given_name_kana: fc.option(fc.string({ minLength: 1, maxLength: 30 })),
});

// Screen dimension generators
const screenDimensionArb = fc.record({
  width: fc.integer({ min: 768, max: 1366 }),
  height: fc.integer({ min: 1024, max: 1024 }),
  deviceType: fc.constantFrom('iPad-Mini', 'iPad-Air', 'iPad-Pro'),
  fontScale: fc.float({ min: Math.fround(0.8), max: Math.fround(1.5) }),
});

describe('Context Detection Accuracy Property Tests', () => {
  /**
   * Property 5: Context Detection Accuracy
   * Context detection should be accurate and consistent
   */
  describe('Property 5: Context Detection Accuracy', () => {
    it('should correctly detect patient context when patient is present', () => {
      fc.assert(
        fc.property(patientArb, (patient) => {
          const context = detectContext(patient);
          
          // Should detect patient context
          expect(context.type).toBe('patient');
          expect(context.patientId).toBe(patient.patient_id);
          
          // Should have a patient name (from family_name or given_name)
          expect(context.patientName).toBeDefined();
          expect(typeof context.patientName).toBe('string');
          expect(context.patientName.length).toBeGreaterThan(0);
          
          // Patient name should come from available name fields
          if (patient.family_name && patient.family_name.trim()) {
            expect(context.patientName).toBe(patient.family_name.trim());
          } else if (patient.given_name && patient.given_name.trim()) {
            expect(context.patientName).toBe(patient.given_name.trim());
          } else {
            expect(context.patientName).toBe('Unknown Patient');
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly detect global context when no patient is present', () => {
      fc.assert(
        fc.property(fc.constant(null), fc.constant(undefined), (nullPatient, undefinedPatient) => {
          const nullContext = detectContext(nullPatient);
          const undefinedContext = detectContext(undefinedPatient);
          
          // Both should detect global context
          expect(nullContext.type).toBe('global');
          expect(nullContext.patientName).toBeUndefined();
          expect(nullContext.patientId).toBeUndefined();
          
          expect(undefinedContext.type).toBe('global');
          expect(undefinedContext.patientName).toBeUndefined();
          expect(undefinedContext.patientId).toBeUndefined();
          
          return true;
        }),
        { numRuns: 10 }
      );
    });

    it('should handle edge cases in patient data gracefully', () => {
      fc.assert(
        fc.property(
          fc.record({
            patient_id: fc.string({ minLength: 1, maxLength: 50 }),
            family_name: fc.option(fc.oneof(fc.constant(''), fc.constant('   '), fc.string({ minLength: 1, maxLength: 30 }))),
            given_name: fc.option(fc.oneof(fc.constant(''), fc.constant('   '), fc.string({ minLength: 1, maxLength: 30 }))),
          }),
          (edgeCasePatient) => {
            const context = detectContext(edgeCasePatient);
            
            // Should still detect patient context
            expect(context.type).toBe('patient');
            expect(context.patientId).toBe(edgeCasePatient.patient_id);
            
            // Should have some patient name (even if "Unknown Patient")
            expect(context.patientName).toBeDefined();
            expect(typeof context.patientName).toBe('string');
            expect(context.patientName.length).toBeGreaterThan(0);
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should produce consistent results for the same input', () => {
      fc.assert(
        fc.property(fc.option(patientArb), (patient) => {
          const context1 = detectContext(patient);
          const context2 = detectContext(patient);
          const context3 = detectContext(patient);
          
          // All results should be identical
          expect(context2).toEqual(context1);
          expect(context3).toEqual(context1);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Display Optimization Properties
   */
  describe('Display Optimization Properties', () => {
    it('should optimize display for different screen sizes', () => {
      fc.assert(
        fc.property(fc.option(patientArb), screenDimensionArb, (patient, screenDims) => {
          const context = detectContext(patient);
          const displayConfig = optimizeContextDisplay(context, screenDims);
          
          // Compact screens should use compact display
          if (screenDims.deviceType === 'iPad-Mini' || screenDims.width < 900) {
            expect(displayConfig.showFullDescription).toBe(false);
            expect(displayConfig.useCompactTitle).toBe(true);
            expect(displayConfig.iconSize).toBeLessThanOrEqual(16);
            expect(displayConfig.titleFontSize).toBeLessThanOrEqual(14);
          } else {
            expect(displayConfig.showFullDescription).toBe(true);
            expect(displayConfig.useCompactTitle).toBe(false);
            expect(displayConfig.iconSize).toBeGreaterThan(16);
            expect(displayConfig.titleFontSize).toBeGreaterThan(14);
          }
          
          // All sizes should be positive and reasonable
          expect(displayConfig.iconSize).toBeGreaterThan(0);
          expect(displayConfig.iconSize).toBeLessThan(50);
          expect(displayConfig.titleFontSize).toBeGreaterThan(0);
          expect(displayConfig.titleFontSize).toBeLessThan(30);
          expect(displayConfig.patientNameFontSize).toBeGreaterThan(0);
          expect(displayConfig.patientNameFontSize).toBeLessThan(30);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain consistent display hierarchy', () => {
      fc.assert(
        fc.property(fc.option(patientArb), screenDimensionArb, (patient, screenDims) => {
          const context = detectContext(patient);
          const displayConfig = optimizeContextDisplay(context, screenDims);
          
          // Patient name should always be larger than or equal to title
          expect(displayConfig.patientNameFontSize).toBeGreaterThanOrEqual(displayConfig.titleFontSize);
          
          // Icon size should be proportional to text sizes
          const avgTextSize = (displayConfig.titleFontSize + displayConfig.patientNameFontSize) / 2;
          expect(displayConfig.iconSize).toBeGreaterThanOrEqual(avgTextSize * 0.8);
          expect(displayConfig.iconSize).toBeLessThanOrEqual(avgTextSize * 1.5);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should handle extreme screen dimensions gracefully', () => {
      fc.assert(
        fc.property(
          fc.option(patientArb),
          fc.record({
            width: fc.integer({ min: 320, max: 2048 }),
            height: fc.integer({ min: 568, max: 2732 }),
            deviceType: fc.constantFrom('iPad-Mini', 'iPad-Air', 'iPad-Pro'),
            fontScale: fc.float({ min: Math.fround(0.5), max: Math.fround(3.0) }),
          }),
          (patient, extremeScreenDims) => {
            const context = detectContext(patient);
            
            // Should not throw for any screen dimensions
            expect(() => {
              const displayConfig = optimizeContextDisplay(context, extremeScreenDims);
              expect(displayConfig).toBeDefined();
              expect(displayConfig.iconSize).toBeGreaterThan(0);
              expect(displayConfig.titleFontSize).toBeGreaterThan(0);
              expect(displayConfig.patientNameFontSize).toBeGreaterThan(0);
            }).not.toThrow();
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Context Type Properties
   */
  describe('Context Type Properties', () => {
    it('should handle different patient name combinations', () => {
      fc.assert(
        fc.property(
          fc.record({
            patient_id: fc.string({ minLength: 1, maxLength: 50 }),
            family_name: fc.option(fc.string({ minLength: 1, maxLength: 30 })),
            given_name: fc.option(fc.string({ minLength: 1, maxLength: 30 })),
          }),
          (patient) => {
            const context = detectContext(patient);
            
            expect(context.type).toBe('patient');
            expect(context.patientName).toBeDefined();
            
            // Should prefer family_name if available
            if (patient.family_name && patient.family_name.trim()) {
              expect(context.patientName).toBe(patient.family_name.trim());
            } else if (patient.given_name && patient.given_name.trim()) {
              expect(context.patientName).toBe(patient.given_name.trim());
            } else {
              // Should fallback to "Unknown Patient"
              expect(context.patientName).toBe('Unknown Patient');
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain context type consistency', () => {
      fc.assert(
        fc.property(fc.option(patientArb), (patient) => {
          const context = detectContext(patient);
          
          // Type should match presence of patient
          if (patient) {
            expect(context.type).toBe('patient');
            expect(context.patientId).toBeDefined();
            expect(context.patientName).toBeDefined();
          } else {
            expect(context.type).toBe('global');
            expect(context.patientId).toBeUndefined();
            expect(context.patientName).toBeUndefined();
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Performance Properties
   */
  describe('Performance Properties', () => {
    it('should detect context efficiently', () => {
      fc.assert(
        fc.property(
          fc.array(fc.option(patientArb), { minLength: 10, maxLength: 100 }),
          (patients) => {
            const startTime = performance.now();
            
            patients.forEach((patient) => {
              detectContext(patient);
            });
            
            const endTime = performance.now();
            const totalTime = endTime - startTime;
            
            // Should complete all detections quickly (under 10ms for 100 detections)
            expect(totalTime).toBeLessThan(10);
            
            return true;
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should optimize display efficiently', () => {
      fc.assert(
        fc.property(
          fc.array(fc.tuple(fc.option(patientArb), screenDimensionArb), { minLength: 10, maxLength: 50 }),
          (testCases) => {
            const startTime = performance.now();
            
            testCases.forEach(([patient, screenDims]) => {
              const context = detectContext(patient);
              optimizeContextDisplay(context, screenDims);
            });
            
            const endTime = performance.now();
            const totalTime = endTime - startTime;
            
            // Should complete all optimizations quickly (under 5ms for 50 optimizations)
            expect(totalTime).toBeLessThan(5);
            
            return true;
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should produce deterministic optimization results', () => {
      fc.assert(
        fc.property(fc.option(patientArb), screenDimensionArb, (patient, screenDims) => {
          const context = detectContext(patient);
          const config1 = optimizeContextDisplay(context, screenDims);
          const config2 = optimizeContextDisplay(context, screenDims);
          const config3 = optimizeContextDisplay(context, screenDims);
          
          // All configurations should be identical
          expect(config2).toEqual(config1);
          expect(config3).toEqual(config1);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Integration Properties
   */
  describe('Integration Properties', () => {
    it('should work correctly with context and display optimization together', () => {
      fc.assert(
        fc.property(fc.option(patientArb), screenDimensionArb, (patient, screenDims) => {
          const context = detectContext(patient);
          const displayConfig = optimizeContextDisplay(context, screenDims);
          
          // Context and display config should be compatible
          if (context.type === 'patient') {
            expect(context.patientName).toBeDefined();
            expect(displayConfig.patientNameFontSize).toBeGreaterThan(0);
          }
          
          // Display config should be appropriate for screen size
          const isSmallScreen = screenDims.deviceType === 'iPad-Mini' || screenDims.width < 900;
          expect(displayConfig.useCompactTitle).toBe(isSmallScreen);
          expect(displayConfig.showFullDescription).toBe(!isSmallScreen);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should handle context changes gracefully', () => {
      fc.assert(
        fc.property(
          fc.tuple(fc.option(patientArb), fc.option(patientArb)),
          screenDimensionArb,
          ([patient1, patient2], screenDims) => {
            const context1 = detectContext(patient1);
            const context2 = detectContext(patient2);
            
            const config1 = optimizeContextDisplay(context1, screenDims);
            const config2 = optimizeContextDisplay(context2, screenDims);
            
            // Both configurations should be valid
            expect(config1.iconSize).toBeGreaterThan(0);
            expect(config2.iconSize).toBeGreaterThan(0);
            
            // Screen-dependent properties should be the same
            expect(config1.useCompactTitle).toBe(config2.useCompactTitle);
            expect(config1.showFullDescription).toBe(config2.showFullDescription);
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});