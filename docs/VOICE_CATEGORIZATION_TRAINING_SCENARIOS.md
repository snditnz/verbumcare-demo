# Voice Categorization Training Scenarios

## Training Scenarios for Healthcare Staff

These scenarios help healthcare professionals practice using the voice categorization feature effectively.

## Scenario 1: Morning Vital Signs Round

**Context:** You're doing morning vital signs for multiple patients

**Practice Recording:**
"Patient Yamada-san in room 201. Blood pressure 135 over 88, heart rate 76, temperature 36.8 degrees Celsius. Patient reports feeling well this morning."

**Expected Extraction:**
- **Vital Signs:** BP 135/88 mmHg, HR 76 bpm, Temp 36.8°C
- **Clinical Note:** Patient reports feeling well

**Learning Points:**
- Include patient name and room for context
- Use specific numbers with units
- Include subjective patient reports

## Scenario 2: Medication Administration

**Context:** Administering scheduled medications

**Practice Recording:**
"Administered to patient Suzuki-san: 10mg amlodipine orally at 8 AM, 5mg warfarin orally at 8 AM. Patient tolerated medications well, no adverse reactions observed."

**Expected Extraction:**
- **Medication 1:** Amlodipine 10mg PO at 8 AM
- **Medication 2:** Warfarin 5mg PO at 8 AM
- **Clinical Note:** Patient tolerated well, no adverse reactions

**Learning Points:**
- List each medication separately
- Include dose, route, and time
- Note patient response

## Scenario 3: Incident Report

**Context:** Patient fall incident

**Practice Recording:**
"Incident report for patient Tanaka-san. Patient found on floor beside bed at 2:30 AM. Patient states she got up to use bathroom and felt dizzy. No visible injuries. Vital signs stable. Bed alarm was not activated. Notified physician Dr. Sato."

**Expected Extraction:**
- **Incident Report:** Fall, medium severity, 2:30 AM
- **Clinical Note:** Patient felt dizzy, no visible injuries
- **Vital Signs:** Stable (if specific values mentioned)

**Learning Points:**
- Include time and circumstances
- Note any contributing factors
- Mention follow-up actions

## Scenario 4: ADL Assessment

**Context:** Assisting with daily activities

**Practice Recording:**
"Patient Watanabe-san ADL assessment. Eating: independent, consumed 80% of breakfast. Bathing: requires assistance due to limited mobility. Dressing: independent for upper body, needs help with socks and shoes. Toileting: uses bedside commode independently."

**Expected Extraction:**
- **ADL - Eating:** Independent, 80% intake
- **ADL - Bathing:** Requires assistance
- **ADL - Dressing:** Partial independence
- **ADL - Toileting:** Independent with equipment

**Learning Points:**
- Address each ADL category separately
- Specify level of assistance needed
- Include percentage or descriptive details

## Scenario 5: Pain Assessment and Management

**Context:** Patient reporting pain

**Practice Recording:**
"Patient Kobayashi-san reports sharp pain in right shoulder, level 7 out of 10, worse with movement. Pain started after physical therapy session. Administered 5mg morphine intravenously at 1 PM. Will reassess in 30 minutes."

**Expected Extraction:**
- **Pain Assessment:** Right shoulder, sharp, level 7/10, movement-related
- **Medication:** Morphine 5mg IV at 1 PM
- **Care Plan:** Reassess in 30 minutes

**Learning Points:**
- Include pain characteristics (location, quality, intensity)
- Note triggers or alleviating factors
- Document interventions and follow-up plans

## Scenario 6: Care Plan Update

**Context:** Updating patient care plan

**Practice Recording:**
"Care plan update for patient Nakamura-san. Problem: risk of falls due to unsteady gait. Goal: prevent falls and improve mobility. Interventions: bed alarm activated, physical therapy twice daily, walker for ambulation. Evaluation: patient using walker consistently, no falls in past 3 days."

**Expected Extraction:**
- **Care Plan:** Problem - fall risk, Goal - prevent falls/improve mobility
- **Interventions:** Bed alarm, PT twice daily, walker use
- **Evaluation:** Consistent walker use, no recent falls

