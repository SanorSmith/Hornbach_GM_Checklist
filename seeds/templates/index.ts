import { countItems, type TemplateSeed } from '../types';
import { GM_DORR } from './gm-dorr';
import { GM_GPL } from './gm-gpl';
import { GM_LF_KVALL } from './gm-lf-kvall';
import { GM_LF_MORGON } from './gm-lf-morgon';

/** Every checklist this system ships with, in the order staff meet them. */
export const TEMPLATE_SEEDS: readonly TemplateSeed[] = [
  GM_LF_MORGON,
  GM_DORR,
  GM_GPL,
  GM_LF_KVALL,
];

export function seedByCode(code: string): TemplateSeed | undefined {
  return TEMPLATE_SEEDS.find((seed) => seed.code === code);
}

export { GM_LF_MORGON, GM_DORR, GM_GPL, GM_LF_KVALL, countItems };
export type { TemplateSeed };
