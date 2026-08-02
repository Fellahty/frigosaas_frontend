import React, { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';

type Props = {
  onScan: (code: string) => void;
  active: boolean;
};

export function ScannerView({ onScan, active }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');

  useEffect(() => {
    if (!active) {
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
      return;
    }

    let cancelled = false;

    const start = async () => {
      if (!videoRef.current) return;
      try {
        const scanner = new QrScanner(
          videoRef.current,
          (result) => {
            if (result?.data) onScan(result.data);
          },
          {
            preferredCamera: 'environment',
            highlightScanRegion: true,
            highlightCodeOutline: true,
            maxScansPerSecond: 8,
          }
        );
        scannerRef.current = scanner;
        await scanner.start();
      } catch {
        if (!cancelled) {
          setError('Caméra indisponible. Saisissez le code manuellement.');
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [active, onScan]);

  return (
    <div>
      <div className="overflow-hidden rounded-3xl bg-black">
        <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
      </div>
      {error ? <p className="mt-3 font-semibold text-amber-700">{error}</p> : null}
      <div className="mt-4 flex gap-2">
        <input
          className="h-14 flex-1 rounded-2xl border-2 border-slate-200 px-4 text-lg"
          placeholder="Code palette / QR"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
        />
        <button
          type="button"
          className="min-h-[56px] rounded-2xl bg-cyan-700 px-5 text-lg font-bold text-white"
          onClick={() => manual.trim() && onScan(manual.trim())}
        >
          OK
        </button>
      </div>
    </div>
  );
}