**Learning Points:**
- Follow SOAP format (Problem, Goal, Intervention, Evaluation)
- Be specific about interventions
- Include measurable outcomes

## Scenario 7: Multi-Category Complex Recording

**Context:** Comprehensive patient assessment

**Practice Recording:**
"Patient Ishida-san morning assessment. Vital signs: blood pressure 142 over 90, heart rate 88, temperature 37.1 degrees. Administered 5mg lisinopril orally at 8 AM for hypertension. Patient reports lower back pain level 5, aching quality, worse when sitting. Assisted with shower due to balance issues. Patient ate 60% of breakfast independently. Plan to consult physical therapy for back pain management."

**Expected Extraction:**
- **Vital Signs:** BP 142/90, HR 88, Temp 37.1°C
- **Medication:** Lisinopril 5mg PO at 8 AM
- **Pain Assessment:** Lower back, aching, level 5/10, positional
- **ADL:** Bathing - assisted, Eating - 60% independent
- **Care Plan:** PT consult for pain management

**Learning Points:**
- AI can extract multiple categories from one recording
- Maintain logical flow in your speech
- Include all relevant details for each category

## Practice Exercises

### Exercise 1: Vital Signs Accuracy
Record vital signs for an imaginary patient using these values:
- BP: 128/82 mmHg
- HR: 74 bpm  
- Temp: 36.9°C
- RR: 18/min
- SpO2: 98%

**Goal:** Achieve >90% confidence scores for all values

### Exercise 2: Medication Precision
Practice recording these medications:
- Metformin 500mg PO BID
- Insulin aspart 8 units subcutaneous before meals
- Furosemide 20mg PO daily

**Goal:** Include all required elements (drug, dose, route, frequency)

### Exercise 3: Pain Documentation
Practice documenting pain with these characteristics:
- Location: Left knee
- Quality: Sharp, stabbing
- Intensity: 6/10
- Duration: Started 2 hours ago
- Aggravating factors: Walking, stairs

**Goal:** Include all pain assessment elements

## Common Recording Mistakes

### Mistake 1: Vague Descriptions
❌ "Patient's blood pressure is okay"
✅ "Blood pressure 120 over 80"

### Mistake 2: Missing Units
❌ "Temperature is 37"
✅ "Temperature 37 degrees Celsius"

### Mistake 3: Unclear Timing
❌ "Gave medication earlier"
✅ "Administered medication at 2 PM"

### Mistake 4: Incomplete Medication Info
❌ "Gave some insulin"
✅ "Administered 8 units insulin aspart subcutaneously"

### Mistake 5: Non-specific Pain
❌ "Patient has some pain"
✅ "Patient reports sharp pain in left knee, level 6 out of 10"

## Assessment Criteria

Rate your voice recordings on these criteria:

**Clarity (1-5 points)**
- 5: Clear speech, no background noise
- 3: Mostly clear with minor issues
- 1: Difficult to understand

**Completeness (1-5 points)**
- 5: All required data elements included
- 3: Most elements included
- 1: Missing critical information

**Accuracy (1-5 points)**
- 5: All extracted data is correct
- 3: Minor corrections needed
- 1: Significant errors requiring editing

**Efficiency (1-5 points)**
- 5: Concise, well-organized information
- 3: Adequate organization
- 1: Rambling or disorganized

**Target Score:** 16-20 points (80-100%)

## Advanced Techniques

### Technique 1: Batch Recording
Record multiple patients in sequence:
"Patient Sato-san: BP 130/85, HR 72. Patient Tanaka-san: BP 118/76, HR 68. Patient Yamada-san: BP 145/92, HR 84."

### Technique 2: Contextual Recording
Include environmental context:
"During physical therapy session, patient reported increased pain level from 4 to 7 in right hip."

### Technique 3: Comparative Recording
Reference previous assessments:
"Pain level improved from yesterday's level 8 to today's level 4 after medication adjustment."

---

*Practice these scenarios regularly to improve your voice categorization skills and documentation efficiency.*