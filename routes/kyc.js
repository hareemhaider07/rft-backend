const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { uploadFields } = require('../middleware/upload');
const { uploadFile } = require('../services/storage');

const router = express.Router();

// GET /api/kyc/status
router.get('/status', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const userResult = await pool.query(
      'SELECT kyc_status, kyc_data FROM users WHERE id = $1',
      [userId]
    );
    if (!userResult.rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const user = userResult.rows[0];

    const docsResult = await pool.query(
      `SELECT id, document_type, issuing_country, document_number,
              verification_status, rejection_reason, submitted_at, verified_at
       FROM kyc_documents
       WHERE user_id = $1
       ORDER BY submitted_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        status:       user.kyc_status,
        submitted_at: docsResult.rows.length ? docsResult.rows[0].submitted_at : null,
        documents:    docsResult.rows
      }
    });
  } catch (error) {
    console.error('Get KYC status error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch KYC status' });
  }
});

// POST /api/kyc/submit
router.post('/submit', authenticate, uploadFields([
  { name: 'front_image',  maxCount: 1 },
  { name: 'back_image',   maxCount: 1 },
  { name: 'selfie_image', maxCount: 1 }
]), [
  body('document_type').notEmpty().withMessage('Document type is required'),
  body('issuing_country').notEmpty().withMessage('Issuing country is required'),
  body('document_number').notEmpty().withMessage('Document number is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { document_type, issuing_country, document_number } = req.body;
    const userId = req.user.id;

    // Check if already pending
    const existing = await pool.query(
      `SELECT id FROM kyc_documents
       WHERE user_id = $1 AND verification_status = 'pending'`,
      [userId]
    );
    if (existing.rows.length) {
      return res.status(400).json({
        success: false,
        message: 'KYC documents already submitted and pending review'
      });
    }

    if (!req.files?.front_image) {
      return res.status(400).json({ success: false, message: 'Front image is required' });
    }

    // ── Upload to Supabase Storage (falls back to local if not configured) ──
    const uploadOrFallback = async (file, folder) => {
      if (!file) return null;
      const cloudUrl = await uploadFile(
        file.path || file.buffer,
        folder,
        file.originalname,
        file.mimetype
      );
      // If cloud upload succeeded, use cloud URL; otherwise fall back to local path
      return cloudUrl || `/uploads/${file.filename}`;
    };

    const frontImageUrl  = await uploadOrFallback(req.files.front_image?.[0],  'kyc');
    const backImageUrl   = await uploadOrFallback(req.files.back_image?.[0],   'kyc');
    const selfieImageUrl = await uploadOrFallback(req.files.selfie_image?.[0], 'kyc');

    // Insert KYC record
    const result = await pool.query(
      `INSERT INTO kyc_documents
         (user_id, document_type, issuing_country, document_number,
          front_image_url, back_image_url, selfie_image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [userId, document_type, issuing_country, document_number,
       frontImageUrl, backImageUrl, selfieImageUrl]
    );

    // Update user KYC status
    await pool.query('UPDATE users SET kyc_status = $1 WHERE id = $2', ['pending', userId]);

    // Notify user
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, 'KYC Submitted ✅', 'Your identity documents have been submitted. Review takes 24–48 hours.', 'info')`,
      [userId]
    );

    res.json({
      success: true,
      message: 'KYC documents submitted. Admin will review within 24–48 hours.',
      data: { kyc_id: result.rows[0].id, status: 'pending' }
    });
  } catch (error) {
    console.error('Submit KYC error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit KYC documents', error: error.message });
  }
});

module.exports = router;
