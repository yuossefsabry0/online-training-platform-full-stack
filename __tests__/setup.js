'use strict';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'mysql://root:@localhost:3306/gym_db_test';
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-key-for-jest-only-32chars!!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-key-for-jest-only-32chars!!';
process.env.SIGNUP_RATE_LIMIT_MAX = '9999';
process.env.FORGOT_PASSWORD_RATE_LIMIT_MAX = '9999';
process.env.DELETE_ACCOUNT_RATE_LIMIT_MAX = '9999';
