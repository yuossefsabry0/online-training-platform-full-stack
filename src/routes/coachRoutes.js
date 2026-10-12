'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/responses');
const { validate } = require('../middlewares/validate');
const { authenticate } = require('../middlewares/authenticate');
const { requireRole, sanitizeRequest } = require('../middlewares/roleGuard');
const coachService = require('../services/coachService');

router.get(
  '/:coachNumber',
  authenticate,
  requireRole(),
  asyncHandler(async (req, res) => {
    const data = await coachService.getPublicProfile(Number(req.params.coachNumber));
    sendSuccess(res, { status: 200, data });
  })
);

module.exports = router;
