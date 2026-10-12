'use strict';

const { z } = require('zod');

// Payment submission (Section 4): descriptive fields only - the extension/
// new-subscription determination and plan/coach resolution are SERVER-side.
const submitPaymentSchema = z.object({
  holderName: z.string().min(2, 'Name is required').max(80),
  reference: z
    .string()
    .min(4, 'Payment reference number is required')
    .max(64)
    .regex(/^[A-Za-z0-9-_]+$/, 'Reference may contain only letters, digits, dashes and underscores'),
  amount: z.coerce.number().positive('Amount must be positive'),
  packageName: z.string().min(2).max(50),
  coachNumber: z.coerce.number().int().positive(),
});

const decidePaymentSchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string().max(255).optional(),
});

module.exports = { submitPaymentSchema, decidePaymentSchema };
