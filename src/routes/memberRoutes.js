'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/responses');
const { validate } = require('../middlewares/validate');
const { authenticate } = require('../middlewares/authenticate');
const { requireRole, sanitizeRequest } = require('../middlewares/roleGuard');
const coachService = require('../services/coachService');
const {
  extendMemberSchema,
  changeMemberPlanSchema,
  reduceMemberSchema,
} = require('../validations/coachSchemas');
const { paginationSchema } = require('../validations/commonSchemas');

router.use(authenticate, requireRole('ADMIN'), sanitizeRequest);


router.get(
  '/',
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const data = await coachService.listMyMembers(req.user.id, req.query);
    sendSuccess(res, { status: 200, data });
  })
);


router.post(
  '/:userId/extend',
  validate(extendMemberSchema),
  asyncHandler(async (req, res) => {
    const result = await coachService.extendMember(req.user, req.params.userId, req.body.months);
    sendSuccess(res, { status: 200, data: result });
  })
);


router.post(
  '/:userId/change-plan',
  validate(changeMemberPlanSchema),
  asyncHandler(async (req, res) => {
    const result = await coachService.changeMemberPlan(req.user, req.params.userId, req.body.months);
    sendSuccess(res, { status: 200, data: result });
  })
);


router.post(
  '/:userId/reduce',
  validate(reduceMemberSchema),
  asyncHandler(async (req, res) => {
    const result = await coachService.reduceMember(req.user, req.params.userId, req.body.days);
    sendSuccess(res, { status: 200, data: result });
  })
);

// Cancel immediately.
router.post(
  '/:userId/cancel',
  asyncHandler(async (req, res) => {
    const result = await coachService.cancelMember(req.user, req.params.userId);
    sendSuccess(res, { status: 200, data: null, message: result.message });
  })
);

module.exports = router;
