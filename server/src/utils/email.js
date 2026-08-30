import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let resendClient = null;
let nodemailerTransporter = null;

// Initialize Resend if API key is available
const getResendClient = () => {
  if (resendClient) return resendClient;
  if (!env.RESEND_API_KEY) return null;
  
  resendClient = new Resend(env.RESEND_API_KEY);
  return resendClient;
};

// Fallback to nodemailer if SMTP is configured
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
  // Try Resend first (preferred)
  const resend = getResendClient();
  if (resend) {
    try {
      await resend.emails.send({
        from: 'UENR Exam System <onboarding@resend.dev>',
        to,
        subject,
        html,
      });
      return { skipped: false, method: 'resend' };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[email] Resend failed:', error.message);
      // Fall through to try nodemailer
    }
  }

  // Fallback to nodemailer if available
  const transport = getNodemailerTransporter();
  if (transport) {
    try {
      const from = env.SMTP_FROM || env.SMTP_USER;
      await transport.sendMail({
        from,
        to,
        subject,
        html,
      });
      return { skipped: false, method: 'smtp' };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[email] SMTP failed:', error.message);
    }
  }

  // eslint-disable-next-line no-console
  console.warn('[email] No email service configured — skipping email send to', to);
  return { skipped: true };
};

export const isEmailConfigured = () => getResendClient() !== null || getNodemailerTransporter() !== null;
