import { beforeEach, describe, expect, it } from 'vitest';
import { getTemplate } from '@/lib/checklists';
import { repository } from '@/lib/repo';
import { __resetMemoryRepositoryForTests, __resetRunsForTests } from '@/lib/repo/memory';
import { buildRunRecord } from './record';

/**
 * The filed copy of a finished list.
 *
 * What matters here is that the record is faithful to the run: everything that
 * was recorded appears, nothing is invented, and a point nobody answered stays
 * visibly unanswered rather than quietly vanishing from the page.
 */

const TODAY = '2026-09-20';

beforeEach(() => {
  __resetMemoryRepositoryForTests();
  __resetRunsForTests();
});

async function openRun(code: string) {
  const template = getTemplate(code)!;
  const [user] = await repository().listUsers();
  return repository().openRun({
    templateCode: template.code,
    templateVersion: template.version,
    businessDate: TODAY,
    shift: template.shift,
    userId: user!.id,
  });
}

async function sign(runId: string, slot = 1) {
  const users = await repository().listUsers();
  const user = users[slot - 1] ?? users[0]!;
  await repository().signRun(runId, {
    slot,
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    contentHash: 'c',
    signatureHash: 's',
    snapshot: {},
  });
}

describe('buildRunRecord', () => {
  it('returns null for a run that does not exist', async () => {
    expect(await buildRunRecord('no-such-run')).toBeNull();
  });

  it('includes every point on the form, answered or not', async () => {
    const run = await openRun('GM_DORR');
    const template = getTemplate('GM_DORR')!;

    const record = (await buildRunRecord(run.id))!;
    const items = record.sections.flatMap((s) => s.items);

    expect(items).toHaveLength(template.items.length);
    expect(record.total).toBe(template.items.length);
    expect(record.answered).toBe(0);
    // An unanswered point is the blank line on the paper sheet.
    expect(items.every((i) => i.answer === null && i.answerSv === null)).toBe(true);
  });

  it('keeps the form order, by section and then by point', async () => {
    const run = await openRun('GM_GPL');
    const template = getTemplate('GM_GPL')!;

    const record = (await buildRunRecord(run.id))!;
    const codes = record.sections.flatMap((s) => s.items.map((i) => i.code));
    const expected = template.items
      .slice()
      .sort((a, b) => a.sortIndex - b.sortIndex)
      .map((i) => i.code);

    expect(codes).toEqual(expected);
  });

  it('shows the answer, the note and the recorded field values', async () => {
    const run = await openRun('GM_GPL');
    const [user] = await repository().listUsers();
    const item = getTemplate('GM_GPL')!.items.find(
      (i) => (i.rules.fields ?? []).length > 0,
    )!;
    const field = item.rules.fields![0]!;

    await repository().saveAnswer(
      run.id,
      {
        itemCode: item.code,
        answer: 'NEJ',
        note: 'Saknas sedan i morse.',
        fields: { [field.key]: 'Scanner 3, vid porten' },
      },
      user!.id,
      new Date(`${TODAY}T09:15:00Z`),
    );

    const record = (await buildRunRecord(run.id))!;
    const recorded = record.sections.flatMap((s) => s.items).find((i) => i.code === item.code)!;

    expect(recorded.answer).toBe('NEJ');
    expect(recorded.answerSv).toBe('Nej');
    expect(recorded.note).toBe('Saknas sedan i morse.');
    expect(recorded.fields).toContainEqual({
      key: field.key,
      labelSv: field.labelSv,
      value: 'Scanner 3, vid porten',
    });
    expect(record.answered).toBe(1);
  });

  it('keeps a field the form defines but nobody filled in', async () => {
    const run = await openRun('GM_GPL');
    const item = getTemplate('GM_GPL')!.items.find((i) => (i.rules.fields ?? []).length > 0)!;

    const record = (await buildRunRecord(run.id))!;
    const recorded = record.sections.flatMap((s) => s.items).find((i) => i.code === item.code)!;

    expect(recorded.fields).toHaveLength(item.rules.fields!.length);
    expect(recorded.fields.every((f) => f.value === null)).toBe(true);
  });

  it('lists both signatures of a two-slot list, with the slot label from the form', async () => {
    const run = await openRun('GM_LF_KVALL');
    await sign(run.id, 1);
    await sign(run.id, 2);

    const record = (await buildRunRecord(run.id))!;

    expect(record.signatures).toHaveLength(2);
    expect(record.signatures[0]?.slot).toBe(1);
    expect(record.signatures[1]?.slot).toBe(2);
    expect(record.signatures[1]?.slotLabelSv).toBe('Genomförs av (Person 2)');
    expect(record.status).toBe('SUBMITTED');
  });

  it('leaves the leader review out of the worker signatures and carries the verdict', async () => {
    const run = await openRun('GM_GPL');
    await sign(run.id);
    await repository().controlRun(run.id, {
      status: 'NOT_OK',
      note: 'FiFo:n var inte justerad.',
      userId: 'leader',
      username: 'erik',
      displayName: 'Erik Andersson',
      contentHash: 'c',
      signatureHash: 's',
      snapshot: {},
    });

    const record = (await buildRunRecord(run.id))!;

    expect(record.signatures).toHaveLength(1);
    expect(record.signatures[0]?.displayName).not.toBe('Erik Andersson');
    expect(record.control.status).toBe('NOT_OK');
    expect(record.control.by).toBe('Erik Andersson');
    expect(record.control.note).toBe('FiFo:n var inte justerad.');
  });

  it('reports that the form has not changed since the run', async () => {
    const run = await openRun('GM_DORR');
    const record = (await buildRunRecord(run.id))!;

    expect(record.runTemplateVersion).toBe(record.currentTemplateVersion);
    expect(record.templateVersionMatches).toBe(true);
  });

  it('carries the header a filed copy needs to stand on its own', async () => {
    const run = await openRun('GM_LF_MORGON');
    const record = (await buildRunRecord(run.id))!;

    expect(record.nameSv).toBe(getTemplate('GM_LF_MORGON')!.nameSv);
    expect(record.businessDate).toBe(TODAY);
    expect(record.roleSv.length).toBeGreaterThan(0);
    expect(record.footerNotesSv).toContain('hinner inte');
  });
});
