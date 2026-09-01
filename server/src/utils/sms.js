import { env } from '../config/env.js';

// ============================
// Twilio SMS Provider
// ============================
let twilioClient = null;

const getTwilioClient = async () => {
  if (twilioClient) return twilioClient;

  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_PHONE_NUMBER) {
    return null;
  }

  try {
    const twilio = await import('twilio');
    twilioClient = twilio.default(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    return twilioClient;
  } catch (error) {
    console.error('[sms] Failed to initialize Twilio:', error.message);
    return null;
  }
};

const sendViaTwilio = async (to, message) => {
  const client = await getTwilioClient();
  if (!client) return null;

  try {
    console.log('[sms] Attempting to send via Twilio to:', to);
    const result = await client.messages.create({
      body: message,
      from: env.TWILIO_PHONE_NUMBER,
      to,
    });
    console.log('[sms] Twilio success, SID:', result.sid);
    return { success: true, method: 'twilio', messageId: result.sid };
  } catch (error) {
    console.error('[sms] Twilio failed:', error.message);
    throw error;
  }
};

// ============================
// Africa's Talking SMS Provider
// ============================
let africasTalkingClient = null;

const getAfricasTalkingClient = () => {
  if (africasTalkingClient) return africasTalkingClient;

  if (!env.AFRICASTALKING_API_KEY || !env.AFRICASTALKING_USERNAME) {
    return null;
  }

  try {
    // Africa's Talking uses dynamic import
    import('africastalking').then((AfricasTalking) => {
      africasTalkingClient = AfricasTalking.default({
        apiKey: env.AFRICASTALKING_API_KEY,
        username: env.AFRICASTALKING_USERNAME,
      });
    });
    return africasTalkingClient;
  } catch (error) {
    console.error('[sms] Failed to initialize Africa\'s Talking:', error.message);
    return null;
  }
};

const sendViaAfricasTalking = async (to, message) => {
  const client = getAfricasTalkingClient();
  if (!client) return null;

  try {
    console.log('[sms] Attempting to send via Africa\'s Talking to:', to);
    const sms = client.SMS;
    const result = await sms.send({
      to: [to],
      message,
      from: env.AFRICASTALKING_SENDER_ID || undefined,
    });
    
    if (result.SMSMessageData.Recipients[0].status === 'Success') {
      console.log('[sms] Africa\'s Talking success');
      return { 
        success: true, 
        method: 'africastalking',
        messageId: result.SMSMessageData.Recipients[0].messageId 
      };
    } else {
      throw new Error(result.SMSMessageData.Recipients[0].status);
    }
  } catch (error) {
    console.error('[sms] Africa\'s Talking failed:', error.message);
    throw error;
  }
};

// ============================
// Hubtel SMS Provider (Ghana - 20+ years, very established)
// ============================
const sendViaHubtel = async (to, message) => {
  if (!env.HUBTEL_CLIENT_ID || !env.HUBTEL_CLIENT_SECRET) {
    return null;
  }

  try {
    console.log('[sms] Attempting to send via Hubtel to:', to);
    
    // Hubtel uses Basic Auth
    const auth = Buffer.from(`${env.HUBTEL_CLIENT_ID}:${env.HUBTEL_CLIENT_SECRET}`).toString('base64');
    
    const response = await fetch('https://devp-api.hubtel.com/v1/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        From: env.HUBTEL_SENDER_ID || 'UENR',
        To: to,
        Content: message,
      }),
    });

    const result = await response.json();
    
    if (response.ok && result.MessageId) {
      console.log('[sms] Hubtel success, message ID:', result.MessageId);
      return { success: true, method: 'hubtel', messageId: result.MessageId };
    } else {
      throw new Error(result.Message || 'Unknown Hubtel error');
    }
  } catch (error) {
    console.error('[sms] Hubtel failed:', error.message);
    throw error;
  }
};

