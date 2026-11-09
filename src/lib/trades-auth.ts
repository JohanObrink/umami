import { hash, secret } from './crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The WAF/IAP validates the app's access token and replaces it with a user JWT, so the
// signature is not checked here.
export function getTradeUserId(request: Request) {
  const header = process.env.TRADES_JWT_HEADER || 'authorization';
  const claim = process.env.TRADES_USER_CLAIM || 'sub';
  const token = request.headers.get(header)?.replace(/^Bearer\s+/i, '');
  const payload = token?.split('.')[1];

  if (!payload) return null;

  try {
    const userId = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))[claim];
    return typeof userId === 'string' && UUID_RE.test(userId) ? userId : null;
  } catch {
    return null;
  }
}

export function hashTradeUserId(userId: string) {
  return hash(userId.toLowerCase(), secret());
}
