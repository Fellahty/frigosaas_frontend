import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, Timestamp, getDoc } from '@/lib/db';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/Card';
import { Spinner } from '../../../components/Spinner';
import { type PoolSettings } from '../../../types/settings';
import { useTenantId } from '../../../lib/hooks/useTenantId';
import { db } from '../../../lib/firebase';
import { toast } from 'react-hot-toast';

type CrateType = 'wood' | 'plastic';
type CrateColor = 'blue' | 'green' | 'red' | 'yellow' | 'white' | 'black' | 'gray' | 'brown';

interface CrateTypeConfig {
  id: string;
  name: string;
  type: CrateType;
  color: CrateColor;
  customName?: string;
  depositAmount: number;
  quantity: number;
  isActive: boolean;
  createdAt: Date;
}

interface PoolTabProps {
  onDirtyChange: (dirty: boolean) => void;
  onValidChange: (valid: boolean) => void;
}

export const PoolTab = forwardRef<{ save: () => Promise<void> }, PoolTabProps>(({ onDirtyChange, onValidChange }, ref) => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  
  const [poolTotal, setPoolTotal] = useState<number>(0);
  
  // Crate type management state
  const [editingCrateType, setEditingCrateType] = useState<CrateTypeConfig | null>(null);
  const [crateTypeForm, setCrateTypeForm] = useState<{
    name: string;
    type: CrateType;
    color: CrateColor;
    depositAmount: number;
    quantity: number;
  }>({
    name: '',
    type: 'plastic',
    color: 'blue',
    depositAmount: 50,
    quantity: 0,
  });

  // Fetch crate types
  const { data: crateTypes, isLoading: crateTypesLoading } = useQuery({
    queryKey: ['crate-types', tenantId],
    queryFn: async (): Promise<CrateTypeConfig[]> => {
      const q = query(collection(db, 'tenants', tenantId, 'crate-types'), where('isActive', '==', true));
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name || '',
          type: data.type || 'plastic',
          color: data.color || 'blue',
          customName: data.customName || '',
          depositAmount: Number(data.depositAmount) || 0,
          quantity: Number(data.quantity) || 0,
          isActive: data.isActive || true,
          createdAt: data.createdAt?.toDate?.() || new Date(),
        };
      });
    },
  });

  // Calculate total crate size from all crate types
  const totalCrateSize = crateTypes?.reduce((total, crateType) => total + crateType.quantity, 0) || 0;

  // Crate type mutations
  const addCrateType = useMutation({
    mutationFn: async (payload: typeof crateTypeForm) => {
      // Add crate type with quantity
      await addDoc(collection(db, 'tenants', tenantId, 'crate-types'), {
        name: payload.name,
        type: payload.type,
        color: payload.color,
        customName: payload.name, // Use name as customName
        depositAmount: payload.depositAmount,
        quantity: payload.quantity || 0, // Store the quantity
        isActive: true,
        createdAt: Timestamp.fromDate(new Date()),
      });

      // Update pool total if quantity > 0
      if (payload.quantity > 0) {
        const newPoolTotal = poolTotal + payload.quantity;
        await updateDoc(doc(db, 'tenants', tenantId, 'settings', 'pool'), {
          pool_vides_total: newPoolTotal,
        });
        setPoolTotal(newPoolTotal);
      }
    },
    onSuccess: async () => {
      // Invalidate and refetch all related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['crate-types', tenantId] }),
        queryClient.invalidateQueries({ queryKey: ['settings', tenantId] }),
        queryClient.refetchQueries({ queryKey: ['crate-types', tenantId] }),
      ]);
      
      setCrateTypeForm({
        name: '',
        type: 'plastic',
        color: 'blue',
        depositAmount: 50,
        quantity: 0,
      });
      toast.success('Type de caisse ajouté avec succès');
    },
    onError: (error) => {
      console.error('Error adding crate type:', error);
      toast.error('Erreur lors de l\'ajout du type de caisse');
    },
  });

  const updateCrateType = useMutation({
    mutationFn: async (payload: { id: string; updates: typeof crateTypeForm }) => {
      await updateDoc(doc(db, 'tenants', tenantId, 'crate-types', payload.id), payload.updates);
    },
    onSuccess: async () => {
      // Invalidate and refetch all related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['crate-types', tenantId] }),
        queryClient.refetchQueries({ queryKey: ['crate-types', tenantId] }),
      ]);
      
      setEditingCrateType(null);
      setCrateTypeForm({
        name: '',
        type: 'plastic',
        color: 'blue',
        depositAmount: 50,
        quantity: 0,
      });
      toast.success('Type de caisse modifié avec succès');
    },
  });

  const deleteCrateType = useMutation({
    mutationFn: async (id: string) => {
      await updateDoc(doc(db, 'tenants', tenantId, 'crate-types', id), { isActive: false });
    },
    onSuccess: async () => {
      // Invalidate and refetch all related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['crate-types', tenantId] }),
        queryClient.refetchQueries({ queryKey: ['crate-types', tenantId] }),
      ]);
      toast.success('Type de caisse supprimé avec succès');
    },
  });

  useEffect(() => {
    // Initialize with default value
    setPoolTotal(0);
    
    // Then try to load from Firestore
    loadSettings();
  }, [tenantId]);

  useEffect(() => {
    // Since we're not editing pool total, always mark as valid and not dirty
    onValidChange(true);
    onDirtyChange(false);
  }, [onDirtyChange, onValidChange]);

  const loadSettings = async () => {
    if (!tenantId) return;
    
    try {
      const docRef = doc(db, 'tenants', tenantId, 'settings', 'pool');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data() as PoolSettings;
        setPoolTotal(data.pool_vides_total || 0);
      }
    } catch (error) {
      console.error('Error loading pool settings:', error);
      // Don't show error toast, just use defaults
    }
  };

  const handleSave = async () => {
    // No-op since we're not editing pool total anymore
    // Pool total should be managed elsewhere (e.g., through operations)
    return;
  };

  // Expose save function to parent
  useImperativeHandle(ref, () => ({
    save: handleSave
  }), []);

  // Crate type management functions
  const handleAddCrateType = () => {
    console.log('Adding crate type:', crateTypeForm);
    addCrateType.mutate(crateTypeForm);
  };

  const handleEditCrateType = (crateType: CrateTypeConfig) => {
    setEditingCrateType(crateType);
    setCrateTypeForm({
      name: crateType.name,
      type: crateType.type,
      color: crateType.color,
      depositAmount: crateType.depositAmount,
      quantity: crateType.quantity || 0, // Show current quantity for editing
    });
  };

  const handleUpdateCrateType = () => {
    if (editingCrateType) {
      updateCrateType.mutate({
        id: editingCrateType.id,
        updates: crateTypeForm
      });
    }
  };

  const handleCancelCrateTypeEdit = () => {
    setEditingCrateType(null);
    setCrateTypeForm({
      name: '',
      type: 'plastic',
      color: 'blue',
      depositAmount: 50,
      quantity: 0,
    });
  };

  const handleDeleteCrateType = (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce type de caisse ?')) {
      deleteCrateType.mutate(id);
    }
  };

  if (crateTypesLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Modern Apple-Style Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
        {/* Total Crates Card */}
        <Card className="group bg-white border-0 shadow-sm hover:shadow-lg rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-300 transform hover:-translate-y-1">
          <div className="relative bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 sm:p-6 lg:p-8">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.05),transparent_50%)]"></div>
            
            <div className="relative">
              {/* Header */}
              <div className="flex items-start justify-between mb-4 sm:mb-6">
                <div className="flex-1 pr-2">
                  <h3 className="text-base sm:text-lg lg:text-xl font-bold text-slate-900 tracking-tight mb-1">
                    {t('settings.pool.stockTotal', 'Stock total')}
                  </h3>
                  <p className="text-xs sm:text-sm lg:text-base text-slate-600 font-medium">
                    {t('settings.pool.availableCrates', 'Caisses disponibles')}
                  </p>
                </div>
                
                {/* Icon */}
                <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0">
                  <span className="text-lg sm:text-xl lg:text-3xl">📦</span>
                </div>
              </div>
              
              {/* Main Number */}
              <div className="mb-3 sm:mb-4">
                <div className="text-2xl sm:text-3xl lg:text-5xl xl:text-6xl font-black text-slate-900 tracking-tight mb-1 sm:mb-2">
                  {totalCrateSize.toLocaleString()}
                </div>
                <div className="text-xs sm:text-sm lg:text-base text-slate-600 font-medium">
                  {t('settings.pool.cratesInStock', 'caisses en stock')}
                </div>
              </div>
              
              {/* Status Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${
                    totalCrateSize > 1000 
                      ? 'bg-green-500' 
                      : totalCrateSize > 100 
                        ? 'bg-yellow-500' 
                        : 'bg-red-500'
                  }`}></div>
                  <span className="text-xs sm:text-sm font-medium text-slate-600">
                    {totalCrateSize > 1000 
                      ? t('settings.pool.status.excellent', 'Excellent')
                      : totalCrateSize > 100 
                        ? t('settings.pool.status.good', 'Bon')
                        : t('settings.pool.status.low', 'Faible')
                    }
                  </span>
                </div>
                
                {crateTypeForm.quantity > 0 && (
                  <div className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
                    +{crateTypeForm.quantity}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Crate Types Card */}
        <Card className="group bg-white border-0 shadow-sm hover:shadow-lg rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-300 transform hover:-translate-y-1">
          <div className="relative bg-gradient-to-br from-blue-50 via-white to-blue-100 p-4 sm:p-6 lg:p-8">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(59,130,246,0.08),transparent_50%)]"></div>
            
            <div className="relative">
              {/* Header */}
              <div className="flex items-start justify-between mb-4 sm:mb-6">
                <div className="flex-1 pr-2">
                  <h3 className="text-base sm:text-lg lg:text-xl font-bold text-blue-900 tracking-tight mb-1">
                    {t('settings.pool.crateTypes', 'Types de caisses')}
                  </h3>
                  <p className="text-xs sm:text-sm lg:text-base text-blue-700 font-medium">
                    {t('settings.pool.configuredVarieties', 'Variétés configurées')}
                  </p>
                </div>
                
                {/* Icon */}
                <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0">
                  <span className="text-lg sm:text-xl lg:text-3xl">🏷️</span>
                </div>
              </div>
              
              {/* Main Number */}
              <div className="mb-3 sm:mb-4">
                <div className="text-2xl sm:text-3xl lg:text-5xl xl:text-6xl font-black text-blue-900 tracking-tight mb-1 sm:mb-2">
                  {crateTypes?.length || 0}
                </div>
                <div className="text-xs sm:text-sm lg:text-base text-blue-700 font-medium">
                  {t('settings.pool.typesConfigured', 'types configurés')}
                </div>
              </div>
              
              {/* Status Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${
                    (crateTypes?.length || 0) > 5 
                      ? 'bg-green-500' 
                      : (crateTypes?.length || 0) > 2 
                        ? 'bg-yellow-500' 
                        : 'bg-red-500'
                  }`}></div>
                  <span className="text-xs sm:text-sm font-medium text-blue-700">
                    {(crateTypes?.length || 0) > 5 
                      ? t('settings.pool.status.excellent', 'Excellent')
                      : (crateTypes?.length || 0) > 2 
                        ? t('settings.pool.status.good', 'Bon')
                        : t('settings.pool.status.low', 'Faible')
                    }
                  </span>
                </div>
                
                <div className="text-xs text-blue-600 font-medium">
                  {t('settings.pool.diversity', 'Diversité')}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Crate Types Management */}
      <Card>
        <div className="p-6">
          <div className="mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t('settings.pool.crateTypes', 'Types de caisses')}</h3>
              <p className="text-sm text-gray-600">{t('settings.pool.manageCrateTypes', 'Gérez les différents types de caisses et leurs propriétés')}</p>
            </div>
          </div>

          {/* Crate Type Form */}
          <div className="mb-4 sm:mb-6 bg-white border border-gray-200 rounded-xl sm:rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
              <h4 className="text-base sm:text-lg font-semibold text-gray-900">
                {editingCrateType ? t('settings.pool.editCrateType', `Modifier le type de caisse - ${editingCrateType.name}`) : t('settings.pool.addNewCrateType', 'Ajouter un nouveau type de caisse')}
              </h4>
              {editingCrateType && (
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  {t('settings.pool.currentStock', 'Stock actuel')}: {editingCrateType.quantity || 0} {t('settings.pool.crates', 'caisses')}
                </p>
              )}
            </div>
            
            <div className="p-4 sm:p-6">
              <div className={`grid grid-cols-1 sm:grid-cols-2 ${crateTypeForm.type === 'plastic' ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3 sm:gap-4 mb-4 sm:mb-6`}>
                {/* Nom */}
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700">{t('settings.pool.name', 'Nom')}</label>
                  <input
                    type="text"
                    value={crateTypeForm.name}
                    onChange={(e) => setCrateTypeForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder={t('settings.pool.namePlaceholder', 'Ex: Caisse standard')}
                  />
                </div>

                {/* Type */}
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700">{t('settings.pool.type', 'Type')}</label>
                  <select
                    value={crateTypeForm.type}
                    onChange={(e) => {
                      const newType = e.target.value as CrateType;
                      setCrateTypeForm(f => ({ 
                        ...f, 
                        type: newType,
                        // Reset color to default when switching to wood
                        color: newType === 'wood' ? 'brown' : f.color
                      }));
                    }}
                    className="w-full border border-gray-300 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
                  >
                    <option value="plastic">🟦 {t('settings.pool.plastic', 'Plastique')}</option>
                    <option value="wood">🟫 {t('settings.pool.wood', 'Bois')}</option>
                  </select>
                </div>

                {/* Couleur - Only show for plastic */}
                {crateTypeForm.type === 'plastic' && (
                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700">{t('settings.pool.color', 'Couleur')}</label>
                    <select
                      value={crateTypeForm.color}
                      onChange={(e) => setCrateTypeForm(f => ({ ...f, color: e.target.value as CrateColor }))}
                      className="w-full border border-gray-300 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
                    >
                      <option value="blue">🔵 {t('settings.pool.colors.blue', 'Bleu')}</option>
                      <option value="green">🟢 {t('settings.pool.colors.green', 'Vert')}</option>
                      <option value="red">🔴 {t('settings.pool.colors.red', 'Rouge')}</option>
                      <option value="yellow">🟡 {t('settings.pool.colors.yellow', 'Jaune')}</option>
                      <option value="white">⚪ {t('settings.pool.colors.white', 'Blanc')}</option>
                      <option value="black">⚫ {t('settings.pool.colors.black', 'Noir')}</option>
                      <option value="gray">⚫ {t('settings.pool.colors.gray', 'Gris')}</option>
                      <option value="brown">🟤 {t('settings.pool.colors.brown', 'Marron')}</option>
                    </select>
                  </div>
                )}

                {/* Caution */}
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700">{t('settings.pool.deposit', 'Caution (MAD)')}</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={crateTypeForm.depositAmount}
                      onChange={(e) => setCrateTypeForm(f => ({ ...f, depositAmount: Number(e.target.value) }))}
                      className="w-full border border-gray-300 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 pr-6 sm:pr-8 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="0"
                    />
                    <span className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs sm:text-sm font-medium">
                      MAD
                    </span>
                  </div>
                </div>
              </div>

              {/* Quantity Input for Total Calculation */}
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="flex-1">
                    <h5 className="text-xs sm:text-sm font-semibold text-blue-900 mb-1">
                      {editingCrateType ? t('settings.pool.modifyQuantity', 'Modifier la quantité') : t('settings.pool.quantityToAdd', 'Quantité à ajouter')}
                    </h5>
                    <p className="text-xs text-blue-700">
                      {editingCrateType 
                        ? t('settings.pool.modifyStockDescription', 'Modifiez le nombre de caisses en stock')
                        : t('settings.pool.addToPoolDescription', 'Entrez le nombre de caisses à ajouter au pool total')
                      }
                    </p>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={crateTypeForm.quantity}
                        onChange={(e) => setCrateTypeForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                        className="w-16 sm:w-20 border border-blue-300 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
                        placeholder="0"
                        min="0"
                      />
                      <span className="text-xs sm:text-sm font-medium text-blue-900">{t('settings.pool.crates', 'caisses')}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm sm:text-lg font-bold text-blue-900">
                        {crateTypeForm.quantity}
                      </div>
                      <div className="text-xs text-blue-700">
                        {editingCrateType 
                          ? `${t('settings.pool.stock', 'Stock')}: ${crateTypeForm.quantity}`
                          : t('settings.pool.totalCrates', 'Total caisses')
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-end">
                <button
                  onClick={editingCrateType ? handleUpdateCrateType : handleAddCrateType}
                  disabled={!crateTypeForm.name.trim() || addCrateType.isPending || updateCrateType.isPending}
                  className="group relative bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
                >
                  <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                    {addCrateType.isPending || updateCrateType.isPending ? (
                      <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <span className="text-sm sm:text-lg">{editingCrateType ? '✏️' : '➕'}</span>
                    )}
                    <span>{editingCrateType ? 'Modifier' : 'Ajouter'}</span>
                  </div>
                </button>
                {editingCrateType && (
                  <button
                    onClick={handleCancelCrateTypeEdit}
                    className="bg-gray-100 text-gray-700 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm hover:bg-gray-200 transition-all duration-300 transform hover:scale-105 active:scale-95"
                  >
                    ❌ Annuler
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Crate Types List */}
          <div>
            <h4 className="text-md font-semibold text-gray-900 mb-4">Stock de caisses</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {(crateTypes || []).map((ct) => (
                <div key={ct.id} className="group bg-white border border-gray-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-5 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                      {/* Crate Icon with Color */}
                      <div className="flex-shrink-0">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-sm ${
                          ct.type === 'wood' ? 'bg-amber-100' :
                          ct.color === 'blue' ? 'bg-blue-100' :
                          ct.color === 'green' ? 'bg-green-100' :
                          ct.color === 'red' ? 'bg-red-100' :
                          ct.color === 'yellow' ? 'bg-yellow-100' :
                          ct.color === 'white' ? 'bg-gray-100' :
                          ct.color === 'black' ? 'bg-gray-800' :
                          ct.color === 'gray' ? 'bg-gray-100' :
                          ct.color === 'brown' ? 'bg-amber-100' : 'bg-gray-100'
                        }`}>
                          <div className="text-lg sm:text-xl lg:text-2xl">
                            {ct.type === 'wood' ? '🟫' : 
                             ct.color === 'blue' ? '🔵' :
                             ct.color === 'green' ? '🟢' :
                             ct.color === 'red' ? '🔴' :
                             ct.color === 'yellow' ? '🟡' :
                             ct.color === 'white' ? '⚪' :
                             ct.color === 'black' ? '⚫' :
                             ct.color === 'gray' ? '⚫' :
                             ct.color === 'brown' ? '🟤' : '📦'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h5 className="font-bold text-gray-900 text-sm sm:text-base lg:text-lg mb-1 truncate">
                          {ct.customName || ct.name}
                        </h5>
                        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                          <span className="capitalize font-medium">{ct.type === 'wood' ? 'Bois' : 'Plastique'}</span>
                          {ct.type === 'plastic' && (
                            <>
                              <span>•</span>
                              <span className="capitalize">{ct.color}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-1 sm:gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
                      <button
                        onClick={() => handleEditCrateType(ct)}
                        className="p-1.5 sm:p-2 text-blue-600 hover:bg-blue-50 rounded-lg sm:rounded-xl transition-colors duration-200"
                        title="Modifier"
                      >
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteCrateType(ct.id)}
                        className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 rounded-lg sm:rounded-xl transition-colors duration-200"
                        title="Supprimer"
                      >
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {/* Details */}
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex justify-between items-center p-2 sm:p-3 bg-gray-50 rounded-lg sm:rounded-xl">
                      <span className="text-xs sm:text-sm font-medium text-gray-600">{t('settings.pool.unitDeposit', 'Caution unitaire')}</span>
                      <span className="text-sm sm:text-base lg:text-lg font-bold text-gray-900">{ct.depositAmount} MAD</span>
                    </div>
                    <div className="flex justify-between items-center text-xs sm:text-sm text-gray-500">
                      <span className="truncate">{t('settings.pool.createdOn', 'Créé le')} {ct.createdAt.toLocaleDateString()}</span>
                      <span className="text-blue-600 font-medium flex-shrink-0 ml-2">
                        {ct.quantity || 0} {t('settings.pool.inStock', 'en stock')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
});
