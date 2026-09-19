import { evaluateCondition, type ConditionContext } from './conditions';
import { mergeRules } from './merge';
import type { AnswerValue, GmRules } from './schema';
import { addMinutes, weekdayOf, zonedToInstant } from './time';
import type {
  ItemEvaluation,
  ItemStatus,
  PlannedEscalation,
  PlannedReminder,
  ResolvedItem,
  ResolvedTemplate,
  RunContext,
  RunEvaluation,
  RunItemState,
  ValidationIssue,
} from './types';

/**
 * The rules engine.
 *
 * PURE. No I/O, no imports from the database, and `now` is a parameter rather
 * than a call to the clock. That is what lets the identical code run on the
 * server, in the browser and in the service worker — if it reached for I/O,
 * offline validation would drift from server validation, and the two
 * disagreeing about whether a checklist may be signed is the worst possible
 * failure for this system.
 *
 * Five passes: merge rules → resolve time → resolve visibility →
 * order and block → validate.
 */
export function evaluateRun(input: {
  template: ResolvedTemplate;
  run: RunContext;
  items: RunItemState[];
  now: Date;
}): RunEvaluation {
  const { template, run, now } = input;
  const timeZone = run.timeZone;
  const weekday = weekdayOf(run.businessDate, timeZone);

  const sectionById = new Map(template.sections.map((s) => [s.id, s]));
  const stateByItemId = new Map(input.items.map((s) => [s.itemId, s]));
  const itemByCode = new Map(template.items.map((i) => [i.code, i]));

  const stateByCode: Record<string, RunItemState> = {};
  for (const item of template.items) {
    stateByCode[item.code] = stateByItemId.get(item.id) ?? { itemId: item.id };
  }

  /* ---- Pass 1: merge ---------------------------------------------------- */
  const rulesByItemId = new Map<string, GmRules>();
  for (const item of template.items) {
    const section = sectionById.get(item.sectionId);
    rulesByItemId.set(item.id, mergeRules(template.defaults, section?.rules, item.rules));
  }

  /* ---- Pass 2: resolve time --------------------------------------------- */
  interface Timing {
    dueAt: Date | null;
    windowStartAt: Date | null;
    windowEndAt: Date | null;
    reasonSv?: string;
    graceMinutes: number;
    unlockAt: Date | null;
  }

  const timingByItemId = new Map<string, Timing>();
  for (const item of template.items) {
    const rules = rulesByItemId.get(item.id)!;
    const timing = rules.timing;
    const section = sectionById.get(item.sectionId);

    let dueAt: Date | null = null;
    let reasonSv: string | undefined;

    if (timing?.relativeDue) {
      // "minst 15 min innan hemgång" — anchored to the shift, not the clock.
      const anchorIso =
        timing.relativeDue.anchor === 'shift_end'
          ? run.shiftEndAt
          : timing.relativeDue.anchor === 'shift_start'
            ? run.shiftStartAt
            : run.openedAt;
      if (anchorIso) {
        dueAt = addMinutes(new Date(anchorIso), timing.relativeDue.offsetMinutes);
      }
    }

    if (!dueAt && timing?.dueTime) {
      // First matching variant wins: the "19:00, eller 17:00 på helgerna" case.
      const variant = timing.variants?.find((v) => v.when.weekdayIn.includes(weekday));
      const effective = variant?.dueTime ?? timing.dueTime;
      reasonSv = variant?.reasonSv;
      dueAt = zonedToInstant(run.businessDate, effective, timeZone, timing.dayOffset ?? 0);
    }

    // An item's own window wins; otherwise it inherits its section's time block
    // ("Morgon 08:00-12:00" on the GPL list).
    const windowStart = timing?.windowStart ?? section?.windowStart;
    const windowEnd = timing?.windowEnd ?? section?.windowEnd;

    timingByItemId.set(item.id, {
      dueAt,
      windowStartAt: windowStart
        ? zonedToInstant(run.businessDate, windowStart, timeZone)
        : null,
      windowEndAt: windowEnd ? zonedToInstant(run.businessDate, windowEnd, timeZone) : null,
      reasonSv,
      graceMinutes: timing?.graceMinutes ?? 0,
      unlockAt: rules.sequence?.unlockAt
        ? zonedToInstant(run.businessDate, rules.sequence.unlockAt, timeZone)
        : null,
    });
  }

  /* ---- Pass 3: visibility ------------------------------------------------ */
  const visibilityByItemId = new Map<string, { visible: boolean; hidden: boolean; explainSv?: string }>();
  for (const item of template.items) {
    const rules = rulesByItemId.get(item.id)!;
    if (!rules.visibility) {
      visibilityByItemId.set(item.id, { visible: true, hidden: false });
      continue;
    }

    const ctx: ConditionContext = {
      selfItemId: item.id,
      stateByCode,
      selfState: stateByCode[item.code] ?? { itemId: item.id },
      weekday,
      shift: run.shift,
      businessDate: run.businessDate,
      now,
    };

    const applies = evaluateCondition(rules.visibility.condition, ctx);
    visibilityByItemId.set(item.id, {
      visible: applies,
      hidden: !applies && rules.visibility.whenFalse === 'HIDDEN',
      explainSv: rules.visibility.explainSv,
    });
  }

  /* ---- Pass 4: order and block ------------------------------------------ */
  const sortKey = (item: ResolvedItem): [number, number, number] => {
    const rules = rulesByItemId.get(item.id)!;
    const due = timingByItemId.get(item.id)?.dueAt;
    return [
      due ? due.getTime() : Number.MAX_SAFE_INTEGER,
      rules.sequence?.orderIndex ?? Number.MAX_SAFE_INTEGER,
      item.sortIndex,
    ];
  };

  const compare = (a: ResolvedItem, b: ResolvedItem) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    for (let i = 0; i < ka.length; i += 1) {
      const diff = (ka[i] ?? 0) - (kb[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  };

  const orderedItemIds = topologicalOrder(template.items, rulesByItemId, itemByCode, compare);

  const blockedByItemId = new Map<string, string[]>();
  for (const item of template.items) {
    const rules = rulesByItemId.get(item.id)!;
    const blockers: string[] = [];

    for (const requiredCode of rules.sequence?.requiresItems ?? []) {
      const state = stateByCode[requiredCode];
      const answered = Boolean(state?.answer ?? state?.answerCode);
      if (!answered) blockers.push(requiredCode);
    }

    for (const [code, allowed] of Object.entries(rules.sequence?.requiresAnswer ?? {})) {
      const answer = stateByCode[code]?.answer;
      if (!answer || !allowed.includes(answer)) {
        if (!blockers.includes(code)) blockers.push(code);
      }
    }

    blockedByItemId.set(item.id, blockers);
  }

  /* ---- Pass 5: validate, and plan reminders ----------------------------- */
  const byItem: Record<string, ItemEvaluation> = {};
  let answered = 0;
  let overdue = 0;
  let notApplicable = 0;
  let blockedCount = 0;
  let applicable = 0;
  let canSubmit = true;

  for (const item of template.items) {
    const rules = rulesByItemId.get(item.id)!;
    const timing = timingByItemId.get(item.id)!;
    const visibility = visibilityByItemId.get(item.id)!;
    const state = stateByCode[item.code] ?? { itemId: item.id };
    const blockers = blockedByItemId.get(item.id) ?? [];

    const isAnswered = Boolean(state.answer ?? state.answerCode);
    const dueAt = timing.dueAt;
    const deadline = dueAt ? addMinutes(dueAt, timing.graceMinutes) : null;
    const isLate = Boolean(
      deadline &&
        (isAnswered
          ? state.answeredAt
            ? new Date(state.answeredAt) > deadline
            : false
          : now > deadline),
    );

    let status: ItemStatus;
    if (!visibility.visible) {
      status = visibility.hidden ? 'HIDDEN' : 'NOT_APPLICABLE';
    } else if (isAnswered) {
      status = 'ANSWERED';
    } else if (blockers.length > 0) {
      status = 'BLOCKED';
    } else if (timing.unlockAt && now < timing.unlockAt) {
      status = 'LOCKED';
    } else {
      status = 'PENDING';
    }

    const errors: ValidationIssue[] =
      visibility.visible ? validateItem(rules, state, isAnswered) : [];

    if (visibility.visible) {
      applicable += 1;
      if (isAnswered) answered += 1;
      if (status === 'BLOCKED') blockedCount += 1;
      if (isLate && !isAnswered) overdue += 1;
      if (errors.length > 0 && (rules.sequence?.blocksSubmit ?? true)) canSubmit = false;
    } else {
      notApplicable += 1;
    }

    byItem[item.id] = {
      itemId: item.id,
      code: item.code,
      status,
      visible: visibility.visible,
      dueAt: dueAt?.toISOString() ?? null,
      windowStartAt: timing.windowStartAt?.toISOString() ?? null,
      windowEndAt: timing.windowEndAt?.toISOString() ?? null,
      ...(timing.reasonSv ? { dueReasonSv: timing.reasonSv } : {}),
      isLate,
      blockedBy: blockers,
      ...(blockers.length > 0
        ? { blockedMessageSv: blockedMessage(blockers, itemByCode) }
        : {}),
      errors,
      warnings: [],
      reminderPlan: isAnswered ? [] : planReminders(item, rules, dueAt),
      escalationPlan: planEscalations(item, rules, state, dueAt, isLate),
    };
  }

  return {
    canSubmit,
    orderedItemIds,
    byItem,
    progress: {
      total: template.items.length,
      applicable,
      answered,
      overdue,
      notApplicable,
      blocked: blockedCount,
    },
  };
}

/* -------------------------------------------------------------------------- */

function blockedMessage(blockers: string[], itemByCode: Map<string, ResolvedItem>): string {
  const first = blockers[0];
  const item = first ? itemByCode.get(first) : undefined;
  const label = item ? `«${item.textSv.slice(0, 48)}…»` : first;
  return `Låst tills ${label} är besvarad.`;
}

/**
 * Kahn's algorithm with a priority queue, so prerequisites always come first
 * and everything else follows the time-and-rule order. This IS the "special
 * booking sequence" the worker is walked through.
 *
 * A cycle can only come from a malformed template (they are rejected at publish
 * time). If one somehow reaches here, the remaining items are appended in
 * template order rather than dropped — a confusing order beats a missing point.
 */
function topologicalOrder(
  items: ResolvedItem[],
  rulesByItemId: Map<string, GmRules>,
  itemByCode: Map<string, ResolvedItem>,
  compare: (a: ResolvedItem, b: ResolvedItem) => number,
): string[] {
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const item of items) {
    indegree.set(item.id, 0);
  }

  for (const item of items) {
    const rules = rulesByItemId.get(item.id);
    const prerequisites = [
      ...(rules?.sequence?.requiresItems ?? []),
      ...(rules?.sequence?.softAfter ?? []),
    ];
    for (const code of prerequisites) {
      const dependency = itemByCode.get(code);
      if (!dependency || dependency.id === item.id) continue;
      indegree.set(item.id, (indegree.get(item.id) ?? 0) + 1);
      dependents.set(dependency.id, [...(dependents.get(dependency.id) ?? []), item.id]);
    }
  }

  const itemById = new Map(items.map((i) => [i.id, i]));
  const ready = items.filter((i) => (indegree.get(i.id) ?? 0) === 0).sort(compare);
  const ordered: string[] = [];

  while (ready.length > 0) {
    const next = ready.shift()!;
    ordered.push(next.id);

    for (const dependentId of dependents.get(next.id) ?? []) {
      const remaining = (indegree.get(dependentId) ?? 1) - 1;
      indegree.set(dependentId, remaining);
      if (remaining === 0) {
        const dependent = itemById.get(dependentId);
        if (dependent) {
          ready.push(dependent);
          ready.sort(compare);
        }
      }
    }
  }

  if (ordered.length < items.length) {
    const seen = new Set(ordered);
    for (const item of items) if (!seen.has(item.id)) ordered.push(item.id);
  }

  return ordered;
}

function validateItem(
  rules: GmRules,
  state: RunItemState,
  isAnswered: boolean,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const mode = rules.answer?.mode ?? 'JA_NEJ_INGET_BEHOV';

  if (!isAnswered) {
    issues.push({ code: 'ANSWER_REQUIRED', messageSv: 'Punkten måste besvaras.' });
    return issues;
  }

  if (mode === 'CODED' && !state.answerCode) {
    issues.push({ code: 'CODE_REQUIRED', messageSv: 'Ange en kod.' });
  }

  const answer = state.answer ?? null;

  if (
    answer === 'INGET_BEHOV' &&
    (rules.answer?.allowIngetBehov === false || mode === 'JA_NEJ')
  ) {
    // The GPL list has no "Inget behov" column at all.
    issues.push({
      code: 'ANSWER_NOT_ALLOWED',
      messageSv: '«Inget behov» är inte tillåtet för den här punkten.',
    });
  }

  /* --- note --- */
  const note = (state.note ?? '').trim();
  const noteRules = rules.evidence?.note;
  const noteRequired =
    answer !== null && (noteRules?.requiredIfAnswer ?? []).includes(answer);
  const ingetBehovNote = answer === 'INGET_BEHOV' && rules.answer?.onIngetBehov?.requiresNote;

  if ((noteRequired || ingetBehovNote) && note.length === 0) {
    issues.push({
      code: 'NOTE_REQUIRED',
      messageSv: noteRules?.bannedMessageSv ?? 'Skriv en anteckning.',
    });
  } else if (note.length > 0) {
    const minLength = noteRules?.minLength ?? 0;
    if (note.length < minLength) {
      issues.push({
        code: 'NOTE_TOO_SHORT',
        messageSv: `Anteckningen är för kort – skriv minst ${minLength} tecken.`,
      });
    }
    for (const pattern of noteRules?.bannedPatterns ?? []) {
      if (compileNotePattern(pattern)?.test(note)) {
        issues.push({
          code: 'NOTE_BANNED',
          messageSv:
            noteRules?.bannedMessageSv ??
            'Skriv VARFÖR ni inte hann – inte «hinner inte».',
        });
        break;
      }
    }
  }

  /* --- photos --- */
  const photo = rules.evidence?.photo;
  const totalPhotos = state.photoCount ?? 0;
  const photoNeeded =
    photo?.required === 'always' ||
    (photo?.required === 'if_answer' && answer !== null && (photo.ifAnswer ?? []).includes(answer)) ||
    (answer === 'INGET_BEHOV' && rules.answer?.onIngetBehov?.requiresPhoto === true);

  if (photoNeeded) {
    const groups = photo?.groups ?? [];
    if (groups.length > 0) {
      // The "2 bilder GM-golv + 2 bilder GM-gård" case: each bucket counts.
      for (const group of groups) {
        const count = state.photoCountsByGroup?.[group.key] ?? 0;
        if (count < group.minCount) {
          issues.push({
            code: 'PHOTO_GROUP_REQUIRED',
            key: group.key,
            messageSv: `${group.labelSv}: ${group.minCount} bild(er) krävs (${count} bifogad).`,
          });
        }
      }
    } else {
      const minCount = photo?.minCount ?? rules.answer?.onIngetBehov?.minPhotos ?? 1;
      if (totalPhotos < minCount) {
        issues.push({
          code: 'PHOTO_REQUIRED',
          messageSv: `Minst ${minCount} bild(er) krävs (${totalPhotos} bifogad).`,
        });
      }
    }
  }

  /* --- extra fields --- */
  for (const field of rules.fields ?? []) {
    const value = state.fields?.[field.key] ?? null;
    const required = answer !== null && (field.requiredIfAnswer ?? []).includes(answer);
    const empty = value === null || value === '' || value === undefined;

    if (required && empty) {
      issues.push({
        code: 'FIELD_REQUIRED',
        key: field.key,
        messageSv: `${field.labelSv} måste fyllas i.`,
      });
      continue;
    }
    if (empty) continue;

    if (field.type === 'INTEGER' || field.type === 'DECIMAL') {
      const numeric = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(numeric)) {
        issues.push({
          code: 'FIELD_OUT_OF_RANGE',
          key: field.key,
          messageSv: `${field.labelSv} måste vara ett tal.`,
        });
      } else if (
        (field.min !== undefined && numeric < field.min) ||
        (field.max !== undefined && numeric > field.max)
      ) {
        issues.push({
          code: 'FIELD_OUT_OF_RANGE',
          key: field.key,
          messageSv:
            field.violationMessageSv ??
            `${field.labelSv} måste vara mellan ${field.min ?? '−∞'} och ${field.max ?? '∞'}.`,
        });
      }
    }
  }

  return issues;
}

