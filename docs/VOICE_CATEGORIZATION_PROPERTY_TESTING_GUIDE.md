# Property-Based Testing Guide for Voice Categorization

## Overview

Property-based testing (PBT) is a crucial component of the voice categorization system's quality assurance. This guide explains how to write, run, and maintain property-based tests that verify the correctness properties defined in the system specification.

## What is Property-Based Testing?

Property-based testing automatically generates hundreds of test cases to verify that your code satisfies certain properties (invariants) across a wide range of inputs. Instead of writing specific test cases, you define properties that should always hold true.

### Example: Traditional vs Property-Based Testing

**Traditional Test:**
```javascript
test('blood pressure extraction', () => {
  const transcript = "Blood pressure is 120 over 80";
  const result = extractVitals(transcript);
  expect(result.blood_pressure.systolic).toBe(120);
  expect(result.blood_pressure.diastolic).toBe(80);
});
```

**Property-Based Test:**
```javascript
test('blood pressure extraction property', () => {
  fc.assert(fc.property(
    fc.integer({ min: 70, max: 250 }), // systolic
    fc.integer({ min: 40, max: 150 }), // diastolic
    (systolic, diastolic) => {
      const transcript = `Blood pressure is ${systolic} over ${diastolic}`;
      const result = extractVitals(transcript);
      
      // Property: extracted values should match input values
      return result.blood_pressure.systolic === systolic &&
             result.blood_pressure.diastolic === diastolic;
    }
  ));
});
```

## Testing Framework Setup

### Backend (Node.js with fast-check)

```javascript
// package.json dependencies
{
  "devDependencies": {
    "fast-check": "^3.15.0",
    "jest": "^29.7.0"
  }
}

// jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.property.test.js'],
  setupFilesAfterEnv: ['<rootDir>/test-setup.js']
};

// test-setup.js
const fc = require('fast-check');

// Configure fast-check globally
fc.configureGlobal({
  numRuns: 100,        // Run 100 test cases per property
  timeout: 30000,      // 30 second timeout
  seed: 42,            // Reproducible tests
  verbose: true        // Show counterexamples
});
```

### Frontend (React Native with fast-check)

```javascript
// package.json dependencies
{
  "devDependencies": {
    "fast-check": "^3.15.0",
    "jest": "^29.7.0",
    "@testing-library/react-native": "^12.4.0"
  }
}

// jest.config.js
module.exports = {
  preset: 'react-native',
  testMatch: ['**/*.property.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/test-setup.ts']
};

// test-setup.ts
import fc from 'fast-check';

fc.configureGlobal({
  numRuns: 100,
  timeout: 30000,
  seed: 42
});
```

## Property Categories

### 1. Round-Trip Properties

These properties test that operations and their inverses return to the original value.

```javascript
// Property: Serialization round-trip
fc.assert(fc.property(
  extractedDataArbitrary(),
  (originalData) => {
    const serialized = JSON.stringify(originalData);
    const deserialized = JSON.parse(serialized);
    
    // Property: Round-trip should preserve data
    return deepEqual(originalData, deserialized);
  }
));

// Property: Transcript parsing round-trip
fc.assert(fc.property(
  validTranscriptArbitrary(),
  (transcript) => {
    const extracted = extractData(transcript);
    const regenerated = generateTranscript(extracted);
    const reExtracted = extractData(regenerated);
    
    // Property: Re-extraction should yield same data
    return deepEqual(extracted, reExtracted);
  }
));
```

### 2. Invariant Properties

These properties test that certain conditions always hold regardless of input.

```javascript
// Property: Confidence scores are always between 0 and 1
fc.assert(fc.property(
  transcriptArbitrary(),
  (transcript) => {
    const result = categorizeTranscript(transcript);
    
    // Property: All confidence scores in valid range
    return result.categories.every(category => 
      category.confidence >= 0 && category.confidence <= 1
    ) && result.overallConfidence >= 0 && result.overallConfidence <= 1;
  }
));

// Property: Patient context is preserved through processing
fc.assert(fc.property(
  patientContextArbitrary(),
  transcriptArbitrary(),
  (patientContext, transcript) => {
    const recording = createRecording(transcript, patientContext);
    const processed = processRecording(recording);
    
    // Property: Patient context should be preserved
    return processed.contextPatientId === patientContext.patientId;
  }
));
```

