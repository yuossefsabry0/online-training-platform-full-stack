'use strict';

const { z } = require('zod');

// Pagination shared by payments log / all-members / audit log endpoints.
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

// Subscription confirmation (Section 3): user picks coach + duration; the
// server resolves everything else (extension vs new) from the database.
const confirmSubscriptionSchema = z.object({
  coachNumber: z.coerce.number().int().positive(),
  months: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]),
});

module.exports = { paginationSchema, confirmSubscriptionSchema };
