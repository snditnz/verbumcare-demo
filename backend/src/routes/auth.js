import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/index.js';

const router = express.Router();

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-CHANGE-IN-PRODUCTION-use-env-var';
const JWT_EXPIRY = '8h'; // 8 hour access tokens
const REFRESH_EXPIRY = '7d'; // 7 day refresh tokens

// Role mapping: Database role → Frontend role
const ROLE_MAP = {
  'physician': 'doctor',
  'registered_nurse': 'nurse',
  'pharmacist': 'nurse', // Map pharmacist to nurse for now
  'nurse_assistant': 'care_worker'
};

/**
 * POST /api/auth/login
 * Authenticate user with username/password, return JWT tokens
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password, deviceInfo } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    // Validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password required',
        message: 'ユーザー名とパスワードを入力してください'
      });
    }

    // Find staff member by username
    const result = await db.query(
      `SELECT
        staff_id,
        username,
        password_hash,
        role,
        family_name,
        given_name,
        family_name_en,
        given_name_en,
        family_name_kana,
        given_name_kana,
        facility_id
      FROM staff
      WHERE LOWER(username) = LOWER($1)`,
      [username]
    );

    if (result.rows.length === 0) {
      // Log failed attempt
      await db.query(
        `INSERT INTO auth_audit_log
         (username, event_type, ip_address, device_info, success, failure_reason)
         VALUES ($1, 'failed_login', $2, $3, false, 'user_not_found')`,
        [username, ipAddress, deviceInfo ? JSON.stringify(deviceInfo) : null]
      );

      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'ユーザー名またはパスワードが正しくありません'
      });
    }

    const staff = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, staff.password_hash);

    if (!validPassword) {
      // Log failed attempt
      await db.query(
        `INSERT INTO auth_audit_log
         (staff_id, username, event_type, ip_address, device_info, success, failure_reason)
         VALUES ($1, $2, 'failed_login', $3, $4, false, 'invalid_password')`,
        [staff.staff_id, username, ipAddress, deviceInfo ? JSON.stringify(deviceInfo) : null]
      );

      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'ユーザー名またはパスワードが正しくありません'
      });
    }

    // Generate JWT tokens
    const accessToken = jwt.sign(
      {
        staffId: staff.staff_id,
        username: staff.username,
        role: ROLE_MAP[staff.role] || staff.role,
        facilityId: staff.facility_id
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    const refreshToken = jwt.sign(
      {
        staffId: staff.staff_id,
        type: 'refresh'
      },
      JWT_SECRET,
      { expiresIn: REFRESH_EXPIRY }
    );

    // Store session in database
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours from now
    await db.query(
      `INSERT INTO staff_sessions
       (staff_id, access_token, refresh_token, device_info, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        staff.staff_id,
        accessToken,
        refreshToken,
        deviceInfo ? JSON.stringify(deviceInfo) : null,
        ipAddress,
        expiresAt
      ]
    );

    // Log successful login
    await db.query(
      `INSERT INTO auth_audit_log
       (staff_id, username, event_type, ip_address, device_info, success)
       VALUES ($1, $2, 'login', $3, $4, true)`,
      [staff.staff_id, username, ipAddress, deviceInfo ? JSON.stringify(deviceInfo) : null]
    );

    // Build user object
    const user = {
      userId: staff.staff_id,           // THIS IS NOW THE REAL STAFF_ID UUID!
      staffId: staff.staff_id,          // Also include explicitly for clarity
      username: staff.username,
      fullName: staff.family_name_en && staff.given_name_en
        ? `${staff.given_name_en} ${staff.family_name_en}`
        : `${staff.given_name} ${staff.family_name}`,
      fullNameJa: `${staff.family_name} ${staff.given_name}`,
      role: ROLE_MAP[staff.role] || staff.role,
      facilityId: staff.facility_id
    };

    console.log(`✅ Login successful: ${username} (${staff.staff_id}) - role: ${user.role}`);

    res.json({
      success: true,
      data: {
        user,
        accessToken,
        refreshToken,
        expiresIn: 28800 // 8 hours in seconds
      },
      message: 'ログインに成功しました'
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'ログインエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user and invalidate session
 */