/**
 * Compiles a banned-note pattern, case-insensitively.
 *
 * Patterns are commonly written in PCRE style as `(?i)hinner\s*inte`. JavaScript
 * does not support inline flags and throws on them, so a pattern written that
 * way would compile to nothing and the rule would look configured while
 * silently matching nothing — the worst kind of failure for a validation rule.
 * The prefix is therefore stripped, and the 'i' flag applied regardless.
 *
 * Returns null for a pattern that genuinely cannot compile. `npm run validate:seeds`
 * catches those before they ever reach a shift.
 */
export function compileNotePattern(pattern: string): RegExp | null {
  const source = pattern.startsWith('(?i)') ? pattern.slice(4) : pattern;
  try {
    return new RegExp(source, 'i');
  } catch {
    return null;
  }
}

function planReminders(
  item: ResolvedItem,
  rules: GmRules,
  dueAt: Date | null,
): PlannedReminder[] {
  if (!dueAt || !rules.reminders?.length) return [];

  const planned: PlannedReminder[] = [];
  for (const rule of rules.reminders) {
    const repeats = rule.repeatEveryMinutes ? (rule.maxRepeats ?? 1) : 1;
    for (let n = 0; n < repeats; n += 1) {
      const offset = rule.offsetMinutes + n * (rule.repeatEveryMinutes ?? 0);
      planned.push({
        fireAt: addMinutes(dueAt, offset).toISOString(),
        severity: rule.severity,
        fullScreen: rule.fullScreen ?? false,
        // Deterministic, so reconciling the plan is idempotent and answering
        // the point can cancel exactly the right rows.
        dedupeKey: `item:${item.id}:offset:${offset}`,
      });
    }
  }
  return planned;
}

