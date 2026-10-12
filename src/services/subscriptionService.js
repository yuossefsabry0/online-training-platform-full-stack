'use strict';

const prisma = require('../prisma/prismaClient');
const { ApiError } = require('../utils/ApiError');
const config = require('../config/env');
const mailer = require('../utils/mailer');
const { toPublicSubscription, toPublicHistoryEntry } = require('../utils/serializers');
const { logAction } = require('./auditService');

const DURATIONS = [1, 3, 6, 12];

function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0); 
  return d;
}

async function getCoachByNumber(coachNumber) {
  const coach = await prisma.coach.findUnique({ where: { coachNumber }, include: { user: true } });
  if (!coach) throw ApiError.notFound(`No coach found with id ${coachNumber}`);
  return coach;
}

// Active active-members count vs optional capacity cap.
async function getCapacityInfo(coachId) {
  const activeCount = await prisma.memberProfile.count({
    where: { coachId, expiresAt: { gt: new Date() } },
  });
  const coach = await prisma.coach.findUnique({ where: { id: coachId } });
  return { activeCount, capacity: coach?.capacity ?? null };
}

async function assertCapacityAvailable(coachId, code) {
  const { activeCount, capacity } = await getCapacityInfo(coachId);
  if (capacity !== null && activeCount >= capacity) {
    throw ApiError.conflict(
      `This coach is currently at full capacity (${activeCount}/${capacity} active members). Please choose another coach or try again later.`,
      code
    );
  }
}

// The user's single active subscription, if any (One-Coach-At-A-Time).
async function findActiveSubscription(userId) {
  const now = new Date();
  const profile = await prisma.memberProfile.findUnique({ where: { userId } });
  if (!profile || !profile.coachId || !profile.expiresAt || profile.expiresAt <= now) {
    return null;
  }
  return prisma.subscription.findFirst({
    where: { userId, coachId: profile.coachId, status: 'ACTIVE', expiresAt: profile.expiresAt },
    include: { coach: true },
  });
}

// Section 3 listing: plans grouped per coach (same price everywhere).
async function listPlans() {
  const coaches = await prisma.coach.findMany({
    orderBy: { coachNumber: 'asc' },
    include: { plans: { orderBy: { months: 'asc' } } },
  });
  return coaches.map((coach) => ({
    coachId: coach.id,
    coachNumber: coach.coachNumber,
    coachName: coach.name,
    specialty: coach.specialty,
    capacity: coach.capacity ?? null,
    activeMembers: undefined, // never leak occupancy to regular users
    plans: coach.plans.map((p) => ({
      planId: p.id,
      name: p.name,
      months: p.months,
      priceCents: p.priceCents,
      price: p.priceCents / 100,
    })),
  }));
}


async function confirmSelection(userId, { coachNumber, months }) {
  const coach = await getCoachByNumber(coachNumber);
  const plan = await prisma.plan.findUnique({
    where: { coachId_months: { coachId: coach.id, months } },
  });
  if (!plan) {
    throw ApiError.badRequest(
      `Coach ${coach.name} does not offer a ${months}-month plan`,
      'PLAN_NOT_OFFERED'
    );
  }

  const active = await findActiveSubscription(userId);
  if (active && active.coachId !== coach.id) {
    throw ApiError.conflict(
      `You already have an active subscription with ${active.coach.name}. You must wait until it ends before subscribing to a different coach.`,
      'ACTIVE_SUBSCRIPTION_WITH_DIFFERENT_COACH'
    );
  }

  // Preliminary (soft) capacity check - final authority is at approval time.
  await assertCapacityAvailable(coach.id, 'COACH_AT_CAPACITY');

  const isExtension = Boolean(active);
  return {
    message: isExtension
      ? `Selection confirmed as an EXTENSION of your existing ${active.coach.name} subscription. Proceed to payment.`
      : `Selection confirmed. Proceed to payment to activate your subscription with ${coach.name}.`,
    data: {
      mode: isExtension ? 'EXTENSION' : 'NEW',
      coach: { coachId: coach.id, coachNumber: coach.coachNumber, name: coach.name },
      plan: { planId: plan.id, name: plan.name, months, priceCents: plan.priceCents },
    },
  };
}


