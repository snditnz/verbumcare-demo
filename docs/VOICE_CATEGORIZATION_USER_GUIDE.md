# Voice Categorization User Guide

## Overview

The Voice Categorization feature in VerbumCare allows healthcare professionals to document patient care using natural speech. The AI automatically analyzes your voice recordings, extracts structured data, and categorizes information into appropriate medical records.

## Key Benefits

- **60-70% faster documentation** compared to manual data entry
- **Natural language input** - speak as you normally would
- **Automatic categorization** into 7 data types (vitals, medications, clinical notes, ADL, incidents, care plans, pain assessments)
- **Multi-language support** for Japanese, English, and Traditional Chinese
- **Offline processing** - works without internet connectivity
- **Review and edit** all extracted data before saving

## Getting Started

### 1. Recording Voice Notes

#### With Patient Context (Recommended)
1. Navigate to a patient's information screen
2. Tap the voice recording button (microphone icon)
3. Speak your observations, measurements, or notes
4. Tap stop when finished

**Example:** "Patient Tanaka-san's blood pressure is 120 over 80, heart rate 72. She completed her morning ADL independently and reports pain level 3 in her lower back."

#### Global Recording (No Patient Selected)
1. From the main dashboard, tap the voice recorder
2. Mention the patient name in your recording for automatic association
3. Speak your observations
4. Tap stop when finished

**Example:** "For patient Suzuki-san in room 302, administered 5mg morphine at 14:30 for post-operative pain management."

### 2. Understanding AI Processing

After recording, the AI performs several steps:

1. **Transcription** (20-30 seconds): Converts speech to text
2. **Categorization** (20-30 seconds): Identifies data types in your speech
3. **Extraction** (10-20 seconds): Pulls structured data from each category
4. **Review Queue**: Adds the processed recording to your review queue

### 3. Managing Your Review Queue

The review queue shows all voice recordings awaiting your approval:

- **Access**: Tap the notification badge or navigate to "Voice Reviews"
- **Ordering**: Items are sorted chronologically (oldest first)
- **Urgency**: Red badges indicate items over 24 hours old
- **Count**: The badge shows total pending reviews

## Data Categories

The AI can automatically detect and extract data for these categories:

### 1. Vital Signs
**What to say:** Blood pressure, heart rate, temperature, respiratory rate, oxygen saturation, weight, height

**Examples:**
- "Blood pressure 130 over 85"
- "Temperature 37.2 degrees Celsius"
- "Heart rate 68 beats per minute"
- "Weight 65 kilograms"

### 2. Medications
**What to say:** Drug name, dosage, route, timing, patient response

**Examples:**
- "Administered 10mg morphine intravenously at 2 PM"
- "Patient took 5mg amlodipine orally this morning"
- "Applied fentanyl patch 25 micrograms per hour"

### 3. Clinical Notes
**What to say:** Observations, assessments, plans in SOAP format

**Examples:**
- "Patient reports feeling dizzy when standing"
- "Wound healing well, no signs of infection"
- "Plan to increase physical therapy sessions"

### 4. Activities of Daily Living (ADL)
**What to say:** Eating, bathing, dressing, toileting, mobility assistance levels

**Examples:**
- "Patient ate 75% of breakfast independently"
- "Required assistance with bathing"
- "Walked to bathroom with walker"

### 5. Incident Reports
**What to say:** Falls, medication errors, equipment issues, safety concerns

**Examples:**
- "Patient fell in bathroom at 3 AM, no injuries observed"
- "IV line became disconnected during transfer"
- "Patient complained of severe chest pain"

### 6. Care Plans
**What to say:** Problems, goals, interventions, evaluations

**Examples:**
- "Goal: improve mobility. Intervention: daily physical therapy"
- "Problem: risk of falls. Plan: bed alarm activated"

### 7. Pain Assessments
**What to say:** Location, intensity (0-10), character, duration, triggers

**Examples:**
- "Patient reports sharp pain in right knee, level 7 out of 10"
- "Lower back pain improved to level 3 after medication"

## Review and Confirmation Process

### 1. Opening a Review

