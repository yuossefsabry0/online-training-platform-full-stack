'use strict';

const config = require('../config/env');
const { ApiError } = require('../utils/ApiError');

function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}


function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Internal server error';
  let details = err.details;

  // Map Prisma known errors to clean API errors.
  if (err.code === 'P2002') {
    statusCode = 409;
    code = 'CONFLICT';
    message = 'A record with the same unique value already exists';
  } else if (err.code === 'P2025') {
    statusCode = 404;
    code = 'NOT_FOUND';
    message = 'Record not found';
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    code = 'MALFORMED_JSON';
    message = 'Request body contains malformed JSON';
  }

  if (!(err instanceof ApiError) && statusCode === 500) {
    message = config.env === 'development' ? message : 'Internal server error';
  }

  if (statusCode >= 500) {
    console.error('[error]', err);
  }

  const body = {
    status: 'error',
    error: {
      code,
      message,
      statusCode,
    },
  };
  if (details) body.error.details = details;

  return res.status(statusCode).json(body);
}

module.exports = { notFoundHandler, errorHandler };
