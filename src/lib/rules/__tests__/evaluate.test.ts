import { describe, expect, it } from 'vitest';
import { evaluateRun } from '../evaluate';
import { item, runOn, section, template, TZ } from './fixtures';

const at = (iso: string) => new Date(iso);

/**
 * One test per rule the four paper checklists actually contain. If a rule here
 * regresses, a real point on a real list stops being enforced.
 */
describe('deadlines', () => {
  it('resolves a plain clock deadline in the store\'s zone', () => {
    // "Är kontrollrundan fram till kl: 08:15 genomförd?"
    const result = evaluateRun({
      template: template([item('A', { timing: { dueTime: '08:15' } })]),
      run: runOn('2026-09-21'),
      items: [],
      now: at('2026-09-21T05:00:00Z'),
    });
    expect(result.byItem['id-A']?.dueAt).toBe('2026-09-21T06:15:00.000Z');
  });

  it('applies the weekend variant', () => {
    // "…fram till 19:00 eller 17:00 på helgerna"
    const rules = {
      timing: {
        dueTime: '19:00',
        variants: [{ when: { weekdayIn: ['SAT' as const, 'SUN' as const] }, dueTime: '17:00', reasonSv: 'Helg' }],
      },
    };

    const weekday = evaluateRun({
      template: template([item('A', rules)]),
      run: runOn('2026-09-21'), // Monday
      items: [],
      now: at('2026-09-21T05:00:00Z'),
    });
    expect(weekday.byItem['id-A']?.dueAt).toBe('2026-09-21T17:00:00.000Z');
    expect(weekday.byItem['id-A']?.dueReasonSv).toBeUndefined();

    const saturday = evaluateRun({
      template: template([item('A', rules)]),
      run: runOn('2026-09-19'), // Saturday
      items: [],
      now: at('2026-09-19T05:00:00Z'),
    });
    expect(saturday.byItem['id-A']?.dueAt).toBe('2026-09-19T15:00:00.000Z');
    expect(saturday.byItem['id-A']?.dueReasonSv).toBe('Helg');
  });

  it('anchors a relative deadline to the end of the shift', () => {
    // "Måste skicka 2 bilder … minst 15 min innan hemgång."
    const result = evaluateRun({
      template: template([
        item('A', { timing: { relativeDue: { anchor: 'shift_end', offsetMinutes: -15 } } }),
      ]),
      run: runOn('2026-09-21', { shiftEndAt: '2026-09-21T18:00:00.000Z' }),
      items: [],
      now: at('2026-09-21T15:00:00Z'),
    });
    expect(result.byItem['id-A']?.dueAt).toBe('2026-09-21T17:45:00.000Z');
  });

  it('marks an unanswered point late only after the grace period', () => {
    const build = (now: string) =>
      evaluateRun({
        template: template([item('A', { timing: { dueTime: '08:15', graceMinutes: 5 } })]),
        run: runOn('2026-09-21'),
        items: [],
        now: at(now),
      });

    expect(build('2026-09-21T06:18:00Z').byItem['id-A']?.isLate).toBe(false);
    expect(build('2026-09-21T06:21:00Z').byItem['id-A']?.isLate).toBe(true);
  });

  it('inherits a section time block, as the GPL list\'s "Morgon 08:00-12:00" does', () => {
    const result = evaluateRun({
      template: template([item('A', {})], {
        sections: [section('s1', { windowStart: '08:00', windowEnd: '12:00' })],
      }),
      run: runOn('2026-09-21'),
      items: [],
      now: at('2026-09-21T07:00:00Z'),
    });
    expect(result.byItem['id-A']?.windowStartAt).toBe('2026-09-21T06:00:00.000Z');
    expect(result.byItem['id-A']?.windowEndAt).toBe('2026-09-21T10:00:00.000Z');
  });
});