1. Tap any item in your review queue
2. The review screen shows:
   - Original transcript (editable)
   - Extracted structured data (editable)
   - Confidence scores for each field
   - Recording metadata

### 2. Understanding Confidence Scores

Confidence scores indicate how certain the AI is about extracted data:

- **Green (80-100%)**: High confidence - likely accurate
- **Yellow (60-79%)**: Medium confidence - review recommended  
- **Red (0-59%)**: Low confidence - verification required

**Tip:** Always review low confidence extractions carefully before saving.

### 3. Editing Transcripts

If the transcript is incorrect:

1. Tap in the transcript text area
2. Edit the text as needed
3. Tap "Re-analyze" to extract new data from the corrected transcript
4. Review the updated extracted data

### 4. Editing Extracted Data

You can directly edit any extracted data field:

1. Tap on any data field
2. Modify the value
3. The system will validate your changes
4. Invalid values will be highlighted in red

### 5. Confirming or Discarding

**To Confirm:**
1. Review all data carefully
2. Tap "Confirm & Save"
3. Confirm in the dialog
4. Data is saved to the database permanently

**To Discard:**
1. Tap "Discard"
2. Confirm in the dialog
3. The recording is archived but not deleted

## Best Practices

### Recording Tips

1. **Speak clearly** at a normal pace
2. **Use specific numbers** with units (e.g., "120 over 80 mmHg")
3. **Mention patient names** for automatic association
4. **Include context** (time, location, circumstances)
5. **Record in quiet environments** when possible

### Workflow Optimization

1. **Process reviews promptly** - aim for same-day completion
2. **Review oldest items first** - they're automatically sorted
3. **Use patient context** whenever possible for better accuracy
4. **Edit transcripts** if speech recognition was unclear
5. **Verify low confidence data** before saving

### Quality Assurance

1. **Always review extracted data** before confirming
2. **Check clinical ranges** for vital signs
3. **Verify medication details** (drug, dose, route, time)
4. **Ensure patient association** is correct
5. **Use the discard option** for unclear or irrelevant recordings

## Troubleshooting

### Common Issues

**"Recording failed"**
- Check microphone permissions in Settings
- Ensure device has sufficient storage
- Try restarting the app

**"Transcription unclear"**
- Edit the transcript manually
- Tap "Re-analyze" to extract new data
- Speak more clearly in future recordings

**"Low confidence scores"**
- Review and edit extracted data manually
- Consider re-recording if transcript is very unclear
- Use more specific medical terminology

**"Data not saving"**
- Check network connection
- Data is queued locally and will sync when connection returns
- Contact IT support if problem persists

### Getting Help

1. **In-app help**: Tap the "?" button on any screen
2. **Training materials**: Available in the Settings menu
3. **IT support**: Contact your facility's IT department
4. **User manual**: Complete documentation available online

## Privacy and Security

- All voice recordings are **encrypted** at rest and in transit
- Recordings are **automatically deleted** after processing (transcript retained)
- Only authorized users can access review queues
- **Audit logs** track all data access and modifications
- **HIPAA compliant** data handling throughout the system

## Frequently Asked Questions

**Q: Can I use voice categorization offline?**
A: Yes, the entire system works offline. Recordings are processed locally and sync when connectivity returns.

**Q: What languages are supported?**
A: Japanese, English, and Traditional Chinese are fully supported with native speech recognition.

**Q: How accurate is the AI extraction?**
A: Accuracy varies by data type and speech clarity, typically 85-95% for clear recordings. Always review before confirming.

**Q: Can I edit data after confirming?**
A: No, confirmed data is permanent. Use the review process to ensure accuracy before confirming.

**Q: What happens to discarded recordings?**
A: Discarded recordings are archived for audit purposes but not included in patient records.

**Q: How long are recordings stored?**
A: Original audio is deleted after processing. Transcripts and extracted data are retained per facility policy.

**Q: Can multiple users process the same recording?**
A: No, each recording is assigned to the user who created it and appears only in their review queue.

---

*For technical support or additional training, contact your facility's IT department or VerbumCare support team.*