### 3. Metamorphic Properties

These properties test relationships between different inputs and outputs.

```javascript
// Property: Longer transcripts don't decrease confidence
fc.assert(fc.property(
  shortTranscriptArbitrary(),
  additionalContentArbitrary(),
  (shortTranscript, additionalContent) => {
    const shortResult = categorizeTranscript(shortTranscript);
    const longResult = categorizeTranscript(shortTranscript + ' ' + additionalContent);
    
    // Property: Adding content shouldn't decrease confidence for existing data
    return longResult.overallConfidence >= shortResult.overallConfidence * 0.9; // Allow 10% tolerance
  }
));

// Property: Queue ordering is maintained
fc.assert(fc.property(
  fc.array(reviewItemArbitrary(), { minLength: 2, maxLength: 10 }),
  (items) => {
    const queue = createReviewQueue(items);
    const sorted = sortQueueChronologically(queue);
    
    // Property: Items should be in chronological order
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].createdAt < sorted[i-1].createdAt) {
        return false;
      }
    }
    return true;
  }
));
```

## Data Generators (Arbitraries)

### Basic Generators

```javascript
// Generate valid vital signs
const vitalSignsArbitrary = () => fc.record({
  blood_pressure: fc.record({
    systolic: fc.integer({ min: 70, max: 250 }),
    diastolic: fc.integer({ min: 40, max: 150 })
  }),
  heart_rate: fc.integer({ min: 30, max: 250 }),
  temperature: fc.float({ min: 32.0, max: 45.0 }),
  respiratory_rate: fc.integer({ min: 8, max: 40 }),
  oxygen_saturation: fc.integer({ min: 70, max: 100 })
});

// Generate medication data
const medicationArbitrary = () => fc.record({
  medication_name: fc.constantFrom('アムロジピン', 'リシノプリル', 'メトホルミン'),
  dose: fc.string({ minLength: 2, maxLength: 10 }),
  route: fc.constantFrom('PO', 'IV', 'IM', 'SC', 'PR'),
  time: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') })
});

// Generate transcripts with known content
const transcriptWithVitalsArbitrary = () => 
  vitalSignsArbitrary().map(vitals => 
    `血圧は${vitals.blood_pressure.systolic}の${vitals.blood_pressure.diastolic}、` +
    `心拍数${vitals.heart_rate}、体温${vitals.temperature}度です`
  );
```

### Complex Generators

```javascript
// Generate realistic patient context
const patientContextArbitrary = () => fc.record({
  patientId: fc.uuid(),
  patientName: fc.record({
    familyName: fc.constantFrom('田中', '佐藤', '鈴木', '高橋'),
    givenName: fc.constantFrom('太郎', '花子', '次郎', '美咲')
  }),
  room: fc.string({ minLength: 3, maxLength: 5 }),
  bed: fc.constantFrom('A', 'B', 'C', 'D')
});

// Generate review queue items
const reviewItemArbitrary = () => fc.record({
  reviewId: fc.uuid(),
  recordingId: fc.uuid(),
  userId: fc.uuid(),
  contextType: fc.constantFrom('patient', 'global'),
  contextPatientId: fc.option(fc.uuid()),
  transcript: fc.string({ minLength: 10, maxLength: 500 }),
  extractedData: extractedDataArbitrary(),
  confidence: fc.float({ min: 0.6, max: 0.99 }),
  status: fc.constantFrom('pending', 'in_review', 'confirmed', 'discarded'),
  createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date() })
});

// Generate extracted data with multiple categories
const extractedDataArbitrary = () => fc.record({
  categories: fc.array(
    fc.record({
      type: fc.constantFrom('vitals', 'medication', 'clinical_note', 'adl', 'incident', 'care_plan', 'pain'),
      confidence: fc.float({ min: 0.6, max: 0.99 }),
      data: fc.anything(),
      fieldConfidences: fc.dictionary(fc.string(), fc.float({ min: 0.6, max: 0.99 }))
    }),
    { minLength: 1, maxLength: 3 }
  ),
  overallConfidence: fc.float({ min: 0.6, max: 0.99 })
});
```

## Correctness Properties Implementation

### Property 1: Patient Context Capture

