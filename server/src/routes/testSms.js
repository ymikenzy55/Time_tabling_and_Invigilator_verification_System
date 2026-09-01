import express from 'express';
import { sendSMS, isSMSConfigured, formatGhanaPhone } from '../utils/sms.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = express.Router();

/**
 * Test SMS endpoint - only accessible by SUPER_ADMIN
 * POST /api/test-sms
 * Body: { phoneNumber: string, message: string }
 */
router.post('/test-sms', authenticate, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
      return res.status(400).json({
        error: 'phoneNumber and message are required',
      });
    }

    // Format phone number for Ghana
    const formattedPhone = formatGhanaPhone(phoneNumber);
    
    if (!formattedPhone || !formattedPhone.startsWith('+')) {
      return res.status(400).json({
        error: 'Invalid phone number format. Use Ghana format: 0201234567 or +233201234567',
      });
    }

    // Check if SMS is configured
    if (!isSMSConfigured()) {
      return res.status(503).json({
        error: 'SMS service not configured. Please set up at least one SMS provider in environment variables.',
      });
    }

    // Send test SMS
    const result = await sendSMS({
      to: formattedPhone,
      message: message.substring(0, 160), // Limit to single SMS
    });

    if (result.success) {
      return res.json({
        success: true,
        message: 'SMS sent successfully',
        provider: result.method,
        to: formattedPhone,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to send SMS',
        skipped: result.skipped,
      });
    }
  } catch (error) {
    console.error('[test-sms] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
});

/**
 * Check SMS configuration status
 * GET /api/test-sms/status
 */
router.get('/test-sms/status', authenticate, requireRole(['SUPER_ADMIN']), (req, res) => {
  const configured = isSMSConfigured();
  
  res.json({
    smsConfigured: configured,
    message: configured 
      ? 'SMS service is configured and ready' 
      : 'No SMS provider configured. Check environment variables.',
  });
});

export default router;
