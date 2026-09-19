import { pgEnum } from 'drizzle-orm/pg-core';

/** Who a person can be. A group leader holds both WORKER and GROUP_LEADER. */
export const userRole = pgEnum('user_role', ['WORKER', 'GROUP_LEADER', 'ADMIN']);

/**
 * How a point is answered.
 *  - JA_NEJ                 the GPL list, which has no "Inget behov" column
 *  - JA_NEJ_INGET_BEHOV     the three linefeeder/door lists
 *  - CODED                  "Skriv F om ni fyllt på, eller B för beställd"
 *  - NUMERIC_ONLY           a count with no yes/no at all
 */
export const answerMode = pgEnum('answer_mode', [
  'JA_NEJ',
  'JA_NEJ_INGET_BEHOV',
  'CODED',
  'NUMERIC_ONLY',
]);

export const answerValue = pgEnum('answer_value', ['JA', 'NEJ', 'INGET_BEHOV']);

export const shiftCode = pgEnum('shift_code', [
  'MORNING',
  'MIDDAY',
  'EVENING',
  'FULL_DAY',
]);

export const templateStatus = pgEnum('template_status', [
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED',
]);

export const runStatus = pgEnum('run_status', [
  'SCHEDULED',
  'OPEN',
  'SUBMITTED',
  'AFTER_CONTROLLED',
  'VOID',
]);

export const itemStatus = pgEnum('item_status', [
  'PENDING',
  'BLOCKED',
  'ANSWERED',
  'NOT_APPLICABLE',
  'SKIPPED',
]);

/** The group leader's verdict on a point during efterkontroll. */
export const controlStatus = pgEnum('control_status', [
  'PENDING',
  'OK',
  'NOT_OK',
  'FOLLOW_UP',
]);

/** Extra data a point can carry: "Antal Stuva", "Gods typ", "Lämnades Till". */
export const fieldType = pgEnum('field_type', [
  'INTEGER',
  'DECIMAL',
  'TEXT',
  'PERSON_REF',
  'TIME',
]);

export const notifChannel = pgEnum('notif_channel', [
  'PUSH',
  'LOCAL_ALARM',
  'IN_APP',
  'EMAIL',
]);

export const notifState = pgEnum('notif_state', [
  'SCHEDULED',
  'SENT',
  'DELIVERED',
  'ACKED',
  'CANCELLED',
  'FAILED',
]);

export const escalationState = pgEnum('escalation_state', [
  'OPEN',
  'ACKED',
  'RESOLVED',
  'EXPIRED',
]);