```javascript
/**
 * Property 1: Patient context capture
 * For any voice recording initiated with an active patient context, 
 * the recording SHALL capture and store the patient ID
 * Validates: Requirements 1.1
 */
describe('Property 1: Patient context capture', () => {
  test('patient context is captured and stored', () => {
    fc.assert(fc.property(
      patientContextArbitrary(),
      audioFileArbitrary(),
      async (patientContext, audioFile) => {
        // Arrange: Set up recording with patient context
        const recordingRequest = {
          audio: audioFile,
          contextType: 'patient',
          contextPatientId: patientContext.patientId
        };

        // Act: Upload recording
        const result = await uploadVoiceRecording(recordingRequest);

        // Assert: Patient context should be captured
        return result.contextType === 'patient' &&
               result.contextPatientId === patientContext.patientId;
      }
    ), { numRuns: 100 });
  });
});
```

### Property 8-14: Category Detection

```javascript
/**
 * Property 8-14: Category detection for all data types
 * For any transcription containing [category] information, 
 * the system SHALL categorize it as [category] data type
 * Validates: Requirements 3.1-3.7
 */
describe('Properties 8-14: Category detection', () => {
  test('vitals are detected in transcripts', () => {
    fc.assert(fc.property(
      vitalSignsArbitrary(),
      (vitals) => {
        // Generate transcript with vital signs
        const transcript = generateVitalsTranscript(vitals);
        
        // Act: Categorize transcript
        const result = categorizeTranscript(transcript);
        
        // Assert: Should detect vitals category
        const vitalsCategory = result.categories.find(c => c.type === 'vitals');
        return vitalsCategory !== undefined && vitalsCategory.confidence > 0.6;
      }
    ), { numRuns: 100 });
  });

  test('medications are detected in transcripts', () => {
    fc.assert(fc.property(
      medicationArbitrary(),
      (medication) => {
        const transcript = generateMedicationTranscript(medication);
        const result = categorizeTranscript(transcript);
        
        const medicationCategory = result.categories.find(c => c.type === 'medication');
        return medicationCategory !== undefined && medicationCategory.confidence > 0.6;
      }
    ), { numRuns: 100 });
  });

  // Similar tests for clinical_note, adl, incident, care_plan, pain...
});
```

### Property 32: Chronological Queue Ordering

```javascript
/**
 * Property 32: Chronological queue ordering
 * For any review queue with multiple recordings, 
 * the system SHALL maintain chronological order (oldest first)
 * Validates: Requirements 8.5
 */
describe('Property 32: Chronological queue ordering', () => {
  test('queue maintains chronological order', () => {
    fc.assert(fc.property(
      fc.array(reviewItemArbitrary(), { minLength: 2, maxLength: 20 }),
      (reviewItems) => {
        // Arrange: Create queue with random order items
        const shuffledItems = shuffle(reviewItems);
        const queue = createReviewQueue(shuffledItems);

        // Act: Get ordered queue
        const orderedQueue = getReviewQueue(queue.userId);

        // Assert: Should be in chronological order (oldest first)
        for (let i = 1; i < orderedQueue.length; i++) {
          if (orderedQueue[i].createdAt < orderedQueue[i-1].createdAt) {
            return false;
          }
        }
        return true;
      }
    ), { numRuns: 100 });
  });
});
```

## Running Property-Based Tests

### Command Line Execution

```bash
# Backend tests
cd backend
npm test -- --testPathPattern="property.test.js"

# Run specific property test
npm test -- --testNamePattern="Property 1"

# Run with verbose output
npm test -- --verbose property.test.js

# Frontend tests
cd ipad-app
npm test -- --testPathPattern="property.test.ts"

# Run with coverage
npm test -- --coverage property.test.ts
```

### Continuous Integration

```yaml
# .github/workflows/property-tests.yml
name: Property-Based Tests

on: [push, pull_request]

jobs:
  property-tests:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: |
        cd backend && npm ci
        cd ../ipad-app && npm ci
        
    - name: Run backend property tests
      run: cd backend && npm test -- --testPathPattern="property.test.js"
      
    - name: Run frontend property tests
      run: cd ipad-app && npm test -- --testPathPattern="property.test.ts"
```

## Debugging Failed Properties

### Understanding Counterexamples

When a property fails, fast-check provides a counterexample:

