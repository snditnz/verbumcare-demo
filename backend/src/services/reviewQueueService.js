import db from '../db/index.js';

/**
 * Review Queue Service
 * Manages the voice review queue for pending user approvals
 * Handles queue operations, chronological ordering, user isolation, and automatic archival
 */

/**
 * Create a review item in the queue
 * @param {object} reviewData - Review item data
 * @param {string} reviewData.recordingId - UUID of the voice recording
 * @param {string} reviewData.userId - UUID of the user who created the recording
 * @param {string} reviewData.contextType - 'patient' or 'global'
 * @param {string} [reviewData.contextPatientId] - UUID of patient (if patient context)
 * @param {string} reviewData.transcript - Transcribed text
 * @param {string} reviewData.transcriptLanguage - Language code (ja, en, zh-TW)
 * @param {object} reviewData.extractedData - Extracted structured data
 * @param {number} reviewData.confidenceScore - Overall confidence score (0.0-1.0)
 * @param {number} [reviewData.processingTimeMs] - Processing time in milliseconds
 * @param {string} [reviewData.modelVersion] - AI model version used
 * @returns {Promise<object>} Created review item with review_id
 */
export async function createReviewItem(reviewData) {
  try {
    console.log('📝 Creating review queue item...');
    
    const {
      recordingId,
      userId,
      contextType,
      contextPatientId = null,
      transcript,
      transcriptLanguage,
      extractedData,
      confidenceScore,
      processingTimeMs = null,
      modelVersion = null
    } = reviewData;

    // Validate required fields
    if (!recordingId || !userId || !contextType || !transcript || !transcriptLanguage || !extractedData) {
      throw new Error('Missing required fields for review item creation');
    }

    // Validate context type
    if (!['patient', 'global'].includes(contextType)) {
      throw new Error('Invalid context type. Must be "patient" or "global"');
    }

    // Validate confidence score
    if (typeof confidenceScore !== 'number' || confidenceScore < 0 || confidenceScore > 1) {
      throw new Error('Confidence score must be a number between 0 and 1');
    }

    const query = `
      INSERT INTO voice_review_queue (
        recording_id,
        user_id,
        context_type,
        context_patient_id,
        transcript,
        transcript_language,
        extracted_data,
        confidence_score,
        processing_time_ms,
        model_version,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
      RETURNING 
        review_id,
        recording_id,
        user_id,
        context_type,
        context_patient_id,
        transcript,
        transcript_language,
        extracted_data,
        confidence_score,
        status,
        created_at,
        processing_time_ms,
        model_version
    `;

    const values = [
      recordingId,
      userId,
      contextType,
      contextPatientId,
      transcript,
      transcriptLanguage,
      JSON.stringify(extractedData),
      confidenceScore,
      processingTimeMs,
      modelVersion
    ];

    const result = await db.query(query, values);
    const reviewItem = result.rows[0];

    console.log(`✅ Review item created: ${reviewItem.review_id}`);
    console.log(`   User: ${userId}`);
    console.log(`   Context: ${contextType}`);
    console.log(`   Confidence: ${confidenceScore.toFixed(2)}`);

    return {
      ...reviewItem,
      extracted_data: typeof reviewItem.extracted_data === 'string' 
        ? JSON.parse(reviewItem.extracted_data) 
        : reviewItem.extracted_data
    };

  } catch (error) {
    console.error('❌ Error creating review item:', error.message);
    throw error;
  }
}

/**
 * Get review queue for a specific user
 * @param {string} userId - UUID of the user
 * @param {object} [options] - Query options
 * @param {string} [options.status] - Filter by status (default: 'pending')
 * @param {number} [options.limit] - Maximum number of items to return
 * @param {number} [options.offset] - Number of items to skip
 * @returns {Promise<Array>} Array of review items with urgency flags
 */
