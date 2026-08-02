export type PrinterStatus =
  | 'connected'
  | 'disconnected'
  | 'paper_out'
  | 'printing'
  | 'failed'
  | 'unknown';

export type PrintResult = {
  ok: boolean;
  status: PrinterStatus;
  message?: string;
};

export type PalletLabelPrintJob = {
  id?: string;
  siteName: string;
  palletCode: string;
  clientName: string;
  productName: string;
  productVariety?: string;
  roomName: string;
  boxes: number;
  weight?: number | null;
  entryAt: string;
  seasonName?: string;
  lotReference?: string;
  isDuplicate?: boolean;
};

export type TicketPrintJob = {
  id?: string;
  siteName: string;
  operationType: string;
  serial?: string;
  clientName: string;
  palletCode: string;
  productName?: string;
  quantity: number;
  weight?: number | null;
  roomName?: string;
  date: string;
  seasonName?: string;
  operatorName?: string;
  isDuplicate?: boolean;
};

export interface PrinterAdapter {
  checkStatus(): Promise<PrinterStatus>;
  printPalletLabel(job: PalletLabelPrintJob): Promise<PrintResult>;
  printTicket(job: TicketPrintJob): Promise<PrintResult>;
}

export type PrintingMode = 'android_native' | 'browser' | 'network_printer' | 'local_print_agent';
