import React, { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { OperatorProvider, useOperatorUi } from './OperatorProvider';
import { OperatorHeader } from './components/OperatorHeader';
import { OfflineStatusBanner } from './components/OfflineStatusBanner';
import { NumericKeypad } from './components/OperatorUi';
import { useAuth } from '@/lib/hooks/useAuth';
import { getToken, setToken } from '@/lib/api/client';
import { operatorPinLogin } from '@/lib/api/operator';
import { ApiError } from '@/lib/api/client';

const OPERATOR_ROLES = new Set(['operator', 'admin', 'manager']);

function LockOverlay() {
  const { unlock, context, tenantId } = useOperatorUi();
  const { user } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (value: string) => {
    if (value.length !== 4 || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await operatorPinLogin(tenantId, user!.id, value);
      setToken(result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      unlock();
      setPin('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Code PIN incorrect');
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-slate-100 p-6">
        <div className="mb-2 text-center text-sm font-semibold uppercase tracking-wide text-slate-500">
          Session verrouillée
        </div>
        <h2 className="text-center text-2xl font-extrabold text-slate-900">
          {user?.name || context?.operator.name}
        </h2>
        <div className="my-5 flex justify-center gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-4 w-4 rounded-full ${pin.length > i ? 'bg-cyan-700' : 'bg-slate-300'}`}
            />
          ))}
        </div>
        {error ? <p className="mb-3 text-center text-sm font-semibold text-red-600">{error}</p> : null}
        <NumericKeypad
          value={pin}
          onChange={(v) => {
            setPin(v);
            if (v.length === 4) void submit(v);
          }}
        />
      </div>
    </div>
  );
}

function OperatorShell() {
  const { online, locked, loading } = useOperatorUi();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-cyan-50/40 to-slate-100">
      <OfflineStatusBanner online={online} />
      <OperatorHeader />
      <main className="mx-auto max-w-6xl px-4 py-6">
        {loading ? (
          <div className="py-20 text-center text-slate-500">Chargement…</div>
        ) : (
          <Outlet />
        )}
      </main>
      {locked ? <LockOverlay /> : null}
    </div>
  );
}

export function OperatorProtectedRoute() {
  const { user, loading } = useAuth();
  const hasToken = !!getToken();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500">
        Vérification…
      </div>
    );
  }

  if (!user || !hasToken) {
    return <Navigate to="/operator/login" replace state={{ from: location }} />;
  }

  if (!OPERATOR_ROLES.has(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (user.role === 'operator' && !location.pathname.startsWith('/operator')) {
    return <Navigate to="/operator" replace />;
  }

  return (
    <OperatorProvider>
      <OperatorShell />
    </OperatorProvider>
  );
}
