import { createHash } from 'node:crypto';
import { signaturePepper } from '@/lib/config';
import type { RunDetail } from '@/lib/repo/types';
import type { ResolvedTemplate } from '@/lib/rules/types';

/**
 * The digital equivalent of "Genomförs av" on the paper form — and rather more.
 *
 * A signature freezes the run exactly as it stood when it was signed: every
 * point's text, answer, note and fields, in a canonical form with sorted keys.
 * The content hash covers that snapshot; the signature hash additionally covers
 * who signed, when, on which device, and a server-side pepper.
 *
 * Because the snapshot is stored alongside, a later template edit cannot change
 * what was signed, and a database edit to the run cannot go unnoticed. That is
 * the argument for the digital list being *more* trustworthy than the paper it
 * replaces, not less.
 */

export interface RunSnapshot {
  templateCode: string;
  templateVersion: number;
  businessDate: string;
  shift: string;
  items: {
    code: string;
    textSv: string;
    answer: string | null;
    answerCode: string | null;
    note: string | null;
    fields: [string, string | number | null][];
  }[];
}

/** Sorted throughout, so the same run always hashes to the same value. */
export function buildSnapshot(template: ResolvedTemplate, run: RunDetail): RunSnapshot {
  const stateByCode = new Map(run.items.map((i) => [i.itemCode, i]));

  return {
    templateCode: template.code,
    templateVersion: template.version,
    businessDate: run.businessDate,
    shift: run.shift,
    items: [...template.items]
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((item) => {
        const state = stateByCode.get(item.code);
        return {
          code: item.code,
          textSv: item.textSv,
          answer: state?.answer ?? null,
          answerCode: state?.answerCode ?? null,
          note: state?.note ?? null,
          fields: Object.entries(state?.fields ?? {}).sort(([a], [b]) => a.localeCompare(b)),
        };
      }),
  };
}

const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

export function contentHashOf(snapshot: RunSnapshot): string {
  return sha256(JSON.stringify(snapshot));
}

export function signatureHashOf(input: {
  contentHash: string;
  username: string;
  signedAt: string;
  deviceLabel: string;
}): string {
  return sha256(
    [input.contentHash, input.username, input.signedAt, input.deviceLabel, signaturePepper()].join(
      '|',
    ),
  );
}

/** `Erik Andersson (erik) · 2026-09-19 19:42 · a3f9…c21` */
export function formatSignature(signature: {
  displayName: string;
  username: string;
  signedAt: string;
  signatureHash: string;
}): string {
  const when = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(signature.signedAt));
  const short = `${signature.signatureHash.slice(0, 4)}…${signature.signatureHash.slice(-3)}`;
  return `${signature.displayName} (${signature.username}) · ${when} · ${short}`;
}
