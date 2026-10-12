'use strict';

function sendSuccess(res, { status = 200, data = null, message = null } = {}) {
  const body = { status: 'success', data };
  if (message) body.message = message;
  return res.status(status).json(body);
}

module.exports = { sendSuccess };
