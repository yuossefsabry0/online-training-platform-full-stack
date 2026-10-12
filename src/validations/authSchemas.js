'use strict';

// Zod v4 schemas (v4 syntax: z.email(), no required_error). The sanitize
// middleware runs BEFORE these, so incoming strings arrive tag-free.

const { z } = require('zod');

const usernameSchema = z.string().min(4, 'Username must be at least 4 characters').max(32);
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(72);
const nicknameSchema = z
  .string()
  .max(50)
  .transform((v) => v.trim());

const signupSchema = z.object({
  username: usernameSchema,
  email: z.email('Email must be a valid email address'),
  password: passwordSchema,
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const emailTokenSchema = z.object({
  token: z.string().min(10, 'Token is required'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Token is required'),
  newPassword: passwordSchema,
});

// Self-service profile update: Nickname ONLY (Section 1). Unknown keys are
// rejected so nobody can sneak a username/email/role change through.
const updateProfileSchema = z
  .object({ nickname: nicknameSchema })
  .strict();

module.exports = {
  usernameSchema,
  passwordSchema,
  signupSchema,
  loginSchema,
  emailTokenSchema,
  resetPasswordSchema,
  updateProfileSchema,
};
