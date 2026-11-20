const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const whatsappBot = require('./whatsapp-bot');

const app = express();
app.use(cors());
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

// Update target phone
app.post('/api/set-target', (req, res) => {
  const { targetPhone } = req.body;
  if (targetPhone) {
    whatsappBot.setTargetPhone(targetPhone);
  }
  res.json({ success: true, targetPhone: whatsappBot.targetPhone });
});

// Fallback to index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Express server and WhatsApp bot
app.listen(config.PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Darsel AI Solver Server running on port ${config.PORT}`);
  console.log(`📱 Target phone: ${config.TARGET_PHONE} (Darsel)`);
  console.log(`⚡ Powered by Google Gemini 3.5 Flash`);
  console.log(`===============================================`);

  // Start WhatsApp listener in the background
  whatsappBot.start();
});
