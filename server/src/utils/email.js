import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let nodemailerTransporter = null;

// Brevo (Sendinblue) SMTP configuration
const getBrevoTransporter = () => {
  if (!env.BREVO_API_KEY) return null;

  return nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
      user: 'yeboahmichael977@gmail.com', // Your Brevo login email
      pass: env.BREVO_API_KEY, // Your Brevo SMTP key
    },
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
  });

  return nodemailerTransporter;
};

export const sendEmail = async ({ to, subject, html }) => {
  // Try Brevo first (preferred for production)
  const brevoTransport = getBrevoTransporter();
  if (brevoTransport) {
    try {
      console.log('[email] Attempting to send via Brevo to:', to);
      await brevoTransport.sendMail({
        from: 'UENR Exam System <yeboahmichael977@gmail.com>',
        to,
        subject,
        html,
      });
      console.log('[email] Brevo success');
      return { skipped: false, method: 'brevo' };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[email] Brevo failed:', error);
      // Fall through to try generic SMTP
    }
  } else {
    console.log('[email] Brevo not configured (no API key)');
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
      return { skipped: false, method: 'smtp' };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[email] SMTP failed:', error);
    }
  } else {
    console.log('[email] SMTP not configured');
  }

  // eslint-disable-next-line no-console
  console.warn('[email] No email service configured — skipping email send to', to);
  return { skipped: true };
};

export const isEmailConfigured = () => getBrevoTransporter() !== null || getNodemailerTransporter() !== null;
