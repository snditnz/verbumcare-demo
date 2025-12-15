import db from '../db/index.js';

/**
 * Review Data Insertion Service
 * Handles insertion of confirmed review data into appropriate database tables
 * All functions maintain patient association and validate data before insertion
 */

/**
 * Insert vitals data from a confirmed review
 * @param {object} reviewItem - The review item containing extracted data
 * @param {string} confirmedBy - UUID of staff member confirming the review
 * @returns {Promise<object>} Inserted vital signs record
 */
export async function insertVitalsFromReview(reviewItem, confirmedBy) {
  try {
    console.log('💉 Inserting vitals from review...');
    
    // Extract vitals data from review
    const vitalsCategory = reviewItem.extracted_data.categories.find(
      cat => cat.type === 'vitals'
    );

    if (!vitalsCategory) {
      throw new Error('No vitals data found in review');
    }

    const vitalsData = vitalsCategory.data;
    const patientId = reviewItem.context_patient_id;

    if (!patientId) {
      throw new Error('Patient ID is required for vitals insertion');
    }

    // Validate against clinical ranges
    const validation = validateVitalSigns(vitalsData);
    if (!validation.valid) {
      console.warn('⚠️  Vitals validation warnings:', validation.warnings);
      // Continue with insertion but log warnings
    }

    // Prepare insertion data
    const query = `
      INSERT INTO vital_signs (
        patient_id,
        measured_at,
        temperature_celsius,
        blood_pressure_systolic,
        blood_pressure_diastolic,
        heart_rate,
        respiratory_rate,
        oxygen_saturation,
        pain_score,
        blood_glucose_mg_dl,
        weight_kg,
        height_cm,
        input_method,
        recorded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'voice', $13)
      RETURNING *
    `;

    const values = [
      patientId,
      vitalsData.measured_at || new Date(),
      vitalsData.temperature_celsius || vitalsData.temperature || null,
      vitalsData.blood_pressure_systolic || vitalsData.blood_pressure?.systolic || null,
      vitalsData.blood_pressure_diastolic || vitalsData.blood_pressure?.diastolic || null,
      vitalsData.heart_rate || null,
      vitalsData.respiratory_rate || null,
      vitalsData.oxygen_saturation || vitalsData.spo2 || null,
      vitalsData.pain_score || null,
      vitalsData.blood_glucose_mg_dl || vitalsData.blood_glucose || null,
      vitalsData.weight_kg || null,
      vitalsData.height_cm || null,
      confirmedBy
    ];

    const result = await db.query(query, values);
    const insertedVitals = result.rows[0];

    console.log(`✅ Vitals inserted: ${insertedVitals.vital_sign_id}`);
    console.log(`   Patient: ${patientId}`);
    console.log(`   BP: ${insertedVitals.blood_pressure_systolic}/${insertedVitals.blood_pressure_diastolic}`);
    console.log(`   HR: ${insertedVitals.heart_rate}`);

    return insertedVitals;

  } catch (error) {
    console.error('❌ Error inserting vitals from review:', error.message);
    throw error;
  }
}

/**
 * Validate vital signs against clinical ranges
 * @param {object} vitalsData - Vitals data to validate
 * @returns {object} Validation result with valid flag and warnings array
 */
function validateVitalSigns(vitalsData) {
  const warnings = [];
  let valid = true;

  // Temperature validation (Celsius)
  if (vitalsData.temperature_celsius || vitalsData.temperature) {
    const temp = vitalsData.temperature_celsius || vitalsData.temperature;
    if (temp < 35.0 || temp > 42.0) {
      warnings.push(`Temperature ${temp}°C is outside normal range (35-42°C)`);
      valid = false;
    }
  }

  // Blood pressure validation
  const systolic = vitalsData.blood_pressure_systolic || vitalsData.blood_pressure?.systolic;
  const diastolic = vitalsData.blood_pressure_diastolic || vitalsData.blood_pressure?.diastolic;

  if (systolic) {
    if (systolic < 70 || systolic > 250) {
      warnings.push(`Systolic BP ${systolic} mmHg is outside normal range (70-250 mmHg)`);
      valid = false;
    }
  }

  if (diastolic) {
    if (diastolic < 40 || diastolic > 150) {
      warnings.push(`Diastolic BP ${diastolic} mmHg is outside normal range (40-150 mmHg)`);
      valid = false;
    }
  }

  if (systolic && diastolic && systolic <= diastolic) {
    warnings.push(`Systolic BP (${systolic}) must be greater than diastolic BP (${diastolic})`);
    valid = false;
  }

  // Heart rate validation
  if (vitalsData.heart_rate) {
    const hr = vitalsData.heart_rate;
    if (hr < 30 || hr > 250) {
      warnings.push(`Heart rate ${hr} bpm is outside normal range (30-250 bpm)`);
      valid = false;
    }
  }

  // Respiratory rate validation
  if (vitalsData.respiratory_rate) {
    const rr = vitalsData.respiratory_rate;
    if (rr < 8 || rr > 60) {
      warnings.push(`Respiratory rate ${rr} breaths/min is outside normal range (8-60 breaths/min)`);
      valid = false;
    }
  }

  // Oxygen saturation validation
  const spo2 = vitalsData.oxygen_saturation || vitalsData.spo2;
  if (spo2) {
    if (spo2 < 70 || spo2 > 100) {
      warnings.push(`SpO2 ${spo2}% is outside normal range (70-100%)`);
      valid = false;
    }
  }

  // Pain score validation
  if (vitalsData.pain_score !== undefined && vitalsData.pain_score !== null) {
    const pain = vitalsData.pain_score;
    if (pain < 0 || pain > 10) {
      warnings.push(`Pain score ${pain} is outside valid range (0-10)`);
      valid = false;
    }
  }

  // Blood glucose validation
  if (vitalsData.blood_glucose_mg_dl || vitalsData.blood_glucose) {
    const glucose = vitalsData.blood_glucose_mg_dl || vitalsData.blood_glucose;
    if (glucose < 20 || glucose > 600) {
      warnings.push(`Blood glucose ${glucose} mg/dL is outside normal range (20-600 mg/dL)`);
      valid = false;
    }
  }

  return { valid, warnings };
}

