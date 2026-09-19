import { beforeEach, describe, expect, it } from 'vitest';
import { __resetMemoryRepositoryForTests, memoryEvidenceRepository } from './memory';

/**
 * Regression cover for a real bug: attachments_dedupe was keyed on
 * (item_code, sha256) with no run, so a byte-identical photo uploaded on a
 * later day was deduped into the earlier run's row instead of being stored.
 * The later run then listed no photo for the point and could never be signed —
 * every retry deduped straight back into the earlier run.
 *
 * These photos are of static scenes, so identical bytes across two days is a
 * routine event rather than a contrivance.
 */

/** "Är sopkärlen tömmda vid pressarna" — carries "OBS! Alltid Skicka bild". */
const ITEM = 'GM_LF_KVALL.GARD.04';
const SAME_BYTES = Buffer.from('identical photo bytes');
const SAME_SHA = 'a'.repeat(64);

function photo(runId: string, sha256 = SAME_SHA) {
  return {
    runId,
    itemCode: ITEM,
    groupKey: null,
    contentType: 'image/webp',
    bytes: SAME_BYTES,
    sha256,
    uploadedBy: 'worker-1',
  };
}

beforeEach(() => {
  __resetMemoryRepositoryForTests();
});

describe('addAttachment', () => {
  it('stores byte-identical photos from two runs as two attachments', async () => {
    const monday = await memoryEvidenceRepository.addAttachment(photo('run-monday'));
    const tuesday = await memoryEvidenceRepository.addAttachment(photo('run-tuesday'));

    expect(tuesday.id).not.toBe(monday.id);
  });

  it('gives each run only its own attachment', async () => {
    const monday = await memoryEvidenceRepository.addAttachment(photo('run-monday'));
    const tuesday = await memoryEvidenceRepository.addAttachment(photo('run-tuesday'));

    expect((await memoryEvidenceRepository.listAttachments('run-monday')).map((a) => a.id)).toEqual(
      [monday.id],
    );
    expect((await memoryEvidenceRepository.listAttachments('run-tuesday')).map((a) => a.id)).toEqual(
      [tuesday.id],
    );
  });

  it('returns the original row when the same bytes are re-sent within one run', async () => {
    const first = await memoryEvidenceRepository.addAttachment(photo('run-monday'));
    const retry = await memoryEvidenceRepository.addAttachment(photo('run-monday'));

    expect(retry.id).toBe(first.id);
    expect(retry.uploadedAt).toBe(first.uploadedAt);
    expect(await memoryEvidenceRepository.listAttachments('run-monday')).toHaveLength(1);
  });

  it('still stores a genuinely different photo for the same point', async () => {
    await memoryEvidenceRepository.addAttachment(photo('run-monday'));
    await memoryEvidenceRepository.addAttachment(photo('run-monday', 'b'.repeat(64)));

    expect(await memoryEvidenceRepository.listAttachments('run-monday')).toHaveLength(2);
  });
});
