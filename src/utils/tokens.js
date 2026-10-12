'use strict';

const crypto = require('crypto');

const randomToken = () => crypto.randomBytes(32).toString('hex');

module.exports = { randomToken };
