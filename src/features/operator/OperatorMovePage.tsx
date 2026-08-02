import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  fetchOperatorRooms,
  fetchPalletByCode,
  moveOperatorPallet,
  newIdempotencyKey,
  type OperatorPallet,
} from '@/lib/api/operator';
import { ApiError } from '@/lib/api/client';
import { useOperatorUi } from './OperatorProvider';
import { ScannerView } from './components/ScannerView';
import { ConfirmationDialog, SuccessScreen } from './components/OperatorUi';

export function OperatorMovePage() {
  const navigate = useNavigate();
  const { tenantId, online } = useOperatorUi();
  const [scanning, setScanning] = useState(true);
  const [pallet, setPallet] = useState<OperatorPallet | null>(null);
  const [destId, setDestId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ roomName: string } | null>(null);
  const idemRef = useRef(newIdempotencyKey('move'));
  const handledRef = useRef(false);

  const { data: rooms = [] } = useQuery({
    queryKey: ['operator-rooms', tenantId],
    enabled: !!tenantId && !!pallet,
    queryFn: () => fetchOperatorRooms(tenantId),
  });

  const onScan = useCallback(
    async (code: string) => {
      if (handledRef.current) return;
      handledRef.current = true;
      setScanning(false);
      try {
        const data = await fetchPalletByCode(tenantId, code);
        setPallet(data);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Palette introuvable');
        handledRef.current = false;
        setScanning(true);
      }
    },
    [tenantId]
  );

  const submit = async () => {
    if (!pallet || !destId || busy) return;
    if (!online) {
      setError('Impossible de contacter le serveur. Réessayez.');
      return;
    }
    setBusy(true);
    try {
      const result = await moveOperatorPallet(tenantId, pallet.id, {
        destinationRoomId: destId,
        idempotencyKey: idemRef.current,
      });
      setDone({ roomName: result.destinationRoomName || '—' });
      setConfirm(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Déplacement impossible');
    } finally {
      setBusy(false);
    }
  };

  if (done && pallet) {
    return (
      <SuccessScreen
        title="Déplacement enregistré"
        lines={[
          { label: 'Palette', value: pallet.code },
          { label: 'Nouvelle chambre', value: done.roomName },
        ]}
        actions={[
          {
            label: 'Autre déplacement',
            primary: true,
            onClick: () => {
              idemRef.current = newIdempotencyKey('move');
              handledRef.current = false;
              setDone(null);
              setPallet(null);
              setDestId(null);
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
      <button type="button" onClick={() => navigate('/operator')} className="mb-3 min-h-[48px] font-semibold text-cyan-800">
        ← Accueil
      </button>
      <h1 className="mb-4 text-3xl font-extrabold">Déplacement</h1>
      {error ? <div className="mb-4 rounded-2xl bg-red-50 p-4 font-semibold text-red-700">{error}</div> : null}

      {!pallet ? <ScannerView active={scanning} onScan={onScan} /> : null}

      {pallet ? (
        <>
          <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="text-xl font-black">{pallet.code}</div>
            <div className="text-slate-600">Chambre actuelle : <strong>{pallet.roomName}</strong></div>
          </div>
          <h2 className="mb-3 text-xl font-bold">Destination</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {rooms
              .filter((r) => r.id !== pallet.roomId)
              .map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setDestId(r.id);
                    setConfirm(true);
                  }}
                  className={`min-h-[88px] rounded-2xl border-2 p-4 text-left ${
                    destId === r.id ? 'border-cyan-700 bg-cyan-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="text-xl font-extrabold">{r.name}</div>
                  <div className="text-sm text-slate-500">Dispo {r.available}</div>
                </button>
              ))}
          </div>
        </>
      ) : null}

      <ConfirmationDialog
        open={confirm}
        title="Confirmer le déplacement"
        message={`Déplacer ${pallet?.code} vers la chambre sélectionnée ?`}
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void submit()}
      />
    </div>
  );
}
