import { beforeEach, describe, expect, it } from 'vitest';
import { repository } from '@/lib/repo';
import { __resetMemoryRepositoryForTests, __resetRunsForTests } from '@/lib/repo/memory';

/**
 * The scheduled check runs every half hour over the same day. Whether someone
 * is told once or thirty times about the same late list is decided here.
 */

const DATE = '2026-09-20';

beforeEach(() => {
  __resetMemoryRepositoryForTests();
  __resetRunsForTests();
});

const item = (overrides: Record<string, unknown> = {}) => ({
  businessDate: DATE,
  templateCode: 'GM_LF_KVALL',
  slot: 1,
  recipientId: 'anna',
  kind: 'ASSIGNED_NOT_STARTED',
  payload: { listName: 'Kvällslistan' },
  ...overrides,
});

describe('createNotifications', () => {
  it('creates what it is given', async () => {
    const created = await repository().createNotifications([item()]);
    expect(created).toBe(1);
  });

  it('tells the same person the same thing only once', async () => {
    await repository().createNotifications([item()]);
    const second = await repository().createNotifications([item()]);

    expect(second).toBe(0);
    expect(await repository().listNotifications('anna', DATE)).toHaveLength(1);
  });

  it('still tells a different person about the same list', async () => {
    await repository().createNotifications([item()]);
    const created = await repository().createNotifications([item({ recipientId: 'erik' })]);

    expect(created).toBe(1);
  });

  it('treats a different kind as a different thing worth saying', async () => {
    await repository().createNotifications([item()]);
    const created = await repository().createNotifications([
      item({ kind: 'NOT_SIGNED_BY_END' }),
    ]);

    expect(created).toBe(1);
    expect(await repository().listNotifications('anna', DATE)).toHaveLength(2);
  });

  it('does not carry over to the next day', async () => {
    await repository().createNotifications([item()]);
    const created = await repository().createNotifications([
      item({ businessDate: '2026-09-21' }),
    ]);

    expect(created).toBe(1);
    expect(await repository().listNotifications('anna', DATE)).toHaveLength(1);
  });
});

describe('ackNotification', () => {
  it('hides it from the recipient once acknowledged', async () => {
    await repository().createNotifications([item()]);
    const [only] = await repository().listNotifications('anna', DATE);

    await repository().ackNotification(only!.id, 'anna');

    expect(await repository().listNotifications('anna', DATE)).toHaveLength(0);
  });

  it('cannot be acknowledged by someone else', async () => {
    await repository().createNotifications([item()]);
    const [only] = await repository().listNotifications('anna', DATE);

    await repository().ackNotification(only!.id, 'erik');

    // Still Anna's to acknowledge: saying "I have seen this" is only something
    // the person it was shown to can say.
    expect(await repository().listNotifications('anna', DATE)).toHaveLength(1);
  });
});
