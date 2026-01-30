import crypto from 'crypto';

export function hashUserId(userId) {
  return crypto.createHash('sha256').update(userId).digest('hex').slice(0, 24);
}

export function hashProjectUri(uri) {
  return crypto.createHash('sha256').update(uri).digest('hex');
}
