'use strict';

// Pluggable mailer. Default transport logs to console (dev-friendly, no SMTP
// needed). Swap `send` for nodemailer/sendgrid/etc without touching services.
const config = require('../config/env');

async function send({ to, subject, text }) {
  if (config.env !== 'test') {
    console.log(`[mailer] from=${config.mailFrom} to=${to} subject="${subject}"\n${text}\n`);
  }
  return { queued: true };
}

const sendVerificationEmail = (user, token) =>
  send({
    to: user.email,
    subject: 'Verify your gym account',
    text: `Hi ${user.username}, verify your account with this token:\n\n/api/auth/verify-email?token=${token}`,
  });

const sendPasswordResetEmail = (user, token) =>
  send({
    to: user.email,
    subject: 'Reset your gym account password',
    text: `Reset your password with this token (valid for 1 hour):\n\nPOST /api/auth/reset-password { "token": "${token}", "newPassword": "..." }`,
  });

const sendExpiryWarningEmail = (user, expiresAt, coachName) =>
  send({
    to: user.email,
    subject: 'Your gym subscription is about to end',
    text: `Hi ${user.username}, your ${coachName} subscription ends on ${expiresAt.toISOString()}. Renew via /api/subscriptions/plans.`,
  });

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendExpiryWarningEmail };
