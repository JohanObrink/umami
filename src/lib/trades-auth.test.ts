import { describe, expect, test } from 'vitest';
import { getTradeUserId, hashTradeUserId } from './trades-auth';

const USER_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

function jwt(payload: object) {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'RS256' })}.${part(payload)}.signature`;
}

function request(headers: Record<string, string>) {
  return new Request('http://localhost/api/trades', { method: 'POST', headers });
}

describe('getTradeUserId', () => {
  test('reads the user id from a bearer token without verifying it', () => {
    expect(getTradeUserId(request({ authorization: `Bearer ${jwt({ sub: USER_ID })}` }))).toBe(
      USER_ID,
    );
  });

  test('rejects a missing header, a malformed token or a missing user id', () => {
    expect(getTradeUserId(request({}))).toBeNull();
    expect(getTradeUserId(request({ authorization: 'Bearer nonsense' }))).toBeNull();
    expect(getTradeUserId(request({ authorization: 'Bearer a.%%%.c' }))).toBeNull();
    expect(getTradeUserId(request({ authorization: `Bearer ${jwt({ name: 'bob' })}` }))).toBeNull();
  });

  test('accepts any user id', () => {
    expect(getTradeUserId(request({ authorization: `Bearer ${jwt({ sub: 'bob' })}` }))).toBe('bob');
  });
});

describe('hashTradeUserId', () => {
  test('is stable and does not contain the user id', () => {
    const hashed = hashTradeUserId(USER_ID);

    expect(hashed).toBe(hashTradeUserId(USER_ID));
    expect(hashed).not.toContain(USER_ID);
    expect(hashed).toHaveLength(128);
  });
});
