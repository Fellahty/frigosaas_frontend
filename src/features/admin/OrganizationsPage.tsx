import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { platformApiRequest } from '../../lib/platformAuth';
import type { Organization } from './types';
import { StatusBadge } from './components/StatusBadge';
import { AdminPageHeader } from './components/AdminPageHeader';
import { AdminLoading } from './components/AdminLoading';
import {
  AdminButton,
  AdminCard,
  AdminPageShell,
  AdminSearch,
  AdminFilterPills,
  AdminModal,
  AdminLabel,
  AdminInput,
  AdminSelect,
  AdminTableShell,
  AdminTableHead,
  AdminTh,
  AdminTableBody,
  AdminEmptyState,
  OrgAvatar,
} from './components/admin-ui';

type FilterStatus = 'all' | 'active' | 'trial' | 'suspended';

const emptyForm = {
  slug: '',
  name: '',
  contactEmail: '',
  adminEmail: '',
  adminPassword: '',
  plan: 'starter' as const,
};

export const OrganizationsPage: React.FC = () => {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    platformApiRequest<Organization[]>('/admin/organizations')
      .then(setOrgs)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(
    () => ({
      all: orgs.length,
      active: orgs.filter((o) => o.status === 'active').length,
      trial: orgs.filter((o) => o.status === 'trial').length,
      suspended: orgs.filter((o) => o.status === 'suspended').length,
    }),
    [orgs]
  );

  const createOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      await platformApiRequest('/admin/organizations', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setShowModal(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const filtered = useMemo(() => {
    return orgs.filter((o) => {
      const matchSearch =
        o.name.toLowerCase().includes(search.toLowerCase()) ||
        o.legacyId.toLowerCase().includes(search.toLowerCase()) ||
        o.slug.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === 'all' || o.status === filter;
      return matchSearch && matchFilter;
    });
  }, [orgs, search, filter]);

  if (loading) {
    return (
      <AdminPageShell>
        <AdminLoading />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Clients frigo"
        subtitle="Gérez les organisations et leurs bases de données isolées"
        actions={
          <AdminButton variant="primary" onClick={() => setShowModal(true)}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nouveau client
          </AdminButton>
        }
      />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full max-w-md">
          <AdminSearch
            value={search}
            onChange={setSearch}
            placeholder="Rechercher nom, slug, ID..."
          />
        </div>
        <AdminFilterPills
          value={filter}
          onChange={(k) => setFilter(k as FilterStatus)}
          options={[
            { key: 'all', label: 'Tous', count: counts.all },
            { key: 'active', label: 'Actifs', count: counts.active },
            { key: 'trial', label: 'Essai', count: counts.trial },
            { key: 'suspended', label: 'Suspendus', count: counts.suspended },
          ]}
        />
      </div>

      <AdminCard padding={false}>
        {filtered.length === 0 ? (
          <AdminEmptyState
            title="Aucun résultat"
            description="Modifiez vos filtres ou créez un nouveau client frigo."
            action={
              <AdminButton variant="primary" onClick={() => setShowModal(true)}>
                + Nouveau client
              </AdminButton>
            }
          />
        ) : (
          <AdminTableShell>
            <AdminTableHead>
              <AdminTh>Client</AdminTh>
              <AdminTh>Tenant ID</AdminTh>
              <AdminTh>Plan</AdminTh>
              <AdminTh>Statut</AdminTh>
              <AdminTh>Contact</AdminTh>
              <AdminTh>Créé</AdminTh>
              <AdminTh align="right" />
            </AdminTableHead>
            <AdminTableBody>
              {filtered.map((o) => (
                <tr key={o._id} className="transition hover:bg-cyan-50/30">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <OrgAvatar name={o.name} size="sm" />
                      <div>
                        <p className="font-medium text-slate-900">{o.name}</p>
                        <p className="font-mono text-[11px] text-slate-400">{o.dbName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <code className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      {o.legacyId}
                    </code>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={o.plan} type="plan" />
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500">{o.contactEmail || '—'}</td>
                  <td className="px-5 py-4 text-sm text-slate-400">
                    {new Date(o.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      to={`/admin/organizations/${o._id}`}
                      className="inline-flex rounded-lg bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-700 hover:text-white"
                    >
                      Configurer
                    </Link>
                  </td>
                </tr>
              ))}
            </AdminTableBody>
          </AdminTableShell>
        )}
      </AdminCard>

      <AdminModal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setError('');
        }}
        title="Nouveau client frigo"
        description="Provisionne une base MongoDB dédiée et un compte administrateur."
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setShowModal(false)}>
              Annuler
            </AdminButton>
            <AdminButton
              variant="success"
              disabled={creating}
              type="submit"
              form="create-org-form"
            >
              {creating ? 'Création...' : 'Créer le client'}
            </AdminButton>
          </>
        }
      >
        <form id="create-org-form" onSubmit={createOrg} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <AdminLabel>Slug URL</AdminLabel>
              <AdminInput
                placeholder="casa, agadir..."
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                required
              />
            </div>
            <div>
              <AdminLabel>Nom affiché</AdminLabel>
              <AdminInput
                placeholder="Frigo Casa"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
          </div>
          <div>
            <AdminLabel>Email contact</AdminLabel>
            <AdminInput
              type="email"
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            />
          </div>
          <div>
            <AdminLabel>Plan</AdminLabel>
            <AdminSelect
              value={form.plan}
              onChange={(e) => setForm({ ...form, plan: e.target.value as 'starter' })}
            >
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </AdminSelect>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <AdminLabel>Email admin frigo</AdminLabel>
              <AdminInput
                type="email"
                value={form.adminEmail}
                onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                required
              />
            </div>
            <div>
              <AdminLabel>Mot de passe admin</AdminLabel>
              <AdminInput
                type="password"
                value={form.adminPassword}
                onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                required
                minLength={6}
              />
            </div>
          </div>
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </form>
      </AdminModal>
    </AdminPageShell>
  );
};
