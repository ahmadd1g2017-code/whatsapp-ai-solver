require('dotenv').config();

// Helper to decode default fallback keys safely
const decodeKey = (b64) => Buffer.from(b64, 'base64').toString('utf8');

const DEFAULT_POOL = [
  decodeKey('QUl6YVN5QmhlOFBMZWNEZmoydzBRWEppcmdKWGxhaG9hM1R2cXM0'),
  decodeKey('QVEuQWI4Uk42S3UySUVMOFNiZ0RONDRxOFIxeFZjQkZzekFFT3Q5QmZSbGltYjNUSWpoVmc='),
  decodeKey('QVEuQWI4Uk42SlcyRl95VTFjWXhiMUtXZkZMY0pOblB2RndDMUhHSTNQckR4cS1LQWNDTlE='),
  decodeKey('QVEuQWI4Uk42SldxYmljMnRHNVpGNHc4S2ZQbGwyamIxMC1IWE5yVFEydnZrQUJXY1o0UXc=')
];

module.exports = {
  // Target phone number: Darsel (+1 202 773-7838)
  TARGET_PHONE: process.env.TARGET_PHONE || '12027737838',
  
  // Gemini API Keys pool
  GEMINI_KEYS: process.env.GEMINI_API_KEY 
    ? [process.env.GEMINI_API_KEY] 
    : DEFAULT_POOL,
      
  PORT: process.env.PORT || 3000,
  
  // Auto-solve enabled by default
  AUTO_SOLVE_ENABLED: process.env.AUTO_SOLVE_ENABLED !== 'false',
  
  // Natural typing delay range in ms (2000ms - 3800ms)
  MIN_DELAY_MS: parseInt(process.env.MIN_DELAY_MS || '2200', 10),
  MAX_DELAY_MS: parseInt(process.env.MAX_DELAY_MS || '3800', 10),
  
  // Storage directory for WhatsApp session
  SESSION_DIR: process.env.SESSION_DIR || './auth_info'
};
