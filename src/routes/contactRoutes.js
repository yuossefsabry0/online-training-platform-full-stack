'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/responses');
const { ApiError } = require('../utils/ApiError');
const config = require('../config/env');
const prisma = require('../prisma/prismaClient');
const { authenticate } = require('../middlewares/authenticate');
const { requireRole } = require('../middlewares/roleGuard');

router.get(
  '/',
  authenticate,
  requireRole('MEMBER'),
  asyncHandler(async (req, res) => {
    const profile = await prisma.memberProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!profile?.coachId || !profile.expiresAt || profile.expiresAt <= new Date()) {
      throw ApiError.forbidden(
        'Your subscription has ended - subscribe again to access contact information.',
        'SUBSCRIPTION_INACTIVE'
      );
    }
    sendSuccess(res, {
      status: 200,
      data: {
        gymPhone: config.contact.gymPhone,
        gymEmail: config.contact.gymEmail,
        address: config.contact.address,
        hours: config.contact.hours,
        memberId: profile.memberId,
      },
    });
  })
);

module.exports = router;
