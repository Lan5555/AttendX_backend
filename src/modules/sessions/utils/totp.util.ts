import { createHmac, randomBytes } from 'crypto';

/**
 * Lightweight time-step rotating token generator, conceptually the same
 * family as TOTP (RFC 6238) but simplified: HMAC-SHA256 over a time
 * counter, truncated to a hex string sized to match the QR payload the
 * Flutter app already renders. This is the seam to swap in a stricter
 * RFC 6238 implementation (or a signed-JWT-per-window scheme) later
 * without touching any controller — only SessionsService calls these.
 */

export function generateSessionSecret(): string {
  return randomBytes(32).toString('hex');
}

function counterAt(timeStepSeconds: number, windowOffset = 0): number {
  return Math.floor(Date.now() / 1000 / timeStepSeconds) + windowOffset;
}

export function generateQrToken(
  secret: string,
  timeStepSeconds: number,
  windowOffset = 0,
): string {
  const counter = counterAt(timeStepSeconds, windowOffset);
  return createHmac('sha256', secret).update(String(counter)).digest('hex').slice(0, 24);
}

/**
 * Verifies a token against the secret, allowing tokens generated up to
 * `validWindows` steps in the past (clock skew / QR display lag) — never
 * accepts future tokens.
 */
export function verifyQrToken(
  secret: string,
  token: string,
  timeStepSeconds: number,
  validWindows: number,
): boolean {
  for (let offset = 0; offset >= -validWindows; offset--) {
    if (generateQrToken(secret, timeStepSeconds, offset) === token) {
      return true;
    }
  }
  return false;
}

export function secondsUntilNextRotation(timeStepSeconds: number): number {
  const now = Date.now() / 1000;
  const elapsedInStep = now % timeStepSeconds;
  return Math.ceil(timeStepSeconds - elapsedInStep);
}
