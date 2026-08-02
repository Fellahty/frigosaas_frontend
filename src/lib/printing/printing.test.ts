import { describe, expect, it } from 'vitest';
import { buildPalletLabelHtml, buildTicketHtml } from './browserAdapter';
import { createPrinterAdapter } from './index';

describe('printing adapters', () => {
  it('builds pallet label with DUPLICATA', () => {
    const html = buildPalletLabelHtml({
      siteName: 'Frigo Test',
      palletCode: 'PAL-20260802-ALP-001',
      clientName: 'Alpha',
      productName: 'Pomme',
      productVariety: 'Golden',
      roomName: 'C1',
      boxes: 42,
      weight: 500,
      entryAt: '02/08/2026',
      seasonName: '2026',
      isDuplicate: true,
    });
    expect(html).toContain('DUPLICATA');
    expect(html).toContain('PAL-20260802-ALP-001');
    expect(html).toContain('CHAMBRE C1');
  });

  it('builds exit ticket', () => {
    const html = buildTicketHtml({
      siteName: 'Frigo Test',
      operationType: 'SORTIE PARTIELLE',
      clientName: 'Alpha',
      palletCode: 'PAL-20260802-ALP-001',
      quantity: 5,
      date: '02/08/2026',
      operatorName: 'Op',
    });
    expect(html).toContain('SORTIE PARTIELLE');
    expect(html).toContain('Signature');
  });

  it('creates browser adapter by default', async () => {
    const adapter = createPrinterAdapter('browser');
    expect(await adapter.checkStatus()).toBeTruthy();
  });

  it('android adapter reports disconnected until Capacitor is wired', async () => {
    const adapter = createPrinterAdapter('android_native');
    expect(await adapter.checkStatus()).toBe('disconnected');
  });
});
