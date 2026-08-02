import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchClientStock, fetchOperatorClients } from '@/lib/api/operator';
import { useOperatorUi } from './OperatorProvider';

export function OperatorStockPage() {
  const navigate = useNavigate();
  const { tenantId } = useOperatorUi();
  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);

  const { data: clients = [] } = useQuery({
    queryKey: ['operator-clients', tenantId, search],
    enabled: !!tenantId && !clientId,
    queryFn: () => fetchOperatorClients(tenantId, search),
  });

  const { data: stock = [], isLoading } = useQuery({
    queryKey: ['operator-client-stock', tenantId, clientId],
    enabled: !!tenantId && !!clientId,
    queryFn: () => fetchClientStock(tenantId, clientId!),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <button type="button" onClick={() => navigate('/operator')} className="mb-3 min-h-[48px] font-semibold text-cyan-800">
        ← Accueil
      </button>
      <h1 className="mb-4 text-3xl font-extrabold">Stock client</h1>

      {!clientId ? (
        <>
          <input
            className="mb-4 h-14 w-full rounded-2xl border-2 border-slate-200 px-4 text-lg"
            placeholder="Rechercher un client…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="grid gap-3">
            {clients.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setClientId(c.id)}
                className="min-h-[72px] rounded-2xl border border-slate-200 bg-white p-4 text-left text-xl font-bold"
              >
                {c.name}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            className="mb-4 font-semibold text-cyan-800"
            onClick={() => setClientId(null)}
          >
            ← Changer de client
          </button>
          {isLoading ? <p>Chargement…</p> : null}
          <div className="grid gap-3">
            {stock.map((p) => (
              <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-lg font-black">{p.code}</div>
                <div className="text-slate-600">
                  {p.productName} · {p.roomName} · {p.boxes} caisses
                </div>
              </div>
            ))}
            {!isLoading && stock.length === 0 ? (
              <p className="text-slate-500">Aucun stock pour ce client.</p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