function planEscalations(
  item: ResolvedItem,
  rules: GmRules,
  state: RunItemState,
  dueAt: Date | null,
  isLate: boolean,
): PlannedEscalation[] {
  const escalation = rules.escalation;
  if (!escalation) return [];

  const planned: PlannedEscalation[] = [];
  const delay = escalation.delayMinutes ?? 0;

  if (escalation.on.includes('OVERDUE') && dueAt && isLate) {
    planned.push({
      fireAt: addMinutes(dueAt, delay).toISOString(),
      trigger: 'OVERDUE',
      dedupeKey: `item:${item.id}:esc:OVERDUE`,
    });
  }

  const answerTriggers: AnswerValue[] = [];
  if (escalation.on.includes('ANSWER_NEJ')) answerTriggers.push('NEJ');
  if (escalation.on.includes('ANSWER_INGET_BEHOV')) answerTriggers.push('INGET_BEHOV');

  if (state.answer && answerTriggers.includes(state.answer)) {
    const base = state.answeredAt ? new Date(state.answeredAt) : (dueAt ?? new Date(0));
    planned.push({
      fireAt: addMinutes(base, delay).toISOString(),
      trigger: state.answer === 'NEJ' ? 'ANSWER_NEJ' : 'ANSWER_INGET_BEHOV',
      dedupeKey: `item:${item.id}:esc:ANSWER_${state.answer}`,
    });
  }

  return planned;
}
