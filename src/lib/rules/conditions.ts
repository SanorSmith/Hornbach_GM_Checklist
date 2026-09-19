import type { Condition, Operand, Weekday } from './schema';
import type { RunItemState } from './types';

export interface ConditionContext {
  selfItemId: string;
  /** Keyed by item CODE, which is what conditions refer to. */
  stateByCode: Record<string, RunItemState>;
  selfState: RunItemState;
  weekday: Weekday;
  shift: string;
  businessDate: string;
  now: Date;
}

function resolveOperand(operand: Operand, ctx: ConditionContext): unknown {
  switch (operand.ref) {
    case 'const':
      return operand.value;
    case 'now':
      return ctx.now.getTime();
    case 'run':
      if (operand.key === 'shift') return ctx.shift;
      if (operand.key === 'weekday') return ctx.weekday;
      return ctx.businessDate;
    case 'answer':
      return ctx.stateByCode[operand.item]?.answer ?? null;
    case 'field': {
      const state = operand.item === 'SELF' ? ctx.selfState : ctx.stateByCode[operand.item];
      return state?.fields?.[operand.key] ?? null;
    }
  }
}

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/**
 * Evaluates one condition.
 *
 * The operator set is capped on purpose — these are the ones the four real
 * checklists need, no more. A missing or unanswered operand makes a comparison
 * false rather than throwing, so a half-filled form never breaks the engine.
 */
export function evaluateCondition(condition: Condition, ctx: ConditionContext): boolean {
  switch (condition.op) {
    case 'and':
      return condition.of.every((c) => evaluateCondition(c, ctx));
    case 'or':
      return condition.of.some((c) => evaluateCondition(c, ctx));
    case 'not':
      return !evaluateCondition(condition.of, ctx);

    case 'eq':
      return resolveOperand(condition.left, ctx) === resolveOperand(condition.right, ctx);
    case 'neq':
      return resolveOperand(condition.left, ctx) !== resolveOperand(condition.right, ctx);

    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const left = asNumber(resolveOperand(condition.left, ctx));
      const right = asNumber(resolveOperand(condition.right, ctx));
      if (left === null || right === null) return false;
      if (condition.op === 'gt') return left > right;
      if (condition.op === 'gte') return left >= right;
      if (condition.op === 'lt') return left < right;
      return left <= right;
    }

    case 'between': {
      // "Boka jordpall ENDAST om det finns 6-7 stuv" lands here.
      const value = asNumber(resolveOperand(condition.left, ctx));
      if (value === null) return false;
      return value >= condition.min && value <= condition.max;
    }

    case 'in': {
      const value = resolveOperand(condition.left, ctx);
      return condition.values.some((candidate) => candidate === value);
    }

    case 'answered': {
      const state = ctx.stateByCode[condition.item];
      return Boolean(state?.answer ?? state?.answerCode);
    }

    case 'answer_is': {
      const answer = ctx.stateByCode[condition.item]?.answer;
      return answer ? condition.values.includes(answer) : false;
    }

    case 'weekday_in':
      return condition.values.includes(ctx.weekday);
  }
}