describe('notes', () => {
  const rules = {
    evidence: {
      note: {
        requiredIfAnswer: ['NEJ' as const],
        minLength: 12,
        bannedPatterns: ['(?i)hinner\\s*inte', '(?i)hann\\s*inte'],
        bannedMessageSv: 'Skriv VARFÖR ni inte hann – inte «hinner inte».',
      },
    },
  };

  const evaluate = (note: string) =>
    evaluateRun({
      template: template([item('A', rules)]),
      run: runOn(),
      items: [{ itemId: 'id-A', answer: 'NEJ', note }],
      now: at('2026-09-21T09:00:00Z'),
    });

  it('demands a reason when the answer is NEJ', () => {
    const result = evaluate('');
    expect(result.byItem['id-A']?.errors.map((e) => e.code)).toContain('NOTE_REQUIRED');
    expect(result.canSubmit).toBe(false);
  });

  it('rejects "hinner inte", exactly as the printed form instructs', () => {
    const result = evaluate('Vi hinner inte');
    expect(result.byItem['id-A']?.errors.map((e) => e.code)).toContain('NOTE_BANNED');
  });

  it('rejects the past-tense variant too', () => {
    expect(evaluate('Hann inte med det idag').byItem['id-A']?.errors.map((e) => e.code)).toContain(
      'NOTE_BANNED',
    );
  });

  it('still matches a pattern written with a PCRE-style (?i) prefix', () => {
    // JavaScript throws on inline flags. If they were not stripped, the rule
    // would compile to nothing and silently stop banning anything.
    const result = evaluateRun({
      template: template([
        item('A', {
          evidence: {
            note: {
              requiredIfAnswer: ['NEJ' as const],
              bannedPatterns: ['(?i)hinner\\s*inte'],
            },
          },
        }),
      ]),
      run: runOn(),
      items: [{ itemId: 'id-A', answer: 'NEJ', note: 'HINNER INTE' }],
      now: at('2026-09-21T09:00:00Z'),
    });
    expect(result.byItem['id-A']?.errors.map((e) => e.code)).toContain('NOTE_BANNED');
  });

  it('accepts a reason that actually explains something', () => {
    const result = evaluate('Containern var låst, vaktmästaren saknade nyckel.');
    expect(result.byItem['id-A']?.errors).toEqual([]);
    expect(result.canSubmit).toBe(true);
  });

  it('rejects a reason too short to mean anything', () => {
    expect(evaluate('Trasig').byItem['id-A']?.errors.map((e) => e.code)).toContain(
      'NOTE_TOO_SHORT',
    );
  });
});

describe('photo evidence', () => {
  it('requires a photo whenever the point says "Alltid Skicka bild"', () => {
    const result = evaluateRun({
      template: template([
        item('A', { evidence: { photo: { required: 'always', minCount: 1 } } }),
      ]),
      run: runOn(),
      items: [{ itemId: 'id-A', answer: 'JA', photoCount: 0 }],
      now: at('2026-09-21T09:00:00Z'),
    });
    expect(result.byItem['id-A']?.errors.map((e) => e.code)).toContain('PHOTO_REQUIRED');
  });

  it('counts the 2+2 photo groups separately', () => {
    // "2 bilder för GM golv yta, 2 bild GM gård"
    const rules = {
      evidence: {
        photo: {
          required: 'always' as const,
          groups: [
            { key: 'golv', labelSv: 'GM-golv', minCount: 2 },
            { key: 'gard', labelSv: 'GM-gård', minCount: 2 },
          ],
        },
      },
    };

    const partial = evaluateRun({
      template: template([item('A', rules)]),
      run: runOn(),
      items: [
        { itemId: 'id-A', answer: 'JA', photoCount: 4, photoCountsByGroup: { golv: 4, gard: 0 } },
      ],
      now: at('2026-09-21T09:00:00Z'),
    });
    // Four photos in total, but all of the floor — the yard is still unevidenced.
    const issues = partial.byItem['id-A']?.errors ?? [];
    expect(issues.map((e) => e.code)).toEqual(['PHOTO_GROUP_REQUIRED']);
    expect(issues[0]?.key).toBe('gard');

    const complete = evaluateRun({
      template: template([item('A', rules)]),
      run: runOn(),
      items: [
        { itemId: 'id-A', answer: 'JA', photoCount: 4, photoCountsByGroup: { golv: 2, gard: 2 } },
      ],
      now: at('2026-09-21T09:00:00Z'),
    });
    expect(complete.byItem['id-A']?.errors).toEqual([]);
  });

  it('inherits the Container section\'s "bild om inget behov" rule', () => {
    const result = evaluateRun({
      template: template([item('A', {})], {
        sections: [
          section('s1', {
            titleSv: 'Container',
            rules: { answer: { onIngetBehov: { requiresPhoto: true, minPhotos: 1 } } },
          }),
        ],
      }),
      run: runOn(),
      items: [{ itemId: 'id-A', answer: 'INGET_BEHOV', photoCount: 0 }],
      now: at('2026-09-21T09:00:00Z'),
    });
    expect(result.byItem['id-A']?.errors.map((e) => e.code)).toContain('PHOTO_REQUIRED');
  });
});

