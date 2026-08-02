import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { useTenantId } from '@/lib/hooks/useTenantId';

type PrintingSettings = {
  mode: 'android_native' | 'browser' | 'network_printer' | 'local_print_agent';
  defaultTicketPrinter?: string;
  defaultLabelPrinter?: string;
  connectionType?: 'bluetooth' | 'wifi' | 'usb' | 'network' | 'browser';
  bluetoothDevice?: string;
  networkIp?: string;
  networkPort?: number;
  printerLanguage?: string;
  labelSize?: string;
  ticketWidth?: string;
  copies?: number;
  autoPrint?: boolean;
};

type SiteSettingsDoc = {
  id?: string;
  name?: string;
  printing?: PrintingSettings;
};

export const PrintingTab = forwardRef<{ save: () => Promise<void> }, {
  onDirtyChange?: (dirty: boolean) => void;
  onValidChange?: (valid: boolean) => void;
}>(function PrintingTab({ onDirtyChange, onValidChange }, ref) {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PrintingSettings>({
    mode: 'browser',
    labelSize: '100x150',
    ticketWidth: '80mm',
    copies: 1,
    autoPrint: true,
    connectionType: 'browser',
  });
  const [baseline, setBaseline] = useState(form);

  const { data } = useQuery({
    queryKey: ['site-settings', tenantId],
    enabled: !!tenantId,
    queryFn: () => apiRequest<SiteSettingsDoc>(`/tenants/${tenantId}/settings`),
  });

  useEffect(() => {
    if (data?.printing) {
      const next = { ...form, ...data.printing };
      setForm(next);
      setBaseline(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.printing]);

  useEffect(() => {
    onDirtyChange?.(JSON.stringify(form) !== JSON.stringify(baseline));
    onValidChange?.(true);
  }, [form, baseline, onDirtyChange, onValidChange]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/tenants/${tenantId}/settings`, {
        method: 'PATCH',
        body: JSON.stringify({ printing: form }),
      });
    },
    onSuccess: async () => {
      setBaseline(form);
      await queryClient.invalidateQueries({ queryKey: ['site-settings', tenantId] });
    },
  });

  useImperativeHandle(ref, () => ({
    save: async () => {
      await saveMutation.mutateAsync();
    },
  }));

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Impression (admin)</h2>
        <p className="text-sm text-slate-500">
          Configuration réservée aux administrateurs. Les opérateurs voient uniquement l’état
          (connectée / déconnectée / papier / échec).
        </p>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Mode d’impression</span>
        <select
          className="mt-1 w-full rounded-md border px-3 py-2"
          value={form.mode}
          onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value as PrintingSettings['mode'] }))}
        >
          <option value="browser">Navigateur (Android print dialog)</option>
          <option value="android_native">Android natif (Capacitor)</option>
          <option value="network_printer">Imprimante réseau</option>
          <option value="local_print_agent">Agent local (PC / Raspberry Pi)</option>
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Imprimante tickets</span>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={form.defaultTicketPrinter || ''}
            onChange={(e) => setForm((f) => ({ ...f, defaultTicketPrinter: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Imprimante étiquettes</span>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={form.defaultLabelPrinter || ''}
            onChange={(e) => setForm((f) => ({ ...f, defaultLabelPrinter: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Connexion</span>
          <select
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={form.connectionType || 'browser'}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                connectionType: e.target.value as PrintingSettings['connectionType'],
              }))
            }
          >
            <option value="browser">Navigateur</option>
            <option value="bluetooth">Bluetooth</option>
            <option value="wifi">Wi-Fi</option>
            <option value="network">Réseau</option>
            <option value="usb">USB</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Appareil Bluetooth</span>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={form.bluetoothDevice || ''}
            onChange={(e) => setForm((f) => ({ ...f, bluetoothDevice: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">IP réseau</span>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={form.networkIp || ''}
            onChange={(e) => setForm((f) => ({ ...f, networkIp: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Port</span>
          <input
            type="number"
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={form.networkPort || ''}
            onChange={(e) => setForm((f) => ({ ...f, networkPort: Number(e.target.value) || undefined }))}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Langage / protocole</span>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2"
            placeholder="ESC/POS, ZPL…"
            value={form.printerLanguage || ''}
            onChange={(e) => setForm((f) => ({ ...f, printerLanguage: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Taille étiquette</span>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={form.labelSize || '100x150'}
            onChange={(e) => setForm((f) => ({ ...f, labelSize: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Largeur ticket</span>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={form.ticketWidth || '80mm'}
            onChange={(e) => setForm((f) => ({ ...f, ticketWidth: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Copies</span>
          <input
            type="number"
            min={1}
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={form.copies || 1}
            onChange={(e) => setForm((f) => ({ ...f, copies: Number(e.target.value) || 1 }))}
          />
        </label>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.autoPrint !== false}
          onChange={(e) => setForm((f) => ({ ...f, autoPrint: e.target.checked }))}
        />
        <span className="text-sm font-medium text-slate-700">Impression automatique après opération</span>
      </label>
    </div>
  );
});
