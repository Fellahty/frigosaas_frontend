import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs, addDoc, doc, getDoc, deleteDoc, updateDoc } from '@/lib/db';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { Spinner } from '../../components/Spinner';

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  createdAt: Date;
  lastVisit?: Date;
}

interface CautionRecord {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  type: 'deposit' | 'refund';
  method: 'cash' | 'check' | 'bank_transfer';
  reference: string;
  reason: string;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  processedBy: string;
  notes?: string;
}

interface CautionSummary {
  client: Client;
  totalDeposits: number;
  totalRefunds: number;
  currentBalance: number;
  lastTransaction: Date | null;
  pendingAmount: number;
  records: CautionRecord[];
}

interface CautionManagementProps {
  onClose?: () => void;
}

const CautionManagement: React.FC<CautionManagementProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [editingRecord, setEditingRecord] = useState<CautionRecord | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);

  // Fetch clients
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients', tenantId],
    queryFn: async (): Promise<Client[]> => {
      if (!tenantId) return [];
      
      const clientsQuery = query(collection(db, 'tenants', tenantId, 'clients'));
      const snapshot = await getDocs(clientsQuery);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Unknown',
          email: data.email || '',
          phone: data.phone || '',
          company: data.company || '',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          lastVisit: data.lastVisit?.toDate?.(),
        };
      });
    },
    enabled: !!tenantId,
  });

  // Fetch deposit per crate from pricing settings
  const { data: depositPerCrate = 50 } = useQuery({
    queryKey: ['deposit-per-crate', tenantId],
    queryFn: async () => {
      if (!tenantId) return 50;
      try {
        const pricingRef = doc(db, 'tenants', tenantId, 'settings', 'pricing');
        const pricingDoc = await getDoc(pricingRef);
        if (pricingDoc.exists()) {
          const data = pricingDoc.data();
          return data?.caution_par_caisse || 50;
        }
        return 50;
      } catch (error) {
        console.error('Error fetching deposit per crate:', error);
        return 50;
      }
    },
    enabled: !!tenantId,
  });

  // Fetch caution records
  const { data: cautionRecords, isLoading: recordsLoading } = useQuery({
    queryKey: ['caution-records', tenantId],
    queryFn: async (): Promise<CautionRecord[]> => {
      if (!tenantId) return [];
      
      const recordsQuery = query(
        collection(db, 'caution_records'),
        where('tenantId', '==', tenantId)
      );
      const snapshot = await getDocs(recordsQuery);
      
      // Sort in memory instead of using orderBy to avoid index requirement
      const records = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          clientId: data.clientId || '',
          clientName: data.clientName || '',
          amount: data.amount || 0,
          type: data.type || 'deposit',
          method: data.method || 'cash',
          reference: data.reference || '',
          reason: data.reason || '',
          status: data.status || 'pending',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
          processedBy: data.processedBy || '',
          notes: data.notes || '',
        };
      });
      
      // Sort by createdAt descending
      return records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    enabled: !!tenantId,
  });

  // Process caution summaries
  const cautionSummaries: CautionSummary[] = useMemo(() => {
    if (!clients || !cautionRecords) return [];

    return clients.map(client => {
      const clientRecords = cautionRecords.filter(record => record.clientId === client.id);
      
      const totalDeposits = clientRecords
        .filter(record => record.type === 'deposit' && record.status === 'completed')
        .reduce((sum, record) => sum + record.amount, 0);
      
      const totalRefunds = clientRecords
        .filter(record => record.type === 'refund' && record.status === 'completed')
        .reduce((sum, record) => sum + record.amount, 0);
      
      const pendingAmount = clientRecords
        .filter(record => record.status === 'pending')
        .reduce((sum, record) => sum + record.amount, 0);
      
      const lastTransaction = clientRecords.length > 0 
        ? clientRecords[0].createdAt 
        : null;

      return {
        client,
        totalDeposits,
        totalRefunds,
        currentBalance: totalDeposits - totalRefunds,
        lastTransaction,
        pendingAmount,
        records: clientRecords,
      };
    });
  }, [clients, cautionRecords]);

  // Filter summaries
  const filteredSummaries = useMemo(() => {
    return cautionSummaries.filter(summary => {
      const matchesSearch = searchTerm === '' || 
        summary.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        summary.client.company?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });
  }, [cautionSummaries, searchTerm]);

  // Record caution mutation
  const recordCautionMutation = useMutation({
    mutationFn: async (data: {
      clientId: string;
      clientName: string;
      amount: number;
      type: 'deposit' | 'refund';
      method: 'cash' | 'check' | 'bank_transfer';
      reference: string;
      reason: string;
      notes?: string;
    }) => {
      const recordData = {
        ...data,
        tenantId,
        status: 'completed',
        processedBy: 'current_user', // This should be replaced with actual user ID
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log('Saving caution record:', recordData);
      const docRef = await addDoc(collection(db, 'caution_records'), recordData);
      console.log('Caution record saved with ID:', docRef.id);
      return docRef.id;
    },
    onSuccess: (docId) => {
      console.log('Caution record saved successfully:', docId);
      queryClient.invalidateQueries({ queryKey: ['caution-records', tenantId] });
      setShowRecordModal(false);
      setShowRefundModal(false);
      setSelectedClient(null);
    },
    onError: (error) => {
      console.error('Error saving caution record:', error);
    },
  });

  // Delete caution record mutation
  const deleteCautionMutation = useMutation({
    mutationFn: async (recordId: string) => {
      const recordRef = doc(db, 'caution_records', recordId);
      await deleteDoc(recordRef);
      return recordId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caution-records', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['cautionRecords', tenantId, selectedClient?.id] });
    },
    onError: (error) => {
      console.error('Error deleting caution record:', error);
    },
  });

  // Update caution record mutation
  const updateCautionMutation = useMutation({
    mutationFn: async (data: { id: string; amount: number; reference: string; reason: string; notes?: string }) => {
      const recordRef = doc(db, 'caution_records', data.id);
      await updateDoc(recordRef, {
        amount: data.amount,
        reference: data.reference,
        reason: data.reason,
        notes: data.notes || '',
        updatedAt: new Date(),
      });
      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caution-records', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['cautionRecords', tenantId, selectedClient?.id] });
      setEditingRecord(null);
    },
    onError: (error) => {
      console.error('Error updating caution record:', error);
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-MA', {
      style: 'currency',
      currency: 'MAD',
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (clientsLoading || recordsLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200/60 sticky top-0 z-10 backdrop-blur-xl bg-white/80">
        <div className="px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                {t('operations.cautionManagement', 'Gestion des cautions')}
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                {t('operations.cautionSubtitle', 'Suivi et gestion des dépôts de garantie clients')}
              </p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100/50">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">
                  {t('operations.totalDeposits', 'Total des dépôts')}
                </p>
                <p className="text-xl sm:text-3xl font-bold text-green-600 truncate">
                  {formatCurrency(cautionSummaries.reduce((sum, s) => sum + s.totalDeposits, 0))}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0 ml-3">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100/50">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">
                  {t('operations.totalRefunds', 'Total des remboursements')}
                </p>
                <p className="text-xl sm:text-3xl font-bold text-red-600 truncate">
                  {formatCurrency(cautionSummaries.reduce((sum, s) => sum + s.totalRefunds, 0))}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0 ml-3">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100/50">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">
                  {t('operations.currentBalance', 'Solde actuel')}
                </p>
                <p className="text-xl sm:text-3xl font-bold text-blue-600 truncate">
                  {formatCurrency(cautionSummaries.reduce((sum, s) => sum + s.currentBalance, 0))}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 ml-3">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Search, View Toggle, and Add Button */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
              <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder={t('operations.searchClients', 'Rechercher des clients...') as string}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-200 rounded-xl sm:rounded-2xl bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-2 text-xs font-medium rounded-md transition-all duration-200 ${
                viewMode === 'cards'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              {t('operations.cards', 'Cartes')}
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 text-xs font-medium rounded-md transition-all duration-200 ${
                viewMode === 'table'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0V6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              {t('operations.table', 'Tableau')}
            </button>
          </div>

          <button
            onClick={() => setShowRecordModal(true)}
            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-600 text-white rounded-xl sm:rounded-2xl hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="hidden sm:inline">{t('operations.recordCaution', 'Enregistrer caution')}</span>
            <span className="sm:hidden">{t('operations.add', 'Ajouter')}</span>
          </button>
        </div>

        {/* Client Caution Display */}
        {viewMode === 'cards' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {filteredSummaries.map((summary) => (
            <div 
              key={summary.client.id}
              className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100/50 hover:shadow-lg transition-all duration-300 group"
            >
              {/* Client Header */}
              <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="relative">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                    <span className="text-white font-bold text-sm sm:text-lg">
                      {summary.client.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 border-white ${
                    summary.currentBalance > 0 ? 'bg-green-500' : 'bg-gray-400'
                  }`}></div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate text-base sm:text-lg">
                    {summary.client.name}
                  </h3>
                  {summary.client.company && (
                    <p className="text-xs sm:text-sm text-gray-500 truncate">
                      {summary.client.company}
                    </p>
                  )}
                </div>
              </div>

              {/* Balance Summary */}
              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-gray-600">{t('operations.currentBalance', 'Solde actuel')}</span>
                  <span className={`text-lg sm:text-xl font-bold ${
                    summary.currentBalance > 0 ? 'text-green-600' : 
                    summary.currentBalance < 0 ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {formatCurrency(summary.currentBalance)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-gray-600">{t('operations.totalDeposits', 'Total dépôts')}</span>
                  <span className="text-base sm:text-lg font-semibold text-green-600">
                    {formatCurrency(summary.totalDeposits)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-gray-600">{t('operations.totalRefunds', 'Total remboursements')}</span>
                  <span className="text-base sm:text-lg font-semibold text-red-600">
                    {formatCurrency(summary.totalRefunds)}
                  </span>
                </div>

                {summary.pendingAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-gray-600">{t('operations.pendingAmount', 'Montant en attente')}</span>
                    <span className="text-base sm:text-lg font-semibold text-yellow-600">
                      {formatCurrency(summary.pendingAmount)}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedClient(summary.client);
                    setShowRecordModal(true);
                  }}
                  className="flex-1 px-3 sm:px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors text-xs sm:text-sm font-medium"
                >
                  {t('operations.deposit', 'Dépôt')}
                </button>
                <button
                  onClick={() => {
                    setSelectedClient(summary.client);
                    setShowRefundModal(true);
                  }}
                  className="flex-1 px-3 sm:px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors text-xs sm:text-sm font-medium"
                >
                  {t('operations.refund', 'Remboursement')}
                </button>
              </div>

              {/* Recent Records */}
              {summary.records && summary.records.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {t('operations.recentRecords', 'Dernières transactions')}
                  </h4>
                  <div className="space-y-1">
                    {summary.records.slice(0, 3).map((record) => (
                      <div key={record.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${
                              record.type === 'deposit' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {record.type === 'deposit' ? '+' : '-'}{formatCurrency(record.amount)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDate(record.createdAt)}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 truncate">
                            {Math.floor(record.amount / (depositPerCrate || 1))} {t('operations.crates', 'caisses')} - {record.reason}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditingRecord(record)}
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            title={t('operations.edit', 'Modifier') as string}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              setRecordToDelete(record.id);
                              setShowDeleteConfirm(true);
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title={t('operations.delete', 'Supprimer') as string}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Last Transaction */}
              {summary.lastTransaction && (
                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    {t('operations.lastTransaction', 'Dernière transaction')}: {formatDate(summary.lastTransaction)}
                  </p>
                </div>
              )}
            </div>
          ))}
            {filteredSummaries.length === 0 && (
              <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100/50 text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {t('operations.noCautionData', 'Aucune donnée de caution')}
                </h3>
                <p className="text-gray-500 text-lg">
                  {t('operations.noCautionDataDescription', 'Commencez par enregistrer des cautions pour vos clients')}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Table View */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('operations.client', 'Client')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('operations.totalDeposits', 'Total dépôts')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('operations.totalRefunds', 'Total remboursements')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('operations.currentBalance', 'Solde actuel')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('operations.lastTransaction', 'Dernière transaction')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('operations.actions', 'Actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSummaries.map((summary) => (
                    <tr key={summary.client.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                            <span className="text-white font-bold text-sm">
                              {summary.client.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {summary.client.name}
                            </div>
                            {summary.client.company && (
                              <div className="text-sm text-gray-500">
                                {summary.client.company}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">
                        {formatCurrency(summary.totalDeposits)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-red-600 font-semibold">
                        {formatCurrency(summary.totalRefunds)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`text-sm font-bold ${
                          summary.currentBalance > 0 ? 'text-green-600' : 
                          summary.currentBalance < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {formatCurrency(summary.currentBalance)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {summary.lastTransaction ? formatDate(summary.lastTransaction) : '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setSelectedClient(summary.client);
                              setShowRecordModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded text-xs"
                          >
                            {t('operations.deposit', 'Dépôt')}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedClient(summary.client);
                              setShowRefundModal(true);
                            }}
                            className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-2 py-1 rounded text-xs"
                          >
                            {t('operations.refund', 'Remboursement')}
                          </button>
                        </div>
                        {summary.records && summary.records.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {summary.records.slice(0, 2).map((record) => (
                              <div key={record.id} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs font-medium ${
                                      record.type === 'deposit' ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      {record.type === 'deposit' ? '+' : '-'}{formatCurrency(record.amount)}
                                    </span>
                                    <span className="text-xs text-gray-500 truncate">
                                      {Math.floor(record.amount / (depositPerCrate || 1))} {t('operations.crates', 'caisses')}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex gap-1 ml-2">
                                  <button
                                    onClick={() => setEditingRecord(record)}
                                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                    title={t('operations.edit', 'Modifier') as string}
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRecordToDelete(record.id);
                                      setShowDeleteConfirm(true);
                                    }}
                                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                    title={t('operations.delete', 'Supprimer') as string}
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredSummaries.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {t('operations.noCautionData', 'Aucune donnée de caution')}
                </h3>
                <p className="text-gray-500">
                  {t('operations.noCautionDataDescription', 'Commencez par enregistrer des cautions pour vos clients')}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Record Caution Modal */}
      {showRecordModal && (
        <CautionRecordModal
          client={selectedClient}
          clients={clients || []}
          type="deposit"
          onClose={() => {
            setShowRecordModal(false);
            setSelectedClient(null);
          }}
          onSave={(data) => recordCautionMutation.mutate(data)}
          isLoading={recordCautionMutation.isPending}
        />
      )}

      {/* Refund Modal */}
      {showRefundModal && (
        <CautionRecordModal
          client={selectedClient}
          clients={clients || []}
          type="refund"
          onClose={() => {
            setShowRefundModal(false);
            setSelectedClient(null);
          }}
          onSave={(data) => recordCautionMutation.mutate(data)}
          isLoading={recordCautionMutation.isPending}
        />
      )}

      {/* Client Selector Modal */}
      {showClientSelector && (
        <ClientSelectorModal
          clients={clients || []}
          onSelect={(client) => {
            setSelectedClient(client);
            setShowClientSelector(false);
            setShowRecordModal(true);
          }}
          onClose={() => setShowClientSelector(false)}
        />
      )}

      {/* Edit Record Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {t('operations.editRecord', 'Modifier la transaction')}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('operations.amount', 'Montant')}
                </label>
                <input
                  type="number"
                  value={editingRecord.amount}
                  onChange={(e) => setEditingRecord({...editingRecord, amount: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('operations.reference', 'Référence')}
                </label>
                <input
                  type="text"
                  value={editingRecord.reference}
                  onChange={(e) => setEditingRecord({...editingRecord, reference: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('operations.reason', 'Raison')}
                </label>
                <input
                  type="text"
                  value={editingRecord.reason}
                  onChange={(e) => setEditingRecord({...editingRecord, reason: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              {editingRecord.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('operations.notes', 'Notes')}
                  </label>
                  <textarea
                    value={editingRecord.notes}
                    onChange={(e) => setEditingRecord({...editingRecord, notes: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                  />
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingRecord(null)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t('operations.cancel', 'Annuler')}
              </button>
              <button
                onClick={() => {
                  if (editingRecord) {
                    updateCautionMutation.mutate({
                      id: editingRecord.id,
                      amount: editingRecord.amount,
                      reference: editingRecord.reference,
                      reason: editingRecord.reason,
                      notes: editingRecord.notes,
                    });
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                disabled={updateCautionMutation.isPending}
              >
                {updateCautionMutation.isPending ? t('operations.saving', 'Enregistrement...') : t('operations.save', 'Enregistrer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('operations.confirmDelete', 'Confirmer la suppression')}
                </h3>
                <p className="text-sm text-gray-500">
                  {t('operations.deleteWarning', 'Cette action ne peut pas être annulée.')}
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setRecordToDelete(null);
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t('operations.cancel', 'Annuler')}
              </button>
              <button
                onClick={() => {
                  if (recordToDelete) {
                    deleteCautionMutation.mutate(recordToDelete);
                    setShowDeleteConfirm(false);
                    setRecordToDelete(null);
                  }
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                disabled={deleteCautionMutation.isPending}
              >
                {deleteCautionMutation.isPending ? t('operations.deleting', 'Suppression...') : t('operations.delete', 'Supprimer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Caution Record Modal Component
interface CautionRecordModalProps {
  client: Client | null;
  clients: Client[];
  type: 'deposit' | 'refund';
  onClose: () => void;
  onSave: (data: any) => void;
  isLoading: boolean;
}

const CautionRecordModal: React.FC<CautionRecordModalProps> = ({
  client,
  clients,
  type,
  onClose,
  onSave,
  isLoading,
}) => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const [formData, setFormData] = useState({
    amount: '',
    method: 'check' as 'cash' | 'check' | 'bank_transfer',
    notes: '',
  });
  const [checkPhoto, setCheckPhoto] = useState<File | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(client);
  const [showClientSelector, setShowClientSelector] = useState(false);

  // Fetch reservations for the selected client (approved reservations with crates)
  const { data: reservations = [], isLoading: reservationsLoading } = useQuery({
    queryKey: ['reservations', tenantId, selectedClient?.id],
    queryFn: async () => {
      if (!tenantId || !selectedClient) return [];
      
      const reservationsQuery = query(
        collection(db, 'tenants', tenantId, 'reservations'),
        where('clientId', '==', selectedClient.id),
        where('status', '==', 'APPROVED')
      );
      const snapshot = await getDocs(reservationsQuery);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          clientId: data.clientId || '',
          clientName: data.clientName || '',
          reservedCrates: data.reservedCrates || 0,
          emptyCratesNeeded: data.emptyCratesNeeded || 0,
          status: data.status || 'APPROVED',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
          reference: data.reference || '',
        };
      });
    },
    enabled: !!tenantId && !!selectedClient,
  });

  // Fetch caution records for the selected client
  const { data: cautionRecords = [], isLoading: cautionRecordsLoading } = useQuery({
    queryKey: ['caution-records', tenantId, selectedClient?.id],
    queryFn: async () => {
      if (!tenantId || !selectedClient) return [];
      
      const recordsQuery = query(
        collection(db, 'caution_records'),
        where('tenantId', '==', tenantId),
        where('clientId', '==', selectedClient.id)
      );
      const snapshot = await getDocs(recordsQuery);
      
      // Filter by status in memory to avoid complex index
      return snapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            clientId: data.clientId || '',
            amount: data.amount || 0,
            type: data.type || 'deposit',
            status: data.status || 'completed',
            createdAt: data.createdAt?.toDate?.() || new Date(),
          };
        })
        .filter(record => record.status === 'completed');
    },
    enabled: !!tenantId && !!selectedClient,
  });


  // Fetch deposit per crate from pricing settings
  const { data: depositPerCrate = 50 } = useQuery({
    queryKey: ['deposit-per-crate', tenantId],
    queryFn: async () => {
      if (!tenantId) return 50;
      
      const pricingDoc = await getDoc(doc(db, 'tenants', tenantId, 'settings', 'pricing'));
      return pricingDoc.exists() ? (pricingDoc.data().caution_par_caisse || 50) : 50;
    },
    enabled: !!tenantId,
  });

  // Calculate reservation summary
  const reservationSummary = useMemo(() => {
    if (!selectedClient || reservations.length === 0) {
      return {
        totalReservedCrates: 0,
        depositRequired: 0,
        depositPaid: 0,
        remaining: 0,
      };
    }

    const totalReservedCrates = reservations.reduce((sum, res) => sum + res.reservedCrates, 0);
    const depositRequired = totalReservedCrates * depositPerCrate;
    
    // Calculate paid deposits from caution records
    const depositPaid = cautionRecords
      .filter(record => record.type === 'deposit')
      .reduce((sum, record) => sum + record.amount, 0);
    
    const remaining = depositRequired - depositPaid;

    return {
      totalReservedCrates,
      depositRequired,
      depositPaid,
      remaining,
    };
  }, [selectedClient, reservations, cautionRecords, depositPerCrate]);

  // Calculate how many crates the client can take based on caution amount
  const cratesCanTake = useMemo(() => {
    if (!formData.amount || !depositPerCrate) return 0;
    const cautionAmount = parseFloat(formData.amount);
    if (cautionAmount <= 0) return 0;
    return Math.floor(cautionAmount / depositPerCrate);
  }, [formData.amount, depositPerCrate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !formData.amount) return;

    onSave({
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      amount: parseFloat(formData.amount),
      type,
      method: formData.method,
      reference: `CAU-${Date.now()}`, // Generate a unique reference
      reason: type === 'deposit' ? 'Caution deposit' : 'Caution refund',
      notes: formData.notes,
      checkPhoto: checkPhoto,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              {type === 'deposit' 
                ? t('operations.recordDeposit', 'Enregistrer un dépôt')
                : t('operations.recordRefund', 'Enregistrer un remboursement')
              }
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Client Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('operations.client', 'Client')}
            </label>
            {selectedClient ? (
              <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                    <span className="text-white font-bold text-sm">
                      {selectedClient.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedClient.name}</h3>
                    {selectedClient.company && (
                      <p className="text-sm text-gray-500">{selectedClient.company}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowClientSelector(true)}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {t('operations.change', 'Changer')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowClientSelector(true)}
                className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 text-center"
              >
                <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-gray-600 font-medium">{t('operations.selectClient', 'Sélectionner un client')}</p>
              </button>
            )}
          </div>

                 {/* Crates in Use Info */}
                 {selectedClient && (
                   <div className="p-3 sm:p-4 bg-green-50 border border-green-200 rounded-xl">
                     <div className="flex items-center gap-2 mb-2">
                       <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                       </svg>
                       <h3 className="font-semibold text-green-800 text-sm sm:text-base">{t('operations.cratesInUse', 'Caisses a utiliser')}</h3>
                     </div>
                     {reservationsLoading || cautionRecordsLoading ? (
                       <div className="flex items-center justify-center py-3 sm:py-4">
                         <Spinner size="sm" />
                         <span className="ml-2 text-green-700 text-sm">{t('common.loading', 'Chargement...')}</span>
                       </div>
                     ) : (
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                         <div className="space-y-1">
                           <p className="text-green-700">{t('operations.totalReservedCrates', 'Total réservé')}: <span className="font-semibold">{reservationSummary.totalReservedCrates.toLocaleString()} caisses</span></p>
                           <p className="text-green-700">{t('operations.depositRequired', 'Cautions requises')}: <span className="font-semibold">{reservationSummary.depositRequired.toLocaleString('fr-MA', {
                             style: 'currency',
                             currency: 'MAD',
                           })}</span></p>
                         </div>
                         <div className="space-y-1">
                           <p className="text-green-700">{t('operations.depositPaid', 'Cautions payées')}: <span className="font-semibold">{reservationSummary.depositPaid.toLocaleString('fr-MA', {
                             style: 'currency',
                             currency: 'MAD',
                           })}</span></p>
             
                         </div>
                       </div>
                     )}
                   </div>
                 )}

          {/* Amount Input Section */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('operations.amount', 'Montant')} (MAD)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                  placeholder="0.00"
                  required
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-gray-500 text-sm">MAD</span>
                </div>
              </div>
            </div>

            {/* Caution Calculation Display */}
            {formData.amount && parseFloat(formData.amount) > 0 && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <h3 className="font-semibold text-blue-800 text-sm">
                    {t('operations.calculation', 'Calcul de caution')}
                  </h3>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-blue-700 text-sm">
                      {t('operations.cautionAmount', 'Montant de caution')}:
                    </span>
                    <span className="font-bold text-blue-900">
                      {parseFloat(formData.amount).toLocaleString('fr-MA', {
                        style: 'currency',
                        currency: 'MAD',
                      })}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-blue-700 text-sm">
                      {t('operations.cautionPerCrate', 'Caution par caisse')}:
                    </span>
                    <span className="font-semibold text-blue-900">
                      {depositPerCrate.toLocaleString('fr-MA', {
                        style: 'currency',
                        currency: 'MAD',
                      })}
                    </span>
                  </div>
                  
                  <div className="pt-2 border-t border-blue-200">
                    <div className="flex justify-between items-center">
                      <span className="text-blue-700 font-medium text-sm">
                        {t('operations.cratesCanTake', 'Caisses qu\'il peut prendre')}:
                      </span>
                      <span className="text-blue-900 font-bold text-lg">
                        {cratesCanTake.toLocaleString()} caisses
                      </span>
                    </div>
                  </div>
                  
                  {cratesCanTake > 0 && (
                    <div className="mt-2 p-2 bg-blue-100 rounded-lg">
                      <p className="text-blue-800 text-xs text-center">
                        {t('operations.calculationNote', 'Avec cette caution, le client peut prendre jusqu\'à')} <strong>{cratesCanTake.toLocaleString()}</strong> {t('operations.crates', 'caisses')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

     
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('operations.method', 'Méthode de paiement')}
            </label>
            <select
              value={formData.method}
              onChange={(e) => setFormData({ ...formData, method: e.target.value as any })}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
            >
              <option value="cash">{t('operations.cash', 'Espèces')}</option>
              <option value="check">{t('operations.check', 'Chèque')}</option>
              <option value="bank_transfer">{t('operations.bankTransfer', 'Virement bancaire')}</option>
            </select>
          </div>

          {/* Check Photo Upload */}
          {formData.method === 'check' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('operations.checkPhoto', 'Photo du chèque')} <span className="text-gray-500">({t('operations.optional', 'Optionnel')})</span>
              </label>
              <div className="flex justify-center px-4 py-3 border-2 border-gray-300 border-dashed rounded-lg hover:border-gray-400 transition-colors">
                {checkPhoto ? (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-600 truncate">{checkPhoto.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCheckPhoto(null)}
                      className="text-sm text-red-600 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50"
                    >
                      {t('operations.removePhoto', 'Supprimer')}
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <label htmlFor="check-photo" className="relative cursor-pointer flex items-center gap-2 text-sm text-blue-600 hover:text-blue-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{t('operations.takePhoto', 'Prendre une photo')}</span>
                      <input
                        id="check-photo"
                        name="check-photo"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setCheckPhoto(file);
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('operations.notes', 'Notes')}
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
              rows={3}
              placeholder={t('operations.notesPlaceholder', 'Notes additionnelles...') as string}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 sm:py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm sm:text-base"
            >
              {t('common.cancel', 'Annuler')}
            </button>
            <button
              type="submit"
              disabled={isLoading || !formData.amount || !selectedClient}
              className={`flex-1 px-4 py-2.5 sm:py-3 rounded-xl font-medium transition-colors text-sm sm:text-base ${
                type === 'deposit'
                  ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300'
                  : 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <Spinner size="sm" />
                  <span className="hidden sm:inline">{t('common.saving', 'Enregistrement...')}</span>
                  <span className="sm:hidden">{t('common.saving', 'Sauvegarde...')}</span>
                </div>
              ) : (
                type === 'deposit' 
                  ? t('operations.recordDeposit', 'Enregistrer le dépôt')
                  : t('operations.recordRefund', 'Enregistrer le remboursement')
              )}
            </button>
          </div>
        </form>

        {/* Client Selector Modal */}
        {showClientSelector && (
          <ClientSelectorModal
            clients={clients}
            onSelect={(client) => {
              setSelectedClient(client);
              setShowClientSelector(false);
            }}
            onClose={() => setShowClientSelector(false)}
          />
        )}
      </div>
    </div>
  );
};

// Client Selector Modal Component
interface ClientSelectorModalProps {
  clients: Client[];
  onSelect: (client: Client) => void;
  onClose: () => void;
}

const ClientSelectorModal: React.FC<ClientSelectorModalProps> = ({
  clients,
  onSelect,
  onClose,
}) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] sm:max-h-[80vh] overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              {t('operations.selectClient', 'Choisir un client')}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm sm:text-base text-gray-600 mt-2">
            {t('operations.selectClientDescription', 'Sélectionnez un client pour gérer ses cautions')}
          </p>
        </div>

        <div className="p-4 sm:p-6">
          {/* Search */}
          <div className="relative mb-4 sm:mb-6">
            <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
              <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder={t('operations.searchClients', 'Rechercher des clients...') as string}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
            />
          </div>

          {/* Client List */}
          <div className="max-h-96 overflow-y-auto space-y-2">
            {filteredClients.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {t('operations.noClientsFound', 'Aucun client trouvé')}
                </h3>
                <p className="text-gray-500">
                  {t('operations.noClientsFoundDescription', 'Aucun client ne correspond à votre recherche')}
                </p>
              </div>
            ) : (
              filteredClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => onSelect(client)}
                  className="w-full p-3 sm:p-4 text-left bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                      <span className="text-white font-bold text-sm sm:text-lg">
                        {client.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate text-base sm:text-lg group-hover:text-blue-600 transition-colors">
                        {client.name}
                      </h3>
                      {client.company && (
                        <p className="text-xs sm:text-sm text-gray-500 truncate">
                          {client.company}
                        </p>
                      )}
                      <p className="text-xs sm:text-sm text-gray-400 truncate">
                        {client.email}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-medium"
          >
            {t('common.cancel', 'Annuler')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CautionManagement;
