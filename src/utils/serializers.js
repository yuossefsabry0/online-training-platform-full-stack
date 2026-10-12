'use strict';

// Serializers: the ONLY shapes that ever leave the API. Password hashes,
// tokens and internal ids never leak because services pass raw rows through
// these before responding.

function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    nickname: user.nickname ?? null,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
  };
}

function toPublicCoach(coach, { includeCapacity = false } = {}) {
  if (!coach) return null;
  const base = {
    coachId: coach.id,
    coachNumber: coach.coachNumber,
    name: coach.name,
    bio: coach.bio,
    specialty: coach.specialty,
  };
  if (includeCapacity) {
    base.capacity = coach.capacity ?? null;
  }
  return base;
}

function toPublicPlan(plan) {
  if (!plan) return null;
  return {
    planId: plan.id,
    coachId: plan.coachId,
    coachNumber: plan.coach?.coachNumber,
    coachName: plan.coach?.name,
    name: plan.name,
    months: plan.months,
    priceCents: plan.priceCents,
    price: plan.priceCents / 100,
  };
}

function toPublicSubscription(sub) {
  if (!sub) return null;
  return {
    id: sub.id,
    coachId: sub.coachId,
    coachName: sub.coach?.name,
    planName: sub.planName,
    months: sub.months,
    startsAt: sub.startsAt,
    expiresAt: sub.expiresAt,
    status: sub.status,
  };
}

function toPublicHistoryEntry(entry) {
  if (!entry) return null;
  return {
    id: entry.id,
    coachId: entry.coachId,
    coachName: entry.coach?.name,
    planName: entry.planName,
    months: entry.months,
    startedAt: entry.startedAt,
    endedAt: entry.endedAt,
    endReason: entry.endReason,
  };
}

function toPublicPayment(payment, { includeUser = true } = {}) {
  if (!payment) return null;
  const base = {
    id: payment.id,
    packageName: payment.packageName,
    amountCents: payment.amountCents,
    amount: payment.amountCents / 100,
    reference: payment.reference,
    holderName: payment.holderName,
    status: payment.status,
    isExtension: payment.isExtension,
    decidedAt: payment.decidedAt,
    rejectionNote: payment.rejectionNote ?? null,
    coach: payment.coach ? { id: payment.coach.id, coachNumber: payment.coach.coachNumber, name: payment.coach.name } : null,
  };
  if (includeUser && payment.user) {
    base.user = {
      id: payment.user.id,
      username: payment.user.username,
      email: payment.user.email,
      role: payment.user.role,
    };
  }
  return base;
}

module.exports = {
  toPublicUser,
  toPublicCoach,
  toPublicPlan,
  toPublicSubscription,
  toPublicHistoryEntry,
  toPublicPayment,
};
