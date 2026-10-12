'use strict';

const express = require('express');
const { sendSuccess } = require('../utils/responses');
const authRoutes = require('./authRoutes');
const coachRoutes = require('./coachRoutes');
const subscriptionRoutes = require('./subscriptionRoutes');
const paymentRoutes = require('./paymentRoutes');
const memberRoutes = require('./memberRoutes');
const adminRoutes = require('./adminRoutes');
const contactRoutes = require('./contactRoutes');

function registerRoutes(app) {
  const api = express.Router();

  api.get('/health', (_req, res) =>
    sendSuccess(res, { data: { service: 'gym-api', uptime: process.uptime() } })
  );

  api.use('/auth', authRoutes);
  api.use('/coaches', coachRoutes);
  api.use('/subscriptions', subscriptionRoutes);
  api.use('/payments', paymentRoutes);
  api.use('/members', memberRoutes); 
  api.use('/admin', adminRoutes);
  api.use('/contact', contactRoutes);

  app.use('/api', api);
}

module.exports = { registerRoutes };