export async function getReviewQueue(userId, options = {}) {
  try {
    console.log(`📋 Fetching review queue for user: ${userId}`);
    
    const {
      status = 'pending',
      limit = 100,
      offset = 0
    } = options;

    // Build query with chronological ordering (oldest first)
    const query = `
      SELECT 
        vrq.review_id,
        vrq.recording_id,
        vrq.user_id,
        vrq.context_type,
        vrq.context_patient_id,
        vrq.transcript,
        vrq.transcript_language,
        vrq.extracted_data,
        vrq.confidence_score,
        vrq.status,
        vrq.created_at,
        vrq.reviewed_at,
        vrq.processing_time_ms,
        vrq.model_version,
        vr.duration_seconds,
        CASE 
          WHEN vrq.context_type = 'patient' THEN 
            COALESCE(p.family_name || ' ' || p.given_name, p.family_name_en || ' ' || p.given_name_en)
          ELSE NULL
        END as patient_name,
        CASE 
          WHEN vrq.created_at < NOW() - INTERVAL '24 hours' THEN true
          ELSE false
        END as is_urgent,
        EXTRACT(EPOCH FROM (NOW() - vrq.created_at)) / 3600 as age_hours
      FROM voice_review_queue vrq
      LEFT JOIN patients p ON vrq.context_patient_id = p.patient_id
      LEFT JOIN voice_recordings vr ON vrq.recording_id = vr.recording_id
      WHERE vrq.user_id = $1
        AND vrq.status = $2
      ORDER BY vrq.created_at ASC
      LIMIT $3 OFFSET $4
    `;

    const values = [userId, status, limit, offset];
    console.log('🔍 Executing getReviewQueue query with values:', values);
    const result = await db.query(query, values);
    console.log('🔍 Raw result sample:', result.rows[0]);
    console.log('🔍 Raw result duration_seconds:', result.rows[0]?.duration_seconds, typeof result.rows[0]?.duration_seconds);

    const reviewItems = result.rows.map(row => {
      console.log(`🔍 Debug row data:`, {
        review_id: row.review_id,
        duration_seconds: row.duration_seconds,
        duration_type: typeof row.duration_seconds
      });
      
      return {
        ...row,
        extracted_data: typeof row.extracted_data === 'string' 
          ? JSON.parse(row.extracted_data) 
          : row.extracted_data,
        age_hours: parseFloat(row.age_hours)
      };
    });

    console.log(`✅ Found ${reviewItems.length} review items`);
    const urgentCount = reviewItems.filter(item => item.is_urgent).length;
    if (urgentCount > 0) {
      console.log(`   ⚠️  ${urgentCount} urgent items (>24 hours old)`);
    }

    return reviewItems;

  } catch (error) {
    console.error('❌ Error fetching review queue:', error.message);
    throw error;
  }
}

/**
 * Update review status
 * @param {string} reviewId - UUID of the review item
 * @param {string} newStatus - New status ('pending', 'in_review', 'confirmed', 'discarded')
 * @param {string} [userId] - UUID of user (for authorization check)
 * @returns {Promise<object>} Updated review item
 */
export async function updateReviewStatus(reviewId, newStatus, userId) {
  try {
    console.log(`🔄 Updating review status: ${reviewId} -> ${newStatus}`);
    
    // Validate status
    const validStatuses = ['pending', 'in_review', 'confirmed', 'discarded'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Build query with optional user authorization check
    let query;
    let values;

    if (userId !== undefined && userId !== null) {
      // With authorization check
      query = `
        UPDATE voice_review_queue
        SET 
          status = $1,
          reviewed_at = CASE WHEN $2 IN ('confirmed', 'discarded') THEN NOW() ELSE reviewed_at END
        WHERE review_id = $3 AND user_id = $4
        RETURNING 
          review_id,
          recording_id,
          user_id,
          context_type,
          context_patient_id,
          transcript,
          transcript_language,
          extracted_data,
          confidence_score,
          status,
          created_at,
          reviewed_at,
          processing_time_ms,
          model_version
      `;
      values = [newStatus, newStatus, reviewId, userId];
    } else {
      // Without authorization check (for system operations)
      query = `
        UPDATE voice_review_queue
        SET 
          status = $1,
          reviewed_at = CASE WHEN $2 IN ('confirmed', 'discarded') THEN NOW() ELSE reviewed_at END
        WHERE review_id = $3
        RETURNING 
          review_id,
          recording_id,
          user_id,
          context_type,
          context_patient_id,
          transcript,
          transcript_language,
          extracted_data,
          confidence_score,
          status,
          created_at,
          reviewed_at,
          processing_time_ms,
          model_version
      `;
      values = [newStatus, newStatus, reviewId];
    }

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Review item not found or user not authorized');
    }

    const reviewItem = result.rows[0];

    console.log(`✅ Review status updated: ${reviewId}`);
    console.log(`   New status: ${newStatus}`);

    return {
      ...reviewItem,
      extracted_data: typeof reviewItem.extracted_data === 'string' 
        ? JSON.parse(reviewItem.extracted_data) 
        : reviewItem.extracted_data
    };

  } catch (error) {
    console.error('❌ Error updating review status:', error.message);
    throw error;
  }
}

/**
 * Delete (archive) a review item
 * @param {string} reviewId - UUID of the review item
 * @param {string} [userId] - UUID of user (for authorization check)
 * @returns {Promise<boolean>} True if deleted successfully
 */
export async function deleteReviewItem(reviewId, userId) {
  try {
    console.log(`🗑️  Deleting review item: ${reviewId}`);
    
    // Instead of hard delete, we update status to 'discarded' for audit trail
    // Pass userId explicitly (can be undefined, which is fine)
    const updatedItem = await updateReviewStatus(reviewId, 'discarded', userId);

    console.log(`✅ Review item archived: ${reviewId}`);
    
    return true;

  } catch (error) {
    console.error('❌ Error deleting review item:', error.message);
    throw error;
  }
}

