import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listOperatorsForLogin, operatorPinLogin } from '@/lib/api/operator';
import { setToken, ApiError } from '@/lib/api/client';
import { NumericKeypad } from './components/OperatorUi';
import { getStoredLegacyTenantId, resolveLoginSlug, persistTenantSession } from '@/lib/tenantResolver';
import { fetchTenantPublicInfo } from '@/lib/tenantBranding';
import { useAuth } from '@/lib/hooks/useAuth';

export function OperatorLoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [tenantId, setTenantId] = useState(() => getStoredLegacyTenantId() || '');
  const [operators, setOperators] = useState<Array<{ id: string; name: string }>>([]);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingOps, setLoadingOps] = useState(false);

  useEffect(() => {
    if (!loading && user && ['operator', 'admin', 'manager'].includes(user.role)) {
      navigate('/operator', { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let resolved = getStoredLegacyTenantId() || tenantId;
        if (!resolved) {
          const slug = resolveLoginSlug();
          if (slug) {
            const info = await fetchTenantPublicInfo(slug);
            if (info?.legacyId) {
              resolved = info.legacyId;
              persistTenantSession(info.slug || slug, info.legacyId, info.name);
            }
          }
        }
        if (!resolved || cancelled) return;
        setTenantId(resolved);
        setLoadingOps(true);
        const list = await listOperatorsForLogin(resolved);
        if (!cancelled) setOperators(list);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : 'Impossible de charger les opérateurs');
        }
      } finally {
        if (!cancelled) setLoadingOps(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submitPin = async (value: string) => {
    if (!selected || value.length !== 4 || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await operatorPinLogin(tenantId, selected.id, value);
      setToken(result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      localStorage.setItem('tenantId', result.user.tenantId);
      navigate('/operator', { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Connexion impossible');
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-slate-50 p-6 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="text-2xl font-black tracking-tight text-cyan-800">FrigoSmart</div>
          <div className="mt-1 text-base text-slate-600">Mode opérateur tablette</div>
        </div>

        {!selected ? (
          <>
            <h1 className="mb-4 text-xl font-bold text-slate-900">Qui êtes-vous ?</h1>
            {loadingOps ? (
              <p className="text-slate-500">Chargement…</p>
            ) : operators.length === 0 ? (
              <p className="rounded-2xl bg-amber-50 p-4 text-amber-900">
                Aucun opérateur configuré. Un administrateur doit créer un utilisateur avec le rôle
                « Opérateur » et un code PIN.
              </p>
            ) : (
              <div className="grid gap-3">
                {operators.map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => setSelected(op)}
                    className="min-h-[64px] rounded-2xl border border-slate-200 bg-white px-4 text-left text-xl font-bold text-slate-900 shadow-sm active:bg-cyan-50"
                  >
                    {op.name}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              className="mb-3 text-sm font-semibold text-cyan-800"
              onClick={() => {
                setSelected(null);
                setPin('');
                setError('');
              }}
            >
              ← Changer d’opérateur
            </button>
            <h1 className="mb-1 text-xl font-bold text-slate-900">{selected.name}</h1>
            <p className="mb-4 text-slate-500">Entrez votre code PIN à 4 chiffres</p>
            <div className="mb-5 flex justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-4 w-4 rounded-full ${pin.length > i ? 'bg-cyan-700' : 'bg-slate-300'}`}
                />
              ))}
            </div>
            {error ? <p className="mb-3 text-center font-semibold text-red-600">{error}</p> : null}
            <NumericKeypad
              value={pin}
              onChange={(v) => {
                setPin(v);
                if (v.length === 4) void submitPin(v);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
