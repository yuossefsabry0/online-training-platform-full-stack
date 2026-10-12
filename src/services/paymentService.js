'use strict';


const prisma = require('../prisma/prismaClient');
const { ApiError } = require('../utils/ApiError');
const { toPublicPayment } = require('../utils/serializers');
const { logAction } = require('./auditService');
const subService = require('./subscriptionService');

async function submitPayment(userId, body) {
  const { holderName, reference, amount, packageName, coachNumber } = body;

  // One pending payment system-wide per user (regardless of target coach).
  const existingPending = await prisma.paymentRequest.findFirst({
    where: { userId, status: 'PENDING' },
  });
  if (existingPending) {
    throw ApiError.conflict(
      'You already have a pending payment request. Wait until it is approved or rejected before submitting another.',
      'PENDING_PAYMENT_EXISTS'
    );
  }

  // Reference numbers are globally unique - no receipt reuse across requests.
  const refTaken = await prisma.paymentRequest.findUnique({ where: { reference } });
  if (refTaken) {
    throw ApiError.conflict(
      'This payment reference number has already been used in a previous request',
      'REFERENCE_ALREADY_USED'
    );
  }

  const coach = await prisma.coach.findUnique({ where: { coachNumber } });
  if (!coach) {
    throw ApiError.notFound(`No coach found with id ${coachNumber}`);
  }

  // Server-side determination of NEW vs EXTENSION - never taken from client
  // input; client cannot influence this flag.
  const active = await subService.findActiveSubscription(userId);
  const isExtension = Boolean(active);

  if (!isExtension) {
    await subService.assertCapacityAvailable(coach.id, 'COACH_AT_CAPACITY');
  }

  let created;
  try {
    created = await prisma.paymentRequest.create({
      data: {
        userId,
        coachId: coach.id,
        packageName,
        amountCents: Math.round(amount * 100),
        reference,
        holderName,
        status: 'PENDING',
        isExtension, // server-determined
      },
    });
  } catch (err) {
    if (err.code === 'P2002') {
      throw ApiError.conflict('This payment reference number has already been used', 'REFERENCE_ALREADY_USED');
    }
    throw err;
  }

  return { payment: created, message: 'Payment request submitted and awaiting approval.' };
}