/**
 * Get review queue count for a user
 * @param {string} userId - UUID of the user
 * @param {string} [status] - Filter by status (default: 'pending')
 * @returns {Promise<number>} Count of review items
 */
export async function getReviewQueueCount(userId, status = 'pending') {
  try {
    const query = `
      SELECT COUNT(*) as count
      FROM voice_review_queue
      WHERE user_id = $1 AND status = $2
    `;

    const result = await db.query(query, [userId, status]);
    const count = parseInt(result.rows[0].count);

    console.log(`📊 Review queue count for user ${userId}: ${count}`);

    return count;

  } catch (error) {
    console.error('❌ Error getting review queue count:', error.message);
    throw error;
  }
}

/**
 * Get a single review item by ID
 * @param {string} reviewId - UUID of the review item
 * @param {string} [userId] - UUID of user (for authorization check)
 * @returns {Promise<object>} Review item
 */
export async function getReviewItem(reviewId, userId = null) {
  try {
    console.log(`🔍 Fetching review item: ${reviewId}`);
    
    let query;
    let values;

    if (userId) {
      query = `
        SELECT 
          vrq.*,
          CASE 
            WHEN vrq.context_type = 'patient' THEN 
              COALESCE(p.family_name || ' ' || p.given_name, p.family_name_en || ' ' || p.given_name_en)
            ELSE NULL
          END as patient_name,
          CASE 
            WHEN vrq.created_at < NOW() - INTERVAL '24 hours' THEN true
            ELSE false
          END as is_urgent
        FROM voice_review_queue vrq
        LEFT JOIN patients p ON vrq.context_patient_id = p.patient_id
        WHERE vrq.review_id = $1 AND vrq.user_id = $2
      `;
      values = [reviewId, userId];
    } else {
      query = `
        SELECT 
          vrq.*,
          CASE 
            WHEN vrq.context_type = 'patient' THEN 
              COALESCE(p.family_name || ' ' || p.given_name, p.family_name_en || ' ' || p.given_name_en)
            ELSE NULL
          END as patient_name,
          CASE 
            WHEN vrq.created_at < NOW() - INTERVAL '24 hours' THEN true
            ELSE false
          END as is_urgent
        FROM voice_review_queue vrq
        LEFT JOIN patients p ON vrq.context_patient_id = p.patient_id
        WHERE vrq.review_id = $1
      `;
      values = [reviewId];
    }

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Review item not found or user not authorized');
    }

    const reviewItem = result.rows[0];

    return {
      ...reviewItem,
      extracted_data: typeof reviewItem.extracted_data === 'string' 
        ? JSON.parse(reviewItem.extracted_data) 
        : reviewItem.extracted_data
    };

  } catch (error) {
    console.error('❌ Error fetching review item:', error.message);
    throw error;
  }
}

/**
 * Archive old review items (>7 days in pending state)
 * This should be called by a background job
 * @returns {Promise<object>} Result with count of archived items and admin notification list
 */
export async function archiveOldReviewItems() {
  try {
    console.log('🗄️  Checking for old review items to archive...');
    
    // Find items older than 7 days in pending state
    const findQuery = `
      SELECT 
        vrq.review_id,
        vrq.user_id,
        vrq.created_at,
        COALESCE(s.family_name || ' ' || s.given_name, s.username) as staff_name
      FROM voice_review_queue vrq
      LEFT JOIN staff s ON vrq.user_id = s.staff_id
      WHERE vrq.status = 'pending'
        AND vrq.created_at < NOW() - INTERVAL '7 days'
    `;

    const findResult = await db.query(findQuery);
    const oldItems = findResult.rows;

    if (oldItems.length === 0) {
      console.log('✅ No old items to archive');
      return {
        archivedCount: 0,
        notifications: []
      };
    }

    console.log(`⚠️  Found ${oldItems.length} items older than 7 days`);

    // Update status to 'archived' (we'll use 'discarded' status for now)
    const archiveQuery = `
      UPDATE voice_review_queue
      SET status = 'discarded', reviewed_at = NOW()
      WHERE status = 'pending'
        AND created_at < NOW() - INTERVAL '7 days'
      RETURNING review_id
    `;

    const archiveResult = await db.query(archiveQuery);
    const archivedCount = archiveResult.rows.length;

    console.log(`✅ Archived ${archivedCount} old review items`);

    // Prepare admin notifications
    const notifications = oldItems.map(item => ({
      userId: item.user_id,
      staffName: item.staff_name,
      reviewId: item.review_id,
      createdAt: item.created_at,
      ageInDays: Math.floor((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24))
    }));

    return {
      archivedCount,
      notifications
    };

  } catch (error) {
    console.error('❌ Error archiving old review items:', error.message);
    throw error;
  }
}

export default {
  createReviewItem,
  getReviewQueue,
  updateReviewStatus,
  deleteReviewItem,
  getReviewQueueCount,
  getReviewItem,
  archiveOldReviewItems
};
