import type { Config } from 'tailwindcss';

/**
 * Two very different screens share this config:
 *  - the worker on a ~4" Zebra handheld, outdoors, wearing gloves
 *  - the group leader on a desktop reviewing a month of runs
 *
 * Touch sizing is therefore a token, not an afterthought: `min-h-touch` (48px) is
 * the floor for anything interactive in the worker shell.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', lg: '2rem' },
    },
    extend: {
      screens: {
        // Zebra TC2x/TC5x land around here; do not let layouts assume >=360px.
        xs: '320px',
      },
      colors: {
        // Hornbach orange.
        brand: {
          50: '#FFF4EB',
          100: '#FFE3CC',
          200: '#FFC599',
          300: '#FFA666',
          400: '#FF8B38',
          500: '#FF7300',
          600: '#DB5E00',
          700: '#A34600',
          800: '#6B2E00',
          900: '#3D1A00',
        },
        // Answer semantics, used by the JA / NEJ / Inget behov controls.
        ja: { DEFAULT: '#137B4B', fg: '#FFFFFF', soft: '#E4F4EC' },
        nej: { DEFAULT: '#B3261E', fg: '#FFFFFF', soft: '#FCE9E8' },
        ingetbehov: { DEFAULT: '#5A6472', fg: '#FFFFFF', soft: '#EEF0F3' },
        // Deadline states.
        due: { soon: '#B26A00', late: '#B3261E', ok: '#137B4B' },
      },
      spacing: {
        touch: '3rem', // 48px — the minimum interactive target
      },
      minHeight: { touch: '3rem' },
      minWidth: { touch: '3rem' },
      borderRadius: {
        gm: '0.75rem',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      keyframes: {
        'alarm-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        'alarm-pulse': 'alarm-pulse 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
