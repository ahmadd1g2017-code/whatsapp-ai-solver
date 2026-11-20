const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const aiSolver = require('./ai-solver');
const { isTarget, MessageGate } = require('./safety');

class WhatsAppBot {
  constructor() {
    this.sock = null;
    this.gate = new MessageGate(config.STATE_FILE);
    this.status = 'disconnected'; // 'disconnected' | 'waiting_pairing' | 'connected'
    this.qrCode = null;
    this.pairingCode = null;
    this.userJid = null;
    this.targetPhone = config.TARGET_PHONE;
    this.autoSolveEnabled = config.AUTO_SOLVE_ENABLED;
    this.activityLogs = [];
    this.maxLogs = 60;
  }

  isTargetSender(remoteJid) {
    return isTarget(remoteJid, this.targetPhone);
  }

  logActivity(entry) {
    const logItem = {
      id: Date.now() + Math.random().toString(36).substring(2, 7),
      time: new Date().toLocaleTimeString('ar-EG', { hour12: true }),
      ...entry
    };
    this.activityLogs.unshift(logItem);
    if (this.activityLogs.length > this.maxLogs) {
      this.activityLogs.pop();
    }
  }

  async start() {
    try {
      const sessionPath = path.resolve(config.SESSION_DIR);
      if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      const { version } = await fetchLatestBaileysVersion();

      this.sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['Darsel Solver', 'Chrome', '120.0.0'],
        syncFullHistory: false
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrCode = await qrcode.toDataURL(qr);
            this.status = 'waiting_pairing';
          } catch (e) {
            console.error('Error generating QR:', e);
          }
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          console.log(`[WhatsApp] Connection closed. Reason code: ${statusCode}. Reconnecting: ${shouldReconnect}`);
          
          this.status = 'disconnected';
          this.userJid = null;
          
          if (shouldReconnect) {
            setTimeout(() => this.start(), 3000);
          }
        } else if (connection === 'open') {
          this.status = 'connected';
          this.userJid = this.sock.user?.id || this.sock.user?.name;
          this.qrCode = null;
          this.pairingCode = null;
          console.log(`[WhatsApp] Connected successfully! User: ${this.userJid}`);
          
          this.logActivity({
            type: 'system',
            message: `تم الاتصال بحساب واتساب بنجاح (${this.userJid})`
          });
        }
      });

      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
          if (!msg.message || msg.key.fromMe) continue;

          const remoteJid = msg.key.remoteJid;
          if (!this.isTargetSender(remoteJid)) {
            // Ignore messages from other people completely
            continue;
          }

          console.log(`[WhatsApp] Received message from target Darsel (${remoteJid})`);
          if (!this.autoSolveEnabled) continue;
          await this.gate.enqueue(async () => {
            if (!this.autoSolveEnabled || !this.gate.claim(msg.key.id)) return;
            await this.handleDarselMessage(msg);
          }).catch(err => this.logActivity({ type: 'error', error: err.message }));
        }
      });

      return this.sock;
    } catch (err) {
      console.error('[WhatsApp] Startup error:', err);
      this.status = 'disconnected';
      setTimeout(() => this.start(), 5000);
    }
  }

  async requestPairingCode(phoneNumber) {
    if (!phoneNumber) throw new Error('يرجى إدخال رقم الهاتف مع رمز الدولة');
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanNumber.length < 8) throw new Error('رقم الهاتف قصير جداً وغير صالح');

    if (this.status === 'connected') {
      throw new Error('الواتساب متصل بالفعل!');
    }

    if (!this.sock) {
      await this.start();
    }

    // Wait 1.5 seconds for socket ready state
    await new Promise((r) => setTimeout(r, 1500));

    try {
      const code = await this.sock.requestPairingCode(cleanNumber);
      const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
      this.pairingCode = formatted;
      this.status = 'waiting_pairing';
      console.log('[WhatsApp] Pairing code generated');
      return formatted;
    } catch (err) {
      console.error('[WhatsApp] Failed to request pairing code:', err);
      throw new Error(`تعذر طلب كود الاقتران: ${err.message}`);
    }
  }

  async handleDarselMessage(msg) {
    const remoteJid = msg.key.remoteJid;
    const messageContent = msg.message?.ephemeralMessage?.message || msg.message?.viewOnceMessageV2?.message || msg.message;

    // Extract text from regular conversation, extended text, or image caption
    let text = messageContent.conversation ||
               messageContent.extendedTextMessage?.text ||
               messageContent.imageMessage?.caption || '';

    let imageBuffer = null;
    let imageMime = 'image/jpeg';

    // Support both direct image and viewOnce image
    const rawImage = messageContent.imageMessage || messageContent.viewOnceMessageV2?.message?.imageMessage;
    if (rawImage) {
      if (Number(rawImage.fileLength || 0) > config.MAX_IMAGE_BYTES) {
        this.logActivity({ type: 'error', error: 'Image exceeds size limit; skipped' }); return;
      }
      try {
        imageBuffer = await downloadMediaMessage(
          msg,
          'buffer',
          {},
          { logger: pino({ level: 'silent' }) }
        );
        imageMime = rawImage.mimetype || 'image/jpeg';
        if (imageBuffer.length > config.MAX_IMAGE_BYTES || !['image/jpeg','image/png','image/webp'].includes(imageMime)) throw new Error('Unsupported or oversized image');
      } catch (err) {
        this.logActivity({ type: 'error', error: 'Image download failed; question skipped' });
        return;
      }
    }

    if (!text.trim() && !imageBuffer) return;

    // Record incoming activity
    this.logActivity({
      type: 'question',
      text: text || (imageBuffer ? '📷 صورة سؤال / مسألة' : 'رسالة غير نصية'),
      hasImage: !!imageBuffer,
      sender: remoteJid
    });

    if (!this.autoSolveEnabled) {
      console.log('[WhatsApp] Auto-solve is toggled OFF. Skipping auto-reply.');
      return;
    }

    try {
      // Send typing presence
      await this.sock.sendPresenceUpdate('composing', remoteJid);

      // Solve via Gemini AI
      const solveResult = await aiSolver.solveQuestion({
        text,
        imageBuffer,
        imageMime
      });

      if (solveResult.skipped) {
        this.logActivity({ type: 'system', message: 'Question incomplete or no valid answer; skipped' }); return;
      }

      // Human-like natural delay
      const randomDelay = Math.floor(Math.random() * (config.MAX_DELAY_MS - config.MIN_DELAY_MS + 1)) + config.MIN_DELAY_MS;
      await new Promise((resolve) => setTimeout(resolve, randomDelay));

      if (!this.autoSolveEnabled || this.status !== 'connected') return;

      // Send the solution back to Darsel
      await this.sock.sendMessage(
        remoteJid,
        { text: solveResult.answer },
        { quoted: msg }
      );

      this.logActivity({
        type: 'answer',
        question: text || '📷 صورة سؤال',
        answer: solveResult.answer,
        durationMs: solveResult.durationMs,
        model: solveResult.model
      });

      console.log(`[WhatsApp] Answered Darsel with: "${solveResult.answer}"`);
    } catch (err) {
      console.error('[WhatsApp] Error solving question:', err);
      this.logActivity({
        type: 'error',
        error: `فشل حل السؤال: ${err.message}`
      });
    }
  }

  getStatus() {
    return {
      status: this.status,
      userJid: this.userJid,
      pairingCode: this.pairingCode,
      hasQr: !!this.qrCode,
      qrCode: this.qrCode,
      targetPhone: this.targetPhone,
      autoSolveEnabled: this.autoSolveEnabled,
      recentLogs: this.activityLogs.slice(0, 25)
    };
  }

  setTargetPhone(newPhone) {
    if (!newPhone) return;
    this.targetPhone = newPhone.replace(/[^0-9]/g, '');
    console.log(`[WhatsApp] Updated target phone to: ${this.targetPhone}`);
  }

  toggleAutoSolve(enabled) {
    this.autoSolveEnabled = typeof enabled === 'boolean' ? enabled : !this.autoSolveEnabled;
    console.log(`[WhatsApp] Auto solve is now: ${this.autoSolveEnabled ? 'ON' : 'OFF'}`);
    return this.autoSolveEnabled;
  }
}

module.exports = new WhatsAppBot();