// ============================
// mNotify SMS Provider (Ghana)
// ============================
const sendViaMnotify = async (to, message) => {
  if (!env.MNOTIFY_API_KEY) {
    return null;
  }

  try {
    console.log('[sms] Attempting to send via mNotify to:', to);
    
    const response = await fetch('https://api.mnotify.com/api/sms/quick', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: env.MNOTIFY_API_KEY,
        to: [to],
        msg: message,
        sender_id: env.MNOTIFY_SENDER_ID || 'UENR',
      }),
    });

    const result = await response.json();
    
    if (result.code === 'ok' || result.status === 'success') {
      console.log('[sms] mNotify success');
      return { success: true, method: 'mnotify', messageId: result.id };
    } else {
      throw new Error(result.message || 'Unknown mNotify error');
    }
  } catch (error) {
    console.error('[sms] mNotify failed:', error.message);
    throw error;
  }
};

// ============================
// Arkesel SMS Provider (Ghana - BEST for local, ~GH₵0.05/SMS)
// ============================
const sendViaArkesel = async (to, message) => {
  if (!env.ARKESEL_API_KEY) {
    return null;
  }

  try {
    console.log('[sms] Attempting to send via Arkesel to:', to);
    
    const response = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: {
        'api-key': env.ARKESEL_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: env.ARKESEL_SENDER_ID || 'UENR',
        message: message,
        recipients: [to],
      }),
    });

    const result = await response.json();
    
    if (result.code === '1000' || result.status === 'success') {
      console.log('[sms] Arkesel success');
      return { success: true, method: 'arkesel', messageId: result.id };
    } else {
      throw new Error(result.message || 'Unknown Arkesel error');
    }
  } catch (error) {
    console.error('[sms] Arkesel failed:', error.message);
    throw error;
  }
};

// ============================
// Vokryn SMS Provider (1000 FREE SMS/month!)
// ============================
const sendViaVokryn = async (to, message) => {
  if (!env.VOKRYN_API_KEY) {
    return null;
  }

  try {
    console.log('[sms] Attempting to send via Vokryn to:', to);
    
    const response = await fetch('https://api.vokryn.com/v1/sms/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.VOKRYN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        message,
        from: env.VOKRYN_SENDER_ID || 'UENR',
      }),
    });

    const result = await response.json();
    
    if (response.ok && result.id) {
      console.log('[sms] Vokryn success, message ID:', result.id);
      return { success: true, method: 'vokryn', messageId: result.id };
    } else {
      throw new Error(result.message || result.error || 'Unknown Vokryn error');
    }
  } catch (error) {
    console.error('[sms] Vokryn failed:', error.message);
    throw error;
  }
};

// ============================
// Termii SMS Provider
// ============================
const sendViaTermii = async (to, message) => {
  if (!env.TERMII_API_KEY || !env.TERMII_SENDER_ID) {
    return null;
  }

  try {
    console.log('[sms] Attempting to send via Termii to:', to);
    
    const response = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        from: env.TERMII_SENDER_ID,
        sms: message,
        type: 'plain',
        channel: 'generic',
        api_key: env.TERMII_API_KEY,
      }),
    });

    const result = await response.json();
    
    if (result.message_id) {
      console.log('[sms] Termii success, message ID:', result.message_id);
      return { success: true, method: 'termii', messageId: result.message_id };
    } else {
      throw new Error(result.message || 'Unknown Termii error');
    }
  } catch (error) {
    console.error('[sms] Termii failed:', error.message);
    throw error;
  }
};

// ============================
// Main SMS Service
// ============================

/**
 * Send an SMS using the first available provider.
 * Tries providers in order: Arkesel → Vokryn → Twilio → Africa's Talking → Termii
 * 
 * @param {Object} params
 * @param {string} params.to - Phone number in E.164 format (e.g., +233201234567)
 * @param {string} params.message - SMS message content (max 160 chars for single SMS)
 * @returns {Promise<{success: boolean, skipped: boolean, method?: string, error?: string}>}
 */