describe('answers', () => {
  it('supports the coded F / B answer', () => {
    // "Skriv F på texten om ni Fylld på, eller B för beställd."
    const result = evaluateRun({
      template: template([
        item('A', {
          answer: {
            mode: 'CODED',
            codes: [
              { value: 'F', labelSv: 'Fylld på' },
              { value: 'B', labelSv: 'Beställd' },
            ],
          },
        }),
      ]),
      run: runOn(),
      items: [{ itemId: 'id-A', answerCode: 'F' }],
      now: at('2026-09-21T09:00:00Z'),
    });
    expect(result.byItem['id-A']?.status).toBe('ANSWERED');
    expect(result.byItem['id-A']?.errors).toEqual([]);
  });

  it('refuses "Inget behov" on the GPL list, which has no such column', () => {
    const result = evaluateRun({
      template: template([item('A', { answer: { mode: 'JA_NEJ' } })]),
      run: runOn(),
      items: [{ itemId: 'id-A', answer: 'INGET_BEHOV' }],
      now: at('2026-09-21T09:00:00Z'),
    });
    expect(result.byItem['id-A']?.errors.map((e) => e.code)).toContain('ANSWER_NOT_ALLOWED');
  });
});

describe('conditional points and extra fields', () => {
  it('hides the soil-pallet booking unless there are 6-7 stacks', () => {
    // "Är bokning av jord pall genomförd? OBS! ENDAST OM 6-7 Stuv FINNS!"
    const rules = {
      fields: [
        { key: 'antal_stuv', type: 'INTEGER' as const, labelSv: 'Antal stuv' },
      ],
      visibility: {
        condition: {
          op: 'between' as const,
          left: { ref: 'field' as const, item: 'SELF', key: 'antal_stuv' },
          min: 6,
          max: 7,
        },
        whenFalse: 'NOT_APPLICABLE' as const,
        explainSv: 'Bokas endast om det finns 6–7 stuv.',
      },
    };

    const tooFew = evaluateRun({
      template: template([item('A', rules)]),
      run: runOn(),
      items: [{ itemId: 'id-A', fields: { antal_stuv: 3 } }],
      now: at('2026-09-21T09:00:00Z'),
    });
    expect(tooFew.byItem['id-A']?.status).toBe('NOT_APPLICABLE');
    expect(tooFew.canSubmit).toBe(true);

    const inRange = evaluateRun({
      template: template([item('A', rules)]),
      run: runOn(),
      items: [{ itemId: 'id-A', fields: { antal_stuv: 6 } }],
      now: at('2026-09-21T09:00:00Z'),
    });
    expect(inRange.byItem['id-A']?.status).toBe('PENDING');
    expect(inRange.canSubmit).toBe(false);
  });

  it('enforces the minimum of 17 pallets per stack', () => {
    const result = evaluateRun({
      template: template([
        item('A', {
          fields: [
            {
              key: 'per_stuva',
              type: 'INTEGER',
              labelSv: 'Pallar per stuva',
              requiredIfAnswer: ['JA'],
              min: 17,
              violationMessageSv: 'Minst 17 pallar per stuva.',
            },
          ],
        }),
      ]),
      run: runOn(),
      items: [{ itemId: 'id-A', answer: 'JA', fields: { per_stuva: 12 } }],
      now: at('2026-09-21T09:00:00Z'),
    });
    const issue = result.byItem['id-A']?.errors[0];
    expect(issue?.code).toBe('FIELD_OUT_OF_RANGE');
    expect(issue?.messageSv).toBe('Minst 17 pallar per stuva.');
  });

  it('requires a named colleague for the safety-checklist handover', () => {
    // "Arbetssäkerhetschecklistan ska lämnas över … Lämnades Till:"
    const result = evaluateRun({
      template: template([
        item('A', {
          fields: [
            {
              key: 'lamnades_till',
              type: 'PERSON_REF',
              labelSv: 'Lämnades till',
              requiredIfAnswer: ['JA'],
            },
          ],
        }),
      ]),
      run: runOn(),
      items: [{ itemId: 'id-A', answer: 'JA' }],
      now: at('2026-09-21T09:00:00Z'),
    });
    expect(result.byItem['id-A']?.errors.map((e) => e.code)).toContain('FIELD_REQUIRED');
  });
});

