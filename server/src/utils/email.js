import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let nodemailerTransporter = null;

// Brevo (Sendinblue) SMTP configuration
const getBrevoTransporter = () => {
  if (!env.BREVO_API_KEY) return null;

  // Brevo SMTP accepts 'apikey' as the username when using an API key.
  // Fall back to SMTP_USER for backward compatibility.
  const brevoUser = env.BREVO_SMTP_USER || env.SMTP_USER || 'apikey';

  return nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
      user: brevoUser,
      pass: env.BREVO_API_KEY,
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 5000,    // 5 seconds
    socketTimeout: 15000,     // 15 seconds
  });
};

// Fallback to generic SMTP if configured
const getNodemailerTransporter = () => {
  if (nodemailerTransporter) return nodemailerTransporter;

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return null;
  }

  nodemailerTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 5000,    // 5 seconds
    socketTimeout: 15000,     // 15 seconds
  });

  return nodemailerTransporter;
};

export const sendEmail = async ({ to, subject, html }) => {
  // Try Brevo first (preferred for production)
  const brevoTransport = getBrevoTransporter();
  if (brevoTransport) {
    try {
      console.log('[email] Attempting to send via Brevo to:', to);
      const fromEmail = env.BREVO_SMTP_USER || env.SMTP_USER || 'noreply@uenr.edu.gh';
      await brevoTransport.sendMail({
        from: `UENR Exam System <${fromEmail}>`,
        to,
        subject,
        html,
      });
      console.log('[email] Brevo success');
      return { success: true, skipped: false, method: 'brevo' };
    } catch (error) {
      console.error('[email] Brevo failed:', error.code || error.message);
      // Fall through to try generic SMTP
    }
  } else {
    console.log('[email] Brevo not configured (no API key or user)');
  }

  // Fallback to generic SMTP if available
  const transport = getNodemailerTransporter();
  if (transport) {
    try {
      console.log('[email] Attempting to send via SMTP to:', to);
      const from = env.SMTP_FROM || env.SMTP_USER;
      await transport.sendMail({
        from,
        to,
        subject,
        html,
      });
      console.log('[email] SMTP success');
      return { success: true, skipped: false, method: 'smtp' };
    } catch (error) {
      console.error('[email] SMTP failed:', error.code || error.message);
      return { success: false, skipped: false, error: error.message };
    }
  } else {
    console.log('[email] SMTP not configured');
  }

  console.warn('[email] No email service configured — skipping email send to', to);
  return { success: false, skipped: true, error: 'No email service configured' };
};

export const isEmailConfigured = () => getBrevoTransporter() !== null || getNodemailerTransporter() !== null;
