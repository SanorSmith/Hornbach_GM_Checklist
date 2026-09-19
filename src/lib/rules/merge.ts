import { gmRulesSchema, type GmRules, type GmRulesInput } from './schema';

type Plain = Record<string, unknown>;

const isPlainObject = (value: unknown): value is Plain =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Deep merge where the later source wins and arrays REPLACE rather than concat.
 *
 * Replacing matters: if a section says photos are required in two named groups
 * and an item overrides with one group, the item must mean one group — not
 * three.
 */
function deepMerge(base: Plain, override: Plain): Plain {
  const out: Plain = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const existing = out[key];
    out[key] =
      isPlainObject(existing) && isPlainObject(value) ? deepMerge(existing, value) : value;
  }
  return out;
}

/**
 * Resolves the rules that apply to one point: template defaults, then its
 * section's rules, then its own.
 *
 * This is how the paper's structure maps cleanly: the footer's ban on writing
 * "hinner inte" is a template default that reaches every point, the Container
 * section's "skicka en bild om inget behov" is set once on the section, and
 * only the genuinely per-point rules live on the item.
 */
export function mergeRules(
  defaults: GmRulesInput | undefined,
  section: GmRulesInput | undefined,
  item: GmRulesInput,
): GmRules {
  const merged = deepMerge(
    deepMerge((defaults ?? {}) as Plain, (section ?? {}) as Plain),
    item as Plain,
  );

  const parsed = gmRulesSchema.safeParse(merged);
  if (parsed.success) return parsed.data;

  // A malformed rules document must not take a shift down. Degrade the point to
  // a plain yes/no and let validation elsewhere surface the problem.
  return { v: 1 };
}

export function isMergeable(rules: unknown): rules is GmRulesInput {
  return gmRulesSchema.safeParse(rules).success;
}