async function getStatus(user) {
  const now = new Date();
  const profile = await prisma.memberProfile.findUnique({
    where: { userId: user.id },
    include: { coach: true },
  });

  const active =
    profile &&
    profile.coachId &&
    profile.expiresAt &&
    profile.expiresAt > now
      ? {
          memberId: profile.memberId,
          coach: { coachId: profile.coachId, coachNumber: profile.coach?.coachNumber, name: profile.coach?.name },
          startsAt: profile.startsAt,
          expiresAt: profile.expiresAt,
          remainingDays: Math.ceil((profile.expiresAt - now) / 86400000),
        }
      : null;

  const expiringSoon =
    active && active.remainingDays <= config.expiryWarningDays ? true : false;

  return {
    role: user.role,
    plan: active ? 'MEMBER' : 'BASIC',
    contactUsAccess: Boolean(active),
    subscription: active,
    expiringSoon,
    ...(expiringSoon
      ? { warning: `Your subscription ends in ${active.remainingDays} day(s). Renew to keep your membership.` }
      : {}),
  };
}


async function getHistory(requester, targetUserId) {
  if (requester.role === 'ADMIN') {
    const ownCoach = await prisma.coach.findUnique({ where: { userId: requester.id } });
    const hasHistoryForThisCoach = await prisma.subscriptionHistory.findFirst({
      where: { userId: targetUserId, coachId: ownCoach.id },
    });
    if (!hasHistoryForThisCoach) {
      // A coach may view history of members they currently hold OR held before.
      const everMember = await prisma.memberProfile.findFirst({
        where: { userId: targetUserId, OR: [{ coachId: ownCoach.id }] },
      });
      if (!everMember) {
        throw ApiError.forbidden('You can only view subscription history of your own members', 'NOT_YOUR_MEMBER');
      }
    }
  } else if (requester.role !== 'SUPER_ADMIN' && requester.id !== targetUserId) {
    throw ApiError.forbidden('You can only view your own subscription history', 'FORBIDDEN');
  }

  const entries = await prisma.subscriptionHistory.findMany({
    where: { userId: targetUserId },
    orderBy: { startedAt: 'desc' },
    include: { coach: true },
  });
  return entries.map(toPublicHistoryEntry);
}


async function applyExpiration(tx, userId, endReason) {
  const now = new Date();
  const profile = await tx.memberProfile.findUnique({ where: { userId } });

  if (!profile || !profile.coachId) return false; // nothing to expire

  await tx.subscription.updateMany({
    where: { userId, status: 'ACTIVE' },
    data: { status: 'ENDED' },
  });

  const endedSub = await tx.subscription.findFirst({
    where: { userId, status: 'ENDED' },
    orderBy: { expiresAt: 'desc' },
  });

  await tx.subscriptionHistory.create({
    data: {
      userId,
      coachId: profile.coachId,
      planName: endedSub?.planName ?? 'Unknown',
      months: endedSub?.months ?? 0,
      startedAt: profile.startsAt ?? now,
      endedAt: now,
      endReason,
    },
  });

  // Full teardown: revoke member id, unlink coach, revert role, clear dates.
  await tx.memberProfile.update({
    where: { userId },
    data: { memberId: null, coachId: null, startsAt: null, expiresAt: null },
  });
  await tx.user.update({ where: { id: userId }, data: { role: 'BASIC' } });

  return true;
}

// Natural-expiry sweep. Returns number of memberships terminated this tick.
async function runExpirySweep() {
  const now = new Date();
  const stale = await prisma.memberProfile.findMany({
    where: { coachId: { not: null }, expiresAt: { lte: now } },
    select: { userId: true },
  });
  let count = 0;
  for (const { userId } of stale) {
    await prisma.$transaction(async (tx) => {
      const changed = await applyExpiration(tx, userId, 'EXPIRED');
      if (changed) count += 1;
    });
  }
  return count;
}

// Warning sweep: emails members whose subscription ends within N days.
async function runWarningSweep() {
  const limit = new Date(Date.now() + config.expiryWarningDays * 86400000);
  const soon = await prisma.memberProfile.findMany({
    where: { coachId: { not: null }, expiresAt: { gt: new Date(), lte: limit } },
    include: { user: true, coach: true },
  });
  for (const m of soon) {
    await mailer.sendExpiryWarningEmail(m.user, m.expiresAt, m.coach.name);
  }
  return soon.length;
}

module.exports = {
  DURATIONS,
  addMonths,
  getCoachByNumber,
  getCapacityInfo,
  assertCapacityAvailable,
  findActiveSubscription,
  listPlans,
  confirmSelection,
  getStatus,
  getHistory,
  applyExpiration,
  runExpirySweep,
  runWarningSweep,
};
