'use strict';

const prisma = require('../prisma/prismaClient');
const { ApiError } = require('../utils/ApiError');
const { logAction } = require('./auditService');
const subService = require('./subscriptionService');


async function getPublicProfile(coachNumber) {
  const coach = await prisma.coach.findUnique({ where: { coachNumber } });
  if (!coach) throw ApiError.notFound(`No coach found with id ${coachNumber}`);
  return {
    coachId: coach.id,
    coachNumber: coach.coachNumber,
    name: coach.name,
    bio: coach.bio,
    specialty: coach.specialty,
  };
}

// List coaches for the plans endpoint / browsing.
async function listCoaches() {
  const coaches = await prisma.coach.findMany({
    orderBy: { coachNumber: 'asc' },
    include: { plans: true },
  });
  return coaches.map((c) => ({
    coachId: c.id,
    coachNumber: c.coachNumber,
    name: c.name,
    bio: c.bio,
    specialty: c.specialty,
    capacity: c.capacity ?? null,
  }));
}


async function createCoach(superAdmin, data) {
  const target = await prisma.user.findUnique({ where: { id: data.userId } });
  if (!target) throw ApiError.notFound('User to promote into a coach was not found');
  if (target.role !== 'ADMIN') {
    throw ApiError.badRequest('Only users with role ADMIN can be given a coach profile', 'NOT_AN_ADMIN');
  }
  const dupe = await prisma.coach.findFirst({ where: { OR: [{ userId: data.userId }, { coachNumber: data.coachNumber }] } });
  if (dupe) throw ApiError.conflict('This user already has a coach profile or the coach id is taken', 'COACH_EXISTS');

  return prisma.coach.create({
    data: {
      userId: data.userId,
      coachNumber: data.coachNumber,
      name: data.name,
      bio: data.bio ?? '',
      specialty: data.specialty ?? '',
      capacity: data.capacity ?? null,
    },
  });
}

async function updateCoach(coachId, patch) {
  try {
    return await prisma.coach.update({ where: { id: coachId }, data: patch });
  } catch (err) {
    if (err.code === 'P2025') throw ApiError.notFound('Coach not found');
    throw err;
  }
}

async function deleteCoach(superAdminId, coachId) {
  const coach = await prisma.coach.findUnique({
    where: { id: coachId },
    include: { _count: { select: { members: { where: { expiresAt: { gt: new Date() } } } } } },
  });
  if (!coach) throw ApiError.notFound('Coach not found');
  if (coach._count.members > 0) {
    throw ApiError.conflict(
      `Cannot remove this coach: ${coach._count.members} active member(s) are still linked. Reassign or let their subscriptions end first.`,
      'COACH_HAS_ACTIVE_MEMBERS'
    );
  }
  await prisma.$transaction(async (tx) => {
    await tx.coach.delete({ where: { id: coachId } });
    await tx.plan.deleteMany({ where: { coachId } });
    await logActionTx(tx, superAdminId, 'REMOVE_COACH', null, { coachId, coachName: coach.name });
  });
  return { message: `Coach ${coach.name} removed` };
}

function logActionTx(tx, actorId, action, targetUserId, details) {
  return tx.auditLog.create({
    data: {
      actorId,
      action,
      targetUserId,
      details: details ? JSON.stringify(details) : null,
    },
  });
}


async function listMyMembers(coachUserId, { page, pageSize }) {
  const ownCoach = await prisma.coach.findUnique({ where: { userId: coachUserId } });
  if (!ownCoach) throw ApiError.forbidden('Coach profile missing', 'COACH_PROFILE_MISSING');

  const now = new Date();
  const where = {
    coachId: ownCoach.id,
    memberId: { not: null },
    expiresAt: { gt: now }, 
  };

  const [total, rows] = await Promise.all([
    prisma.memberProfile.count({ where }),
    prisma.memberProfile.findMany({
      where,
      orderBy: { expiresAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: true },
    }),
  ]);

  return {
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    items: rows.map((m) => ({
      userId: m.userId,
      email: m.user.email,
      username: m.user.username,
      nickname: m.user.nickname ?? null, 
      memberId: m.memberId,
      startsAt: m.startsAt,
      expiresAt: m.expiresAt,
      remainingDays: Math.ceil((new Date(m.expiresAt) - now) / 86400000),
    })),
  };
}

