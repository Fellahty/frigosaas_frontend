import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  createReprintJob,
  fetchPrintables,
  updatePrintJobStatus,
  type PrintJobSummary,
} from '@/lib/api/operator';
import { ApiError } from '@/lib/api/client';
import { useOperatorUi } from './OperatorProvider';

export function OperatorReprintPage() {
  const navigate = useNavigate();
  const { tenantId, printer, context } = useOperatorUi();
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: jobs = [], refetch } = useQuery({
    queryKey: ['operator-printables', tenantId, search],
    enabled: !!tenantId,
    queryFn: () => fetchPrintables(tenantId, search),
  });

  const reprint = async (job: PrintJobSummary) => {
    setBusyId(job.id);
    setMessage('');
    try {
      const reprintJob = await createReprintJob(tenantId, {
        sourceJobId: job.id,
        documentType: job.documentType,
      });
      const payload = reprintJob.payload || {};
      const isLabel =
        reprintJob.documentType === 'pallet_label' || reprintJob.documentType === 'reprint_label';

      const result = isLabel
        ? await printer.printPalletLabel({
            siteName: String(payload.siteName || context?.siteName || ''),
            palletCode: String(payload.palletCode || ''),
            clientName: String(payload.clientName || ''),
            productName: String(payload.productName || ''),
            productVariety: String(payload.productVariety || ''),
            roomName: String(payload.roomName || ''),
            boxes: Number(payload.boxes || 0),
            weight: (payload.weight as number | null) ?? null,
            entryAt: String(payload.entryAt || ''),
            seasonName: String(payload.seasonName || context?.season?.name || ''),
            lotReference: String(payload.lotReference || ''),
            isDuplicate: true,
          })
        : await printer.printTicket({
            siteName: String(payload.siteName || context?.siteName || ''),
            operationType: String(payload.mode === 'complete' ? 'SORTIE' : 'TICKET'),
            serial: String(payload.serial || ''),
            clientName: String(payload.clientName || ''),
            palletCode: String(payload.palletCode || ''),
            productName: String(payload.productName || ''),
            quantity: Number(payload.boxes || payload.quantity || 0),
            weight: (payload.weight as number | null) ?? null,
            roomName: String(payload.roomName || ''),
            date: String(payload.entryAt || payload.exitAt || new Date().toLocaleString('fr-FR')),
            seasonName: String(payload.seasonName || context?.season?.name || ''),
            operatorName: String(payload.operatorName || context?.operator.name || ''),
            isDuplicate: true,
          });

      await updatePrintJobStatus(
        tenantId,
        reprintJob.id,
        result.ok ? 'printed' : 'failed',
        result.message
      );
      setMessage(
        result.ok
          ? 'DUPLICATA envoyé à l’imprimante'
          : 'La palette / opération est intacte, mais l’imprimante est déconnectée. Vous pouvez réimprimer plus tard.'
      );
      void refetch();
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : 'Réimpression impossible');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <button type="button" onClick={() => navigate('/operator')} className="mb-3 min-h-[48px] font-semibold text-cyan-800">
        ← Accueil
      </button>
      <h1 className="mb-4 text-3xl font-extrabold">Réimpression</h1>
      <input
        className="mb-4 h-14 w-full rounded-2xl border-2 border-slate-200 px-4 text-lg"
        placeholder="Palette, client, n° transaction…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {message ? <div className="mb-4 rounded-2xl bg-cyan-50 p-4 font-semibold text-cyan-900">{message}</div> : null}
      <div className="grid gap-3">
        {jobs.map((job) => (
          <div key={job.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-bold">{String(job.payload?.palletCode || '—')}</div>
                <div className="text-sm text-slate-500">
                  {job.documentType} · {String(job.payload?.clientName || '')} · {job.status}
                </div>
              </div>
              <button
                type="button"
                disabled={busyId === job.id}
                onClick={() => void reprint(job)}
                className="min-h-[48px] rounded-xl bg-slate-900 px-4 font-semibold text-white disabled:opacity-50"
              >
                Réimprimer
              </button>
            </div>
          </div>
        ))}
        {jobs.length === 0 ? <p className="text-slate-500">Aucun document récent.</p> : null}
      </div>
    </div>
  );
}
