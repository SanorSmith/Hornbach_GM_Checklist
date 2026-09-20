'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';

/**
 * Prints the record.
 *
 * Deliberately the browser's own print dialog rather than a generated PDF: the
 * store prints to whatever is on the network, and the person doing it needs to
 * pick the printer, the paper and how many copies — all of which they already
 * know how to do from this dialog.
 */
export function PrintButton() {
  return (
    <Button
      type="button"
      variant="secondary"
      className="gm-no-print min-h-touch gap-2"
      onClick={() => window.print()}
    >
      <Printer className="h-4 w-4" aria-hidden />
      {t('prot.print')}
    </Button>
  );
}