describe('sequence', () => {
  it('orders points by deadline — the "booking sequence" the worker follows', () => {
    const result = evaluateRun({
      template: template([
        item('LATE', { timing: { dueTime: '15:00' } }, { id: 'id-LATE', sortIndex: 0 }),
        item('EARLY', { timing: { dueTime: '07:00' } }, { id: 'id-EARLY', sortIndex: 1 }),
        item('MID', { timing: { dueTime: '11:30' } }, { id: 'id-MID', sortIndex: 2 }),
      ]),
      run: runOn(),
      items: [],
      now: at('2026-09-21T04:00:00Z'),
    });
    expect(result.orderedItemIds).toEqual(['id-EARLY', 'id-MID', 'id-LATE']);
  });

  it('blocks a point until its prerequisite is answered, and says why', () => {
    const items = [
      item('FIRST', { timing: { dueTime: '08:00' } }, { id: 'id-FIRST', sortIndex: 0 }),
      item(
        'SECOND',
        { timing: { dueTime: '07:00' }, sequence: { requiresItems: ['FIRST'] } },
        { id: 'id-SECOND', sortIndex: 1 },
      ),
    ];

    const blocked = evaluateRun({
      template: template(items),
      run: runOn(),
      items: [],
      now: at('2026-09-21T04:00:00Z'),
    });
    expect(blocked.byItem['id-SECOND']?.status).toBe('BLOCKED');
    expect(blocked.byItem['id-SECOND']?.blockedBy).toEqual(['FIRST']);
    expect(blocked.byItem['id-SECOND']?.blockedMessageSv).toContain('Låst tills');
    // The prerequisite comes first even though SECOND is due earlier.
    expect(blocked.orderedItemIds).toEqual(['id-FIRST', 'id-SECOND']);

    const unblocked = evaluateRun({
      template: template(items),
      run: runOn(),
      items: [{ itemId: 'id-FIRST', answer: 'JA' }],
      now: at('2026-09-21T04:00:00Z'),
    });
    expect(unblocked.byItem['id-SECOND']?.status).toBe('PENDING');
  });

  it('keeps a point locked until its unlock time', () => {
    const build = (now: string) =>
      evaluateRun({
        template: template([item('A', { sequence: { unlockAt: '13:00' } })]),
        run: runOn(),
        items: [],
        now: at(now),
      });
    expect(build('2026-09-21T09:00:00Z').byItem['id-A']?.status).toBe('LOCKED');
    expect(build('2026-09-21T11:30:00Z').byItem['id-A']?.status).toBe('PENDING');
  });
});

