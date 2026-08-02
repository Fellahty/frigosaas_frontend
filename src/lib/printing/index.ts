import { AndroidNativePrinterAdapter } from './androidNativeAdapter';
import { BrowserPrinterAdapter } from './browserAdapter';
import type { PrinterAdapter, PrintingMode } from './types';

export function createPrinterAdapter(mode: PrintingMode = 'browser'): PrinterAdapter {
  switch (mode) {
    case 'android_native':
      return new AndroidNativePrinterAdapter();
    case 'network_printer':
    case 'local_print_agent':
      // Future: network / agent adapters. Browser fallback for now.
      return new BrowserPrinterAdapter();
    case 'browser':
    default:
      return new BrowserPrinterAdapter();
  }
}

export * from './types';
export { BrowserPrinterAdapter } from './browserAdapter';
export { AndroidNativePrinterAdapter } from './androidNativeAdapter';
export { buildPalletLabelHtml, buildTicketHtml } from './browserAdapter';
