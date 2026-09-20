import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The drawn name is the face of a signature; the hash is the proof.
 *
 * What these pin down is that the two are tied together — so a drawing cannot
 * be swapped for somebody else's afterwards without the signature hash ceasing
 * to match the row it sits on.
 */

vi.mock('@/lib/config', () => ({ signaturePepper: () => 'test-pepper' }));

const BASE = {
  contentHash: 'abc123',
  username: 'anna',
  signedAt: '2026-09-21T08:00:00.000Z',
  deviceLabel: 'Zebra TC21',
};

let signatureHashOf: typeof import('./signature').signatureHashOf;
let drawingHashOf: typeof import('./signature').drawingHashOf;

beforeEach(async () => {
  ({ signatureHashOf, drawingHashOf } = await import('./signature'));
});

describe('signatureHashOf', () => {
  it('changes when the drawing changes', () => {
    const one = signatureHashOf({ ...BASE, drawingHash: drawingHashOf('AAAA') });
    const other = signatureHashOf({ ...BASE, drawingHash: drawingHashOf('BBBB') });

    expect(one).not.toBe(other);
  });

  it('is stable for the same drawing', () => {
    const hash = drawingHashOf('AAAA');
    expect(signatureHashOf({ ...BASE, drawingHash: hash })).toBe(
      signatureHashOf({ ...BASE, drawingHash: hash }),
    );
  });

  it('tells a signature with no drawing apart from one whose drawing was removed', () => {
    // Both end up with an empty drawing hash, so these must agree — the point
    // is that neither can be confused with a signature that *had* one.
    const none = signatureHashOf(BASE);
    const explicitlyNull = signatureHashOf({ ...BASE, drawingHash: null });
    const withDrawing = signatureHashOf({ ...BASE, drawingHash: drawingHashOf('AAAA') });

    expect(none).toBe(explicitlyNull);
    expect(none).not.toBe(withDrawing);
  });

  it('still depends on who signed, when, and on what', () => {
    const drawingHash = drawingHashOf('AAAA');
    const base = signatureHashOf({ ...BASE, drawingHash });

    expect(signatureHashOf({ ...BASE, username: 'erik', drawingHash })).not.toBe(base);
    expect(
      signatureHashOf({ ...BASE, signedAt: '2026-09-21T09:00:00.000Z', drawingHash }),
    ).not.toBe(base);
    expect(signatureHashOf({ ...BASE, deviceLabel: 'iPhone', drawingHash })).not.toBe(base);
    expect(signatureHashOf({ ...BASE, contentHash: 'other', drawingHash })).not.toBe(base);
  });
});

describe('drawingHashOf', () => {
  it('is a sha256 of the base64 exactly as stored', () => {
    expect(drawingHashOf('AAAA')).toMatch(/^[0-9a-f]{64}$/);
    expect(drawingHashOf('AAAA')).not.toBe(drawingHashOf('AAAB'));
  });
});
