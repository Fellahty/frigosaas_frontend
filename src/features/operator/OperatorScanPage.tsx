import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  exitOperatorPallet,
  fetchPalletByCode,
  newIdempotencyKey,
  updatePrintJobStatus,
  type OperatorPallet,
} from '@/lib/api/operator';
import { ApiError } from '@/lib/api/client';
import { useOperatorUi } from './OperatorProvider';
import { ScannerView } from './components/ScannerView';
import {
  ConfirmationDialog,
  QuantityInput,
  SuccessScreen,
} from './components/OperatorUi';

export function OperatorScanPage() {
  const navigate = useNavigate();
  const { tenantId, printer, context, online } = useOperatorUi();
  const [scanning, setScanning] = useState(true);
  const [pallet, setPallet] = useState<OperatorPallet | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'complete' | 'partial' | null>(null);
  const [partialBoxes, setPartialBoxes] = useState(1);
  const [partialWeight, setPartialWeight] = useState(0);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<{ boxes: number; remaining: number; closed: boolean } | null>(
    null
  );
  const idemRef = useRef(newIdempotencyKey('exit'));
  const handledRef = useRef(false);

  const onScan = useCallback(
    async (code: string) => {
      if (handledRef.current) return;
      handledRef.current = true;
      setScanning(false);
      setLoading(true);
      setError('');
      try {
        const data = await fetchPalletByCode(tenantId, code);
        setPallet(data);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Palette introuvable');
        setScanning(true);
        handledRef.current = false;
      } finally {
        setLoading(false);
      }
    },
    [tenantId]
  );

  const doExit = async () => {
    if (!pallet || busy || !mode) return;
    if (!online) {
      setError('Impossible de contacter le serveur. Réessayez.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await exitOperatorPallet(tenantId, pallet.id, {
        mode,
        boxes: mode === 'partial' ? partialBoxes : undefined,
        weight: mode === 'partial' && partialWeight > 0 ? partialWeight : undefined,
        idempotencyKey: idemRef.current,
      });

      if (result.printJob) {
        try {
          const payload = result.printJob.payload || {};
          const pr = await printer.printTicket({
            siteName: String(payload.siteName || context?.siteName || ''),
            operationType: mode === 'complete' ? 'SORTIE COMPLÈTE' : 'SORTIE PARTIELLE',
            clientName: String(payload.clientName || pallet.clientName || ''),
            palletCode: String(payload.palletCode || pallet.code),
            productName: String(payload.productName || pallet.productName || ''),
            quantity: Number(payload.boxes || result.boxesExited || 0),
            weight: (payload.weight as number | null) ?? null,
            roomName: String(payload.roomName || pallet.roomName || ''),
            date: String(payload.exitAt || new Date().toLocaleString('fr-FR')),
            seasonName: String(payload.seasonName || context?.season?.name || ''),
            operatorName: String(payload.operatorName || context?.operator.name || ''),
          });
          await updatePrintJobStatus(
            tenantId,
            result.printJob.id,
            pr.ok ? 'printed' : 'failed',
            pr.message
          );
        } catch {
          /* print failure must not affect stock */
        }
      }

      setSuccess({
        boxes: result.boxesExited || 0,
        remaining: result.remaining || 0,
        closed: !!result.closed,
      });
      setMode(null);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Impossible de contacter le serveur. Réessayez.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (success && pallet) {
    return (
      <SuccessScreen
        title={success.closed ? 'Sortie complète enregistrée' : 'Sortie partielle enregistrée'}
        lines={[
          { label: 'Palette', value: pallet.code },
          { label: 'Sortie', value: `${success.boxes} caisses` },
          { label: 'Reste', value: `${success.remaining} caisses` },
        ]}
        actions={[
          {
            label: 'Scanner une autre',
            primary: true,
            onClick: () => {
              idemRef.current = newIdempotencyKey('exit');
              handledRef.current = false;
              setSuccess(null);
              setPallet(null);
              setScanning(true);
            },
          },
          { label: 'Retour à l’accueil', onClick: () => navigate('/operator') },
        ]}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <button
        type="button"
        onClick={() => navigate('/operator')}
        className="mb-3 min-h-[48px] text-base font-semibold text-cyan-800"
      >
        ← Accueil
      </button>
      <h1 className="mb-4 text-3xl font-extrabold text-slate-900">Sortie / Scanner</h1>

      {scanning && !pallet ? <ScannerView active={scanning} onScan={onScan} /> : null}
      {loading ? <p className="text-slate-500">Recherche…</p> : null}
      {error ? <div className="mb-4 rounded-2xl bg-red-50 p-4 font-semibold text-red-700">{error}</div> : null}

      {pallet ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-2xl font-black text-slate-900">{pallet.code}</div>
          <div className="mt-4 space-y-2 text-lg">
            <div className="flex justify-between"><span className="text-slate-500">Client</span><span className="font-bold">{pallet.clientName}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Produit</span><span className="font-bold">{pallet.productName}{pallet.productVariety ? ` / ${pallet.productVariety}` : ''}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Chambre</span><span className="font-bold">{pallet.roomName}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Stock</span><span className="font-bold">{pallet.boxes} caisses</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Statut</span><span className="font-bold">{pallet.status}</span></div>
          </div>

          {pallet.status !== 'exited' && pallet.boxes > 0 ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode('complete')}
                className="min-h-[64px] rounded-2xl bg-cyan-700 text-lg font-bold text-white"
              >
                Sortie complète
              </button>
              <button
                type="button"
                onClick={() => {
                  setPartialBoxes(1);
                  setMode('partial');
                }}
                className="min-h-[64px] rounded-2xl border-2 border-cyan-700 text-lg font-bold text-cyan-800"
              >
                Sortie partielle
              </button>
            </div>
          ) : (
            <p className="mt-4 font-semibold text-amber-700">Cette palette n’a plus de stock.</p>
          )}

          <button
            type="button"
            className="mt-4 min-h-[48px] text-base font-semibold text-slate-600"
            onClick={() => {
              handledRef.current = false;
              setPallet(null);
              setScanning(true);
              idemRef.current = newIdempotencyKey('exit');
            }}
          >
            Scanner une autre palette
          </button>
        </div>
      ) : null}

      <ConfirmationDialog
        open={mode === 'complete'}
        title="Confirmer la sortie complète"
        message={`Sortir entièrement la palette ${pallet?.code} (${pallet?.boxes} caisses) ?`}
        confirmLabel="Confirmer la sortie"
        busy={busy}
        onCancel={() => setMode(null)}
        onConfirm={() => void doExit()}
      />

      {mode === 'partial' && pallet ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-6">
            <h2 className="text-2xl font-bold">Sortie partielle</h2>
            <div className="mt-4 grid gap-4">
              <QuantityInput
                label="Caisses à sortir"
                value={partialBoxes}
                min={1}
                max={pallet.boxes}
                onChange={setPartialBoxes}
              />
              <QuantityInput
                label="Poids (optionnel)"
                unit="kg"
                value={partialWeight}
                min={0}
                onChange={setPartialWeight}
              />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                className="min-h-[56px] rounded-xl border border-slate-300 font-semibold"
                onClick={() => setMode(null)}
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={busy || partialBoxes <= 0 || partialBoxes > pallet.boxes}
                className="min-h-[56px] rounded-xl bg-cyan-700 font-semibold text-white disabled:opacity-50"
                onClick={() => void doExit()}
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
