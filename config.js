require('dotenv').config();
const path = require('node:path');
module.exports = {
  TARGET_PHONE: '12027737838',
  GEMINI_KEYS: [process.env.GEMINI_API_KEY].filter(Boolean),
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
  HOST: process.env.HOST || '127.0.0.1',
  PORT: Number(process.env.PORT || 3000),
  AUTO_SOLVE_ENABLED: process.env.AUTO_SOLVE_ENABLED === 'true',
  MIN_DELAY_MS: 1000, MAX_DELAY_MS: 2000,
  SESSION_DIR: path.resolve(process.env.DATA_DIR || './data', 'auth'),
  STATE_FILE: path.resolve(process.env.DATA_DIR || './data', 'processed.json'),
  MAX_IMAGE_BYTES: 8 * 1024 * 1024
};