describe('reminders and escalation', () => {
  it('plans reminders relative to the deadline with stable dedupe keys', () => {
    const result = evaluateRun({
      template: template([
        item('A', {
          timing: { dueTime: '08:15' },
          reminders: [
            { offsetMinutes: -30, severity: 'info' },
            { offsetMinutes: 0, severity: 'alarm', fullScreen: true },
          ],
        }),
      ]),
      run: runOn(),
      items: [],
      now: at('2026-09-21T04:00:00Z'),
    });

    expect(result.byItem['id-A']?.reminderPlan).toEqual([
      { fireAt: '2026-09-21T05:45:00.000Z', severity: 'info', fullScreen: false, dedupeKey: 'item:id-A:offset:-30' },
      { fireAt: '2026-09-21T06:15:00.000Z', severity: 'alarm', fullScreen: true, dedupeKey: 'item:id-A:offset:0' },
    ]);
  });

  it('stops planning reminders once the point is answered', () => {
    const result = evaluateRun({
      template: template([
        item('A', { timing: { dueTime: '08:15' }, reminders: [{ offsetMinutes: 0, severity: 'alarm' }] }),
      ]),
      run: runOn(),
      items: [{ itemId: 'id-A', answer: 'JA' }],
      now: at('2026-09-21T04:00:00Z'),
    });
    expect(result.byItem['id-A']?.reminderPlan).toEqual([]);
  });

  it('escalates a NEJ to the group leader, as the evening list requires', () => {
    // "Är Groupledare / morgon personal meddelad om eventuellt 'ej upphittade reklamationer'?"
    const result = evaluateRun({
      template: template([
        item('A', {
          escalation: {
            on: ['ANSWER_NEJ'],
            delayMinutes: 0,
            targets: [{ type: 'ROLE', value: 'GROUP_LEADER' }, { type: 'NEXT_SHIFT_PRIMARY' }],
          },
        }),
      ]),
      run: runOn(),
      items: [{ itemId: 'id-A', answer: 'NEJ', note: 'Reklamationen kunde inte hittas i rad 12.', answeredAt: '2026-09-21T17:30:00.000Z' }],
      now: at('2026-09-21T17:31:00Z'),
    });
    expect(result.byItem['id-A']?.escalationPlan).toEqual([
      { fireAt: '2026-09-21T17:30:00.000Z', trigger: 'ANSWER_NEJ', dedupeKey: 'item:id-A:esc:ANSWER_NEJ' },
    ]);
  });
});

describe('progress', () => {
  it('excludes not-applicable points from the applicable count', () => {
    const result = evaluateRun({
      template: template([
        item('A', {}, { id: 'id-A' }),
        item(
          'B',
          {
            visibility: {
              condition: { op: 'weekday_in', values: ['SUN'] },
              whenFalse: 'NOT_APPLICABLE',
            },
          },
          { id: 'id-B' },
        ),
      ]),
      run: runOn('2026-09-21'), // Monday
      items: [{ itemId: 'id-A', answer: 'JA' }],
      now: at('2026-09-21T09:00:00Z'),
    });

    expect(result.progress).toMatchObject({
      total: 2,
      applicable: 1,
      answered: 1,
      notApplicable: 1,
    });
    expect(result.canSubmit).toBe(true);
  });
});

describe('timezone independence', () => {
  it('gives the same deadline regardless of the run\'s own clock', () => {
    const run = evaluateRun({
      template: template([item('A', { timing: { dueTime: '19:45' } })]),
      run: runOn('2026-07-15', { timeZone: TZ }),
      items: [],
      now: at('2026-07-15T03:00:00Z'),
    });
    expect(run.byItem['id-A']?.dueAt).toBe('2026-07-15T17:45:00.000Z');
  });
});