```
Property failed after 1 tests
{ seed: 42, path: "0:0:0", endOnFailure: true }
Counterexample: [{"patientId": "00000000-0000-0000-0000-000000000000", "transcript": ""}]
Shrunk 5 time(s)
Got error: Property assertion failed
```

### Debugging Strategies

1. **Reproduce the failure:**
```javascript
// Use the seed and path from the failure
fc.assert(fc.property(
  patientContextArbitrary(),
  (patientContext) => {
    // Your property logic here
  }
), { 
  seed: 42,           // Use seed from failure
  path: "0:0:0",      // Use path from failure
  numRuns: 1          // Run only the failing case
});
```

2. **Add logging:**
```javascript
fc.assert(fc.property(
  patientContextArbitrary(),
  (patientContext) => {
    console.log('Testing with:', patientContext);
    const result = processPatientContext(patientContext);
    console.log('Result:', result);
    
    return result.isValid;
  }
));
```

3. **Use preconditions:**
```javascript
fc.assert(fc.property(
  transcriptArbitrary(),
  (transcript) => {
    // Skip invalid inputs
    fc.pre(transcript.length > 0);
    fc.pre(!transcript.includes('invalid'));
    
    const result = processTranscript(transcript);
    return result.isValid;
  }
));
```

## Best Practices

### 1. Property Design

- **Start simple**: Begin with basic invariants before complex properties
- **Use preconditions**: Filter out invalid inputs with `fc.pre()`
- **Test boundaries**: Include edge cases in your generators
- **Make properties fast**: Avoid expensive operations in property checks

### 2. Generator Design

```javascript
// Good: Constrained, realistic data
const realisticVitalsArbitrary = () => fc.record({
  systolic: fc.integer({ min: 90, max: 180 }),    // Normal range
  diastolic: fc.integer({ min: 60, max: 120 })    // Normal range
});

// Bad: Unconstrained data that may not be realistic
const badVitalsArbitrary = () => fc.record({
  systolic: fc.integer(),  // Could be negative or extremely high
  diastolic: fc.integer()  // Could be negative or extremely high
});
```

### 3. Test Organization

```javascript
// Group related properties
describe('Voice Categorization Properties', () => {
  describe('Patient Context Properties (1-7)', () => {
    // Properties 1-7 tests
  });
  
  describe('Category Detection Properties (8-14)', () => {
    // Properties 8-14 tests
  });
  
  describe('Queue Management Properties (30-35)', () => {
    // Properties 30-35 tests
  });
});
```

### 4. Performance Optimization

```javascript
// Cache expensive setup
let expensiveSetup;
beforeAll(async () => {
  expensiveSetup = await createExpensiveTestSetup();
});

// Use smaller numRuns for slow properties
fc.assert(fc.property(
  complexArbitrary(),
  (input) => {
    // Expensive property check
  }
), { numRuns: 20 }); // Reduced from default 100
```

## Integration with Existing Tests

### Combining Unit and Property Tests

```javascript
describe('Vital Signs Extraction', () => {
  // Traditional unit tests for specific cases
  test('extracts blood pressure correctly', () => {
    const transcript = "血圧は120の80です";
    const result = extractVitals(transcript);
    expect(result.blood_pressure.systolic).toBe(120);
    expect(result.blood_pressure.diastolic).toBe(80);
  });

  // Property-based test for general behavior
  test('property: extracted vitals are within valid ranges', () => {
    fc.assert(fc.property(
      validVitalsTranscriptArbitrary(),
      (transcript) => {
        const result = extractVitals(transcript);
        return isValidVitalSigns(result);
      }
    ));
  });
});
```

### Regression Testing

```javascript
// Save counterexamples as regression tests
describe('Regression Tests', () => {
  test('handles empty transcript gracefully', () => {
    // This was a counterexample from Property 15
    const transcript = "";
    const result = extractData(transcript);
    expect(result.categories).toEqual([]);
  });

  test('handles special characters in patient names', () => {
    // This was a counterexample from Property 2
    const patientName = "田中-O'Connor";
    const result = processPatientName(patientName);
    expect(result.isValid).toBe(true);
  });
});
```

---

*For more information on property-based testing theory and advanced techniques, see the fast-check documentation and "Property-Based Testing with PropEr, Erlang, and Elixir" by Fred Hebert.*