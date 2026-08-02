import type {
  PalletLabelPrintJob,
  PrinterAdapter,
  PrinterStatus,
  PrintResult,
  TicketPrintJob,
} from './types';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function openPrintWindow(html: string, title: string): Promise<PrintResult> {
  return new Promise((resolve) => {
    const w = window.open('', '_blank', 'noopener,noreferrer,width=480,height=720');
    if (!w) {
      resolve({
        ok: false,
        status: 'failed',
        message: 'Impossible d’ouvrir la fenêtre d’impression. Autorisez les pop-ups.',
      });
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.document.title = title;

    const finish = (ok: boolean) => {
      try {
        w.close();
      } catch {
        /* ignore */
      }
      resolve({
        ok,
        status: ok ? 'connected' : 'failed',
        message: ok
          ? 'Document envoyé à l’imprimante'
          : 'Impression annulée ou non confirmée',
      });
    };

    w.onload = () => {
      setTimeout(() => {
        try {
          w.focus();
          w.print();
          finish(true);
        } catch {
          finish(false);
        }
      }, 350);
    };
  });
}

export function buildPalletLabelHtml(job: PalletLabelPrintJob): string {
  const dup = job.isDuplicate
    ? `<div style="text-align:center;font-size:28px;font-weight:800;color:#b91c1c;margin:8px 0;">DUPLICATA</div>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Étiquette ${esc(job.palletCode)}</title>
<style>
  @page { size: 100mm 150mm; margin: 4mm; }
  body { font-family: Arial, sans-serif; margin: 0; color: #0f172a; }
  .wrap { width: 92mm; padding: 4mm; }
  .brand { font-size: 18px; font-weight: 800; letter-spacing: 0.04em; color: #0e7490; }
  .site { font-size: 12px; color: #475569; margin-bottom: 8px; }
  .code { font-size: 26px; font-weight: 900; letter-spacing: 0.02em; margin: 10px 0; }
  .qr { width: 42mm; height: 42mm; border: 2px solid #0f172a; display:flex;align-items:center;justify-content:center;font-size:10px;margin: 8px auto; }
  .row { display:flex; justify-content:space-between; font-size: 13px; margin: 4px 0; gap: 8px; }
  .label { color:#64748b; } .val { font-weight:700; text-align:right; }
  .room { font-size: 22px; font-weight: 900; background:#ecfeff; border:2px solid #0e7490; padding:8px; text-align:center; margin-top:10px; }
</style></head><body><div class="wrap">
  <div class="brand">FRIGOSMART</div>
  <div class="site">${esc(job.siteName)}</div>
  ${dup}
  <div class="code">PALETTE: ${esc(job.palletCode)}</div>
  <div class="qr">${esc(job.palletCode)}</div>
  <div class="row"><span class="label">Client</span><span class="val">${esc(job.clientName)}</span></div>
  <div class="row"><span class="label">Produit</span><span class="val">${esc(job.productName)}${job.productVariety ? ' / ' + esc(job.productVariety) : ''}</span></div>
  <div class="row"><span class="label">Caisses</span><span class="val">${esc(job.boxes)}</span></div>
  <div class="row"><span class="label">Poids</span><span class="val">${job.weight != null ? esc(job.weight) + ' kg' : '—'}</span></div>
  <div class="row"><span class="label">Entrée</span><span class="val">${esc(job.entryAt)}</span></div>
  <div class="row"><span class="label">Saison</span><span class="val">${esc(job.seasonName || '')}</span></div>
  <div class="row"><span class="label">Lot</span><span class="val">${esc(job.lotReference || '—')}</span></div>
  <div class="room">CHAMBRE ${esc(job.roomName)}</div>
</div></body></html>`;
}

export function buildTicketHtml(job: TicketPrintJob): string {
  const dup = job.isDuplicate
    ? `<div style="text-align:center;font-size:18px;font-weight:800;color:#b91c1c;">DUPLICATA</div>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Ticket ${esc(job.palletCode)}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  body { font-family: 'Courier New', monospace; width: 72mm; margin: 0; color: #111; font-size: 12px; }
  .c { text-align:center; } .b { font-weight:700; }
  .line { border-top: 1px dashed #333; margin: 6px 0; }
  .row { display:flex; justify-content:space-between; margin: 3px 0; gap: 6px; }
</style></head><body>
  <div class="c b" style="font-size:14px;">FRIGOSMART</div>
  <div class="c">${esc(job.siteName)}</div>
  ${dup}
  <div class="line"></div>
  <div class="c b">${esc(job.operationType)}</div>
  <div class="row"><span>N°</span><span>${esc(job.serial || '—')}</span></div>
  <div class="row"><span>Client</span><span>${esc(job.clientName)}</span></div>
  <div class="row"><span>Palette</span><span class="b">${esc(job.palletCode)}</span></div>
  <div class="row"><span>Produit</span><span>${esc(job.productName || '—')}</span></div>
  <div class="row"><span>Qté</span><span class="b">${esc(job.quantity)}</span></div>
  <div class="row"><span>Poids</span><span>${job.weight != null ? esc(job.weight) + ' kg' : '—'}</span></div>
  <div class="row"><span>Chambre</span><span>${esc(job.roomName || '—')}</span></div>
  <div class="row"><span>Date</span><span>${esc(job.date)}</span></div>
  <div class="row"><span>Saison</span><span>${esc(job.seasonName || '—')}</span></div>
  <div class="row"><span>Opérateur</span><span>${esc(job.operatorName || '—')}</span></div>
  <div class="line"></div>
  <div class="c" style="margin-top:16px;">Signature: ______________</div>
</body></html>`;
}

export class BrowserPrinterAdapter implements PrinterAdapter {
  async checkStatus(): Promise<PrinterStatus> {
    return navigator.onLine ? 'connected' : 'disconnected';
  }

  async printPalletLabel(job: PalletLabelPrintJob): Promise<PrintResult> {
    return openPrintWindow(buildPalletLabelHtml(job), `Label ${job.palletCode}`);
  }

  async printTicket(job: TicketPrintJob): Promise<PrintResult> {
    return openPrintWindow(buildTicketHtml(job), `Ticket ${job.palletCode}`);
  }
}
