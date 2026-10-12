'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/responses');
const { validate } = require('../middlewares/validate');
const { authenticate } = require('../middlewares/authenticate');
const { requireRole, sanitizeRequest } = require('../middlewares/roleGuard');
const subService = require('../services/subscriptionService');
const { confirmSubscriptionSchema } = require('../validations/commonSchemas');


router.get(
  '/status',
  authenticate,
  requireRole(),
  asyncHandler(async (req, res) => {
    const data = await subService.getStatus(req.user);
    sendSuccess(res, { status: 200, data });
  })
);

// available plans across the 3 coaches.
router.get(
  '/plans',
  authenticate,
  requireRole(),
  asyncHandler(async (_req, res) => {
    const plans = await subService.listPlans();
    sendSuccess(res, { status: 200, data: plans });
  })
);

// validates selection & passes it forward to payment.
router.post(
  '/confirm',
  authenticate,
  sanitizeRequest,
  requireRole(),
  validate(confirmSubscriptionSchema),
  asyncHandler(async (req, res) => {
    const result = await subService.confirmSelection(req.user.id, req.body);
    sendSuccess(res, { status: 200, data: result.data, message: result.message });
  })
);

module.exports = router;
