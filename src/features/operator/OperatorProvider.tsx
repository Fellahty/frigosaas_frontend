import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchOperatorContext, type OperatorContext } from '@/lib/api/operator';
import { createPrinterAdapter, type PrinterAdapter, type PrinterStatus, type PrintingMode } from '@/lib/printing';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTenantId } from '@/lib/hooks/useTenantId';

const IDLE_LOCK_MS = 5 * 60 * 1000;

type OperatorUiContextValue = {
  tenantId: string;
  context: OperatorContext | undefined;
  loading: boolean;
  online: boolean;
  printerStatus: PrinterStatus;
  printer: PrinterAdapter;
  locked: boolean;
  lock: () => void;
  unlock: () => void;
  refreshContext: () => void;
  bumpActivity: () => void;
};

const OperatorUiContext = createContext<OperatorUiContextValue | null>(null);

export function OperatorProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const tenantId = useTenantId() || user?.tenantId || '';
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [locked, setLocked] = useState(false);
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus>('unknown');
  const [lastActivity, setLastActivity] = useState(Date.now());

  const { data: context, isLoading, refetch } = useQuery({
    queryKey: ['operator-context', tenantId],
    enabled: !!tenantId && !!user,
    queryFn: () => fetchOperatorContext(tenantId),
    refetchInterval: 60_000,
  });

  const printer = useMemo(() => {
    const mode = (context?.printer?.mode || 'browser') as PrintingMode;
    return createPrinterAdapter(mode);
  }, [context?.printer?.mode]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    printer.checkStatus().then((s) => {
      if (!cancelled) setPrinterStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, [printer]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (Date.now() - lastActivity > IDLE_LOCK_MS) setLocked(true);
    }, 15_000);
    return () => window.clearInterval(id);
  }, [lastActivity]);

  useEffect(() => {
    const bump = () => setLastActivity(Date.now());
    window.addEventListener('pointerdown', bump);
    window.addEventListener('keydown', bump);
    return () => {
      window.removeEventListener('pointerdown', bump);
      window.removeEventListener('keydown', bump);
    };
  }, []);

  const value: OperatorUiContextValue = {
    tenantId,
    context,
    loading: isLoading,
    online,
    printerStatus,
    printer,
    locked,
    lock: () => setLocked(true),
    unlock: () => {
      setLocked(false);
      setLastActivity(Date.now());
    },
    refreshContext: () => {
      void refetch();
    },
    bumpActivity: () => setLastActivity(Date.now()),
  };

  return <OperatorUiContext.Provider value={value}>{children}</OperatorUiContext.Provider>;
}

export function useOperatorUi() {
  const ctx = useContext(OperatorUiContext);
  if (!ctx) throw new Error('useOperatorUi must be used within OperatorProvider');
  return ctx;
}
