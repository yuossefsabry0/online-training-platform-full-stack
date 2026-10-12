'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/responses');
const { validate } = require('../middlewares/validate');
const { authenticate } = require('../middlewares/authenticate');
const { requireRole, sanitizeRequest } = require('../middlewares/roleGuard');
const { rateLimit } = require('../middlewares/rateLimit');
const rate = require('../middlewares/loginRateLimit');
const config = require('../config/env');
const authService = require('../services/authService');
const { ApiError } = require('../utils/ApiError');
const { z } = require('zod');
const {
  signupSchema,
  loginSchema,
  emailTokenSchema,
  resetPasswordSchema,
  updateProfileSchema,
} = require('../validations/authSchemas');


const signupLimit = rateLimit({
  windowMs: config.rateLimit.signup.windowMs,
  max: config.rateLimit.signup.max,
  message: 'Too many signup attempts from this location. Please try again later.',
  code: 'SIGNUP_RATE_LIMITED',
});

const forgotPasswordLimit = rateLimit({
  windowMs: config.rateLimit.forgotPassword.windowMs,
  max: config.rateLimit.forgotPassword.max,
  message: 'Too many password reset requests from this location. Please try again later.',
  code: 'FORGOT_PASSWORD_RATE_LIMITED',
});

const deleteAccountLimit = rateLimit({
  windowMs: config.rateLimit.deleteAccount.windowMs,
  max: config.rateLimit.deleteAccount.max,
  message: 'Too many account deletion attempts. Please try again later.',
  code: 'DELETE_ACCOUNT_RATE_LIMITED',
});

router.post(
  '/signup',
  signupLimit,
  sanitizeRequest,
  validate(signupSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.signup(req.body);
    sendSuccess(res, { status: 201, data: result.user, message: result.message });
  })
);

router.get(
  '/verify-email',
  sanitizeRequest,
  validate(emailTokenSchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await authService.verifyEmail(req.query.token);
    sendSuccess(res, { status: 200, data: { user: result.user }, message: result.message });
  })
);


router.post(
  '/verify-email',
  sanitizeRequest,
  validate(emailTokenSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.verifyEmail(req.body.token);
    sendSuccess(res, { status: 200, data: { user: result.user }, message: result.message });
  })
);

router.post(
  '/login',
  sanitizeRequest,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const ip = req.ip || 'unknown';
    await rate.assertNotLocked({ username: req.body.username, ip });
    try {
      const result = await authService.login(req.body, ip);
      await rate.recordSuccess({ username: req.body.username, ip, userId: result.user.id });
      sendSuccess(res, {
        status: 200,
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          sessionExpiresAt: result.sessionExpiresAt,
          user: result.user,
        },
        message: 'Login successful. The token is valid for 24 hours.',
      });
    } catch (err) {
      if (err.statusCode === 401) {
        await rate.recordFailure({ username: req.body.username, ip }).catch(() => {});
      }
      throw err;
    }
  })
);

router.post(
  '/forgot-password',
  forgotPasswordLimit,
  sanitizeRequest,
  validate(z.object({ email: z.email() })),
  asyncHandler(async (req, res) => {
    const result = await authService.forgotPassword(req.body.email);
    sendSuccess(res, { status: 200, data: null, message: result.message });
  })
);

router.post(
  '/reset-password',
  sanitizeRequest,
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.resetPassword(req.body);
    sendSuccess(res, { status: 200, data: null, message: result.message });
  })
);


router.post(
  '/refresh',
  sanitizeRequest,
  asyncHandler(async (req, res) => {
    const refreshToken = req.body?.refreshToken;
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw ApiError.badRequest('refreshToken is required', 'VALIDATION_ERROR');
    }
    const result = await authService.refreshAccessToken(refreshToken);
    sendSuccess(res, {
      status: 200,
      data: { accessToken: result.accessToken, sessionExpiresAt: result.sessionExpiresAt },
      message: 'Access token refreshed.',
    });
  })
);

router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : null;
    const accessRaw = (req.headers.authorization || '').slice(7).trim();
    const result = await authService.logout(accessRaw, refreshToken);
    sendSuccess(res, { status: 200, data: null, message: result.message });
  })
);

router.patch(
  '/profile',
  authenticate,
  sanitizeRequest,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.updateNickname(req.user.id, req.body.nickname);
    sendSuccess(res, { status: 200, data: result.user, message: result.message });
  })
);

router.delete(
  '/account',
  authenticate,
  deleteAccountLimit,
  asyncHandler(async (req, res) => {
    const result = await authService.deleteOwnAccount(req.user.id);
    sendSuccess(res, { status: 200, data: null, message: result.message });
  })
);

module.exports = router;
