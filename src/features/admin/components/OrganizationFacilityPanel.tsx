import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { platformApiRequest } from '../../../lib/platformAuth';
import type { FacilityGroupConfig, Organization } from '../types';
import { DEFAULT_FACILITY_GROUPS, resolveFacilityGroups } from '../../../lib/facilityGroups';
import { AdminButton, AdminCard, AdminCardHeader } from './admin-ui';

interface Props {
  orgId: string;
  organization: Organization;
  onSaved: () => void;
}

const emptyGroup = (id: string, index: number): FacilityGroupConfig => ({
  id,
  label: `Bloc ${index + 1}`,
  subtitle: '',
  chFrom: index === 0 ? 1 : 7,
  chTo: index === 0 ? 6 : 99,
  couloirNumbers: index === 0 ? [1] : [2],
});

export const OrganizationFacilityPanel: React.FC<Props> = ({ orgId, organization, onSaved }) => {
  const [groups, setGroups] = useState<FacilityGroupConfig[]>(
    resolveFacilityGroups(organization.facilityGroups)
  );
  const [groupCount, setGroupCount] = useState(
    resolveFacilityGroups(organization.facilityGroups).length
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const resolved = resolveFacilityGroups(organization.facilityGroups);
    setGroups(resolved);
    setGroupCount(resolved.length);
  }, [organization.facilityGroups]);

  const updateGroup = (index: number, patch: Partial<FacilityGroupConfig>) => {
    setGroups((prev) => prev.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  };

  const updateCouloirs = (index: number, value: string) => {
    const nums = value
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n));
    updateGroup(index, { couloirNumbers: nums });
  };

  const changeGroupCount = (count: number) => {
    setGroupCount(count);
    setGroups((prev) => {
      const next = [...prev];
      while (next.length < count) {
        next.push(emptyGroup(`group${next.length + 1}`, next.length));
      }
      return next.slice(0, count);
    });
  };

  const resetDefaults = () => {
    setGroups([...DEFAULT_FACILITY_GROUPS]);
    setGroupCount(DEFAULT_FACILITY_GROUPS.length);
  };

  const save = async () => {
    setSaving(true);
    try {
      await platformApiRequest(`/admin/organizations/${orgId}`, {
        method: 'PATCH',
        body: JSON.stringify({ facilityGroups: groups.slice(0, groupCount) }),
      });
      toast.success('Structure des chambres enregistrée');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const visibleGroups = groups.slice(0, groupCount);

  return (
    <AdminCard className="mt-8">
      <AdminCardHeader
        title="Structure des chambres"
        description="Regroupement affiché sur la carte du frigo (dashboard tenant)"
        action={
          <AdminButton variant="ghost" size="sm" onClick={resetDefaults}>
            Réinitialiser
          </AdminButton>
        }
      />

      <div className="mb-5">
        <label className="text-xs font-medium text-slate-500">Nombre de blocs / onglets</label>
        <select
          value={groupCount}
          onChange={(e) => changeGroupCount(+e.target.value)}
          className="mt-1 w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2 text-sm"
        >
          <option value={1}>1 bloc (toutes les chambres)</option>
          <option value={2}>2 blocs (ex. CH 1-6 / 7+)</option>
          <option value={3}>3 blocs</option>
        </select>
      </div>

      <div className="space-y-6">
        {visibleGroups.map((group, index) => (
          <div key={group.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-800">Bloc {index + 1}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-500">Titre affiché</label>
                <input
                  value={group.label}
                  onChange={(e) => updateGroup(index, { label: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Bloc Nord"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Sous-titre</label>
                <input
                  value={group.subtitle || ''}
                  onChange={(e) => updateGroup(index, { subtitle: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Chambres 1 à 6"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">CH du n°</label>
                <input
                  type="number"
                  min={0}
                  value={group.chFrom}
                  onChange={(e) => updateGroup(index, { chFrom: +e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">CH au n°</label>
                <input
                  type="number"
                  min={0}
                  value={group.chTo}
                  onChange={(e) => updateGroup(index, { chTo: +e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-500">
                  Couloirs (numéros séparés par virgule)
                </label>
                <input
                  value={group.couloirNumbers.join(', ')}
                  onChange={(e) => updateCouloirs(index, e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="1, 2"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Les chambres « CH 3 », « Chambre 5 » ou « Couloir 1 » sont classées selon ces règles.
            </p>
          </div>
        ))}
      </div>

      <AdminButton variant="primary" className="mt-5 w-full sm:w-auto" onClick={save} disabled={saving}>
        Enregistrer la structure
      </AdminButton>
    </AdminCard>
  );
};
