'use strict';


const prisma = require('../prisma/prismaClient');

async function logAction({ actorId, action, targetUserId = null, details = null }) {
  return prisma.auditLog.create({
    data: {
      actorId,
      action,
      targetUserId,
      details: details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null,
    },
  });
}

module.exports = { logAction };
