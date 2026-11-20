# Darsel WhatsApp Solver — isolated service

This repository is independent of Nano and Nanosha. Do not import its modules into either bot, share their credentials/data directories, or deploy it into their existing service. This change has not been connected to a live WhatsApp account.

## Setup

Requires Node.js 22+, internet access and a new Gemini API key. Keys from the original public config must be revoked in the provider account: deleting them here does not revoke them or remove Git history.

1. Run `npm ci`.
2. Copy `.env.example` to `.env` and set a NEW `GEMINI_API_KEY` and a unique `ADMIN_PASSWORD` (20+ characters). Keep `.env` private.
3. Run `npm start`. Open `http://127.0.0.1:3000` and sign in as `admin` with your password.
4. Request a pairing code and link your own WhatsApp account using Linked devices / link with phone number where available.
5. Auto-answer starts OFF. Enable it only when ready for the real Darsel test. Disable it from the dashboard at any time.

The Gemini model is configurable; model availability and quota must be verified with your own account. An API key and any provider usage costs are separate from chat subscriptions.

## Android / Termux trial without Northflank

Install Termux from an official Termux distribution. In Termux:

```sh
pkg update
pkg install nodejs-lts git
node --version
git clone --branch isolated-whatsapp-hardening https://github.com/ahmadd1g2017-code/whatsapp-ai-solver.git
cd whatsapp-ai-solver
npm ci
cp .env.example .env
```

Edit `.env` locally, then run `npm start` and open the local address above on the same phone. Node must be version 22 or newer. This Android installation path has NOT been tested on the user's device. Dependency compatibility may need adjustment. Android may stop background processes; this is a trial option, not guaranteed 24/7 hosting. Disabling battery optimization for Termux can reduce interruptions but does not guarantee uptime. Do not disable the phone's screen lock.

## Independent hosted deployment

Deploy only to a separate service with its own resources and persistent directory. Set `HOST=0.0.0.0`, `DATA_DIR=/data`, and mount persistent storage at `/data`. Expose the dashboard only through HTTPS; Basic authentication is not encryption. Run exactly one replica to avoid concurrent WhatsApp sessions and duplicate replies. No new host has been provisioned by this change.

## Behavior and limitations

- Only exact Darsel phone JIDs are accepted. Unknown LID identifiers are skipped instead of guessing their identity.
- Images that fail download, exceed the limit, or have an unsupported type are skipped. The post-download size check is not a streaming download memory limit.
- Replies use structured output and validate choice labels/numeric format; this does not prove mathematical correctness. Unclear questions are skipped.
- Feedback and start/continue commands are not automatically answered. Start a lesson manually.
- Each message is claimed on disk before solving. A crash or failed request may skip that question; automatic retry is deliberately avoided to prevent duplicate sends. The last 10,000 IDs are retained.
- Pausing prevents a pending answer from being sent if pause is observed before the send call. It cannot recall messages already sent.
- Baileys is an unofficial linked-device integration and cannot guarantee account or connection continuity.
- Read-only health is public; all dashboard, logs, pairing and control routes require authentication. Keep the dashboard private and rotate the password if exposed.

## Validation

`npm test` covers exact sender isolation, answer format rejection, persistent duplicate suppression and serial processing. Live Gemini, WhatsApp pairing, Android installation and hosting still require a real environment test. No Nano files or deployments are changed.
