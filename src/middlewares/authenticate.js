'use strict';

const { ApiError } = require('../utils/ApiError');
const { verifyToken } = require('../utils/tokenService');
const prisma = require('../prisma/prismaClient');


async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Missing or malformed Authorization header', 'TOKEN_MISSING');
    }
    const raw = header.slice(7).trim();
    let payload;
    try {
      payload = verifyToken(raw, 'access'); // throws TokenExpiredError / JsonWebTokenError
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Token has expired. Please log in again.', 'TOKEN_EXPIRED');
      }
      throw ApiError.unauthorized('Invalid authentication token', 'TOKEN_INVALID');
    }


    if (!payload.jti) {
      throw ApiError.unauthorized('Token missing jti claim. Please log in again.', 'TOKEN_INVALID');
    }
    const revoked = await prisma.revokedToken.findUnique({ where: { jti: payload.jti } });
    if (revoked) {
      throw ApiError.unauthorized('Token has been revoked (logged out)', 'TOKEN_REVOKED');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true },
    });
    if (!user) throw ApiError.unauthorized('Account no longer exists', 'ACCOUNT_NOT_FOUND');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate };
