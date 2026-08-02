import React from 'react';

export function OfflineStatusBanner({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <div className="bg-red-600 px-4 py-3 text-center text-base font-semibold text-white">
      Impossible de contacter le serveur. Vos informations sont conservées. Réessayez.
    </div>
  );
}
