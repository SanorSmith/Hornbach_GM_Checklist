'use client';

import { useState } from 'react';
import { AlertTriangle, Lock, MessageSquarePlus } from 'lucide-react';
import { Input, Textarea } from '@/components/ui/input';
import type { AttachmentMeta } from '@/lib/repo/types';
import { PhotoCapture } from './photo-capture';
import { cn, formatRemaining, formatTime } from '@/lib/utils';
import type { GmRules } from '@/lib/rules/schema';
import type { ItemEvaluation, ResolvedItem } from '@/lib/rules/types';
import type { RunItemStateRecord } from '@/lib/repo/types';

type AnswerValue = 'JA' | 'NEJ' | 'INGET_BEHOV';

function Countdown({ evaluation, now }: { evaluation: ItemEvaluation; now: Date }) {
  if (!evaluation.dueAt) return null;
  const due = new Date(evaluation.dueAt);
  const minutesLeft = (due.getTime() - now.getTime()) / 60_000;

  const tone =
    evaluation.status === 'ANSWERED'
      ? 'gm-countdown-ok'
      : minutesLeft < 0
        ? 'gm-countdown-late'
        : minutesLeft < 30
          ? 'gm-countdown-soon'
          : 'gm-countdown-ok';

  return (
    <span className={tone} title={evaluation.dueReasonSv}>
      {formatTime(due)}
      {evaluation.status !== 'ANSWERED' && (
        <span className="font-normal"> · {formatRemaining(due, now)}</span>
      )}
    </span>
  );
}

