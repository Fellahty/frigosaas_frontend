import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, orderBy, limit, getDocs, addDoc, Timestamp, doc, getDoc } from '@/lib/db';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { Card } from '../../components/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/Table';
import { Spinner } from '../../components/Spinner';
import { logCreate, logUpdate } from '../../lib/logging';
import { PaymentRecordingModal } from './PaymentRecordingModal';
import { CashOutModal } from './CashOutModal';
import { DayClosureModal } from './DayClosureModal';
import { UpcomingPayments } from './UpcomingPayments';
import { useTranslation } from 'react-i18next';
import { formatTimestampWithTime } from '../../lib/dateUtils';

// Types
interface CashMovement {
  id: string;
  type: 'in' | 'out';
  reason: string;
  clientId?: string;
  clientName?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  amount: number;
  paymentMethod: 'cash' | 'check' | 'transfer' | 'card';
  reference: string;
  userId: string;
  userName: string;
  createdAt: Timestamp;
  notes?: string;
}

interface PendingCollection {
  id: string;
  clientId: string;
  clientName: string;
  invoiceId: string;
  invoiceNumber: string;
  dueDate: Timestamp;
  amountDue: number;
  status: 'pending' | 'overdue';
}

interface Caution {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  type: 'blocked' | 'to_refund';
  createdAt: Timestamp;
  loanId?: string;
}

interface CashOverview {
  currentBalance: number;
  todayReceipts: number;
  todayPayments: number;
  pendingCollections: number;
  blockedCautions: number;
  cautionsToRefund: number;
}

