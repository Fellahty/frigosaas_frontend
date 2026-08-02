import type { PrinterAdapter, PrinterStatus, PrintResult, PalletLabelPrintJob, TicketPrintJob } from './types';

/**
 * Stub adapter for future Capacitor / manufacturer SDK integration.
 * Keeps printer-specific logic isolated from business workflows.
 */
export class AndroidNativePrinterAdapter implements PrinterAdapter {
  async checkStatus(): Promise<PrinterStatus> {
    return 'disconnected';
  }

  async printPalletLabel(_job: PalletLabelPrintJob): Promise<PrintResult> {
    return {
      ok: false,
      status: 'disconnected',
      message:
        'Impression Android native non configurée. Utilisez le mode navigateur ou configurez Capacitor.',
    };
  }

  async printTicket(_job: TicketPrintJob): Promise<PrintResult> {
    return {
      ok: false,
      status: 'disconnected',
      message:
        'Impression Android native non configurée. Utilisez le mode navigateur ou configurez Capacitor.',
    };
  }
}
