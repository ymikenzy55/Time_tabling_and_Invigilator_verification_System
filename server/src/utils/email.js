import { MailerSend, EmailParams, Sender, Recipient } from 'mailersend';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let mailerSendClient = null;
let nodemailerTransporter = null;

const getMailerSendClient = () => {
  if (mailerSendClient) return mailerSendClient;
  if (!env.MAILERSEND_API_KEY) return null;
  mailerSendClient = new MailerSend({ apiKey: env.MAILERSEND_API_KEY });
  return mailerSendClient;
};

const getNodemailerTransporter = () => {
  if (nodemailerTransporter) return nodemailerTransporter;
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) return null;
  nodemailerTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 15000,
  });
  return nodemailerTransporter;
};

const FROM_EMAIL = env.MAILERSEND_FROM_EMAIL || 'noreply@trial-vyjq2lr7q3p4z0g7.mlsender.net';
const FROM_NAME = env.MAILERSEND_FROM_NAME || 'UENR Exam System';

export const sendEmail = async ({ to, subject, html }) => {
  const mailerSend = getMailerSendClient();
  if (mailerSend) {
    try {
      console.log('[email] Sending via MailerSend to:', to);
      const sentFrom = new Sender(FROM_EMAIL, FROM_NAME);
      const recipients = [new Recipient(to)];
      const emailParams = new EmailParams()
        .setFrom(sentFrom)
        .setTo(recipients)
        .setReplyTo(sentFrom)
        .setSubject(subject)
        .setHtml(html)
        .setText(html.replace(/<[^>]*>/g, ''));
      await mailerSend.email.send(emailParams);
      console.log('[email] MailerSend success');
      return { success: true, skipped: false, method: 'mailersend' };
    } catch (error) {
      console.error('[email] MailerSend failed:', error.message || error);
    }
  } else {
    console.log('[email] MailerSend not configured (no API key)');
  }

  const transport = getNodemailerTransporter();
  if (transport) {
    try {
      console.log('[email] Attempting to send via SMTP to:', to);
      const from = env.SMTP_FROM || env.SMTP_USER;
      await transport.sendMail({ from, to, subject, html });
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

export const isEmailConfigured = () => getMailerSendClient() !== null || getNodemailerTransporter() !== null;