const CaissePage: React.FC = () => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'upcoming' | 'pending' | 'journal' | 'reports'>('overview');
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [isCashOut, setIsCashOut] = useState(false);
  const [isClosingDay, setIsClosingDay] = useState(false);

  // Fetch general settings to get initial cash balance
  const { data: generalSettings } = useQuery({
    queryKey: ['general-settings', tenantId],
    queryFn: async () => {
      const docRef = doc(db, 'tenants', tenantId, 'settings', 'site');
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() : { initial_cash_balance: 0 };
    },
  });

  // Fetch cash overview
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['cash-overview', tenantId, generalSettings?.initial_cash_balance],
    enabled: !!generalSettings, // Only run when general settings are loaded
    queryFn: async (): Promise<CashOverview> => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get today's movements
      const movementsQuery = query(
        collection(db, 'tenants', tenantId, 'cashMovements'),
        where('createdAt', '>=', Timestamp.fromDate(today)),
        where('createdAt', '<', Timestamp.fromDate(tomorrow))
      );
      const movementsSnapshot = await getDocs(movementsQuery);
      const todayMovements = movementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashMovement));

      // Get pending collections (next 7 days)
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const pendingQuery = query(
        collection(db, 'tenants', tenantId, 'pendingCollections'),
        where('dueDate', '<=', Timestamp.fromDate(nextWeek))
      );
      const pendingSnapshot = await getDocs(pendingQuery);
      const pendingCollections = pendingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingCollection));

      // Get cautions
      const cautionsQuery = query(collection(db, 'tenants', tenantId, 'cautions'));
      const cautionsSnapshot = await getDocs(cautionsQuery);
      const cautions = cautionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Caution));

      // Calculate overview
      const todayReceipts = todayMovements
        .filter(m => m.type === 'in')
        .reduce((sum, m) => sum + m.amount, 0);
      
      const todayPayments = todayMovements
        .filter(m => m.type === 'out')
        .reduce((sum, m) => sum + m.amount, 0);

      const pendingAmount = pendingCollections
        .reduce((sum, p) => sum + p.amountDue, 0);

      const blockedCautions = cautions
        .filter(c => c.type === 'blocked')
        .reduce((sum, c) => sum + c.amount, 0);

      const cautionsToRefund = cautions
        .filter(c => c.type === 'to_refund')
        .reduce((sum, c) => sum + c.amount, 0);

      // Get initial cash balance from settings
      const initialBalance = generalSettings?.initial_cash_balance || 0;
      
      // Calculate current balance (initial + receipts - payments)
      const currentBalance = initialBalance + todayReceipts - todayPayments;

      return {
        currentBalance,
        todayReceipts,
        todayPayments,
        pendingCollections: pendingAmount,
        blockedCautions,
        cautionsToRefund,
      };
    },
  });

  // Fetch pending collections
  const { data: pendingCollections, isLoading: pendingLoading } = useQuery({
    queryKey: ['pending-collections', tenantId],
    queryFn: async (): Promise<PendingCollection[]> => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const q = query(
        collection(db, 'tenants', tenantId, 'pendingCollections'),
        where('dueDate', '<=', Timestamp.fromDate(nextWeek)),
        orderBy('dueDate', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingCollection));
    },
  });

  // Fetch journal (last 30 movements)
  const { data: journal, isLoading: journalLoading } = useQuery({
    queryKey: ['cash-journal', tenantId],
    queryFn: async (): Promise<CashMovement[]> => {
      const q = query(
        collection(db, 'tenants', tenantId, 'cashMovements'),
        orderBy('createdAt', 'desc'),
        limit(30)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashMovement));
    },
  });

  // Record payment mutation
  const recordPayment = useMutation({
    mutationFn: async (data: { clientId: string; invoiceIds: string[]; amount: number; paymentMethod: string; reference: string; clientName?: string }) => {
      const movementData = {
        type: 'in' as const,
        reason: 'Paiement client',
        clientId: data.clientId,
        clientName: data.clientName || 'Client inconnu',
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        reference: data.reference,
        userId: 'current-user', // Would get from auth context
        userName: 'Utilisateur actuel',
        createdAt: Timestamp.fromDate(new Date()),
        notes: `Paiement pour ${data.invoiceIds.length} facture(s)`,
      };

      const docRef = await addDoc(collection(db, 'tenants', tenantId, 'cashMovements'), movementData);
      await logCreate('cashMovement', docRef.id, `Paiement enregistré: ${data.amount} MAD`, 'admin', 'Administrateur');
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-overview', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['cash-journal', tenantId] });
      setIsRecordingPayment(false);
    },
  });


  // Cash out mutation
  const cashOut = useMutation({
    mutationFn: async (data: { amount: number; reason: string; reference: string }) => {
      const movementData = {
        type: 'out' as const,
        reason: data.reason,
        amount: data.amount,
        paymentMethod: 'cash' as const,
        reference: data.reference,
        userId: 'current-user',
        userName: 'Utilisateur actuel',
        createdAt: Timestamp.fromDate(new Date()),
        notes: 'Sortie de caisse',
      };

      const docRef = await addDoc(collection(db, 'tenants', tenantId, 'cashMovements'), movementData);
      await logCreate('cashMovement', docRef.id, `Sortie de caisse: ${data.amount} MAD`, 'admin', 'Administrateur');
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-overview', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['cash-journal', tenantId] });
      setIsCashOut(false);
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (timestamp: Timestamp | null | undefined) => {
    return formatTimestampWithTime(timestamp);
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash':
        return '💵';
      case 'check':
        return '📄';
      case 'transfer':
        return '🏦';
      case 'card':
        return '💳';
      default:
        return '💰';
    }
  };

  const getMovementTypeColor = (type: 'in' | 'out') => {
    return type === 'in' ? 'text-green-600' : 'text-red-600';
  };

  const getMovementTypeIcon = (type: 'in' | 'out') => {
    return type === 'in' ? '↗️' : '↘️';
  };

  // Export functions
  const exportToCSV = () => {
    if (!journal || journal.length === 0) {
      alert(t('caisse.noDataToExport', 'Aucune donnée à exporter'));
      return;
    }

    const headers = [
      t('caisse.dateTime', 'Date/Heure'),
      t('caisse.type', 'Type'),
      t('caisse.reason', 'Raison'),
      t('caisse.client', 'Client'),
      t('caisse.invoice', 'Facture'),
      t('caisse.amount', 'Montant'),
      t('caisse.paymentMethod', 'Mode'),
      t('caisse.reference', 'Réf'),
      t('caisse.user', 'Utilisateur')
    ];

    const csvData = journal.map(movement => [
      formatDate(movement.createdAt),
      movement.type === 'in' ? t('caisse.entry', 'Entrée') : t('caisse.exit', 'Sortie'),
      movement.reason,
      movement.clientName || '',
      movement.invoiceNumber || '',
      movement.type === 'in' ? `+${formatCurrency(movement.amount)}` : `-${formatCurrency(movement.amount)}`,
      movement.paymentMethod,
      movement.reference,
      movement.userName
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `journal-caisse-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    if (!journal || journal.length === 0) {
      alert(t('caisse.noDataToExport', 'Aucune donnée à exporter'));
      return;
    }

    // Create a simple HTML table for PDF generation
    const tableHTML = `
      <html>
        <head>
          <title>Journal de Caisse - ${new Date().toLocaleDateString('fr-FR')}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .amount-positive { color: green; }
            .amount-negative { color: red; }
            .header { text-align: center; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Journal de Caisse</h1>
            <p>Période: ${new Date().toLocaleDateString('fr-FR')}</p>
            <p>Total des mouvements: ${journal.length}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>${t('caisse.dateTime', 'Date/Heure')}</th>
                <th>${t('caisse.type', 'Type')}</th>
                <th>${t('caisse.reason', 'Raison')}</th>
                <th>${t('caisse.client', 'Client')}</th>
                <th>${t('caisse.invoice', 'Facture')}</th>
                <th>${t('caisse.amount', 'Montant')}</th>
                <th>${t('caisse.paymentMethod', 'Mode')}</th>
                <th>${t('caisse.reference', 'Réf')}</th>
                <th>${t('caisse.user', 'Utilisateur')}</th>
              </tr>
            </thead>
            <tbody>
              ${journal.map(movement => `
                <tr>
                  <td>${formatDate(movement.createdAt)}</td>
                  <td>${movement.type === 'in' ? t('caisse.entry', 'Entrée') : t('caisse.exit', 'Sortie')}</td>
                  <td>${movement.reason}</td>
                  <td>${movement.clientName || ''}</td>
                  <td>${movement.invoiceNumber || ''}</td>
                  <td class="${movement.type === 'in' ? 'amount-positive' : 'amount-negative'}">
                    ${movement.type === 'in' ? '+' : '-'}${formatCurrency(movement.amount)}
                  </td>
                  <td>${movement.paymentMethod}</td>
                  <td>${movement.reference}</td>
                  <td>${movement.userName}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(tableHTML);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  if (overviewLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-4 sm:space-y-6">
      {/* Header - Apple Style */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 rounded-2xl p-4 sm:p-6 border border-white/50 shadow-lg shadow-gray-200/50">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5"></div>
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-400/10 to-indigo-400/10 rounded-full -translate-y-12 translate-x-12"></div>
        <div className="absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr from-indigo-400/10 to-blue-400/10 rounded-full translate-y-10 -translate-x-10"></div>
        
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
            {/* Title Section */}
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                <span className="text-xl">💰</span>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">{t('caisse.title', 'Trésorerie')}</h1>
                <p className="text-gray-600 text-xs sm:text-sm">{t('caisse.subtitle', 'Gestion de la caisse et suivi des encaissements')}</p>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setIsRecordingPayment(true)}
                className="group relative px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700 flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <span className="text-sm sm:text-base relative z-10">💵</span>
                <span className="text-xs font-semibold relative z-10 hidden sm:inline">{t('caisse.registerPayment', 'Enregistrer paiement')}</span>
                <span className="text-xs font-semibold relative z-10 sm:hidden">{t('caisse.registerPayment', 'Paiement')}</span>
              </button>
              
              <button
                onClick={() => setIsCashOut(true)}
                className="group relative px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 text-white rounded-xl hover:from-orange-600 hover:via-orange-700 hover:to-red-600 flex items-center justify-center space-x-2 shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <span className="text-sm sm:text-base relative z-10">📤</span>
                <span className="text-xs font-semibold relative z-10 hidden sm:inline">{t('caisse.cashOutTitle', 'Sortie de caisse')}</span>
                <span className="text-xs font-semibold relative z-10 sm:hidden">{t('caisse.cashOutTitle', 'Sortie')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        <Card className="p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 border-0 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-blue-600/70 uppercase tracking-wider">{t('caisse.currentBalance', 'Solde actuel')}</p>
              <p className="text-lg sm:text-xl font-semibold text-gray-900 mt-1 sm:mt-2 tracking-tight">
                {formatCurrency(overview?.currentBalance || 0)}
              </p>
              {generalSettings?.initial_cash_balance && generalSettings.initial_cash_balance > 0 && (
                <p className="text-xs text-blue-500/60 mt-1">
                  {t('caisse.initialBalance', 'Solde initial')}: {formatCurrency(generalSettings.initial_cash_balance)}
                </p>
              )}
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/60 backdrop-blur-sm rounded-lg sm:rounded-xl flex items-center justify-center shadow-sm self-end sm:self-auto">
              <span className="text-sm sm:text-lg">💰</span>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 bg-gradient-to-br from-green-50 to-green-100/50 border-0 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-green-600/70 uppercase tracking-wider">{t('caisse.todayReceipts', 'Encaissements aujourd\'hui')}</p>
              <p className="text-lg sm:text-xl font-semibold text-gray-900 mt-1 sm:mt-2 tracking-tight">
                {formatCurrency(overview?.todayReceipts || 0)}
              </p>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/60 backdrop-blur-sm rounded-lg sm:rounded-xl flex items-center justify-center shadow-sm self-end sm:self-auto">
              <span className="text-sm sm:text-lg">↗️</span>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 bg-gradient-to-br from-red-50 to-red-100/50 border-0 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-red-600/70 uppercase tracking-wider">{t('caisse.todayPayments', 'Décaissements aujourd\'hui')}</p>
              <p className="text-lg sm:text-xl font-semibold text-gray-900 mt-1 sm:mt-2 tracking-tight">
                {formatCurrency(overview?.todayPayments || 0)}
              </p>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/60 backdrop-blur-sm rounded-lg sm:rounded-xl flex items-center justify-center shadow-sm self-end sm:self-auto">
              <span className="text-sm sm:text-lg">↘️</span>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 bg-gradient-to-br from-orange-50 to-orange-100/50 border-0 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-orange-600/70 uppercase tracking-wider">{t('caisse.toCollect', 'À encaisser')} (7 {t('caisse.days', 'jours')})</p>
              <p className="text-lg sm:text-xl font-semibold text-gray-900 mt-1 sm:mt-2 tracking-tight">
                {formatCurrency(overview?.pendingCollections || 0)}
              </p>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/60 backdrop-blur-sm rounded-lg sm:rounded-xl flex items-center justify-center shadow-sm self-end sm:self-auto">
              <span className="text-sm sm:text-lg">⏰</span>
            </div>
          </div>
        </Card>
      </div>


      {/* Tabs */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl p-1.5 sm:p-2 shadow-sm border border-gray-100/50">
        <nav className="flex flex-wrap gap-1">
          {[
            { id: 'overview', label: t('caisse.overview', 'Vue d\'ensemble'), icon: '📊', shortLabel: t('caisse.overview', 'Vue') },
            { id: 'upcoming', label: t('caisse.upcomingPayments', 'Prochains Paiements'), icon: '💰', shortLabel: t('caisse.upcomingPayments', 'Paiements') },
            { id: 'pending', label: t('caisse.pendingCollections', 'À encaisser'), icon: '⏰', shortLabel: t('caisse.pendingCollections', 'Encaisser') },
            { id: 'journal', label: t('caisse.journal', 'Journal'), icon: '📋', shortLabel: t('caisse.journal', 'Journal') },
            { id: 'reports', label: t('caisse.reports', 'Rapports'), icon: '📈', shortLabel: t('caisse.reports', 'Rapports') },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg font-medium text-xs flex items-center space-x-1.5 sm:space-x-2 whitespace-nowrap transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              <span className="text-xs sm:text-sm">{tab.icon}</span>
              <span className="hidden xs:inline sm:hidden">{tab.shortLabel}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4 sm:space-y-6">
          <Card className="p-4 sm:p-6 bg-white/80 backdrop-blur-sm border-0 shadow-sm">
            <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 text-gray-900">{t('caisse.quickActions', 'Actions rapides')}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
              <button
                onClick={() => setIsRecordingPayment(true)}
                className="group p-3 sm:p-4 lg:p-6 bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200/50 rounded-xl sm:rounded-2xl hover:from-blue-100 hover:to-blue-200/50 hover:border-blue-300/50 transition-all duration-200 text-center hover:shadow-md hover:scale-105"
              >
                <div className="text-2xl sm:text-3xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-200">💵</div>
                <div className="text-xs sm:text-sm font-medium text-gray-700 group-hover:text-gray-900">{t('caisse.registerPayment', 'Enregistrer un paiement')}</div>
                <div className="text-xs text-gray-500 mt-1 hidden sm:block">{t('caisse.clientInvoice', 'Client → Facture(s)')}</div>
              </button>


              <button
                onClick={() => setIsCashOut(true)}
                className="group p-3 sm:p-4 lg:p-6 bg-gradient-to-br from-orange-50 to-orange-100/50 border border-orange-200/50 rounded-xl sm:rounded-2xl hover:from-orange-100 hover:to-orange-200/50 hover:border-orange-300/50 transition-all duration-200 text-center hover:shadow-md hover:scale-105"
              >
                <div className="text-2xl sm:text-3xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-200">📤</div>
                <div className="text-xs sm:text-sm font-medium text-gray-700 group-hover:text-gray-900">{t('caisse.cashOutTitle', 'Sortie de caisse')}</div>
                <div className="text-xs text-gray-500 mt-1 hidden sm:block">{t('caisse.expense', 'Dépense')}</div>
              </button>

              <button
                onClick={() => setIsClosingDay(true)}
                className="group p-3 sm:p-4 lg:p-6 bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-200/50 rounded-xl sm:rounded-2xl hover:from-purple-100 hover:to-purple-200/50 hover:border-purple-300/50 transition-all duration-200 text-center hover:shadow-md hover:scale-105"
              >
                <div className="text-2xl sm:text-3xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-200">🔒</div>
                <div className="text-xs sm:text-sm font-medium text-gray-700 group-hover:text-gray-900">{t('caisse.dayClosure', 'Clôture de journée')}</div>
                <div className="text-xs text-gray-500 mt-1 hidden sm:block">{t('caisse.lockJournal', 'Verrouiller le journal')}</div>
              </button>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'upcoming' && (
        <UpcomingPayments />
      )}

      {activeTab === 'pending' && (
        <Card>
          <div className="p-4 md:p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
              <h3 className="text-lg font-semibold">{t('caisse.pendingCollections', 'À encaisser')} (échéances)</h3>
              <div className="flex flex-wrap gap-2">
                <button className="px-3 py-1 text-xs sm:text-sm bg-red-100 text-red-700 rounded-full">
                  {t('caisse.overdue', 'En retard')}
                </button>
                <button className="px-3 py-1 text-xs sm:text-sm bg-blue-100 text-blue-700 rounded-full">
                  {t('caisse.thisWeek', 'Cette semaine')}
                </button>
              </div>
            </div>
          </div>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>{t('caisse.client', 'Client')}</TableHeader>
                <TableHeader>{t('caisse.invoice', 'Facture')}</TableHeader>
                <TableHeader>{t('caisse.dueDate', 'Échéance')}</TableHeader>
                <TableHeader>{t('caisse.amountDue', 'Montant dû')}</TableHeader>
                <TableHeader>{t('caisse.actions', 'Actions')}</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {pendingLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Spinner />
                  </TableCell>
                </TableRow>
              ) : pendingCollections?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    {t('caisse.noPendingDue', 'Aucune échéance en attente')}
                  </TableCell>
                </TableRow>
              ) : (
                pendingCollections?.map((collection) => (
                  <TableRow key={collection.id}>
                    <TableCell>{collection.clientName}</TableCell>
                    <TableCell className="font-mono">{collection.invoiceNumber}</TableCell>
                    <TableCell>{formatDate(collection.dueDate)}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(collection.amountDue)}</TableCell>
                    <TableCell>
                      <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                        {t('caisse.collect', 'Encaisser')}
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {activeTab === 'journal' && (
        <Card>
          <div className="p-4 md:p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
              <h3 className="text-lg font-semibold">{t('caisse.journal', 'Journal')} (30 derniers mouvements)</h3>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={exportToCSV}
                  className="px-3 py-1 text-xs sm:text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors duration-200"
                >
                  {t('caisse.exportCSV', 'Exporter CSV')}
                </button>
                <button 
                  onClick={exportToPDF}
                  className="px-3 py-1 text-xs sm:text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors duration-200"
                >
                  {t('caisse.exportPDF', 'Exporter PDF')}
                </button>
              </div>
            </div>
          </div>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>{t('caisse.dateTime', 'Date/Heure')}</TableHeader>
                <TableHeader>{t('caisse.type', 'Type')}</TableHeader>
                <TableHeader>{t('caisse.reason', 'Raison')}</TableHeader>
                <TableHeader>{t('caisse.clientInvoice', 'Client/Facture')}</TableHeader>
                <TableHeader>{t('caisse.amount', 'Montant')}</TableHeader>
                <TableHeader>{t('caisse.paymentMethod', 'Mode')}</TableHeader>
                <TableHeader>{t('caisse.reference', 'Réf')}</TableHeader>
                <TableHeader>{t('caisse.user', 'Utilisateur')}</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {journalLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Spinner />
                  </TableCell>
                </TableRow>
              ) : journal?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    {t('caisse.noMovements', 'Aucun mouvement enregistré')}
                  </TableCell>
                </TableRow>
              ) : (
                journal?.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell className="text-sm">{formatDate(movement.createdAt)}</TableCell>
                    <TableCell>
                      <span className={`flex items-center space-x-1 ${getMovementTypeColor(movement.type)}`}>
                        <span>{getMovementTypeIcon(movement.type)}</span>
                        <span className="text-sm font-medium">
                          {movement.type === 'in' ? t('caisse.entry', 'Entrée') : t('caisse.exit', 'Sortie')}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>{movement.reason}</TableCell>
                    <TableCell>
                      {movement.clientName && (
                        <div>
                          <div className="font-medium">{movement.clientName}</div>
                          {movement.invoiceNumber && (
                            <div className="text-sm text-gray-500 font-mono">{movement.invoiceNumber}</div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className={`font-semibold ${getMovementTypeColor(movement.type)}`}>
                      {movement.type === 'in' ? '+' : '-'}{formatCurrency(movement.amount)}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center space-x-1">
                        <span>{getPaymentMethodIcon(movement.paymentMethod)}</span>
                        <span className="text-sm capitalize">{movement.paymentMethod}</span>
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{movement.reference}</TableCell>
                    <TableCell className="text-sm">{movement.userName}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">{t('caisse.reports', 'Rapports')} (période)</h3>
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-4">📈</div>
              <p>{t('caisse.reportsInDevelopment', 'Fonctionnalité de rapports en cours de développement')}</p>
              <p className="text-sm">{t('caisse.reportsFeatures', 'Totaux in/out, top clients payeurs, écarts vs fermeture')}</p>
            </div>
          </Card>
        </div>
      )}

      {/* Modals */}
      <PaymentRecordingModal
        isOpen={isRecordingPayment}
        onClose={() => setIsRecordingPayment(false)}
      />
      
      <CashOutModal
        isOpen={isCashOut}
        onClose={() => setIsCashOut(false)}
      />
      
      <DayClosureModal
        isOpen={isClosingDay}
        onClose={() => setIsClosingDay(false)}
      />
        </div>
      </div>
    </div>
  );
};

export default CaissePage;