export const sendSMS = async ({ to, message }) => {
  // Validate phone number format (basic check)
  if (!to || !to.startsWith('+')) {
    console.warn('[sms] Invalid phone number format. Must be in E.164 format (e.g., +233201234567)');
    return { success: false, skipped: false, error: 'Invalid phone number format' };
  }

  // Trim message to avoid unexpected charges for multi-part SMS
  const trimmedMessage = message.substring(0, 500);
  if (message.length > 500) {
    console.warn('[sms] Message truncated from', message.length, 'to 500 characters');
  }

  // Try providers in order - whichever is configured will work!
  
  // Try Hubtel first (Ghana - 20+ years, very reliable)
  if (env.HUBTEL_CLIENT_ID && env.HUBTEL_CLIENT_SECRET) {
    try {
      const result = await sendViaHubtel(to, trimmedMessage);
      if (result) return result;
    } catch (error) {
      console.error('[sms] Hubtel provider failed, trying next...');
    }
  } else {
    console.log('[sms] Hubtel not configured');
  }

  // Try mNotify (Ghana)
  if (env.MNOTIFY_API_KEY) {
    try {
      const result = await sendViaMnotify(to, trimmedMessage);
      if (result) return result;
    } catch (error) {
      console.error('[sms] mNotify provider failed, trying next...');
    }
  } else {
    console.log('[sms] mNotify not configured');
  }

  // Try Arkesel (Ghana)
  if (env.ARKESEL_API_KEY) {
    try {
      const result = await sendViaArkesel(to, trimmedMessage);
      if (result) return result;
    } catch (error) {
      console.error('[sms] Arkesel provider failed, trying next...');
    }
  } else {
    console.log('[sms] Arkesel not configured');
  }

  // Try Vokryn (1000 FREE SMS/month - if working)
  if (env.VOKRYN_API_KEY) {
    try {
      const result = await sendViaVokryn(to, trimmedMessage);
      if (result) return result;
    } catch (error) {
      console.error('[sms] Vokryn provider failed, trying next...');
    }
  } else {
    console.log('[sms] Vokryn not configured');
  }

  // Try Twilio
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
    try {
      const result = await sendViaTwilio(to, trimmedMessage);
      if (result) return result;
    } catch (error) {
      console.error('[sms] Twilio provider failed, trying next...');
    }
  } else {
    console.log('[sms] Twilio not configured');
  }

  // Try Africa's Talking
  if (env.AFRICASTALKING_API_KEY && env.AFRICASTALKING_USERNAME) {
    try {
      const result = await sendViaAfricasTalking(to, trimmedMessage);
      if (result) return result;
    } catch (error) {
      console.error('[sms] Africa\'s Talking provider failed, trying next...');
    }
  } else {
    console.log('[sms] Africa\'s Talking not configured');
  }

  // Try Termii last
  if (env.TERMII_API_KEY && env.TERMII_SENDER_ID) {
    try {
      const result = await sendViaTermii(to, trimmedMessage);
      if (result) return result;
    } catch (error) {
      console.error('[sms] Termii provider failed');
      return { success: false, skipped: false, error: error.message };
    }
  } else {
    console.log('[sms] Termii not configured');
  }

  console.warn('[sms] No SMS service configured — skipping SMS send to', to);
  return { success: false, skipped: true, error: 'No SMS service configured' };
};

/**
 * Check if at least one SMS provider is configured
 */
export const isSMSConfigured = () => {
  return !!(
    (env.HUBTEL_CLIENT_ID && env.HUBTEL_CLIENT_SECRET) ||
    env.MNOTIFY_API_KEY ||
    env.ARKESEL_API_KEY ||
    env.VOKRYN_API_KEY ||
    (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER) ||
    (env.AFRICASTALKING_API_KEY && env.AFRICASTALKING_USERNAME) ||
    (env.TERMII_API_KEY && env.TERMII_SENDER_ID)
  );
};

/**
 * Format a phone number to E.164 format for Ghana
 * Example: 0201234567 → +233201234567
 */
export const formatGhanaPhone = (phone) => {
  if (!phone) return null;
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // If it starts with 233, add +
  if (cleaned.startsWith('233')) {
    return `+${cleaned}`;
  }
  
  // If it starts with 0, replace with +233
  if (cleaned.startsWith('0')) {
    return `+233${cleaned.substring(1)}`;
  }
  
  // If it's just the number without country code, add +233
  if (cleaned.length === 9 || cleaned.length === 10) {
    return `+233${cleaned}`;
  }
  
  // Return as-is if we can't format it
  return phone;
};