// Approve / reject by ADMIN (coach) or SUPER_ADMIN.
async function decidePayment(decider, requestId, { action, note }) {
  const request = await prisma.paymentRequest.findUnique({
    where: { id: requestId },
    include: { user: true, coach: true },
  });
  if (!request) throw ApiError.notFound(`Payment request ${requestId} not found`);

  if (request.status !== 'PENDING') {
    throw ApiError.conflict(
      `This payment request has already been ${request.status.toLowerCase()}`,
      'REQUEST_ALREADY_DECIDED'
    );
  }

  // Coaches may only decide on requests aimed at THEMSELVES.
  if (decider.role === 'ADMIN') {
    const ownCoach = await prisma.coach.findUnique({ where: { userId: decider.id } });
    if (!ownCoach || ownCoach.id !== request.coachId) {
      throw ApiError.forbidden('You can only decide payment requests addressed to you', 'NOT_YOUR_REQUEST');
    }
  }

  if (action === 'reject') {
    const rejected = await prisma.paymentRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED', decidedById: decider.id, decidedAt: new Date(), rejectionNote: note ?? null },
    });
    await logAction({
      actorId: decider.id,
      action: 'REJECT_PAYMENT',
      targetUserId: request.userId,
      details: { requestId, reference: request.reference, packageName: request.packageName, note: note ?? null },
    });
    return { payment: rejected, message: 'Payment request rejected.' };
  }

  // APPROVAL PATH with authoritative re-verification

  const user = request.user;
  const active = await subService.findActiveSubscription(user.id);

  // Re-check (a): conflicting subscription with a DIFFERENT coach?
  if (active && active.coachId !== request.coachId) {
    const conflicted = await prisma.paymentRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        decidedById: decider.id,
        decidedAt: new Date(),
        rejectionNote: 'Auto-rejected at approval: member subscribed to another coach while this request was pending',
      },
    });
    await logAction({
      actorId: decider.id,
      action: 'APPROVE_PAYMENT_BLOCKED_CONFLICT',
      targetUserId: user.id,
      details: { requestId, reason: 'ONE_COACH_RULE_VIOLATED' },
    });
    throw ApiError.conflict(
      'Approval failed: the user now has an active subscription with a different coach (One-Coach-At-A-Time rule). The request has been marked as rejected.',
      'APPROVAL_CONFLICT_ONE_COACH_RULE'
    );
  }

  //coach still has capacity? (may have filled up while pending)
  const { activeCount, capacity } = await subService.getCapacityInfo(request.coachId);
  if (!active && capacity !== null && activeCount >= capacity) {
    await prisma.paymentRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        decidedById: decider.id,
        decidedAt: new Date(),
        rejectionNote: 'Auto-rejected at approval: coach reached full capacity while this request was pending',
      },
    });
    await logAction({
      actorId: decider.id,
      action: 'APPROVE_PAYMENT_BLOCKED_CAPACITY',
      targetUserId: user.id,
      details: { requestId, reason: 'COACH_AT_CAPACITY' },
    });
    throw ApiError.conflict(
      `Approval failed: ${request.coach.name} is now at full capacity (${activeCount}/${capacity}). The request has been marked as rejected.`,
      'APPROVAL_CONFLICT_CAPACITY'
    );
  }

  // All checks passed - activate inside one transaction.
  const now = new Date();
  const months = monthsFromPlanOrPackage(request);

  const approvedPayment = await prisma.$transaction(async (tx) => {
    let profile = await tx.memberProfile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      profile = await tx.memberProfile.create({ data: { userId: user.id } });
    }

    let mode;
    if (active && active.coachId === request.coachId) {
      // EXTENSION: add time on top of remaining time; keep memberId & role.
      mode = 'EXTENSION';
      const base =
        profile.expiresAt && profile.expiresAt > now ? profile.expiresAt : now;
      const expiresAt = subService.addMonths(base, months);
      await tx.memberProfile.update({
        where: { userId: user.id },
        data: { expiresAt, coachId: request.coachId },
      });
      await tx.subscription.update({
        where: { id: active.id },
        data: { expiresAt, months: active.months + months, planName: `${active.planName} + ${months}mo extension` },
      });
    } else {
      // NEW: generate member id, promote BASIC -> MEMBER, link coach.
      mode = 'NEW';
      const memberId = `M-${Date.now().toString(36).toUpperCase()}-${user.id.slice(-6).toUpperCase()}`;
      const expiresAt = subService.addMonths(now, months);
      await tx.memberProfile.update({
        where: { userId: user.id },
        data: {
          memberId,
          coachId: request.coachId,
          startsAt: now,
          expiresAt,
        },
      });
      await tx.user.update({ where: { id: user.id }, data: { role: 'MEMBER' } });
      await tx.subscription.create({
        data: {
          userId: user.id,
          coachId: request.coachId,
          planName: request.packageName,
          months,
          startsAt: now,
          expiresAt,
          status: 'ACTIVE',
        },
      });
    }

    return tx.paymentRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED', decidedById: decider.id, decidedAt: now },
    });
  });

  await logAction({
    actorId: decider.id,
    action: 'APPROVE_PAYMENT',
    targetUserId: user.id,
    details: {
      requestId,
      mode: active ? 'EXTENSION' : 'NEW',
      reference: request.reference,
      packageName: request.packageName,
      amountCents: request.amountCents,
    },
  });

  return {
    payment: approvedPayment,
    message: `Payment approved. ${active ? 'Subscription extended.' : 'Membership activated.'}`,
  };
}

// Resolve duration from the matched Plan row; fall back to parsing the
// package name ("3 Months" -> 3). Keeps approvals robust even for manual packages.
function monthsFromPlanOrPackage(request) {
  const nameMatch = request.packageName.match(/(\d+)\s*(month|months|mo)/i);
  if (nameMatch) return parseInt(nameMatch[1], 10);
  const known = [1, 3, 6, 12];
  for (const m of known) {
    if (request.packageName.includes(String(m))) return m;
  }
  return 1; // safest default
}


async function listPayments(requester, { page, pageSize }) {
  const where = {};
  if (requester.role === 'ADMIN') {
    const ownCoach = await prisma.coach.findUnique({ where: { userId: requester.id } });
    if (!ownCoach) throw ApiError.forbidden('Coach profile missing', 'COACH_PROFILE_MISSING');
    where.coachId = ownCoach.id;
  }
  const [total, rows] = await Promise.all([
    prisma.paymentRequest.count({ where }),
    prisma.paymentRequest.findMany({
      where,
      orderBy: { decidedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: true, coach: true },
    }),
  ]);
  return {
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    items: rows.map((r) => toPublicPayment(r)),
  };
}

module.exports = { submitPayment, decidePayment, listPayments };
