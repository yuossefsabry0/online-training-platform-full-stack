'use strict';

const bcrypt = require('bcryptjs');
const prisma = require('../prisma/prismaClient');
const { ApiError } = require('../utils/ApiError');
const {
  signAccessToken,
  signRefreshToken,
  verifyToken,
  randomSessionId,
} = require('../utils/tokenService');
const { randomToken } = require('../utils/tokens');
const mailer = require('../utils/mailer');
const config = require('../config/env');

const BCRYPT_ROUNDS = 10;

async function signup({ username, email, password }) {
  const [usernameTaken, emailTaken] = await Promise.all([
    prisma.user.findUnique({ where: { username } }),
    prisma.user.findUnique({ where: { email } }),
  ]);
  if (usernameTaken) {
    throw ApiError.conflict('Username already exists - please choose a different username', 'USERNAME_TAKEN');
  }
  if (emailTaken) {
    throw ApiError.conflict('Email is already registered', 'EMAIL_TAKEN');
  }

  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const verifyTokenValue = randomToken();


  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: hashed,
      verifyToken: verifyTokenValue,
      role: 'BASIC',
      isVerified: false,
    },
  });

  await prisma.memberProfile.create({ data: { userId: user.id } });
  await mailer.sendVerificationEmail(user, verifyTokenValue);

  return {
    user: toPublicUserSafe(user),
    message:
      'Account created. A verification link has been emailed to you - the account remains unverified until confirmed.',
  };
}

async function verifyEmail(token) {
  const user = await prisma.user.findUnique({ where: { verifyToken: token } });
  if (!user) {
    throw ApiError.badRequest('Invalid or unknown verification token', 'INVALID_VERIFICATION_TOKEN');
  }
  if (user.isVerified) {
    return { user: toPublicUserSafe(user), message: 'Account already verified' };
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isVerified: true, verifyToken: null },
  });
  return { user: toPublicUserSafe(updated), message: 'Email verified successfully. You can now log in.' };
}

async function login({ username, password }, ip) {
  const user = await prisma.user.findUnique({
    where: { username },
    include: { memberProfile: true },
  });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw ApiError.unauthorized('Invalid username or password', 'INVALID_CREDENTIALS');
  }

  // Deleted accounts can never log back in.
  const deleted = await prisma.deletedAccount.findUnique({ where: { originalId: user.id } });
  if (deleted) {
    throw ApiError.unauthorized('This account has been deleted', 'ACCOUNT_DELETED');
  }

  if (!user.isVerified) {
    throw ApiError.forbidden(
      'Email not verified. Please verify your email before logging in.',
      'EMAIL_NOT_VERIFIED'
    );
  }

  const sessionId = randomSessionId();
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user, sessionId);



  const sessionExpiresAt = new Date(Date.now() + config.jwt.refreshTtlSeconds * 1000);

  return {
    sessionId,
    sessionExpiresAt,
    accessToken,
    refreshToken,
    user: {
      ...toPublicUserSafe(user),
      memberId: user.memberProfile?.memberId ?? null,
      coachId: user.memberProfile?.coachId ?? null,
    },
  };
}


async function refreshAccessToken(refreshToken) {
  let payload;
  try {
    payload = verifyToken(refreshToken, 'refresh');
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Session has ended (24h limit). Please log in again.', 'SESSION_ENDED');
    }
    throw ApiError.unauthorized('Invalid refresh token', 'REFRESH_TOKEN_INVALID');
  }

  const revoked = await prisma.revokedToken.findUnique({ where: { jti: payload.jti } });
  if (revoked) {
    throw ApiError.unauthorized('Refresh token has been revoked (logged out)', 'TOKEN_REVOKED');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw ApiError.unauthorized('Account no longer exists', 'ACCOUNT_NOT_FOUND');

  // Hard cap: even if clock skew or manual minting produced a longer-lived
  // refresh token, never issue an access token beyond login + configured TTL.
  const iatMs = payload.iat * 1000;
  const hardExpiry = new Date(iatMs + config.jwt.refreshTtlSeconds * 1000);
  if (Date.now() >= hardExpiry.getTime()) {
    throw ApiError.unauthorized('Session has ended (24h limit). Please log in again.', 'SESSION_ENDED');
  }

  const accessToken = signAccessToken(user);
  return { accessToken, sessionExpiresAt: hardExpiry, user: toPublicUserSafe(user) };
}