/**
 * Insert medication administration from a confirmed review
 * @param {object} reviewItem - The review item containing extracted data
 * @param {string} confirmedBy - UUID of staff member confirming the review
 * @returns {Promise<object>} Inserted medication administration record
 */
export async function insertMedicationFromReview(reviewItem, confirmedBy) {
  try {
    console.log('💊 Inserting medication from review...');
    
    // Extract medication data from review
    const medicationCategory = reviewItem.extracted_data.categories.find(
      cat => cat.type === 'medication'
    );

    if (!medicationCategory) {
      throw new Error('No medication data found in review');
    }

    const medicationData = medicationCategory.data;
    const patientId = reviewItem.context_patient_id;

    if (!patientId) {
      throw new Error('Patient ID is required for medication insertion');
    }

    // Validate required fields
    if (!medicationData.medication_name && !medicationData.drug_name) {
      throw new Error('Medication name is required');
    }

    if (!medicationData.dose) {
      throw new Error('Medication dose is required');
    }

    if (!medicationData.route) {
      throw new Error('Medication route is required');
    }

    // Try to find matching medication order (optional - may not exist)
    let orderId = null;
    if (medicationData.medication_name || medicationData.drug_name) {
      const medicationName = medicationData.medication_name || medicationData.drug_name;
      const orderQuery = `
        SELECT order_id FROM medication_orders
        WHERE patient_id = $1
          AND (medication_name_ja ILIKE $2 OR medication_name_en ILIKE $2)
          AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `;
      const orderResult = await db.query(orderQuery, [patientId, `%${medicationName}%`]);
      if (orderResult.rows.length > 0) {
        orderId = orderResult.rows[0].order_id;
        console.log(`   Found matching order: ${orderId}`);
      }
    }

    // If no order found, create a placeholder order
    if (!orderId) {
      console.log('   No matching order found, creating placeholder order...');
      const createOrderQuery = `
        INSERT INTO medication_orders (
          patient_id,
          order_number,
          medication_name_ja,
          medication_name_en,
          dose,
          dose_unit,
          route,
          frequency,
          start_datetime,
          status,
          ordered_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10)
        RETURNING order_id
      `;

      const orderValues = [
        patientId,
        `VOICE-${Date.now()}`,
        medicationData.medication_name || medicationData.drug_name,
        medicationData.medication_name_en || medicationData.medication_name || medicationData.drug_name,
        medicationData.dose,
        medicationData.dose_unit || 'unit',
        medicationData.route,
        medicationData.frequency || 'as_needed',
        new Date(),
        confirmedBy
      ];

      const orderResult = await db.query(createOrderQuery, orderValues);
      orderId = orderResult.rows[0].order_id;
      console.log(`   Created placeholder order: ${orderId}`);
    }

    // Calculate hash for medication administration (simplified - no chain for voice entries)
    const crypto = await import('crypto');
    const recordData = JSON.stringify({
      order_id: orderId,
      patient_id: patientId,
      administered_datetime: medicationData.administered_datetime || new Date(),
      dose_given: medicationData.dose,
      route_given: medicationData.route,
      administered_by: confirmedBy
    });
    const recordHash = crypto.createHash('sha256').update(recordData).digest('hex');

    // Insert medication administration
    const query = `
      INSERT INTO medication_administrations (
        order_id,
        patient_id,
        scheduled_datetime,
        administered_datetime,
        patient_barcode_scanned,
        medication_barcode_scanned,
        dose_given,
        route_given,
        status,
        reason_if_not_given,
        administered_by,
        notes,
        record_hash,
        previous_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      orderId,
      patientId,
      medicationData.scheduled_datetime || null,
      medicationData.administered_datetime || medicationData.time || new Date(),
      false, // Voice entries don't have barcode scans
      false,
      medicationData.dose,
      medicationData.route,
      medicationData.status || 'administered',
      medicationData.reason_if_not_given || null,
      confirmedBy,
      medicationData.response || medicationData.notes || `Voice entry from review ${reviewItem.review_id}`,
      recordHash,
      null // No previous hash for voice entries
    ];

    const result = await db.query(query, values);
    const insertedMedication = result.rows[0];

    console.log(`✅ Medication inserted: ${insertedMedication.administration_id}`);
    console.log(`   Patient: ${patientId}`);
    console.log(`   Medication: ${medicationData.medication_name || medicationData.drug_name}`);
    console.log(`   Dose: ${medicationData.dose}`);

    return insertedMedication;

  } catch (error) {
    console.error('❌ Error inserting medication from review:', error.message);
    throw error;
  }
}

/**
 * Insert clinical note from a confirmed review
 * @param {object} reviewItem - The review item containing extracted data
 * @param {string} confirmedBy - UUID of staff member confirming the review
 * @returns {Promise<object>} Inserted clinical note record
 */
export async function insertClinicalNoteFromReview(reviewItem, confirmedBy) {
  try {
    console.log('📝 Inserting clinical note from review...');
    
    // Extract clinical note data from review
    const clinicalNoteCategory = reviewItem.extracted_data.categories.find(
      cat => cat.type === 'clinical_note'
    );

    if (!clinicalNoteCategory) {
      throw new Error('No clinical note data found in review');
    }

    const noteData = clinicalNoteCategory.data;
    const patientId = reviewItem.context_patient_id;

    if (!patientId) {
      throw new Error('Patient ID is required for clinical note insertion');
    }

    // Get staff information
    const staffQuery = `
      SELECT family_name, given_name, role
      FROM staff
      WHERE staff_id = $1
    `;
    const staffResult = await db.query(staffQuery, [confirmedBy]);
    const staff = staffResult.rows[0];
    const authorName = staff ? `${staff.family_name} ${staff.given_name}` : 'Unknown';
    const authorRole = staff?.role || 'registered_nurse';

    // Format note text (SOAP format if applicable)
    let noteText = '';
    if (noteData.subjective || noteData.objective || noteData.assessment || noteData.plan) {
      // SOAP format
      if (noteData.subjective) noteText += `S: ${noteData.subjective}\n`;
      if (noteData.objective) noteText += `O: ${noteData.objective}\n`;
      if (noteData.assessment) noteText += `A: ${noteData.assessment}\n`;
      if (noteData.plan) noteText += `P: ${noteData.plan}\n`;
    } else if (noteData.note_text || noteData.description) {
      // Simple note format
      noteText = noteData.note_text || noteData.description;
    } else {
      // Fallback: use transcript
      noteText = reviewItem.transcript;
    }

    // Determine note category
    let noteCategory = noteData.category || 'other';
    const validCategories = [
      'symptom_observation',
      'treatment',
      'consultation',
      'fall_incident',
      'medication',
      'vital_signs',
      'behavioral',
      'other'
    ];
    if (!validCategories.includes(noteCategory)) {
      noteCategory = 'other';
    }

    // Insert clinical note
    const query = `
      INSERT INTO clinical_notes (
        patient_id,
        note_type,
        note_category,
        note_datetime,
        note_text,
        voice_recording_id,
        voice_transcribed,
        authored_by,
        author_role,
        author_name,
        follow_up_required,
        follow_up_date,
        follow_up_notes,
        status,
        requires_approval
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'submitted', $14)
      RETURNING *
    `;

    const values = [
      patientId,
      noteData.note_type || 'nurse_note',
      noteCategory,
      noteData.note_datetime || new Date(),
      noteText,
      reviewItem.recording_id,
      true, // Voice transcribed
      confirmedBy,
      authorRole,
      authorName,
      noteData.follow_up_required || false,
      noteData.follow_up_date || null,
      noteData.follow_up_notes || null,
      noteData.requires_approval || false
    ];

    const result = await db.query(query, values);
    const insertedNote = result.rows[0];

    console.log(`✅ Clinical note inserted: ${insertedNote.note_id}`);
    console.log(`   Patient: ${patientId}`);
    console.log(`   Category: ${noteCategory}`);
    console.log(`   Author: ${authorName}`);

    return insertedNote;

  } catch (error) {
    console.error('❌ Error inserting clinical note from review:', error.message);
    throw error;
  }
}

/**
 * Insert ADL assessment from a confirmed review
 * @param {object} reviewItem - The review item containing extracted data
 * @param {string} confirmedBy - UUID of staff member confirming the review
 * @returns {Promise<object>} Inserted Barthel assessment record
 */
export async function insertADLFromReview(reviewItem, confirmedBy) {
  try {
    console.log('🚶 Inserting ADL assessment from review...');
    
    // Extract ADL data from review
    const adlCategory = reviewItem.extracted_data.categories.find(
      cat => cat.type === 'adl'
    );

    if (!adlCategory) {
      throw new Error('No ADL data found in review');
    }

    const adlData = adlCategory.data;
    const patientId = reviewItem.context_patient_id;

    if (!patientId) {
      throw new Error('Patient ID is required for ADL insertion');
    }

    // Calculate total score from category scores
    // Barthel Index categories and their max scores:
    // eating (10), transfer (15), toileting (10), walking (15), grooming (5),
    // bathing (5), stairs (10), dressing (10), bowel (10), bladder (10)
    let categoryScores = {};
    let totalScore = 0;

    if (adlData.category_scores) {
      categoryScores = adlData.category_scores;
      totalScore = Object.values(categoryScores).reduce((sum, score) => sum + (score || 0), 0);
    } else if (adlData.activities) {
      // Convert activities array to category scores
      for (const activity of adlData.activities) {
        const activityName = activity.activity || activity.name;
        const score = activity.score || 0;
        categoryScores[activityName] = score;
        totalScore += score;
      }
    } else if (adlData.total_score !== undefined) {
      // Use provided total score
      totalScore = adlData.total_score;
      // Create placeholder category scores
      categoryScores = { general: totalScore };
    } else {
      throw new Error('ADL data must include category_scores, activities, or total_score');
    }

    // Validate total score
    if (totalScore < 0 || totalScore > 100) {
      throw new Error(`Total Barthel score ${totalScore} is outside valid range (0-100)`);
    }

    // Insert Barthel assessment
    const query = `
      INSERT INTO barthel_assessments (
        patient_id,
        assessed_at,
        total_score,
        category_scores,
        additional_notes,
        voice_recording_id,
        assessed_by,
        input_method
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'voice')
      RETURNING *
    `;

    const values = [
      patientId,
      adlData.assessed_at || new Date(),
      totalScore,
      JSON.stringify(categoryScores),
      adlData.additional_notes || adlData.notes || null,
      reviewItem.recording_id,
      confirmedBy
    ];

    const result = await db.query(query, values);
    const insertedAssessment = result.rows[0];

    console.log(`✅ ADL assessment inserted: ${insertedAssessment.assessment_id}`);
    console.log(`   Patient: ${patientId}`);
    console.log(`   Total score: ${totalScore}/100`);

    return insertedAssessment;

  } catch (error) {
    console.error('❌ Error inserting ADL from review:', error.message);
    throw error;
  }
}

/**
 * Insert incident report from a confirmed review
 * @param {object} reviewItem - The review item containing extracted data
 * @param {string} confirmedBy - UUID of staff member confirming the review
 * @returns {Promise<object>} Inserted incident report record
 */
export async function insertIncidentFromReview(reviewItem, confirmedBy) {
  try {
    console.log('⚠️  Inserting incident report from review...');
    
    // Extract incident data from review
    const incidentCategory = reviewItem.extracted_data.categories.find(
      cat => cat.type === 'incident'
    );

    if (!incidentCategory) {
      throw new Error('No incident data found in review');
    }

    const incidentData = incidentCategory.data;
    const patientId = reviewItem.context_patient_id;

    if (!patientId) {
      throw new Error('Patient ID is required for incident insertion');
    }

    // Validate required fields
    if (!incidentData.description) {
      throw new Error('Incident description is required');
    }

    // Validate incident type
    const validTypes = ['fall', 'medication-error', 'behavioral', 'injury', 'other'];
    let incidentType = incidentData.type || incidentData.incident_type || 'other';
    if (!validTypes.includes(incidentType)) {
      incidentType = 'other';
    }

    // Validate severity
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    let severity = incidentData.severity || 'medium';
    if (!validSeverities.includes(severity)) {
      severity = 'medium';
    }

    // Insert incident report
    const query = `
      INSERT INTO patient_incidents (
        patient_id,
        incident_type,
        severity,
        occurred_at,
        description,
        voice_recording_id,
        reported_by,
        reported_at,
        reviewed,
        follow_up_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      patientId,
      incidentType,
      severity,
      incidentData.occurred_at || new Date(),
      incidentData.description,
      reviewItem.recording_id,
      confirmedBy,
      new Date(),
      false, // Not reviewed yet
      incidentData.actions_taken || incidentData.follow_up_notes || null
    ];

    const result = await db.query(query, values);
    const insertedIncident = result.rows[0];

    console.log(`✅ Incident report inserted: ${insertedIncident.incident_id}`);
    console.log(`   Patient: ${patientId}`);
    console.log(`   Type: ${incidentType}`);
    console.log(`   Severity: ${severity}`);

    return insertedIncident;

  } catch (error) {
    console.error('❌ Error inserting incident from review:', error.message);
    throw error;
  }
}

