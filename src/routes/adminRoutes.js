'use strict';

/* Admin / Super Admin dashboard endpoints:
- payments log (ADMIN scoped, SUPER_ADMIN full)
- member subscription history
- audit log (SUPER_ADMIN only)
- deleted accounts (SUPER_ADMIN only)
- coach CRUD (SUPER_ADMIN only)
*/
const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/responses');
const { validate } = require('../middlewares/validate');
const { authenticate } = require('../middlewares/authenticate');
const { requireRole } = require('../middlewares/roleGuard');
const prisma = require('../prisma/prismaClient');
const paymentService = require('../services/paymentService');
const subService = require('../services/subscriptionService');
const coachService = require('../services/coachService');
const auditService = require('../services/auditService');
const { paginationSchema } = require('../validations/commonSchemas');
const { createCoachSchema, updateCoachSchema } = require('../validations/coachSchemas');

router.use(authenticate);

router.get(
  '/payments',
  requireRole('ADMIN'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const data = await paymentService.listPayments(req.user, req.query);
    sendSuccess(res, { status: 200, data });
  })
);


router.get(
  '/members/:userId/history',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const entries = await subService.getHistory(req.user, req.params.userId);
    sendSuccess(res, { status: 200, data: entries });
  })
);

// SUPER_ADMIN only
router.get(
  '/audit-log',
  requireRole('SUPER_ADMIN'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query;
    const [total, rows] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          actor: { select: { username: true, role: true } },
          target: { select: { username: true } },
        },
      }),
    ]);
    sendSuccess(res, {
      status: 200,
      data: {
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        items: rows.map((r) => ({
          id: r.id,
          actor: r.actor?.username,
          actorRole: r.actor?.role,
          action: r.action,
          targetUser: r.target?.username ?? null,
          details: (() => {
            if (!r.details) return null;
            try { return JSON.parse(r.details); } catch { return r.details; }
          })(),
          createdAt: r.createdAt,
        })),
      },
    });
  })
);

//SUPER_ADMIN only 
router.get(
  '/deleted-accounts',
  requireRole('SUPER_ADMIN'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query;
    const [total, rows] = await Promise.all([
      prisma.deletedAccount.count(),
      prisma.deletedAccount.findMany({
        orderBy: { deletedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    sendSuccess(res, {
      status: 200,
      data: {
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        items: rows,
      },
    });
  })
);


router.delete(
  '/deleted-accounts/:id',
  requireRole('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    try {
      await prisma.deletedAccount.delete({ where: { id: req.params.id } });
    } catch (err) {
      if (err.code === 'P2025') {
        const { ApiError } = require('../utils/ApiError');
        throw ApiError.notFound('Archived account not found');
      }
      throw err;
    }
    sendSuccess(res, { status: 200, data: null, message: 'Archived account permanently deleted' });
  })
);

//SUPER_ADMIN only 
router.get(
  '/coaches',
  requireRole('SUPER_ADMIN'),
  asyncHandler(async (_req, res) => {
    const coaches = await coachService.listCoaches();
    sendSuccess(res, { status: 200, data: coaches });
  })
);

router.post(
  '/coaches',
  requireRole('SUPER_ADMIN'),
  validate(createCoachSchema),
  asyncHandler(async (req, res) => {
    const coach = await coachService.createCoach(req.user, req.body);
    await auditService.logAction({
      actorId: req.user.id,
      action: 'CREATE_COACH',
      targetUserId: coach.userId,
      details: { coachId: coach.id, coachNumber: coach.coachNumber, name: coach.name },
    });
    sendSuccess(res, { status: 201, data: coach });
  })
);

router.patch(
  '/coaches/:id',
  requireRole('SUPER_ADMIN'),
  validate(updateCoachSchema),
  asyncHandler(async (req, res) => {
    const coach = await coachService.updateCoach(req.params.id, req.body);
    await auditService.logAction({
      actorId: req.user.id,
      action: 'UPDATE_COACH',
      targetUserId: coach.userId,
      details: { coachId: coach.id, patch: req.body },
    });
    sendSuccess(res, { status: 200, data: coach });
  })
);

router.delete(
  '/coaches/:id',
  requireRole('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const result = await coachService.deleteCoach(req.user.id, req.params.id);
    sendSuccess(res, { status: 200, data: null, message: result.message });
  })
);

module.exports = router;