export function ItemCard({
  item,
  rules,
  evaluation,
  state,
  ordinalLabel,
  onChange,
  disabled,
  runId,
  photos,
  onPhotosChanged,
}: {
  item: ResolvedItem;
  rules: GmRules;
  evaluation: ItemEvaluation;
  state: RunItemStateRecord | undefined;
  ordinalLabel: string;
  onChange: (patch: Partial<RunItemStateRecord>) => void;
  disabled: boolean;
  runId: string;
  photos: AttachmentMeta[];
  onPhotosChanged: () => void;
}) {
  // Above the early return for hidden items: hooks have to run in the same
  // order on every render, and this component returns null for some of them.
  //
  // The paper form has an "Anteckning" column on every row, and people use it —
  // a JA with a caveat is still worth writing down. Required notes open
  // themselves; the rest are one tap away, so an optional field does not push
  // the answer buttons down the screen on every point.
  const [noteOpen, setNoteOpen] = useState(false);

  const now = new Date();
  const mode = rules.answer?.mode ?? 'JA_NEJ_INGET_BEHOV';
  const locked = evaluation.status === 'BLOCKED' || evaluation.status === 'LOCKED';
  const notApplicable = evaluation.status === 'NOT_APPLICABLE';

  if (evaluation.status === 'HIDDEN') return null;

  const answer = state?.answer ?? null;
  const noteRequired =
    answer !== null && (rules.evidence?.note?.requiredIfAnswer ?? []).includes(answer);

  const hasNote = (state?.note ?? '').length > 0;
  const showNote = noteRequired || noteOpen || hasNote;

  // Mirrors the engine's rule: always, or only for the answers listed, or
  // because "Inget behov" needs a photo to prove there was nothing to do.
  const photoRules = rules.evidence?.photo;
  const photoGroups = photoRules?.groups ?? [];
  const photoNeeded =
    photoRules?.required === 'always' ||
    (photoRules?.required === 'if_answer' &&
      answer !== null &&
      (photoRules.ifAnswer ?? []).includes(answer)) ||
    (answer === 'INGET_BEHOV' && rules.answer?.onIngetBehov?.requiresPhoto === true);

  const visibleFields = (rules.fields ?? []).filter(
    (field) =>
      answer === null ||
      (field.requiredIfAnswer ?? []).length === 0 ||
      (field.requiredIfAnswer ?? []).includes(answer),
  );

  const answerButton = (value: AnswerValue, label: string, className: string) => (
    <button
      key={value}
      type="button"
      className={className}
      aria-pressed={answer === value}
      disabled={disabled || locked || notApplicable}
      onClick={() => onChange({ answer: answer === value ? null : value })}
    >
      {label}
    </button>
  );

  return (
    <li
      className={cn('gm-item', locked && 'gm-item-blocked', notApplicable && 'opacity-55')}
      id={`item-${item.code}`}
    >
      <div className="flex items-start gap-3">
        <span className="gm-item-number mt-0.5">{ordinalLabel}</span>
        <div className="min-w-0 flex-1">
          <p className="gm-item-text">{item.textSv}</p>
          {item.helpSv ? <p className="gm-hint">{item.helpSv}</p> : null}
        </div>
        <Countdown evaluation={evaluation} now={now} />
      </div>

      {locked ? (
        <p className="gm-muted flex items-center gap-2 text-sm">
          <Lock className="h-4 w-4 shrink-0" aria-hidden />
          {evaluation.blockedMessageSv ??
            (evaluation.status === 'LOCKED' ? 'Öppnas senare under passet.' : 'Låst.')}
        </p>
      ) : notApplicable ? (
        <p className="gm-muted text-sm">
          {rules.visibility?.explainSv ?? 'Gäller inte idag.'}
        </p>
      ) : (
        <>
          {mode === 'CODED' ? (
            <div className="flex gap-2">
              {(rules.answer?.codes ?? []).map((code) => (
                <button
                  key={code.value}
                  type="button"
                  className="gm-answer gm-answer-ja"
                  aria-pressed={state?.answerCode === code.value}
                  disabled={disabled}
                  onClick={() =>
                    onChange({
                      answerCode: state?.answerCode === code.value ? null : code.value,
                    })
                  }
                >
                  {code.value} · {code.labelSv}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-2">
              {answerButton('JA', 'Ja', 'gm-answer-ja')}
              {answerButton('NEJ', 'Nej', 'gm-answer-nej')}
              {mode !== 'JA_NEJ' && rules.answer?.allowIngetBehov !== false
                ? answerButton('INGET_BEHOV', 'Inget behov', 'gm-answer-ingetbehov')
                : null}
            </div>
          )}

          {!showNote && !disabled ? (
            <button
              type="button"
              className="gm-btn gm-btn-ghost min-h-touch self-start px-2 text-sm"
              onClick={() => setNoteOpen(true)}
            >
              <MessageSquarePlus className="h-4 w-4" aria-hidden />
              Lägg till anteckning
            </button>
          ) : null}

          {showNote ? (
            <div>
              <label className="gm-label" htmlFor={`note-${item.code}`}>
                {noteRequired ? 'Anteckning — varför?' : 'Anteckning'}
              </label>
              <Textarea
                id={`note-${item.code}`}
                value={state?.note ?? ''}
                placeholder={
                  noteRequired
                    ? (rules.evidence?.note?.placeholderSv ?? 'Beskriv orsaken…')
                    : 'Skriv vad som behöver förklaras…'
                }
                disabled={disabled}
                invalid={evaluation.errors.some((e) => e.code.startsWith('NOTE'))}
                onChange={(e) => onChange({ note: e.target.value })}
              />
            </div>
          ) : null}

          {visibleFields.map((field) => (
            <div key={field.key}>
              <label className="gm-label" htmlFor={`f-${item.code}-${field.key}`}>
                {field.labelSv}
              </label>
              <Input
                id={`f-${item.code}-${field.key}`}
                type={field.type === 'INTEGER' || field.type === 'DECIMAL' ? 'number' : 'text'}
                inputMode={field.type === 'INTEGER' ? 'numeric' : undefined}
                value={String(state?.fields?.[field.key] ?? '')}
                disabled={disabled}
                invalid={evaluation.errors.some((e) => e.key === field.key)}
                onChange={(e) => {
                  const raw = e.target.value;
                  const value =
                    field.type === 'INTEGER' || field.type === 'DECIMAL'
                      ? raw === ''
                        ? null
                        : Number(raw)
                      : raw;
                  onChange({ fields: { ...(state?.fields ?? {}), [field.key]: value } });
                }}
              />
            </div>
          ))}

          {photoNeeded ? (
            <div className="space-y-3 border-t border-[hsl(var(--gm-border))] pt-3">
              {rules.evidence?.photo?.hintSv ? (
                <p className="gm-hint m-0">{rules.evidence.photo.hintSv}</p>
              ) : null}
              {photoGroups.length > 0 ? (
                photoGroups.map((group) => (
                  <PhotoCapture
                    key={group.key}
                    runId={runId}
                    itemCode={item.code}
                    groupKey={group.key}
                    label={group.labelSv}
                    minCount={group.minCount}
                    photos={photos.filter((p) => p.groupKey === group.key)}
                    disabled={disabled}
                    onChange={onPhotosChanged}
                  />
                ))
              ) : (
                <PhotoCapture
                  runId={runId}
                  itemCode={item.code}
                  groupKey={null}
                  minCount={
                    rules.evidence?.photo?.minCount ??
                    rules.answer?.onIngetBehov?.minPhotos ??
                    1
                  }
                  photos={photos}
                  disabled={disabled}
                  onChange={onPhotosChanged}
                />
              )}
            </div>
          ) : null}

          {evaluation.errors
            .filter((e) => e.code !== 'ANSWER_REQUIRED')
            .map((issue) => (
              <p key={`${issue.code}-${issue.key ?? ''}`} className="gm-error flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {issue.messageSv}
              </p>
            ))}
        </>
      )}
    </li>
  );
}
