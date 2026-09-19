import { isDemo } from '@/lib/config';
import { t } from '@/lib/i18n';

/**
 * Says plainly that the data is not real.
 *
 * Deliberately loud: a checklist that looks signed but was never stored is
 * worse than no checklist at all, so nobody should be able to mistake the
 * demo deployment for the live one.
 */
export function DemoBanner() {
  if (!isDemo()) return null;
  return (
    <div className="gm-offline-banner justify-center text-center" role="status">
      {t('demo.banner')}
    </div>
  );
}
