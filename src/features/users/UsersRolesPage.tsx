import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, Timestamp, db } from '@/lib/db';
import { useTranslation } from 'react-i18next';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { logCreate, logDelete, logUpdate } from '../../lib/logging';
import { Card } from '../../components/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/Table';
import { Spinner } from '../../components/Spinner';

type UserRole = 'admin' | 'manager' | 'viewer';

interface TenantUser {
  id: string;
  name: string;
  phone: string;
  username: string;
  role: UserRole;
  createdAt: Date;
  isActive: boolean;
  firebaseUid?: string;
}

export const UsersRolesPage: React.FC = () => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  const [isAdding, setIsAdding] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<TenantUser | null>(null);
  const [deletingUser, setDeletingUser] = React.useState<TenantUser | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [form, setForm] = React.useState<{ 
    name: string; 
    phone: string;
    username: string; 
    password: string; 
    confirmPassword: string;
    role: UserRole;
    isActive: boolean;
  }>({
    name: '',
    phone: '',
    username: '',
    password: '',
    confirmPassword: '',
    role: 'viewer',
    isActive: true,
  });

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['tenant-users', tenantId],
    queryFn: async (): Promise<TenantUser[]> => {
      const q = query(collection(db, 'users'), where('tenantId', '==', tenantId));
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name || '',
          phone: data.phone || '',
          username: data.username || '',
          role: (data.role as UserRole) || 'viewer',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          isActive: data.isActive !== false,
          firebaseUid: data.firebaseUid || '',
        };
      });
    },
  });

  const addUser = useMutation({
    mutationFn: async (payload: { 
      name: string; 
      phone: string;
      username: string; 
      password: string; 
      role: UserRole;
      isActive: boolean;
    }) => {
      // Basic password validation
      if (payload.password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      
      // Create Firestore user document (without Firebase Auth for now)
      await addDoc(collection(db, 'users'), {
        tenantId,
        name: payload.name,
        phone: payload.phone,
        username: payload.username,
        password: payload.password, // In production, this should be hashed
        role: payload.role,
        isActive: payload.isActive,
        createdAt: Timestamp.fromDate(new Date()),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tenant-users', tenantId] });
      setIsAdding(false);
      setForm({ 
        name: '', 
        phone: '',
        username: '', 
        password: '', 
        confirmPassword: '', 
        role: 'viewer',
        isActive: true
      });
      setShowPassword(false);
      setShowConfirmPassword(false);
      // Log the action
      await logCreate('user', undefined, `User created: ${form.name} (${form.username})`, 'admin', 'Administrateur');
    },
  });

  const updateUser = useMutation({
    mutationFn: async (payload: { 
      id: string;
      name: string; 
      phone: string;
      username: string; 
      password?: string; 
      role: UserRole;
      isActive: boolean;
    }) => {
      const updateData: any = {
        name: payload.name,
        phone: payload.phone,
        username: payload.username,
        role: payload.role,
        isActive: payload.isActive,
      };

      // Only update password if provided
      if (payload.password && payload.password.length >= 6) {
        updateData.password = payload.password;
      }

      // Update Firestore document
      await updateDoc(doc(db, 'users', payload.id), updateData);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tenant-users', tenantId] });
      setEditingUser(null);
      setForm({ 
        name: '', 
        phone: '',
        username: '', 
        password: '', 
        confirmPassword: '', 
        role: 'viewer',
        isActive: true
      });
      setShowPassword(false);
      setShowConfirmPassword(false);
      // Log the action
      await logUpdate('user', editingUser?.id, `User updated: ${editingUser?.name} (${editingUser?.username})`, 'admin', 'Administrateur');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Delete Firestore document
      await deleteDoc(doc(db, 'users', userId));
      
      // Note: In a real app, you'd also delete the Firebase Auth user
      // For now, we'll just delete the Firestore document
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tenant-users', tenantId] });
      setDeletingUser(null);
      // Log the action
      await logDelete('user', deletingUser?.id, `User deleted: ${deletingUser?.name} (${deletingUser?.username})`, 'admin', 'Administrateur');
    },
  });

  const handleEdit = (user: TenantUser) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      phone: user.phone,
      username: user.username,
      password: '',
      confirmPassword: '',
      role: user.role,
      isActive: user.isActive,
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleDelete = (user: TenantUser) => {
    setDeletingUser(user);
  };

  const handleSaveEdit = () => {
    if (!editingUser) return;
    
    if (form.password && form.password !== form.confirmPassword) {
      alert(t('usersRoles.passwordMismatch', 'Passwords do not match'));
      return;
    }

    updateUser.mutate({
      id: editingUser.id,
      name: form.name,
      phone: form.phone,
      username: form.username,
      password: form.password || undefined,
      role: form.role,
      isActive: form.isActive,
    });
  };

  const handleConfirmDelete = () => {
    if (!deletingUser) return;
    deleteUserMutation.mutate(deletingUser.id);
  };

  const resetForm = () => {
    setForm({ 
      name: '', 
      phone: '',
      username: '', 
      password: '', 
      confirmPassword: '', 
      role: 'viewer',
      isActive: true
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setIsAdding(false);
    setEditingUser(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        <p className="font-medium">{t('usersRoles.errorLoading', 'Erreur de chargement')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-sm md:text-base">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{t('usersRoles.title', 'Utilisateurs & Rôles')}</h1>
          <p className="text-gray-600">{t('usersRoles.subtitle', 'Gérez les accès de votre équipe')}</p>
        </div>
        <button
          onClick={() => setIsAdding((v) => !v)}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M12 4.5a.75.75 0 01.75.75V11h5.75a.75.75 0 010 1.5H12.75v5.75a.75.75 0 01-1.5 0V12.5H5.5a.75.75 0 010-1.5h5.75V5.25A.75.75 0 0112 4.5z" clipRule="evenodd" /></svg>
          {t('usersRoles.addUser', 'Ajouter un utilisateur')}
        </button>
      </div>

      {isAdding && (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('usersRoles.fullName', 'Nom complet')}</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border rounded-md px-3 py-2"
                placeholder={t('usersRoles.fullNamePlaceholder', 'Ex: Jean Dupont') as string}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('clients.phone', 'Téléphone')}</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full border rounded-md px-3 py-2"
                placeholder={t('clients.phonePlaceholder', '0666507474') as string}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('usersRoles.username', 'Nom d\'utilisateur')}</label>
              <input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                className="w-full border rounded-md px-3 py-2"
                placeholder={t('usersRoles.usernamePlaceholder', 'Ex: j.dupont') as string}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('usersRoles.role', 'Rôle')}</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="admin">{t('usersRoles.roleAdmin', 'Administrateur')}</option>
                <option value="manager">{t('usersRoles.roleManager', 'Gestionnaire')}</option>
                <option value="viewer">{t('usersRoles.roleViewer', 'Lecteur')}</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="isActive"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="h-4 w-4"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                {t('usersRoles.isActive', 'Utilisateur actif')}
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('usersRoles.password', 'Mot de passe')}</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 pr-10"
                  placeholder={t('usersRoles.passwordPlaceholder', 'Enter password') as string}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? t('usersRoles.hidePassword', 'Masquer le mot de passe') as string : t('usersRoles.showPassword', 'Afficher le mot de passe') as string}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">{t('usersRoles.passwordHelp', 'Minimum 6 characters')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('usersRoles.confirmPassword', 'Confirmer le mot de passe')}</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 pr-10"
                  placeholder={t('usersRoles.confirmPasswordPlaceholder', 'Confirm password') as string}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  aria-label={showConfirmPassword ? t('usersRoles.hidePassword', 'Masquer le mot de passe') as string : t('usersRoles.showPassword', 'Afficher le mot de passe') as string}
                >
                  {showConfirmPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => {
                if (form.password !== form.confirmPassword) {
                  alert(t('usersRoles.passwordMismatch', 'Passwords do not match'));
                  return;
                }
                addUser.mutate({
                  name: form.name,
                  phone: form.phone,
                  username: form.username,
                  password: form.password,
                  role: form.role,
                  isActive: form.isActive
                });
              }}
              disabled={!form.name || !form.phone || !form.username || !form.password || !form.confirmPassword || addUser.isLoading}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-60"
            >
              {addUser.isLoading ? t('common.loading') : t('common.save')}
            </button>
            <button onClick={() => {
              setIsAdding(false);
              setShowPassword(false);
              setShowConfirmPassword(false);
            }} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200">
              {t('common.cancel')}
            </button>
          </div>
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <Table className="min-w-full text-xs">
            <TableHead>
              <TableRow className="bg-gray-50">
                <TableHeader className="px-3 py-2 text-left font-semibold text-gray-700">{t('usersRoles.fullName', 'Nom complet')}</TableHeader>
                <TableHeader className="px-3 py-2 text-left font-semibold text-gray-700">{t('clients.phone', 'Téléphone')}</TableHeader>
                <TableHeader className="px-3 py-2 text-left font-semibold text-gray-700">{t('usersRoles.username', 'Nom d\'utilisateur')}</TableHeader>
                <TableHeader className="px-3 py-2 text-center font-semibold text-gray-700">{t('usersRoles.role', 'Rôle')}</TableHeader>
                <TableHeader className="px-3 py-2 text-center font-semibold text-gray-700">{t('usersRoles.status', 'Statut')}</TableHeader>
                <TableHeader className="px-3 py-2 text-center font-semibold text-gray-700">{t('clients.created', 'Créé le')}</TableHeader>
                <TableHeader className="px-3 py-2 text-center font-semibold text-gray-700">{t('common.actions', 'Actions')}</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.isArray(users) && users.length > 0 ? (
                users.map((u) => (
                  <TableRow key={u.id} className="hover:bg-gray-50 border-b border-gray-200">
                    <TableCell className="px-3 py-2 font-medium text-gray-900 truncate max-w-[120px]" title={u.name}>
                      {u.name}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-gray-600 font-mono text-xs">
                      {u.phone}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-gray-600 font-mono text-xs">
                      {u.username}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        u.role === 'admin' 
                          ? 'bg-red-100 text-red-800' 
                          : u.role === 'manager'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {t(`roles.${u.role}`, u.role)}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        u.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {u.isActive ? t('usersRoles.active', 'Actif') : t('usersRoles.inactive', 'Inactif')}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-center text-gray-500 text-xs">
                      {u.createdAt.toLocaleDateString('fr-FR', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: '2-digit' 
                      })}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleEdit(u)}
                          className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors"
                          title={t('common.edit', 'Modifier')}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors"
                          title={t('common.delete', 'Supprimer')}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500 text-sm">
                    {t('usersRoles.noUsers', 'Aucun utilisateur')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">{t('usersRoles.editUser', 'Modifier l\'utilisateur')}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('usersRoles.fullName', 'Nom complet')}</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder={t('usersRoles.fullNamePlaceholder', 'Ex: Jean Dupont') as string}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('clients.phone', 'Téléphone')}</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder={t('clients.phonePlaceholder', '0666507474') as string}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('usersRoles.username', 'Nom d\'utilisateur')}</label>
                  <input
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder={t('usersRoles.usernamePlaceholder', 'Ex: j.dupont') as string}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('usersRoles.role', 'Rôle')}</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                    className="w-full border rounded-md px-3 py-2"
                  >
                    <option value="admin">{t('usersRoles.roleAdmin', 'Administrateur')}</option>
                    <option value="manager">{t('usersRoles.roleManager', 'Gestionnaire')}</option>
                    <option value="viewer">{t('usersRoles.roleViewer', 'Lecteur')}</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="editIsActive"
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  <label htmlFor="editIsActive" className="text-sm font-medium text-gray-700">
                    {t('usersRoles.isActive', 'Utilisateur actif')}
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('usersRoles.password', 'Mot de passe')} <span className="text-gray-500">({t('usersRoles.optional', 'Optionnel')})</span></label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      className="w-full border rounded-md px-3 py-2 pr-10"
                      placeholder={t('usersRoles.passwordPlaceholder', 'Enter password') as string}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{t('usersRoles.passwordHelp', 'Minimum 6 characters')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('usersRoles.confirmPassword', 'Confirmer le mot de passe')}</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={form.confirmPassword}
                      onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                      className="w-full border rounded-md px-3 py-2 pr-10"
                      placeholder={t('usersRoles.confirmPasswordPlaceholder', 'Confirm password') as string}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={handleSaveEdit}
                  disabled={!form.name || !form.phone || !form.username || updateUser.isLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60"
                >
                  {updateUser.isLoading ? t('common.loading') : t('common.save')}
                </button>
                <button 
                  onClick={() => setEditingUser(null)}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {t('usersRoles.confirmDelete', 'Confirmer la suppression')}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {t('usersRoles.deleteMessage', 'Êtes-vous sûr de vouloir supprimer l\'utilisateur')} <strong>{deletingUser.name}</strong> ? 
                  <br />
                  {t('usersRoles.deleteWarning', 'Cette action est irréversible.')}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleConfirmDelete}
                    disabled={deleteUserMutation.isLoading}
                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-60"
                  >
                    {deleteUserMutation.isLoading ? t('common.loading') : t('common.delete')}
                  </button>
                  <button
                    onClick={() => setDeletingUser(null)}
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


