import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { platformApiRequest } from '../../../lib/platformAuth';
import {
  AdminButton,
  AdminCard,
  AdminCardHeader,
  AdminEmptyState,
  AdminFilterPills,
  AdminModal,
  AdminTableBody,
  AdminTableHead,
  AdminTableShell,
  AdminTh,
} from '../components/admin-ui';
import { AdminLoading } from '../components/AdminLoading';

interface TenantUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

interface TenantClient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  isActive: boolean;
  hasPassword: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

interface AccessData {
  users: TenantUser[];
  clients: TenantClient[];
}

type Tab = 'users' | 'clients';

interface Props {
  orgId: string;
}

export const OrganizationAccessPanel: React.FC<Props> = ({ orgId }) => {
  const [data, setData] = useState<AccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('users');
  const [saving, setSaving] = useState<string | null>(null);
  const [passwordModal, setPasswordModal] = useState<{
    type: Tab;
    id: string;
    name: string;
  } | null>(null);
  const [blockConfirm, setBlockConfirm] = useState<{
    type: Tab;
    id: string;
    name: string;
    block: boolean;
  } | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await platformApiRequest<AccessData>(`/admin/organizations/${orgId}/access`);
      setData(result);
    } catch {
      setData(null);
      toast.error('Impossible de charger les accès');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (type: Tab, id: string, isActive: boolean) => {
    setSaving(id);
    setBlockConfirm(null);
    try {
      const path =
        type === 'users'
          ? `/admin/organizations/${orgId}/access/users/${id}`
          : `/admin/organizations/${orgId}/access/clients/${id}`;
      await platformApiRequest(path, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      });
      toast.success(isActive ? 'Accès réactivé' : 'Accès bloqué');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(null);
    }
  };

  const resetPassword = async () => {
    if (!passwordModal || newPassword.length < 6) {
      toast.error('Mot de passe minimum 6 caractères');
      return;
    }
    setSaving(passwordModal.id);
    try {
      const path =
        passwordModal.type === 'users'
          ? `/admin/organizations/${orgId}/access/users/${passwordModal.id}`
          : `/admin/organizations/${orgId}/access/clients/${passwordModal.id}`;
      await platformApiRequest(path, {
        method: 'PATCH',
        body: JSON.stringify({ password: newPassword }),
      });
      toast.success('Mot de passe mis à jour');
      setPasswordModal(null);
      setNewPassword('');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(null);
    }
  };

  const roleLabel: Record<string, string> = {
    admin: 'Admin',
    manager: 'Manager',
    viewer: 'Lecteur',
    client: 'Client',
  };

  const formatLastLogin = (date?: string) => {
    if (!date) return <span className="text-xs text-amber-600">Jamais</span>;
    return (
      <span className="text-xs text-slate-500">
        {new Date(date).toLocaleDateString('fr-FR')}
      </span>
    );
  };

  const AccessActions: React.FC<{
    type: Tab;
    id: string;
    name: string;
    isActive: boolean;
  }> = ({ type, id, name, isActive }) => (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={saving === id}
        onClick={() => {
          setPasswordModal({ type, id, name });
          setNewPassword('');
        }}
        className="text-xs text-slate-500 hover:text-cyan-700 disabled:opacity-50"
      >
        Mot de passe
      </button>
      <button
        type="button"
        disabled={saving === id}
        onClick={() => setBlockConfirm({ type, id, name, block: isActive })}
        className={`text-xs disabled:opacity-50 ${
          isActive ? 'text-slate-400 hover:text-red-600' : 'text-emerald-600 hover:text-emerald-700'
        }`}
      >
        {isActive ? 'Bloquer l\'accès' : 'Réactiver l\'accès'}
      </button>
    </div>
  );

  if (loading) {
    return (
      <AdminCard className="mt-8">
        <AdminLoading />
      </AdminCard>
    );
  }

  const users = data?.users ?? [];
  const clients = data?.clients ?? [];
  const activeList = tab === 'users' ? users : clients;

  return (
    <>
      <AdminCard className="mt-8">
        <AdminCardHeader
          title="Gestion des accès"
          description="Modifier les comptes via les options de chaque ligne"
        />

        <div className="mb-5">
          <AdminFilterPills
          options={[
            { key: 'users', label: 'Équipe frigo', count: users.length },
            { key: 'clients', label: 'Clients finaux', count: clients.length },
          ]}
          value={tab}
          onChange={(id) => setTab(id as Tab)}
          />
        </div>

        {activeList.length === 0 ? (
          <AdminEmptyState
            title={tab === 'users' ? 'Aucun utilisateur' : 'Aucun client final'}
            description="Les comptes apparaîtront ici une fois créés dans le frigo."
          />
        ) : tab === 'users' ? (
          <AdminTableShell minWidth="800px">
            <AdminTableHead>
              <AdminTh>Utilisateur</AdminTh>
              <AdminTh>Rôle</AdminTh>
              <AdminTh>Contact</AdminTh>
              <AdminTh>Dernière connexion</AdminTh>
              <AdminTh>Statut</AdminTh>
              <AdminTh align="right">Config</AdminTh>
            </AdminTableHead>
            <AdminTableBody>
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/80">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-slate-900">{user.name}</p>
                    <p className="text-xs text-slate-400">
                      Créé le {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-medium text-cyan-800">
                      {roleLabel[user.role] || user.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">
                    {user.email && <div className="text-sm">{user.email}</div>}
                    {user.phone && <div className="text-xs text-slate-400">{user.phone}</div>}
                  </td>
                  <td className="px-5 py-3.5">{formatLastLogin(user.lastLoginAt)}</td>
                  <td className="px-5 py-3.5">
                    {user.isActive ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Actif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        Bloqué
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <AccessActions type="users" id={user.id} name={user.name} isActive={user.isActive} />
                  </td>
                </tr>
              ))}
            </AdminTableBody>
          </AdminTableShell>
        ) : (
          <AdminTableShell minWidth="800px">
            <AdminTableHead>
              <AdminTh>Client</AdminTh>
              <AdminTh>Contact</AdminTh>
              <AdminTh>Accès login</AdminTh>
              <AdminTh>Dernière connexion</AdminTh>
              <AdminTh>Statut</AdminTh>
              <AdminTh align="right">Config</AdminTh>
            </AdminTableHead>
            <AdminTableBody>
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50/80">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-slate-900">{client.name}</p>
                    {client.company && <p className="text-xs text-slate-400">{client.company}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">
                    {client.email && <div className="text-sm">{client.email}</div>}
                    {client.phone && <div className="text-xs text-slate-400">{client.phone}</div>}
                  </td>
                  <td className="px-5 py-3.5">
                    {client.hasPassword ? (
                      <span className="text-xs text-slate-500">Mot de passe défini</span>
                    ) : (
                      <span className="text-xs text-amber-600">Pas de mot de passe</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">{formatLastLogin(client.lastLoginAt)}</td>
                  <td className="px-5 py-3.5">
                    {client.isActive ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Actif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        Bloqué
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <AccessActions type="clients" id={client.id} name={client.name} isActive={client.isActive} />
                  </td>
                </tr>
              ))}
            </AdminTableBody>
          </AdminTableShell>
        )}
      </AdminCard>

      <AdminModal
        open={!!blockConfirm}
        onClose={() => setBlockConfirm(null)}
        title={blockConfirm?.block ? 'Bloquer l\'accès' : 'Réactiver l\'accès'}
        description={
          blockConfirm
            ? blockConfirm.block
              ? `${blockConfirm.name} ne pourra plus se connecter.`
              : `${blockConfirm.name} pourra à nouveau se connecter.`
            : undefined
        }
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setBlockConfirm(null)}>
              Annuler
            </AdminButton>
            <AdminButton
              variant={blockConfirm?.block ? 'danger' : 'success'}
              disabled={saving === blockConfirm?.id}
              onClick={() => {
                if (!blockConfirm) return;
                toggleActive(blockConfirm.type, blockConfirm.id, !blockConfirm.block);
              }}
            >
              Confirmer
            </AdminButton>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Cette action est réversible depuis la colonne Config.
        </p>
      </AdminModal>

      <AdminModal
        open={!!passwordModal}
        onClose={() => {
          setPasswordModal(null);
          setNewPassword('');
        }}
        title="Réinitialiser le mot de passe"
        description={
          passwordModal
            ? `Nouveau mot de passe pour ${passwordModal.name}`
            : undefined
        }
        footer={
          <>
            <AdminButton
              variant="secondary"
              onClick={() => {
                setPasswordModal(null);
                setNewPassword('');
              }}
            >
              Annuler
            </AdminButton>
            <AdminButton
              variant="primary"
              disabled={saving === passwordModal?.id || newPassword.length < 6}
              onClick={resetPassword}
            >
              Enregistrer
            </AdminButton>
          </>
        }
      >
        <div>
          <label className="text-xs font-medium text-slate-500">Nouveau mot de passe</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimum 6 caractères"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            autoFocus
          />
          <p className="mt-2 text-xs text-slate-400">
            Le compte devra utiliser ce mot de passe à la prochaine connexion.
          </p>
        </div>
      </AdminModal>
    </>
  );
};
