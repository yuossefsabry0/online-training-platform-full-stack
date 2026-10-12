'use strict';

const { ApiError } = require('../utils/ApiError');
const { sanitizeDeep } = require('../utils/sanitize');


function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
      // SUPER_ADMIN is implicitly allowed everywhere ADMIN is.
      if (allowedRoles.includes('ADMIN') && req.user.role === 'SUPER_ADMIN') {
        return next();
      }
      return next(
        ApiError.forbidden(
          `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
          'INSUFFICIENT_ROLE'
        )
      );
    }
    next();
  };
}

// Body/query sanitization middleware: strips tags/control chars from every
// string in body, params and query before validation/handlers run.
function sanitizeRequest(req, _res, next) {
  if (req.body && typeof req.body === 'object') req.body = sanitizeDeep(req.body);
  if (req.params && typeof req.params === 'object') req.params = sanitizeDeep(req.params);
  if (req.query && typeof req.query === 'object') req.query = sanitizeDeep(req.query);
  next();
}

module.exports = { requireRole, sanitizeRequest };
