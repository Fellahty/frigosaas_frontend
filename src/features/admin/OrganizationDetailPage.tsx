import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { platformApiRequest } from '../../lib/platformAuth';
import type { Organization, Subscription } from './types';
import { StatusBadge } from './components/StatusBadge';
import { UsageBar } from './components/UsageBar';
import { AdminLoading } from './components/AdminLoading';
import {
  AdminButton,
  AdminCard,
  AdminCardHeader,
  AdminPageShell,
  OrgAvatar,
} from './components/admin-ui';
import { OrganizationAccessPanel } from './components/OrganizationAccessPanel';
import { OrganizationUsagePanel } from './components/OrganizationUsagePanel';
import { OrganizationAuditPanel } from './AdminAuditLogPage';
import { OrganizationPlatformLogsPanel } from './components/OrganizationPlatformLogsPanel';
import { OrganizationFacilityPanel } from './components/OrganizationFacilityPanel';

interface Usage {
  roomsCount: number;
  clientsCount: number;
  usersCount: number;
  receptionsCount: number;
  reservationsCount: number;
  lastUpdated: string;
}

interface OrgDetail {
  organization: Organization;
  subscription: Subscription | null;
  usage: Usage | null;
}

export const OrganizationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Organization>>({});
  const [subForm, setSubForm] = useState<Partial<Subscription>>({});

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const result = await platformApiRequest<OrgDetail>(`/admin/organizations/${id}`);
      setData(result);
      setForm(result.organization);
      if (result.subscription) setSubForm(result.subscription);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const saveOrganization = async () => {
    if (!id) return;

    const destructive = form.status === 'suspended' || form.status === 'cancelled';
    const statusChanged = form.status !== data?.organization.status;
    if (destructive && statusChanged) {
      const label = form.status === 'suspended' ? 'suspendre' : 'annuler';
      if (!window.confirm(`Confirmer : ${label} l'accès de ce client ?`)) return;
    }

    setSaving(true);
    try {
      await platformApiRequest(`/admin/organizations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name,
          status: form.status,
          plan: form.plan,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
          maxRooms: form.maxRooms,
          maxUsers: form.maxUsers,
          maxClients: form.maxClients,
        }),
      });
      toast.success('Configuration enregistrée');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const saveSubscription = async () => {
    if (!id || !data) return;
    setSaving(true);
    try {
      if (data.subscription?._id) {
        await platformApiRequest(`/admin/subscriptions/${data.subscription._id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            plan: subForm.plan,
            status: subForm.status,
            priceMonthly: subForm.priceMonthly,
            billingCycle: subForm.billingCycle,
            notes: subForm.notes,
          }),
        });
      } else {
        await platformApiRequest('/admin/subscriptions', {
          method: 'POST',
          body: JSON.stringify({
            organizationId: id,
            plan: subForm.plan || form.plan || 'starter',
            status: subForm.status || 'trialing',
            priceMonthly: subForm.priceMonthly || 0,
            billingCycle: subForm.billingCycle || 'monthly',
          }),
        });
      }
      toast.success('Abonnement enregistré');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié`);
  };

  if (loading) {
    return (
      <AdminPageShell>
        <AdminLoading />
      </AdminPageShell>
    );
  }
  if (!data) {
    return (
      <AdminPageShell>
        <AdminCard className="border-red-200 bg-red-50 text-red-700">Client introuvable</AdminCard>
        <Link to="/admin/organizations" className="mt-4 inline-block text-sm text-cyan-700 hover:underline">
          ← Retour à la liste
        </Link>
      </AdminPageShell>
    );
  }

  const org = data.organization;
  const usage = data.usage;
  const loginUrl = `${window.location.origin}/login/${org.slug}`;

  return (
    <AdminPageShell>
      <button
        type="button"
        onClick={() => navigate('/admin/organizations')}
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-cyan-700"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Tous les clients
      </button>

      <AdminCard className="mb-8 border-slate-200 bg-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <OrgAvatar name={org.name} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">{org.name}</h1>
                <StatusBadge status={org.status} />
                <StatusBadge status={org.plan} type="plan" />
              </div>
              <p className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
                <code className="rounded-lg bg-white px-2 py-0.5 font-mono text-xs ring-1 ring-slate-200">
                  {org.legacyId}
                </code>
                <code className="rounded-lg bg-white px-2 py-0.5 font-mono text-xs ring-1 ring-slate-200">
                  {org.dbName}
                </code>
                {org.lastLoginAt && (
                  <span className="text-xs text-slate-400">
                    Dernière connexion : {new Date(org.lastLoginAt).toLocaleString('fr-FR')}
                    {org.loginCount != null && ` · ${org.loginCount} connexion(s)`}
                  </span>
                )}
                {!org.lastLoginAt && (
                  <span className="text-xs text-amber-600">Jamais connecté</span>
                )}
              </p>
            </div>
          </div>
          <a
            href={loginUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-sm text-cyan-700 hover:underline"
          >
            Ouvrir login →
          </a>
        </div>
      </AdminCard>

      {usage && (
        <AdminCard className="mb-8">
          <AdminCardHeader title="Consommation & limites" description="Usage vs quotas du plan" />
          <div className="grid gap-5 sm:grid-cols-2">
            <UsageBar label="Chambres froid" value={usage.roomsCount} max={org.maxRooms} />
            <UsageBar label="Clients finaux" value={usage.clientsCount} max={org.maxClients} />
            <UsageBar label="Utilisateurs" value={usage.usersCount} max={org.maxUsers} />
            <UsageBar label="Réceptions" value={usage.receptionsCount} />
            <UsageBar label="Réservations" value={usage.reservationsCount} />
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Dernière collecte : {new Date(usage.lastUpdated).toLocaleString('fr-FR')}
          </p>
        </AdminCard>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminCard>
          <AdminCardHeader title="Configuration client" />
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-500">Nom du frigo</label>
              <input
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Statut d'accès</label>
                <select
                  value={form.status || 'trial'}
                  onChange={(e) => setForm({ ...form, status: e.target.value as Organization['status'] })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="trial">Essai</option>
                  <option value="active">Actif</option>
                  <option value="suspended">Suspendu</option>
                  <option value="cancelled">Annulé</option>
                </select>
                {(form.status === 'suspended' || form.status === 'cancelled') &&
                  form.status !== org.status && (
                    <p className="mt-1.5 text-xs text-amber-700">
                      ⚠ Enregistrer coupera l'accès au frigo.
                    </p>
                  )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Plan</label>
                <select
                  value={form.plan || 'starter'}
                  onChange={(e) => setForm({ ...form, plan: e.target.value as Organization['plan'] })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Email contact</label>
              <input
                type="email"
                value={form.contactEmail || ''}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Téléphone</label>
              <input
                value={form.contactPhone || ''}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(['maxRooms', 'maxUsers', 'maxClients'] as const).map((key, i) => (
                <div key={key}>
                  <label className="text-xs font-medium text-slate-500">
                    {['Max chambres', 'Max users', 'Max clients'][i]}
                  </label>
                  <input
                    type="number"
                    value={form[key] ?? 0}
                    onChange={(e) => setForm({ ...form, [key]: +e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
            <AdminButton variant="primary" className="w-full" onClick={saveOrganization} disabled={saving}>
              Enregistrer
            </AdminButton>
          </div>
        </AdminCard>

        <AdminCard>
          <AdminCardHeader title="Abonnement & facturation" />
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Plan</label>
                <select
                  value={subForm.plan || form.plan || 'starter'}
                  onChange={(e) => setSubForm({ ...subForm, plan: e.target.value as Subscription['plan'] })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Statut paiement</label>
                <select
                  value={subForm.status || 'trialing'}
                  onChange={(e) => setSubForm({ ...subForm, status: e.target.value as Subscription['status'] })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="trialing">Essai</option>
                  <option value="active">Actif</option>
                  <option value="past_due">Impayé</option>
                  <option value="cancelled">Annulé</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Prix mensuel (MAD)</label>
                <input
                  type="number"
                  value={subForm.priceMonthly ?? 0}
                  onChange={(e) => setSubForm({ ...subForm, priceMonthly: +e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Cycle</label>
                <select
                  value={subForm.billingCycle || 'monthly'}
                  onChange={(e) => setSubForm({ ...subForm, billingCycle: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="monthly">Mensuel</option>
                  <option value="yearly">Annuel</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Notes internes</label>
              <textarea
                value={subForm.notes || ''}
                onChange={(e) => setSubForm({ ...subForm, notes: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Notes FrigoSmart..."
              />
            </div>
            {data.subscription?.startDate && (
              <p className="text-xs text-slate-400">
                Début : {new Date(data.subscription.startDate).toLocaleDateString('fr-FR')}
              </p>
            )}
            <AdminButton variant="primary" className="w-full" onClick={saveSubscription} disabled={saving}>
              Enregistrer l'abonnement
            </AdminButton>
          </div>
        </AdminCard>
      </div>

      {id && data && (
        <OrganizationFacilityPanel orgId={id} organization={data.organization} onSaved={load} />
      )}

      {id && <OrganizationUsagePanel orgId={id} />}

      {id && <OrganizationAccessPanel orgId={id} />}

      {id && <OrganizationPlatformLogsPanel orgId={id} />}

      {id && (
        <AdminCard className="mt-8">
          <AdminCardHeader title="Journal admin" description="Actions FrigoSmart sur ce client" />
          <OrganizationAuditPanel orgId={id} />
        </AdminCard>
      )}

      <AdminCard className="mt-6 border-dashed bg-slate-50/50">
        <h3 className="font-medium text-slate-900">Accès & informations</h3>
        <div className="mt-3 space-y-2">
          <p>
            URL login :{' '}
            <button
              type="button"
              onClick={() => copyText(loginUrl, 'URL')}
              className="font-mono text-cyan-700 hover:underline"
            >
              {loginUrl}
            </button>
          </p>
          <p>
            Tenant ID :{' '}
            <button
              type="button"
              onClick={() => copyText(org.legacyId, 'Tenant ID')}
              className="font-mono text-cyan-700 hover:underline"
            >
              {org.legacyId}
            </button>
          </p>
          <p className="text-xs text-slate-400">
            Créé le {new Date(org.createdAt).toLocaleDateString('fr-FR')}
            {org.trialEndsAt && ` · Fin essai : ${new Date(org.trialEndsAt).toLocaleDateString('fr-FR')}`}
          </p>
        </div>
      </AdminCard>
    </AdminPageShell>
  );
};
