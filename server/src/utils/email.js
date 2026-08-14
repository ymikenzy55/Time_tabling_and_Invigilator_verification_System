import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  return transporter;
};

export const sendEmail = async ({ to, subject, html }) => {
  const transport = getTransporter();
  if (!transport) {
    // eslint-disable-next-line no-console
    console.warn('[email] SMTP not configured — skipping email send to', to);
    return { skipped: true };
  }

  const from = env.SMTP_FROM || env.SMTP_USER;

  await transport.sendMail({
    from,
    to,
    subject,
    html,
  });

  return { skipped: false };
};

export const isEmailConfigured = () => getTransporter() !== null;
