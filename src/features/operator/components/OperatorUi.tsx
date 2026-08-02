import React, { useState } from 'react';

type Props = {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  unit?: string;
};

export function QuantityInput({ value, onChange, min = 0, max = 99999, step = 1, label, unit }: Props) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-3xl font-bold text-slate-800 active:bg-slate-200"
          onClick={() => onChange(clamp(value - step))}
          aria-label="Diminuer"
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          className="h-14 flex-1 rounded-xl border-2 border-cyan-700/40 bg-cyan-50 text-center text-3xl font-bold text-slate-900"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
        />
        <button
          type="button"
          className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-3xl font-bold text-slate-800 active:bg-slate-200"
          onClick={() => onChange(clamp(value + step))}
          aria-label="Augmenter"
        >
          +
        </button>
      </div>
      {unit ? <div className="mt-2 text-center text-sm text-slate-500">{unit}</div> : null}
    </div>
  );
}

export function NumericKeypad({
  value,
  onChange,
  maxLength = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

  const press = (k: string) => {
    if (k === 'C') return onChange('');
    if (k === '⌫') return onChange(value.slice(0, -1));
    if (value.length >= maxLength) return;
    onChange(value + k);
  };

  return (
    <div className="grid grid-cols-3 gap-3">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          className="flex min-h-[64px] items-center justify-center rounded-2xl bg-white text-2xl font-bold text-slate-800 shadow-sm ring-1 ring-slate-200 active:bg-slate-100"
        >
          {k}
        </button>
      ))}
    </div>
  );
}

export function ConfirmationDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onConfirm,
  onCancel,
  busy,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <p className="mt-3 text-base text-slate-600">{message}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-[56px] rounded-xl border border-slate-300 text-lg font-semibold text-slate-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="min-h-[56px] rounded-xl bg-cyan-700 text-lg font-semibold text-white disabled:opacity-60"
          >
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SuccessScreen({
  title,
  lines,
  printLines,
  actions,
}: {
  title: string;
  lines: Array<{ label: string; value: string }>;
  printLines?: string[];
  actions: Array<{ label: string; onClick: () => void; primary?: boolean }>;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="text-4xl">✓</div>
        <h1 className="mt-3 text-3xl font-extrabold text-emerald-900">{title}</h1>
        <div className="mt-6 space-y-2 text-left">
          {lines.map((l) => (
            <div key={l.label} className="flex justify-between gap-3 text-lg">
              <span className="text-emerald-800/70">{l.label}</span>
              <span className="font-bold text-emerald-950">{l.value}</span>
            </div>
          ))}
        </div>
        {printLines?.length ? (
          <div className="mt-6 space-y-1 rounded-2xl bg-white/70 p-4 text-left text-base text-slate-700">
            {printLines.map((p) => (
              <div key={p}>{p}</div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-6 grid gap-3">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={a.onClick}
            className={`min-h-[56px] rounded-2xl text-lg font-bold ${
              a.primary ? 'bg-cyan-700 text-white' : 'border border-slate-300 bg-white text-slate-800'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function OperatorStepHeader({
  step,
  total,
  title,
  onBack,
}: {
  step: number;
  total: number;
  title: string;
  onBack?: () => void;
}) {
  const [showHint] = useState(true);
  return (
    <div className="mb-6">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mb-3 min-h-[48px] rounded-xl px-3 text-base font-semibold text-cyan-800"
        >
          ← Retour
        </button>
      ) : null}
      <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Étape {step}/{total}
      </div>
      <h1 className="text-3xl font-extrabold text-slate-900">{title}</h1>
      {showHint ? (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-cyan-700 transition-all"
            style={{ width: `${(step / total) * 100}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
