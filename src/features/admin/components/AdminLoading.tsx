import React from 'react';

export const AdminLoading: React.FC<{ label?: string }> = ({ label = 'Chargement...' }) => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <div className="text-center">
      <div className="relative mx-auto h-12 w-12">
        <div className="absolute inset-0 rounded-full border-2 border-slate-200" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-cyan-700" />
      </div>
      <p className="mt-5 text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-xs text-slate-400">FrigoSmart Platform</p>
    </div>
  </div>
);