// Resolve + authorize the target member for a coach action.
async function assertOwnActiveMember(coachUserId, memberUserId) {
  const ownCoach = await prisma.coach.findUnique({ where: { userId: coachUserId } });
  if (!ownCoach) throw ApiError.forbidden('Coach profile missing', 'COACH_PROFILE_MISSING');

  const profile = await prisma.memberProfile.findUnique({
    where: { userId: memberUserId },
    include: { user: true },
  });
  if (!profile || !profile.memberId) throw ApiError.notFound('Member not found');

  // A coach manages ONLY members currently linked to them.
  if (profile.coachId !== ownCoach.id || !profile.expiresAt || profile.expiresAt <= new Date()) {
    throw ApiError.forbidden('This member is not an active subscriber of yours', 'NOT_YOUR_ACTIVE_MEMBER');
  }
  return { profile };
}



async function extendMember(actor, memberUserId, months) {
  const { profile } = await assertOwnActiveMember(actor.id, memberUserId);
  const base = profile.expiresAt > new Date() ? profile.expiresAt : new Date();
  const newExpiry = subService.addMonths(base, months);

  await prisma.$transaction(async (tx) => {
    await tx.memberProfile.update({ where: { userId: memberUserId }, data: { expiresAt: newExpiry } });
    await tx.subscription.updateMany({
      where: { userId: memberUserId, status: 'ACTIVE' },
      data: { expiresAt: newExpiry },
    });
    await logActionTx(tx, actor.id, 'EXTEND_MEMBER', memberUserId, { months, newExpiry });
  });

  return { expiresAt: newExpiry, message: `Subscription extended by ${months} month(s).` };
}

async function changeMemberPlan(actor, memberUserId, months) {
  const { profile } = await assertOwnActiveMember(actor.id, memberUserId);
  const remainingMs = new Date(profile.expiresAt) - new Date();

  // Change = recompute expiry from TODAY with the new duration.
  const newExpiry = subService.addMonths(new Date(), months);
  const lostDays = Math.max(0, Math.ceil(remainingMs / 86400000));

  await prisma.$transaction(async (tx) => {
    await tx.memberProfile.update({ where: { userId: memberUserId }, data: { expiresAt: newExpiry } });
    await tx.subscription.updateMany({
      where: { userId: memberUserId, status: 'ACTIVE' },
      data: { planName: `${months} Month(s)`, months, expiresAt: newExpiry },
    });
    await logActionTx(tx, actor.id, 'CHANGE_MEMBER_PLAN', memberUserId, { months, newExpiry, previousExpiry: profile.expiresAt });
  });

  return { expiresAt: newExpiry, message: `Plan changed to ${months} month(s). Note: prior remaining time (${lostDays}d) was replaced.` };
}

async function reduceMember(actor, memberUserId, days) {
  const { profile } = await assertOwnActiveMember(actor.id, memberUserId);
  const newExpiry = new Date(new Date(profile.expiresAt).getTime() - days * 86400000);

  if (newExpiry <= new Date()) {
    // Reduction to/below zero triggers the FULL expiration logic immediately.
    await prisma.$transaction(async (tx) => {
      await subService.applyExpiration(tx, memberUserId, 'REDUCED_TO_ZERO');
      await logActionTx(tx, actor.id, 'REDUCE_MEMBER_EXPIRED', memberUserId, { days, result: 'SUBSCRIPTION_ENDED' });
    });
    return { ended: true, message: `Reduction of ${days} day(s) brought remaining time to zero - subscription has ended and membership revoked.` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.memberProfile.update({ where: { userId: memberUserId }, data: { expiresAt: newExpiry } });
    await tx.subscription.updateMany({
      where: { userId: memberUserId, status: 'ACTIVE' },
      data: { expiresAt: newExpiry },
    });
    await logActionTx(tx, actor.id, 'REDUCE_MEMBER', memberUserId, { days, newExpiry });
  });
  return { ended: false, expiresAt: newExpiry, message: `Subscription reduced by ${days} day(s).` };
}

async function cancelMember(actor, memberUserId) {
  await assertOwnActiveMember(actor.id, memberUserId);
  await prisma.$transaction(async (tx) => {
    await subService.applyExpiration(tx, memberUserId, 'CANCELLED');
    await logActionTx(tx, actor.id, 'CANCEL_MEMBER', memberUserId, { immediate: true });
  });
  return { message: 'Subscription cancelled. Membership revoked, role reverted to BASIC.' };
}

module.exports = {
  getPublicProfile,
  listCoaches,
  createCoach,
  updateCoach,
  deleteCoach,
  listMyMembers,
  extendMember,
  changeMemberPlan,
  reduceMember,
  cancelMember,
};
