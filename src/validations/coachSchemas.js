'use strict';

const { z } = require('zod');

// Coach management actions (Section 5).
const extendMemberSchema = z.object({
  months: z.coerce.number().int().min(1).max(36),
});

const changeMemberPlanSchema = z.object({
  months: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]),
});

const reduceMemberSchema = z.object({
  days: z.coerce.number().int().min(1).max(365 * 3),
});

// Super Admin coach CRUD (Section 2).
const createCoachSchema = z.object({
  userId: z.string().min(6), // existing ADMIN user to promote into a coach profile
  coachNumber: z.coerce.number().int().positive(),
  name: z.string().min(2).max(60),
  bio: z.string().max(2000).optional(),
  specialty: z.string().max(120).optional(),
  capacity: z.coerce.number().int().positive().optional().nullable(),
});

const updateCoachSchema = z
  .object({
    bio: z.string().max(2000).optional(),
    specialty: z.string().max(120).optional(),
    capacity: z.coerce.number().int().positive().nullable().optional(),
  })
  .strict();

module.exports = {
  extendMemberSchema,
  changeMemberPlanSchema,
  reduceMemberSchema,
  createCoachSchema,
  updateCoachSchema,
};
