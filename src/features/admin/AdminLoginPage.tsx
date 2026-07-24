import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginPlatformAdmin } from '../../lib/platformAuth';
import { FrigoSmartLogo } from './components/FrigoSmartLogo';

const features = [
  'Gestion multi-tenant des frigos',
  'Abonnements & facturation',
  'Monitoring usage en temps réel',
  'Provisionnement bases isolées',
];

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginPlatformAdmin(email.trim(), password);
      navigate('/admin');
    } catch {
      setError('Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      <div className="relative hidden w-[45%] overflow-hidden border-r border-slate-100 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="pointer-events-none absolute -right-16 top-10 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-teal-400/10 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative">
          <FrigoSmartLogo className="h-11 brightness-0 invert" />
        </div>

        <div className="relative">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
            Administration SaaS
          </p>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
            Pilotez votre
            <br />
            <span className="bg-gradient-to-r from-cyan-300 to-teal-200 bg-clip-text text-transparent">
              plateforme frigo
            </span>
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-300">
            Console pour gérer clients, abonnements et infrastructure multi-tenant.
          </p>
          <ul className="mt-8 space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-slate-200">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/30">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">© 2026 FrigoSmart · Plateforme SaaS</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-cyan-50/30 px-6 py-12 sm:px-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex justify-center lg:hidden">
            <FrigoSmartLogo className="h-11" />
          </div>

          <div className="admin-card-elevated p-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Connexion</h2>
              <p className="mt-1 text-sm text-slate-500">Accès réservé à l&apos;équipe FrigoSmart</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500/60 focus:bg-white focus:ring-2 focus:ring-cyan-600/15"
                  placeholder="superadmin@frigosmart.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Mot de passe</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 pr-16 text-sm text-slate-900 outline-none transition focus:border-cyan-500/60 focus:bg-white focus:ring-2 focus:ring-cyan-600/15"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 hover:text-cyan-700"
                  >
                    {showPassword ? 'Masquer' : 'Voir'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-cyan-700 py-3 text-sm font-semibold text-white shadow-sm shadow-cyan-700/25 transition hover:bg-cyan-600 disabled:opacity-50"
              >
                {loading ? 'Connexion...' : 'Accéder au panel'}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            <Link to="/login/demo" className="font-medium text-cyan-700 hover:text-cyan-600 hover:underline">
              ← Voir le frigo démo
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
