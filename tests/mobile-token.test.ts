import { describe, expect, it } from 'vitest';
import { createIngestToken, createMobileToken, createSession, verifyIngestToken, verifyMobileToken, verifySession } from '@/lib/auth';

describe('mobile read token', () => {
  it('round-trips to the user id', async () => {
    expect(await verifyMobileToken(await createMobileToken(42))).toBe(42);
  });

  it('is not interchangeable with session or ingest tokens', async () => {
    const mobile = await createMobileToken(7);
    expect(await verifySession(mobile)).toBeNull();
    expect(await verifyIngestToken(mobile)).toBeNull();
    expect(await verifyMobileToken(await createSession(7))).toBeNull();
    expect(await verifyMobileToken(await createIngestToken(7))).toBeNull();
  });

  it('rejects a token re-pointed at another user', async () => {
    const sig = (await createMobileToken(7)).split('.')[1];
    expect(await verifyMobileToken(`8.${sig}`)).toBeNull();
  });

  it('rejects junk', async () => {
    for (const v of [null, '', 'abc', '.x', '7.', 'x.y']) expect(await verifyMobileToken(v)).toBeNull();
  });
});
