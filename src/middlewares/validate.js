'use strict';

const { ApiError } = require('../utils/ApiError');

// Zod validate(schema, property) middleware factory. On failure -> 400 with
// machine-readable code + per-field details array in the error envelope.
function validate(schema, property = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[property]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || property,
        message: issue.message,
        code: issue.code,
      }));
      return next(
        new ApiError(400, 'VALIDATION_ERROR', 'Invalid request data', details)
      );
    }
    req[property] = result.data;
    next();
  };
}

module.exports = { validate };