router.post('/logout', async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (accessToken) {
      // Delete session from database
      const result = await db.query(
        'DELETE FROM staff_sessions WHERE access_token = $1 RETURNING staff_id',
        [accessToken]
      );

      // Log logout
      if (result.rows.length > 0) {
        try {
          const decoded = jwt.verify(accessToken, JWT_SECRET);
          await db.query(
            `INSERT INTO auth_audit_log
             (staff_id, event_type, success)
             VALUES ($1, 'logout', true)`,
            [decoded.staffId]
          );
          console.log(`✅ Logout successful: ${decoded.staffId}`);
        } catch (err) {
          // Token might be expired, that's okay
          console.log('Logout: token expired or invalid (expected)');
        }
      }
    }

    res.json({
      success: true,
      message: 'ログアウトしました'
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Return success anyway - logout should always succeed from client perspective
    res.json({
      success: true,
      message: 'ログアウトしました'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token required',
        message: 'リフレッシュトークンが必要です'
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token',
        message: 'リフレッシュトークンが無効または期限切れです'
      });
    }

    // Check if session still exists in database
    const sessionResult = await db.query(
      'SELECT * FROM staff_sessions WHERE refresh_token = $1 AND staff_id = $2',
      [refreshToken, decoded.staffId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Session not found',
        message: 'セッションが見つかりません'
      });
    }

    // Get staff data
    const staffResult = await db.query(
      `SELECT
        staff_id,
        username,
        role,
        facility_id
      FROM staff
      WHERE staff_id = $1`,
      [decoded.staffId]
    );

    if (staffResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Staff not found',
        message: 'スタッフが見つかりません'
      });
    }

    const staff = staffResult.rows[0];

    // Generate new access token
    const newAccessToken = jwt.sign(
      {
        staffId: staff.staff_id,
        username: staff.username,
        role: ROLE_MAP[staff.role] || staff.role,
        facilityId: staff.facility_id
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    // Update session with new access token
    const newExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await db.query(
      `UPDATE staff_sessions
       SET access_token = $1,
           expires_at = $2,
           last_activity = CURRENT_TIMESTAMP
       WHERE refresh_token = $3`,
      [newAccessToken, newExpiresAt, refreshToken]
    );

    // Log token refresh
    await db.query(
      `INSERT INTO auth_audit_log
       (staff_id, event_type, success)
       VALUES ($1, 'token_refresh', true)`,
      [staff.staff_id]
    );

    console.log(`✅ Token refreshed: ${staff.staff_id}`);

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        expiresIn: 28800 // 8 hours
      },
      message: 'トークンを更新しました'
    });

  } catch (error) {
    console.error('❌ Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: 'Token refresh failed',
      message: 'トークンの更新に失敗しました',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user information
 */
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
        message: 'トークンが提供されていません'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        message: 'トークンが無効または期限切れです'
      });
    }

    // Get staff data
    const result = await db.query(
      `SELECT
        staff_id,
        username,
        role,
        family_name,
        given_name,
        family_name_en,
        given_name_en,
        facility_id
      FROM staff
      WHERE staff_id = $1`,
      [decoded.staffId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Staff not found',
        message: 'スタッフが見つかりません'
      });
    }

    const staff = result.rows[0];

    const user = {
      userId: staff.staff_id,
      staffId: staff.staff_id,
      username: staff.username,
      fullName: staff.family_name_en && staff.given_name_en
        ? `${staff.given_name_en} ${staff.family_name_en}`
        : `${staff.given_name} ${staff.family_name}`,
      fullNameJa: `${staff.family_name} ${staff.given_name}`,
      role: ROLE_MAP[staff.role] || staff.role,
      facilityId: staff.facility_id
    };

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
      message: '認証に失敗しました',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/auth/sessions
 * Get all active sessions for current user (for session management)
 */
router.get('/sessions', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const result = await db.query(
      `SELECT
        session_id,
        device_info,
        ip_address,
        created_at,
        last_activity,
        expires_at
      FROM staff_sessions
      WHERE staff_id = $1
        AND expires_at > CURRENT_TIMESTAMP
      ORDER BY last_activity DESC`,
      [decoded.staffId]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
});

export default router;