/**
 * Insert care plan item from a confirmed review
 * @param {object} reviewItem - The review item containing extracted data
 * @param {string} confirmedBy - UUID of staff member confirming the review
 * @returns {Promise<object>} Inserted care plan item record
 */
export async function insertCarePlanFromReview(reviewItem, confirmedBy) {
  try {
    console.log('📋 Inserting care plan from review...');
    
    // Extract care plan data from review
    const carePlanCategory = reviewItem.extracted_data.categories.find(
      cat => cat.type === 'care_plan'
    );

    if (!carePlanCategory) {
      throw new Error('No care plan data found in review');
    }

    const carePlanData = carePlanCategory.data;
    const patientId = reviewItem.context_patient_id;

    if (!patientId) {
      throw new Error('Patient ID is required for care plan insertion');
    }

    // Validate required fields
    if (!carePlanData.problem && !carePlanData.problem_description) {
      throw new Error('Problem description is required for care plan');
    }

    if (!carePlanData.goal && !carePlanData.long_term_goal_description) {
      throw new Error('Goal description is required for care plan');
    }

    // Find or create active care plan for patient
    let carePlanId = null;
    const carePlanQuery = `
      SELECT care_plan_id FROM care_plans
      WHERE patient_id = $1 AND status = 'active'
      ORDER BY created_date DESC
      LIMIT 1
    `;
    const carePlanResult = await db.query(carePlanQuery, [patientId]);

    if (carePlanResult.rows.length > 0) {
      carePlanId = carePlanResult.rows[0].care_plan_id;
      console.log(`   Found active care plan: ${carePlanId}`);
    } else {
      // Create new care plan
      console.log('   No active care plan found, creating new one...');
      const createCarePlanQuery = `
        INSERT INTO care_plans (
          patient_id,
          status,
          created_by,
          comprehensive_policy
        ) VALUES ($1, 'active', $2, $3)
        RETURNING care_plan_id
      `;
      const createResult = await db.query(createCarePlanQuery, [
        patientId,
        confirmedBy,
        `Care plan created from voice review ${reviewItem.review_id}`
      ]);
      carePlanId = createResult.rows[0].care_plan_id;
      console.log(`   Created new care plan: ${carePlanId}`);
    }

    // Determine problem category
    const problemCategory = carePlanData.problem_category || 'general';

    // Prepare interventions
    let interventions = [];
    if (carePlanData.interventions) {
      if (Array.isArray(carePlanData.interventions)) {
        interventions = carePlanData.interventions.map((intervention, index) => ({
          intervention_id: index + 1,
          type: typeof intervention === 'string' ? 'nursing' : (intervention.type || 'nursing'),
          description: typeof intervention === 'string' ? intervention : intervention.description,
          frequency: typeof intervention === 'string' ? 'daily' : (intervention.frequency || 'daily'),
          responsible_role: typeof intervention === 'string' ? 'registered_nurse' : (intervention.responsible_role || 'registered_nurse')
        }));
      } else if (typeof carePlanData.interventions === 'string') {
        interventions = [{
          intervention_id: 1,
          type: 'nursing',
          description: carePlanData.interventions,
          frequency: 'daily',
          responsible_role: 'registered_nurse'
        }];
      }
    }

    // Insert care plan item
    const query = `
      INSERT INTO care_plan_items (
        care_plan_id,
        problem_category,
        problem_description,
        problem_priority,
        identified_date,
        problem_status,
        long_term_goal_description,
        long_term_goal_target_date,
        long_term_goal_duration,
        short_term_goal_description,
        short_term_goal_target_date,
        short_term_goal_duration,
        short_term_goal_measurable_criteria,
        interventions,
        updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;

    const values = [
      carePlanId,
      problemCategory,
      carePlanData.problem || carePlanData.problem_description,
      carePlanData.problem_priority || 'medium',
      carePlanData.identified_date || new Date(),
      'active',
      carePlanData.goal || carePlanData.long_term_goal_description,
      carePlanData.long_term_goal_target_date || null,
      carePlanData.long_term_goal_duration || '3_months',
      carePlanData.short_term_goal || carePlanData.short_term_goal_description || carePlanData.goal || carePlanData.long_term_goal_description,
      carePlanData.short_term_goal_target_date || null,
      carePlanData.short_term_goal_duration || '1_month',
      carePlanData.short_term_goal_measurable_criteria || null,
      JSON.stringify(interventions),
      confirmedBy
    ];

    const result = await db.query(query, values);
    const insertedCarePlanItem = result.rows[0];

    console.log(`✅ Care plan item inserted: ${insertedCarePlanItem.care_plan_item_id}`);
    console.log(`   Patient: ${patientId}`);
    console.log(`   Care plan: ${carePlanId}`);
    console.log(`   Problem: ${carePlanData.problem || carePlanData.problem_description}`);

    return insertedCarePlanItem;

  } catch (error) {
    console.error('❌ Error inserting care plan from review:', error.message);
    throw error;
  }
}

/**
 * Insert pain assessment from a confirmed review
 * @param {object} reviewItem - The review item containing extracted data
 * @param {string} confirmedBy - UUID of staff member confirming the review
 * @returns {Promise<object>} Inserted pain assessment record
 */
export async function insertPainAssessmentFromReview(reviewItem, confirmedBy) {
  try {
    console.log('😣 Inserting pain assessment from review...');
    
    // Extract pain data from review
    const painCategory = reviewItem.extracted_data.categories.find(
      cat => cat.type === 'pain'
    );

    if (!painCategory) {
      throw new Error('No pain data found in review');
    }

    const painData = painCategory.data;
    const patientId = reviewItem.context_patient_id;

    if (!patientId) {
      throw new Error('Patient ID is required for pain assessment insertion');
    }

    // Validate pain score
    if (painData.intensity === undefined && painData.pain_score === undefined) {
      throw new Error('Pain intensity/score is required');
    }

    const painScore = painData.intensity || painData.pain_score;
    if (painScore < 0 || painScore > 10) {
      throw new Error(`Pain score ${painScore} is outside valid range (0-10)`);
    }

    // Prepare structured data for nursing assessment
    const structuredData = {
      assessment_type: 'pain',
      pain_score: painScore,
      pain_location: painData.location || null,
      pain_character: painData.character || null,
      pain_duration: painData.duration || null,
      aggravating_factors: painData.aggravating_factors || null,
      relieving_factors: painData.relieving_factors || null
    };

    // Prepare narrative notes
    let narrativeNotes = '';
    if (painData.location) narrativeNotes += `Location: ${painData.location}\n`;
    if (painData.character) narrativeNotes += `Character: ${painData.character}\n`;
    if (painData.duration) narrativeNotes += `Duration: ${painData.duration}\n`;
    if (painData.aggravating_factors) narrativeNotes += `Aggravating factors: ${painData.aggravating_factors}\n`;
    if (painData.relieving_factors) narrativeNotes += `Relieving factors: ${painData.relieving_factors}\n`;

    if (!narrativeNotes) {
      narrativeNotes = `Pain assessment: ${painScore}/10`;
    }

    // Insert nursing assessment
    const query = `
      INSERT INTO nursing_assessments (
        patient_id,
        assessment_datetime,
        assessment_type,
        input_method,
        voice_recording_id,
        structured_data,
        narrative_notes,
        ai_processed,
        ai_confidence_score,
        assessed_by
      ) VALUES ($1, $2, 'pain', 'voice', $3, $4, $5, true, $6, $7)
      RETURNING *
    `;

    const values = [
      patientId,
      painData.assessment_datetime || new Date(),
      reviewItem.recording_id,
      JSON.stringify(structuredData),
      narrativeNotes,
      painCategory.confidence || 0.8,
      confirmedBy
    ];

    const result = await db.query(query, values);
    const insertedAssessment = result.rows[0];

    console.log(`✅ Pain assessment inserted: ${insertedAssessment.assessment_id}`);
    console.log(`   Patient: ${patientId}`);
    console.log(`   Pain score: ${painScore}/10`);

    return insertedAssessment;

  } catch (error) {
    console.error('❌ Error inserting pain assessment from review:', error.message);
    throw error;
  }
}

// Export all functions
export default {
  insertVitalsFromReview,
  insertMedicationFromReview,
  insertClinicalNoteFromReview,
  insertADLFromReview,
  insertIncidentFromReview,
  insertCarePlanFromReview,
  insertPainAssessmentFromReview,
  validateVitalSigns
};

/**
 * Insert all data from a confirmed review in an atomic transaction
 * Wraps all insertions in a single transaction - all succeed or all fail
 * @param {object} reviewItem - The review item containing extracted data
 * @param {string} confirmedBy - UUID of staff member confirming the review
 * @param {object} [options] - Options for insertion
 * @param {number} [options.maxRetries=3] - Maximum number of retry attempts on deadlock
 * @returns {Promise<object>} Result with inserted records
 */
export async function insertReviewDataAtomic(reviewItem, confirmedBy, options = {}) {
  const { maxRetries = 3 } = options;
  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    attempt++;
    const client = await db.getClient();
    
    try {
      console.log(`🔄 Starting atomic transaction (attempt ${attempt}/${maxRetries})...`);
      await client.query('BEGIN');

      const insertedRecords = {
        vitals: [],
        medications: [],
        clinical_notes: [],
        adl_assessments: [],
        incidents: [],
        care_plan_items: [],
        pain_assessments: []
      };

      // Check if this is a global context review
      const isGlobalContext = !reviewItem.context_patient_id;
      
      console.log(`🔍 DEBUG: reviewItem.context_patient_id = "${reviewItem.context_patient_id}"`);
      console.log(`🔍 DEBUG: isGlobalContext = ${isGlobalContext}`);
      
      if (isGlobalContext) {
        console.log('   📝 Global context review - skipping patient-specific data insertion');
      }

      // Process each category in the extracted data
      for (const category of reviewItem.extracted_data.categories) {
        try {
          switch (category.type) {
            case 'vitals':
              if (isGlobalContext) {
                console.log('   ⏭️  Skipping vitals insertion (global context - no patient specified)');
                break;
              }
              console.log('   Inserting vitals...');
              const vitals = await insertVitalsFromReviewWithClient(client, reviewItem, confirmedBy);
              insertedRecords.vitals.push(vitals);
              break;

            case 'medication':
              if (isGlobalContext) {
                console.log('   ⏭️  Skipping medication insertion (global context - no patient specified)');
                break;
              }
              console.log('   Inserting medication...');
              const medication = await insertMedicationFromReviewWithClient(client, reviewItem, confirmedBy);
              insertedRecords.medications.push(medication);
              break;

            case 'clinical_note':
              // Clinical notes can be inserted for global context (general notes)
              console.log('   Inserting clinical note...');
              const clinicalNote = await insertClinicalNoteFromReviewWithClient(client, reviewItem, confirmedBy);
              insertedRecords.clinical_notes.push(clinicalNote);
              break;

            case 'adl':
              if (isGlobalContext) {
                console.log('   ⏭️  Skipping ADL assessment insertion (global context - no patient specified)');
                break;
              }
              console.log('   Inserting ADL assessment...');
              const adl = await insertADLFromReviewWithClient(client, reviewItem, confirmedBy);
              insertedRecords.adl_assessments.push(adl);
              break;

            case 'incident':
              if (isGlobalContext) {
                console.log('   ⏭️  Skipping incident report insertion (global context - no patient specified)');
                break;
              }
              console.log('   Inserting incident report...');
              const incident = await insertIncidentFromReviewWithClient(client, reviewItem, confirmedBy);
              insertedRecords.incidents.push(incident);
              break;

            case 'care_plan':
              if (isGlobalContext) {
                console.log('   ⏭️  Skipping care plan insertion (global context - no patient specified)');
                break;
              }
              console.log('   Inserting care plan item...');
              const carePlanItem = await insertCarePlanFromReviewWithClient(client, reviewItem, confirmedBy);
              insertedRecords.care_plan_items.push(carePlanItem);
              break;

            case 'pain':
              if (isGlobalContext) {
                console.log('   ⏭️  Skipping pain assessment insertion (global context - no patient specified)');
                break;
              }
              console.log('   Inserting pain assessment...');
              const painAssessment = await insertPainAssessmentFromReviewWithClient(client, reviewItem, confirmedBy);
              insertedRecords.pain_assessments.push(painAssessment);
              break;

            default:
              console.warn(`   ⚠️  Unknown category type: ${category.type}`);
          }
        } catch (categoryError) {
          console.error(`   ❌ Error inserting ${category.type}:`, categoryError.message);
          throw categoryError; // Rollback entire transaction
        }
      }

      // Update review status to 'confirmed'
      await client.query(
        'UPDATE voice_review_queue SET status = $1, reviewed_at = NOW() WHERE review_id = $2',
        ['confirmed', reviewItem.review_id]
      );

      // Update categorization log
      await client.query(`
        UPDATE voice_categorization_log
        SET 
          confirmed_at = NOW(),
          confirmed_by = $1
        WHERE review_id = $2
      `, [confirmedBy, reviewItem.review_id]);

      // Update voice recording review_status
      await client.query(
        'UPDATE voice_recordings SET review_status = $1 WHERE recording_id = $2',
        ['reviewed', reviewItem.recording_id]
      );

      // Commit transaction
      await client.query('COMMIT');
      console.log(`✅ Atomic transaction committed successfully`);
      console.log(`   Inserted: ${Object.values(insertedRecords).flat().length} records`);

      return {
        success: true,
        insertedRecords,
        reviewId: reviewItem.review_id
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Transaction rolled back (attempt ${attempt}/${maxRetries}):`, error.message);
      
      lastError = error;

      // Check if error is a deadlock (PostgreSQL error code 40P01)
      if (error.code === '40P01' && attempt < maxRetries) {
        console.log(`   🔄 Deadlock detected, retrying in ${attempt * 100}ms...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 100));
        continue; // Retry
      }

      // For other errors, don't retry
      throw error;

    } finally {
      client.release();
    }
  }

  // If we exhausted all retries
  throw new Error(`Transaction failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Helper functions that use a provided client instead of the pool
 * These are used within the atomic transaction
 */

async function insertVitalsFromReviewWithClient(client, reviewItem, confirmedBy) {
  const vitalsCategory = reviewItem.extracted_data.categories.find(cat => cat.type === 'vitals');
  if (!vitalsCategory) throw new Error('No vitals data found');

  const vitalsData = vitalsCategory.data;
  const patientId = reviewItem.context_patient_id;
  if (!patientId) throw new Error('Patient ID required');

  const query = `
    INSERT INTO vital_signs (
      patient_id, measured_at, temperature_celsius,
      blood_pressure_systolic, blood_pressure_diastolic,
      heart_rate, respiratory_rate, oxygen_saturation,
      pain_score, blood_glucose_mg_dl, weight_kg, height_cm,
      input_method, recorded_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'voice', $13)
    RETURNING *
  `;

  const values = [
    patientId,
    vitalsData.measured_at || new Date(),
    vitalsData.temperature_celsius || vitalsData.temperature || null,
    vitalsData.blood_pressure_systolic || vitalsData.blood_pressure?.systolic || null,
    vitalsData.blood_pressure_diastolic || vitalsData.blood_pressure?.diastolic || null,
    vitalsData.heart_rate || null,
    vitalsData.respiratory_rate || null,
    vitalsData.oxygen_saturation || vitalsData.spo2 || null,
    vitalsData.pain_score || null,
    vitalsData.blood_glucose_mg_dl || vitalsData.blood_glucose || null,
    vitalsData.weight_kg || null,
    vitalsData.height_cm || null,
    confirmedBy
  ];

  const result = await client.query(query, values);
  return result.rows[0];
}

async function insertMedicationFromReviewWithClient(client, reviewItem, confirmedBy) {
  const medicationCategory = reviewItem.extracted_data.categories.find(cat => cat.type === 'medication');
  if (!medicationCategory) throw new Error('No medication data found');

  const medicationData = medicationCategory.data;
  const patientId = reviewItem.context_patient_id;
  if (!patientId) throw new Error('Patient ID required');

  // Find or create order
  let orderId = null;
  if (medicationData.medication_name || medicationData.drug_name) {
    const medicationName = medicationData.medication_name || medicationData.drug_name;
    const orderResult = await client.query(
      `SELECT order_id FROM medication_orders
       WHERE patient_id = $1 AND (medication_name_ja ILIKE $2 OR medication_name_en ILIKE $2)
       AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
      [patientId, `%${medicationName}%`]
    );
    if (orderResult.rows.length > 0) {
      orderId = orderResult.rows[0].order_id;
    }
  }

  if (!orderId) {
    const createOrderResult = await client.query(
      `INSERT INTO medication_orders (
        patient_id, order_number, medication_name_ja, medication_name_en,
        dose, dose_unit, route, frequency, start_datetime, status, ordered_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10)
      RETURNING order_id`,
      [
        patientId,
        `VOICE-${Date.now()}`,
        medicationData.medication_name || medicationData.drug_name,
        medicationData.medication_name_en || medicationData.medication_name || medicationData.drug_name,
        medicationData.dose,
        medicationData.dose_unit || 'unit',
        medicationData.route,
        medicationData.frequency || 'as_needed',
        new Date(),
        confirmedBy
      ]
    );
    orderId = createOrderResult.rows[0].order_id;
  }

  const crypto = await import('crypto');
  const recordData = JSON.stringify({
    order_id: orderId,
    patient_id: patientId,
    administered_datetime: medicationData.administered_datetime || new Date(),
    dose_given: medicationData.dose,
    route_given: medicationData.route,
    administered_by: confirmedBy
  });
  const recordHash = crypto.createHash('sha256').update(recordData).digest('hex');

  const result = await client.query(
    `INSERT INTO medication_administrations (
      order_id, patient_id, scheduled_datetime, administered_datetime,
      patient_barcode_scanned, medication_barcode_scanned,
      dose_given, route_given, status, reason_if_not_given,
      administered_by, notes, record_hash, previous_hash
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *`,
    [
      orderId, patientId,
      medicationData.scheduled_datetime || null,
      medicationData.administered_datetime || medicationData.time || new Date(),
      false, false,
      medicationData.dose,
      medicationData.route,
      medicationData.status || 'administered',
      medicationData.reason_if_not_given || null,
      confirmedBy,
      medicationData.response || medicationData.notes || `Voice entry from review ${reviewItem.review_id}`,
      recordHash,
      null
    ]
  );

  return result.rows[0];
}

async function insertClinicalNoteFromReviewWithClient(client, reviewItem, confirmedBy) {
  const clinicalNoteCategory = reviewItem.extracted_data.categories.find(cat => cat.type === 'clinical_note');
  if (!clinicalNoteCategory) throw new Error('No clinical note data found');

  const noteData = clinicalNoteCategory.data;
  const patientId = reviewItem.context_patient_id;
  if (!patientId) throw new Error('Patient ID required');

  const staffResult = await client.query('SELECT family_name, given_name, role FROM staff WHERE staff_id = $1', [confirmedBy]);
  const staff = staffResult.rows[0];
  const authorName = staff ? `${staff.family_name} ${staff.given_name}` : 'Unknown';
  const authorRole = staff?.role || 'registered_nurse';

  let noteText = '';
  if (noteData.subjective || noteData.objective || noteData.assessment || noteData.plan) {
    if (noteData.subjective) noteText += `S: ${noteData.subjective}\n`;
    if (noteData.objective) noteText += `O: ${noteData.objective}\n`;
    if (noteData.assessment) noteText += `A: ${noteData.assessment}\n`;
    if (noteData.plan) noteText += `P: ${noteData.plan}\n`;
  } else {
    noteText = noteData.note_text || noteData.description || reviewItem.transcript;
  }

  const result = await client.query(
    `INSERT INTO clinical_notes (
      patient_id, note_type, note_category, note_datetime, note_text,
      voice_recording_id, voice_transcribed, authored_by, author_role, author_name,
      follow_up_required, follow_up_date, follow_up_notes, status, requires_approval
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'submitted', $14)
    RETURNING *`,
    [
      patientId,
      noteData.note_type || 'nurse_note',
      noteData.category || 'other',
      noteData.note_datetime || new Date(),
      noteText,
      reviewItem.recording_id,
      true,
      confirmedBy,
      authorRole,
      authorName,
      noteData.follow_up_required || false,
      noteData.follow_up_date || null,
      noteData.follow_up_notes || null,
      noteData.requires_approval || false
    ]
  );

  return result.rows[0];
}

async function insertADLFromReviewWithClient(client, reviewItem, confirmedBy) {
  const adlCategory = reviewItem.extracted_data.categories.find(cat => cat.type === 'adl');
  if (!adlCategory) throw new Error('No ADL data found');

  const adlData = adlCategory.data;
  const patientId = reviewItem.context_patient_id;
  if (!patientId) throw new Error('Patient ID required');

  let categoryScores = {};
  let totalScore = 0;

  if (adlData.category_scores) {
    categoryScores = adlData.category_scores;
    totalScore = Object.values(categoryScores).reduce((sum, score) => sum + (score || 0), 0);
  } else if (adlData.activities) {
    for (const activity of adlData.activities) {
      const activityName = activity.activity || activity.name;
      const score = activity.score || 0;
      categoryScores[activityName] = score;
      totalScore += score;
    }
  } else if (adlData.total_score !== undefined) {
    totalScore = adlData.total_score;
    categoryScores = { general: totalScore };
  } else {
    throw new Error('ADL data must include category_scores, activities, or total_score');
  }

  const result = await client.query(
    `INSERT INTO barthel_assessments (
      patient_id, assessed_at, total_score, category_scores,
      additional_notes, voice_recording_id, assessed_by, input_method
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'voice')
    RETURNING *`,
    [
      patientId,
      adlData.assessed_at || new Date(),
      totalScore,
      JSON.stringify(categoryScores),
      adlData.additional_notes || adlData.notes || null,
      reviewItem.recording_id,
      confirmedBy
    ]
  );

  return result.rows[0];
}

async function insertIncidentFromReviewWithClient(client, reviewItem, confirmedBy) {
  const incidentCategory = reviewItem.extracted_data.categories.find(cat => cat.type === 'incident');
  if (!incidentCategory) throw new Error('No incident data found');

  const incidentData = incidentCategory.data;
  const patientId = reviewItem.context_patient_id;
  if (!patientId) throw new Error('Patient ID required');

  const validTypes = ['fall', 'medication-error', 'behavioral', 'injury', 'other'];
  let incidentType = incidentData.type || incidentData.incident_type || 'other';
  if (!validTypes.includes(incidentType)) incidentType = 'other';

  const validSeverities = ['low', 'medium', 'high', 'critical'];
  let severity = incidentData.severity || 'medium';
  if (!validSeverities.includes(severity)) severity = 'medium';

  const result = await client.query(
    `INSERT INTO patient_incidents (
      patient_id, incident_type, severity, occurred_at, description,
      voice_recording_id, reported_by, reported_at, reviewed, follow_up_notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      patientId,
      incidentType,
      severity,
      incidentData.occurred_at || new Date(),
      incidentData.description,
      reviewItem.recording_id,
      confirmedBy,
      new Date(),
      false,
      incidentData.actions_taken || incidentData.follow_up_notes || null
    ]
  );

  return result.rows[0];
}

async function insertCarePlanFromReviewWithClient(client, reviewItem, confirmedBy) {
  const carePlanCategory = reviewItem.extracted_data.categories.find(cat => cat.type === 'care_plan');
  if (!carePlanCategory) throw new Error('No care plan data found');

  const carePlanData = carePlanCategory.data;
  const patientId = reviewItem.context_patient_id;
  if (!patientId) throw new Error('Patient ID required');

  // Find or create care plan
  let carePlanId = null;
  const carePlanResult = await client.query(
    'SELECT care_plan_id FROM care_plans WHERE patient_id = $1 AND status = $2 ORDER BY created_date DESC LIMIT 1',
    [patientId, 'active']
  );

  if (carePlanResult.rows.length > 0) {
    carePlanId = carePlanResult.rows[0].care_plan_id;
  } else {
    const createResult = await client.query(
      'INSERT INTO care_plans (patient_id, status, created_by, comprehensive_policy) VALUES ($1, $2, $3, $4) RETURNING care_plan_id',
      [patientId, 'active', confirmedBy, `Care plan created from voice review ${reviewItem.review_id}`]
    );
    carePlanId = createResult.rows[0].care_plan_id;
  }

  let interventions = [];
  if (carePlanData.interventions) {
    if (Array.isArray(carePlanData.interventions)) {
      interventions = carePlanData.interventions.map((intervention, index) => ({
        intervention_id: index + 1,
        type: typeof intervention === 'string' ? 'nursing' : (intervention.type || 'nursing'),
        description: typeof intervention === 'string' ? intervention : intervention.description,
        frequency: typeof intervention === 'string' ? 'daily' : (intervention.frequency || 'daily'),
        responsible_role: typeof intervention === 'string' ? 'registered_nurse' : (intervention.responsible_role || 'registered_nurse')
      }));
    } else if (typeof carePlanData.interventions === 'string') {
      interventions = [{
        intervention_id: 1,
        type: 'nursing',
        description: carePlanData.interventions,
        frequency: 'daily',
        responsible_role: 'registered_nurse'
      }];
    }
  }

  const result = await client.query(
    `INSERT INTO care_plan_items (
      care_plan_id, problem_category, problem_description, problem_priority,
      identified_date, problem_status, long_term_goal_description,
      long_term_goal_target_date, long_term_goal_duration,
      short_term_goal_description, short_term_goal_target_date,
      short_term_goal_duration, short_term_goal_measurable_criteria,
      interventions, updated_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *`,
    [
      carePlanId,
      carePlanData.problem_category || 'general',
      carePlanData.problem || carePlanData.problem_description,
      carePlanData.problem_priority || 'medium',
      carePlanData.identified_date || new Date(),
      'active',
      carePlanData.goal || carePlanData.long_term_goal_description,
      carePlanData.long_term_goal_target_date || null,
      carePlanData.long_term_goal_duration || '3_months',
      carePlanData.short_term_goal || carePlanData.short_term_goal_description || carePlanData.goal || carePlanData.long_term_goal_description,
      carePlanData.short_term_goal_target_date || null,
      carePlanData.short_term_goal_duration || '1_month',
      carePlanData.short_term_goal_measurable_criteria || null,
      JSON.stringify(interventions),
      confirmedBy
    ]
  );

  return result.rows[0];
}

async function insertPainAssessmentFromReviewWithClient(client, reviewItem, confirmedBy) {
  const painCategory = reviewItem.extracted_data.categories.find(cat => cat.type === 'pain');
  if (!painCategory) throw new Error('No pain data found');

  const painData = painCategory.data;
  const patientId = reviewItem.context_patient_id;
  if (!patientId) throw new Error('Patient ID required');

  const painScore = painData.intensity || painData.pain_score;
  if (painScore === undefined) throw new Error('Pain intensity/score is required');
  if (painScore < 0 || painScore > 10) throw new Error(`Pain score ${painScore} is outside valid range (0-10)`);

  const structuredData = {
    assessment_type: 'pain',
    pain_score: painScore,
    pain_location: painData.location || null,
    pain_character: painData.character || null,
    pain_duration: painData.duration || null,
    aggravating_factors: painData.aggravating_factors || null,
    relieving_factors: painData.relieving_factors || null
  };

  let narrativeNotes = '';
  if (painData.location) narrativeNotes += `Location: ${painData.location}\n`;
  if (painData.character) narrativeNotes += `Character: ${painData.character}\n`;
  if (painData.duration) narrativeNotes += `Duration: ${painData.duration}\n`;
  if (painData.aggravating_factors) narrativeNotes += `Aggravating factors: ${painData.aggravating_factors}\n`;
  if (painData.relieving_factors) narrativeNotes += `Relieving factors: ${painData.relieving_factors}\n`;
  if (!narrativeNotes) narrativeNotes = `Pain assessment: ${painScore}/10`;

  const result = await client.query(
    `INSERT INTO nursing_assessments (
      patient_id, assessment_datetime, assessment_type, input_method,
      voice_recording_id, structured_data, narrative_notes,
      ai_processed, ai_confidence_score, assessed_by
    ) VALUES ($1, $2, 'pain', 'voice', $3, $4, $5, true, $6, $7)
    RETURNING *`,
    [
      patientId,
      painData.assessment_datetime || new Date(),
      reviewItem.recording_id,
      JSON.stringify(structuredData),
      narrativeNotes,
      painCategory.confidence || 0.8,
      confirmedBy
    ]
  );

  return result.rows[0];
}
