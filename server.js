const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const whatsappBot = require('./whatsapp-bot');

const app = express();
// Same-origin dashboard; no cross-origin API access.
const crypto = require('node:crypto');
if (config.ADMIN_PASSWORD.length < 20) throw new Error('Set ADMIN_PASSWORD to at least 20 characters');
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  if (req.headers.origin && req.headers.origin !== `${req.protocol}://${req.get('host')}`) return res.sendStatus(403);
  const supplied = req.headers.authorization || '';
  const expected = 'Basic ' + Buffer.from('admin:' + config.ADMIN_PASSWORD).toString('base64');
  const hash = x => crypto.createHash('sha256').update(x).digest();
  if (!crypto.timingSafeEqual(hash(supplied), hash(expected))) {
    res.set('WWW-Authenticate', 'Basic realm="WhatsApp Solver"'); return res.sendStatus(401);
  }
  next();
});
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint for Northflank and uptime monitors
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    botStatus: whatsappBot.status
  });
});

// Bot status and live activity feed
app.get('/api/status', (req, res) => {
  res.json(whatsappBot.getStatus());
});

// Request pairing code using phone number
app.post('/api/pair', async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return res.status(400).json({ success: false, error: 'رقم الهاتف مطلوب' });
  }

  try {
    const code = await whatsappBot.requestPairingCode(phoneNumber);
    res.json({ success: true, code });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Toggle auto-solve ON/OFF
app.post('/api/toggle-auto', (req, res) => {
  const state = whatsappBot.toggleAutoSolve();
  res.json({ success: true, autoSolveEnabled: state });
});

// Target is fixed to Darsel; no remote target mutation.

// Fallback to index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Express server and WhatsApp bot
app.listen(config.PORT, config.HOST, () => {
  console.log(`===============================================`);
  console.log(`🚀 Darsel AI Solver Server running on port ${config.PORT}`);
  console.log(`📱 Target phone: ${config.TARGET_PHONE} (Darsel)`);
  console.log(`⚡ Powered by Google Gemini`);
  console.log(`===============================================`);

  // Start WhatsApp listener in the background
  whatsappBot.start();
});