async function logout(accessToken, refreshToken) {
  const entries = [];
  for (const [raw, kind] of [
    [accessToken, 'access'],
    [refreshToken, 'refresh'],
  ]) {
    if (!raw) continue;
    try {
      const payload = verifyToken(raw, kind);
      entries.push({
        jti: payload.jti,
        userId: payload.sub,
        expiresAt: new Date(payload.exp * 1000),
      });
    } catch {

    }
  }
  if (entries.length) {
    await prisma.revokedToken.createMany({ data: entries, skipDuplicates: true });
  }
  return { message: 'Logged out. Tokens have been invalidated.' };
}

// Password reset request: always respond generically (no account enumeration),
// but only actually send when the email exists.
async function forgotPassword(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  let message =
    'If that email is registered, a password reset link has been sent. Check your inbox.';
  if (user) {
    const resetTokenValue = randomToken();
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: resetTokenValue, resetExpires: new Date(Date.now() + 60 * 60 * 1000) },
    });
    await mailer.sendPasswordResetEmail(user, resetTokenValue);
  }
  return { message };
}

async function resetPassword({ token, newPassword }) {
  const user = await prisma.user.findUnique({ where: { resetToken: token } });
  if (!user || !user.resetExpires || user.resetExpires < new Date()) {
    throw ApiError.badRequest('Reset token is invalid or has expired', 'INVALID_RESET_TOKEN');
  }
  const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed, resetToken: null, resetExpires: null },
  });
  return { message: 'Password has been reset. You can now log in with your new password.' };
}

// Self-service profile update: Nickname ONLY (enforced again here).
async function updateNickname(userId, nickname) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { nickname },
  });
  return { user: toPublicUserSafe(user), message: 'Nickname updated' };
}

// Self-service delete (Section 1). Guards: no active subscription (BASIC),
// no pending payment. Account is MOVED to DeletedAccounts, not hard-deleted.
async function deleteOwnAccount(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { memberProfile: true },
  });
  if (!user) throw ApiError.notFound('Account not found');

  if (user.role === 'MEMBER' || (user.memberProfile && user.memberProfile.coachId)) {
    throw ApiError.conflict(
      'You have an active subscription. It must expire or be cancelled by your coach before deleting your account.',
      'ACTIVE_SUBSCRIPTION_EXISTS'
    );
  }

  const pendingPayment = await prisma.paymentRequest.findFirst({
    where: { userId, status: 'PENDING' },
  });
  if (pendingPayment) {
    throw ApiError.conflict(
      'You have a pending payment request. Wait until it is approved or rejected before deleting your account.',
      'PENDING_PAYMENT_EXISTS'
    );
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const record = await tx.deletedAccount.create({
      data: {
        originalId: user.id,
        username: user.username,
        email: user.email,
        roleAtDeletion: user.role,
      },
    });
    // Cascade wipes profile/subscription/payment rows; the DeletedAccounts
    // row above preserves identity for Super Admin review.
    await tx.user.delete({ where: { id: user.id } });
    return record;
  });

  return { deleted, message: 'Account deleted and moved to the deleted-accounts archive.' };
}

// Shared mapper - keeps member fields out unless the caller includes them.
function toPublicUserSafe(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    nickname: user.nickname ?? null,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
  };
}

module.exports = {
  signup,
  verifyEmail,
  login,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword,
  updateNickname,
  deleteOwnAccount,
};
