import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  createOperatorEntry,
  fetchOperatorClients,
  fetchOperatorRooms,
  newIdempotencyKey,
  updatePrintJobStatus,
  type OperatorClient,
  type OperatorRoom,
} from '@/lib/api/operator';
import { ApiError } from '@/lib/api/client';
import { useOperatorUi } from './OperatorProvider';
import {
  OperatorStepHeader,
  QuantityInput,
  SuccessScreen,
} from './components/OperatorUi';

const DRAFT_KEY = 'frigosmart.operator.entryDraft';

type Draft = {
  step: number;
  clientId?: string;
  clientName?: string;
  roomId?: string;
  roomName?: string;
  productName: string;
  productVariety: string;
  boxes: number;
  weight: number;
  packagingType: string;
  origin: string;
  lotReference: string;
  notes: string;
};

const emptyDraft = (): Draft => ({
  step: 1,
  productName: '',
  productVariety: '',
  boxes: 0,
  weight: 0,
  packagingType: '',
  origin: '',
  lotReference: '',
  notes: '',
});

export function OperatorEntryPage() {
  const navigate = useNavigate();
  const { tenantId, context, printer, online } = useOperatorUi();
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? { ...emptyDraft(), ...JSON.parse(raw) } : emptyDraft();
    } catch {
      return emptyDraft();
    }
  });
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{
    palletCode: string;
    printLines: string[];
  } | null>(null);
  const idemRef = useRef(newIdempotencyKey('entry'));
  const submittingRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  const { data: clients = [] } = useQuery({
    queryKey: ['operator-clients', tenantId, search],
    enabled: !!tenantId && draft.step === 1,
    queryFn: () => fetchOperatorClients(tenantId, search),
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['operator-rooms', tenantId],
    enabled: !!tenantId && draft.step === 2,
    queryFn: () => fetchOperatorRooms(tenantId),
  });

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === draft.clientId),
    [clients, draft.clientId]
  );

  const selectClient = (c: OperatorClient) => {
    setDraft((d) => ({ ...d, clientId: c.id, clientName: c.name, step: 2 }));
  };

  const selectRoom = (r: OperatorRoom) => {
    setDraft((d) => ({ ...d, roomId: r.id, roomName: r.name, step: 3 }));
  };

  const submit = async () => {
    if (submittingRef.current || busy) return;
    if (!online) {
      setError('Impossible de contacter le serveur. Vos informations sont conservées. Réessayez.');
      return;
    }
    if (!draft.clientId || !draft.roomId || !draft.productName || draft.boxes <= 0) {
      setError('Veuillez compléter les informations obligatoires.');
      return;
    }

    submittingRef.current = true;
    setBusy(true);
    setError('');

    try {
      const result = await createOperatorEntry(tenantId, {
        clientId: draft.clientId,
        roomId: draft.roomId,
        productName: draft.productName,
        productVariety: draft.productVariety || undefined,
        boxes: draft.boxes,
        weight: draft.weight > 0 ? draft.weight : undefined,
        packagingType: draft.packagingType || undefined,
        origin: draft.origin || undefined,
        lotReference: draft.lotReference || undefined,
        notes: draft.notes || undefined,
        idempotencyKey: idemRef.current,
      });

      const palletCode = result.palletCode || '—';
      const printLines: string[] = [];

      for (const job of result.printJobs || []) {
        try {
          const payload = job.payload || {};
          if (job.documentType === 'pallet_label') {
            const pr = await printer.printPalletLabel({
              id: job.id,
              siteName: String(payload.siteName || context?.siteName || ''),
              palletCode: String(payload.palletCode || palletCode),
              clientName: String(payload.clientName || draft.clientName || ''),
              productName: String(payload.productName || draft.productName),
              productVariety: String(payload.productVariety || ''),
              roomName: String(payload.roomName || draft.roomName || ''),
              boxes: Number(payload.boxes || draft.boxes),
              weight: (payload.weight as number | null) ?? null,
              entryAt: String(payload.entryAt || new Date().toLocaleString('fr-FR')),
              seasonName: String(payload.seasonName || context?.season?.name || ''),
              lotReference: String(payload.lotReference || ''),
            });
            await updatePrintJobStatus(tenantId, job.id, pr.ok ? 'printed' : 'failed', pr.message);
            printLines.push(pr.ok ? 'Étiquette imprimée' : 'Palette créée, mais impression en attente');
          } else {
            const pr = await printer.printTicket({
              id: job.id,
              siteName: String(payload.siteName || context?.siteName || ''),
              operationType: 'ENTRÉE',
              serial: String(payload.serial || ''),
              clientName: String(payload.clientName || draft.clientName || ''),
              palletCode: String(payload.palletCode || palletCode),
              productName: String(payload.productName || draft.productName),
              quantity: Number(payload.boxes || draft.boxes),
              weight: (payload.weight as number | null) ?? null,
              roomName: String(payload.roomName || draft.roomName || ''),
              date: String(payload.entryAt || new Date().toLocaleString('fr-FR')),
              seasonName: String(payload.seasonName || context?.season?.name || ''),
              operatorName: String(payload.operatorName || context?.operator.name || ''),
            });
            await updatePrintJobStatus(tenantId, job.id, pr.ok ? 'printed' : 'failed', pr.message);
            printLines.push(pr.ok ? 'Ticket imprimé' : 'Ticket en attente d’impression');
          }
        } catch (printErr) {
          printLines.push('Palette créée, mais impression en attente');
          try {
            await updatePrintJobStatus(
              tenantId,
              job.id,
              'failed',
              printErr instanceof Error ? printErr.message : 'print error'
            );
          } catch {
            /* ignore */
          }
        }
      }

      localStorage.removeItem(DRAFT_KEY);
      setSuccess({ palletCode, printLines });
    } catch (e) {
      if (e instanceof ApiError && e.message.toLowerCase().includes('déjà')) {
        setError('Cette opération a déjà été enregistrée.');
      } else {
        setError(
          e instanceof ApiError
            ? e.message
            : 'Impossible de contacter le serveur. Vos informations sont conservées. Réessayez.'
        );
      }
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  };

  if (success) {
    return (
      <SuccessScreen
        title="Palette créée avec succès"
        lines={[
          { label: 'Palette', value: success.palletCode },
          { label: 'Client', value: draft.clientName || '—' },
          { label: 'Chambre', value: draft.roomName || '—' },
          { label: 'Quantité', value: `${draft.boxes} caisses` },
        ]}
        printLines={success.printLines}
        actions={[
          {
            label: 'Créer une autre palette',
            primary: true,
            onClick: () => {
              idemRef.current = newIdempotencyKey('entry');
              setSuccess(null);
              setDraft({
                ...emptyDraft(),
                clientId: draft.clientId,
                clientName: draft.clientName,
                roomId: draft.roomId,
                roomName: draft.roomName,
                step: 3,
              });
            },
          },
          {
            label: 'Réimprimer',
            onClick: () => navigate('/operator/reprint'),
          },
          {
            label: 'Retour à l’accueil',
            onClick: () => navigate('/operator'),
          },
        ]}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {draft.step === 1 && (
        <>
          <OperatorStepHeader step={1} total={4} title="Sélectionner le client" onBack={() => navigate('/operator')} />
          <input
            className="mb-4 h-14 w-full rounded-2xl border-2 border-slate-200 px-4 text-lg"
            placeholder="Rechercher nom, téléphone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {clients.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectClient(c)}
                className="min-h-[88px] rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm active:border-cyan-600"
              >
                <div className="text-xl font-bold text-slate-900">{c.name}</div>
                <div className="text-sm text-slate-500">{c.phone || c.company || '—'}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {draft.step === 2 && (
        <>
          <OperatorStepHeader
            step={2}
            total={4}
            title="Sélectionner la chambre"
            onBack={() => setDraft((d) => ({ ...d, step: 1 }))}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {rooms.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => selectRoom(r)}
                className="min-h-[110px] rounded-2xl border-2 border-slate-200 bg-white p-4 text-left active:border-cyan-700"
              >
                <div className="text-2xl font-extrabold text-slate-900">{r.name}</div>
                <div className="mt-2 text-sm text-slate-600">
                  Stock: {r.occupied} · Dispo: {r.available}/{r.capacity || '—'}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {draft.step === 3 && (
        <>
          <OperatorStepHeader
            step={3}
            total={4}
            title="Informations palette"
            onBack={() => setDraft((d) => ({ ...d, step: 2 }))}
          />
          <div className="mb-4 rounded-2xl bg-cyan-50 p-4 text-sm text-cyan-900">
            Client: <strong>{draft.clientName || selectedClient?.name}</strong> · Chambre:{' '}
            <strong>{draft.roomName}</strong> · Saison: <strong>{context?.season?.name || '—'}</strong>
          </div>
          <div className="grid gap-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-500">Produit *</span>
              <input
                className="h-14 w-full rounded-2xl border-2 border-slate-200 px-4 text-lg"
                value={draft.productName}
                onChange={(e) => setDraft((d) => ({ ...d, productName: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-500">Variété</span>
              <input
                className="h-14 w-full rounded-2xl border-2 border-slate-200 px-4 text-lg"
                value={draft.productVariety}
                onChange={(e) => setDraft((d) => ({ ...d, productVariety: e.target.value }))}
              />
            </label>
            <QuantityInput
              label="Nombre de caisses *"
              value={draft.boxes}
              onChange={(boxes) => setDraft((d) => ({ ...d, boxes }))}
              min={1}
            />
            <QuantityInput
              label="Poids total"
              unit="kg"
              value={draft.weight}
              onChange={(weight) => setDraft((d) => ({ ...d, weight }))}
              min={0}
            />
            <button
              type="button"
              disabled={!draft.productName || draft.boxes <= 0}
              onClick={() => setDraft((d) => ({ ...d, step: 4 }))}
              className="min-h-[56px] rounded-2xl bg-cyan-700 text-lg font-bold text-white disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        </>
      )}

      {draft.step === 4 && (
        <>
          <OperatorStepHeader
            step={4}
            total={4}
            title="Confirmation"
            onBack={() => setDraft((d) => ({ ...d, step: 3 }))}
          />
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            {[
              ['Client', draft.clientName],
              ['Produit', draft.productName],
              ['Variété', draft.productVariety || '—'],
              ['Chambre', draft.roomName],
              ['Caisses', String(draft.boxes)],
              ['Poids', draft.weight ? `${draft.weight} kg` : '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-slate-100 py-3 text-lg last:border-0">
                <span className="text-slate-500">{k}</span>
                <span className="font-bold text-slate-900">{v}</span>
              </div>
            ))}
          </div>
          {error ? (
            <div className="mt-4 rounded-2xl bg-red-50 p-4 font-semibold text-red-700">{error}</div>
          ) : null}
          <button
            type="button"
            disabled={busy || !online}
            onClick={() => void submit()}
            className="mt-5 min-h-[64px] w-full rounded-2xl bg-cyan-700 text-xl font-extrabold text-white disabled:opacity-50"
          >
            {busy ? 'Création…' : 'Créer et imprimer'}
          </button>
        </>
      )}
    </div>
  );
}
