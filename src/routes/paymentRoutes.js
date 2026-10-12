'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/responses');
const { validate } = require('../middlewares/validate');
const { authenticate } = require('../middlewares/authenticate');
const { requireRole, sanitizeRequest } = require('../middlewares/roleGuard');
const paymentService = require('../services/paymentService');
const { submitPaymentSchema, decidePaymentSchema } = require('../validations/paymentSchemas');
const { paginationSchema } = require('../validations/commonSchemas');

// Submit a payment request (any authenticated user).
router.post(
  '/',
  authenticate,
  sanitizeRequest,
  requireRole(),
  validate(submitPaymentSchema),
  asyncHandler(async (req, res) => {
    const result = await paymentService.submitPayment(req.user.id, req.body);
    sendSuccess(res, {
      status: 201,
      data: {
        id: result.payment.id,
        status: result.payment.status,
        isExtension: result.payment.isExtension,
        packageName: result.payment.packageName,
        amount: result.payment.amountCents / 100,
      },
      message: result.message,
    });
  })
);

// Coach decision on a pending request.
router.patch(
  '/:id/decide',
  authenticate,
  sanitizeRequest,
  requireRole('ADMIN'),
  validate(decidePaymentSchema),
  asyncHandler(async (req, res) => {
    const result = await paymentService.decidePayment(req.user, req.params.id, req.body);
    sendSuccess(res, {
      status: 200,
      data: { id: result.payment.id, status: result.payment.status },
      message: result.message,
    });
  })
);

// Payments log: SUPER_ADMIN sees all; coaches see requests aimed at them.
router.get(
  '/',
  authenticate,
  requireRole('ADMIN'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const data = await paymentService.listPayments(req.user, req.query);
    sendSuccess(res, { status: 200, data });
  })
);

module.exports = router;
