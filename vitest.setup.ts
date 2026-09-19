import '@testing-library/jest-dom/vitest';

// Every deadline in this app is a Europe/Stockholm wall-clock time. Tests must not
// silently depend on the machine's zone.
process.env.TZ = 'Europe/Stockholm';
