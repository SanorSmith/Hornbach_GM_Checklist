/**
 * Schema barrel. Drizzle needs every table re-exported from one module so that
 * relational queries and `drizzle-kit generate` see the whole picture.
 *
 * Templates themselves ship as versioned seeds in `seeds/templates/` rather
 * than as rows: a run pins the template's code and version, which gives the
 * same immutability guarantee without a table nobody edits by hand yet. The
 * template builder will add that table when it needs one.
 *
 * Evidence, after-control and notifications follow.
 */
export * from './enums';
export * from './stores';
export * from './identity';
export * from './runs';
export * from './assignments';
export * from './notifications';
export * from './push';
export * from './evidence';
export * from './audit';
