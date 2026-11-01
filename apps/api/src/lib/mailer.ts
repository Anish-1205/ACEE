import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config';

/**
 * Email over SMTP. Development uses Mailpit (docker compose service `mail`, inbox at http://localhost:8025);
 * production needs a real SMTP_URL. Without SMTP_URL nothing is sent and callers are told so.
 */
let transport: Transporter | null = null;
export const mailConfigured = () => !!config.SMTP_URL;

export async function sendMail(to: string, subject: string, text: string) {
  if (!config.SMTP_URL) throw new Error('SMTP_URL not configured');
  transport ??= nodemailer.createTransport(config.SMTP_URL);
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#333">
  <div style="background:#003A66;color:#fff;padding:16px 20px;font-weight:bold">ACEE Student Portal</div>
  <div style="padding:20px;white-space:pre-line;line-height:1.6">${escapeHtml(text)}</div>
  <div style="padding:12px 20px;font-size:12px;color:#6B7A8F;border-top:1px solid #DCE3EE">ACEE Review Consultants Pvt. Ltd. · This is an automated message.</div>
</div>`;
  await transport.sendMail({ from: config.MAIL_FROM, to, subject, text, html });
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
