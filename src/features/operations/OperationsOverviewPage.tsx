import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs, doc, getDoc } from '@/lib/db';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { Spinner } from '../../components/Spinner';
import { safeToDate } from '../../lib/dateUtils';

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  createdAt: Date;
  lastVisit?: Date;
}

interface Reservation {
  id: string;
  clientId: string;
  clientName: string;
  reservedCrates: number;
  status: 'REQUESTED' | 'APPROVED' | 'CLOSED' | 'REFUSED';
  depositRequired: number;
  depositPaid: number;
  createdAt: Date;
  updatedAt: Date;
}

interface EmptyCrateLoan {
  id: string;
  clientId: string;
  crates: number;
  status: 'open' | 'closed';
  createdAt: Date;
  closedAt?: Date;
  depositMad: number;
  depositType: 'cash' | 'check';
  depositReference: string;
}

interface Reception {
  id: string;
  clientId: string;
  clientName: string;
  productName: string;
  productVariety: string;
  totalCrates: number;
  roomId?: string;
  roomName?: string;
  status: 'pending' | 'in_progress' | 'completed';
  arrivalTime: Date;
  createdAt: Date;
}

interface CautionRecord {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  type: string;
  status: string;
  createdAt: Date;
}

interface ClientStatus {
  client: Client;
  reservations: Reservation[];
  emptyCrateLoans: EmptyCrateLoan[];
  receptions: Reception[];
  summary: {
    totalReserved: number;
    totalLoaned: number;
    totalReceived: number;
    totalExited: number;
    netOutstanding: number;
    activeReservations: number;
    openLoans: number;
    totalDeposit: number;
    lastActivity: Date | null;
  };
}

export const OperationsOverviewPage: React.FC = () => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'entries' | 'name' | 'activity' | 'outstanding'>('entries');

  // Fetch all clients
  const { data: clients, isLoading: clientsLoading, error: clientsError } = useQuery({
    queryKey: ['clients', tenantId],
    queryFn: async (): Promise<Client[]> => {
      if (!tenantId) {
        console.log('No tenant ID available');
        return [];
      }
      
      console.log('Fetching clients for tenant:', tenantId);
      const clientsQuery = query(
        collection(db, 'tenants', tenantId, 'clients')
      );
      const snapshot = await getDocs(clientsQuery);
      
      console.log('Clients fetched:', snapshot.docs.length);
      
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
    retry: 2, // Retry failed requests twice
    retryDelay: 1000, // Wait 1 second between retries
    staleTime: 30000, // Consider data stale after 30 seconds
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });

  // Fetch all reservations
  const { data: reservations, isLoading: reservationsLoading, error: reservationsError } = useQuery({
    queryKey: ['reservations', tenantId],
    queryFn: async (): Promise<Reservation[]> => {
      if (!tenantId) return [];
      
      const reservationsQuery = query(
        collection(db, 'tenants', tenantId, 'reservations')
      );
      const snapshot = await getDocs(reservationsQuery);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          clientId: data.clientId || '',
          clientName: data.clientName || '',
          reservedCrates: data.reservedCrates || 0,
          status: data.status || 'REQUESTED',
          depositRequired: data.depositRequired || 0,
          depositPaid: data.depositPaid || 0,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        };
      });
    },
    enabled: !!tenantId,
    retry: 2,
    retryDelay: 1000,
  });

  // Fetch all empty crate loans
  const { data: emptyCrateLoans, isLoading: loansLoading, error: loansError } = useQuery({
    queryKey: ['empty-crate-loans', tenantId],
    queryFn: async (): Promise<EmptyCrateLoan[]> => {
      if (!tenantId) return [];
      
      const loansQuery = query(
        collection(db, 'empty_crate_loans'),
        where('tenantId', '==', tenantId)
      );
      const snapshot = await getDocs(loansQuery);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          clientId: data.clientId || '',
          crates: data.crates || 0,
          status: data.status || 'open',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          closedAt: data.closedAt?.toDate?.(),
          depositMad: data.depositMad || 0,
          depositType: data.depositType || 'cash',
          depositReference: data.depositReference || '',
        };
      });
    },
    enabled: !!tenantId,
    retry: 2,
    retryDelay: 1000,
  });

  // Fetch pricing settings to get caution_par_caisse
  const { data: depositPerCrate = 50, isLoading: pricingLoading } = useQuery({
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
    retry: 2,
    retryDelay: 1000,
  });

  // Fetch caution records to get total caution amount
  const { data: cautionRecords = [], isLoading: cautionLoading } = useQuery({
    queryKey: ['caution-records', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      try {
        const cautionQuery = query(
          collection(db, 'caution_records'),
          where('tenantId', '==', tenantId),
          where('status', '==', 'completed')
        );
        const snapshot = await getDocs(cautionQuery);
        
        return snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            clientId: data.clientId || '',
            clientName: data.clientName || '',
            amount: data.amount || 0,
            type: data.type || 'deposit',
            status: data.status || 'completed',
            createdAt: data.createdAt?.toDate?.() || new Date(),
          };
        });
      } catch (error) {
        console.error('Error fetching caution records:', error);
        return [];
      }
    },
    enabled: !!tenantId,
    retry: 2,
    retryDelay: 1000,
  });

  // Fetch all receptions
  const { data: receptions, isLoading: receptionsLoading, error: receptionsError } = useQuery({
    queryKey: ['receptions', tenantId],
    queryFn: async (): Promise<Reception[]> => {
      if (!tenantId) return [];
      
      const receptionsQuery = query(
        collection(db, 'receptions'),
        where('tenantId', '==', tenantId)
      );
      const snapshot = await getDocs(receptionsQuery);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          clientId: data.clientId || '',
          clientName: data.clientName || '',
          productName: data.productName || '',
          productVariety: data.productVariety || '',
          totalCrates: data.totalCrates || 0,
          roomId: data.roomId || '',
          roomName: data.roomName || '',
          status: data.status || 'pending',
          arrivalTime: data.arrivalTime?.toDate?.() || new Date(),
          createdAt: data.createdAt?.toDate?.() || new Date(),
        };
      });
    },
    enabled: !!tenantId,
    retry: 2,
    retryDelay: 1000,
  });

  // Process client status data
  const clientStatuses: ClientStatus[] = React.useMemo(() => {
    if (!clients || !reservations || !emptyCrateLoans || !receptions) {
      console.log('Missing data:', { clients: !!clients, reservations: !!reservations, emptyCrateLoans: !!emptyCrateLoans, receptions: !!receptions });
      return [];
    }

    console.log('Processing client data:', {
      clientsCount: clients.length,
      reservationsCount: reservations.length,
      loansCount: emptyCrateLoans.length,
      receptionsCount: receptions.length,
      totalAppleEntries: receptions.length,
      totalCratesReceived: receptions.reduce((sum, r) => sum + r.totalCrates, 0)
    });

    return clients.map(client => {
      const clientReservations = reservations.filter(r => r.clientId === client.id);
      const clientLoans = emptyCrateLoans.filter(l => l.clientId === client.id);
      const clientReceptions = receptions.filter(r => r.clientId === client.id);

      // Calculate summary statistics
      const totalReserved = clientReservations
        .filter(r => r.status === 'APPROVED')
        .reduce((sum, r) => sum + r.reservedCrates, 0);
      
      const totalLoaned = clientLoans
        .filter(l => l.status === 'open')
        .reduce((sum, l) => sum + l.crates, 0);
      
      const totalReceived = clientReceptions
        .reduce((sum, r) => sum + r.totalCrates, 0);
      
      const netOutstanding = Math.max(totalLoaned - totalReceived, 0);
      
      const totalExited = clientLoans
        .filter(l => l.status === 'closed')
        .reduce((sum, l) => sum + l.crates, 0);
      
      const activeReservations = clientReservations
        .filter(r => r.status === 'APPROVED').length;
      
      const openLoans = clientLoans
        .filter(l => l.status === 'open').length;
      
      const totalDeposit = clientReservations
        .reduce((sum, r) => sum + r.depositPaid, 0);
      
      // Find last activity date
      const allDates = [
        ...clientReservations.map(r => safeToDate(r.updatedAt)),
        ...clientLoans.map(l => safeToDate(l.createdAt)),
        ...clientReceptions.map(r => safeToDate(r.createdAt)),
        safeToDate(client.lastVisit),
      ].filter((date): date is Date => date !== undefined && !isNaN(date.getTime()));
      
      const lastActivity = allDates.length > 0 
        ? new Date(Math.max(...allDates.map(d => d.getTime())))
        : null;

      console.log(`Client ${client.name}:`, {
        reservations: clientReservations.length,
        loans: clientLoans.length,
        receptions: clientReceptions.length,
        totalReserved,
        totalLoaned,
        totalReceived,
        totalExited,
        lastActivity: lastActivity ? lastActivity.toISOString() : null,
        allDates: allDates.map(d => d.toISOString()),
        receptionDetails: clientReceptions.map(r => ({
          id: r.id,
          status: r.status,
          totalCrates: r.totalCrates,
          clientName: r.clientName,
          createdAt: r.createdAt,
          safeCreatedAt: safeToDate(r.createdAt)?.toISOString()
        })),
        loanDetails: clientLoans.map(l => ({
          id: l.id,
          createdAt: l.createdAt,
          safeCreatedAt: safeToDate(l.createdAt)?.toISOString()
        })),
        reservationDetails: clientReservations.map(r => ({
          id: r.id,
          updatedAt: r.updatedAt,
          safeUpdatedAt: safeToDate(r.updatedAt)?.toISOString()
        }))
      });

      return {
        client,
        reservations: clientReservations,
        emptyCrateLoans: clientLoans,
        receptions: clientReceptions,
        summary: {
          totalReserved,
          totalLoaned,
          totalReceived,
          totalExited,
          netOutstanding,
          activeReservations,
          openLoans,
          totalDeposit,
          lastActivity,
        },
      };
    });
  }, [clients, reservations, emptyCrateLoans, receptions]);

  // Calculate total caution amount from caution records
  const totalCautionAmount = useMemo(() => {
    return cautionRecords.reduce((sum, record) => sum + record.amount, 0);
  }, [cautionRecords]);

  // Helper function to get caution amount for a specific client
  const getClientCautionAmount = (clientId: string) => {
    return cautionRecords
      .filter(record => record.clientId === clientId)
      .reduce((sum, record) => sum + record.amount, 0);
  };

  const getSortLabel = () => {
    switch (sortBy) {
      case 'entries':
        return `📊 ${t('operations.sortedByEntries', 'Trié par entrées pommiers')}`;
      case 'name':
        return `📊 ${t('operations.sortedByName', 'Trié par nom')}`;
      case 'activity':
        return `📊 ${t('operations.sortedByActivity', 'Trié par activité')}`;
      case 'outstanding':
        return `📊 ${t('operations.sortedByOutstanding', 'Trié par caisses dehors')}`;
      default:
        return `📊 ${t('operations.sortedByEntries', 'Trié par entrées pommiers')}`;
    }
  };

  const cycleSortBy = () => {
    const sortOptions: Array<'entries' | 'name' | 'activity' | 'outstanding'> = ['entries', 'name', 'activity', 'outstanding'];
    const currentIndex = sortOptions.indexOf(sortBy);
    const nextIndex = (currentIndex + 1) % sortOptions.length;
    setSortBy(sortOptions[nextIndex]);
  };

  // Filter and search client statuses
  const filteredClientStatuses = useMemo(() => {
    if (!clientStatuses) return [];

    const filtered = clientStatuses.filter(clientStatus => {
      const matchesSearch = searchTerm === '' || 
        clientStatus.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clientStatus.client.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clientStatus.client.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && (clientStatus.summary.activeReservations > 0 || clientStatus.summary.openLoans > 0)) ||
        (statusFilter === 'inactive' && clientStatus.summary.activeReservations === 0 && clientStatus.summary.openLoans === 0);

      return matchesSearch && matchesStatus;
    });

    // Sort based on selected criteria
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'entries':
          const aEntries = a.receptions.length;
          const bEntries = b.receptions.length;
          if (aEntries !== bEntries) {
            return bEntries - aEntries; // Highest number of entries first
          }
          return a.client.name.localeCompare(b.client.name);
          
        case 'name':
          return a.client.name.localeCompare(b.client.name);
          
        case 'activity':
          const aActivity = a.summary.lastActivity?.getTime() || 0;
          const bActivity = b.summary.lastActivity?.getTime() || 0;
          return bActivity - aActivity; // Most recent activity first
          
        case 'outstanding':
          const aOutstanding = a.summary.netOutstanding;
          const bOutstanding = b.summary.netOutstanding;
          if (aOutstanding !== bOutstanding) {
            return bOutstanding - aOutstanding; // Highest outstanding first
          }
          return a.client.name.localeCompare(b.client.name);
          
        default:
          return a.client.name.localeCompare(b.client.name);
      }
    });
  }, [clientStatuses, searchTerm, statusFilter, sortBy]);

  const isLoading = clientsLoading || reservationsLoading || loansLoading || receptionsLoading;
  const hasError = clientsError || reservationsError || loansError || receptionsError;

  if (hasError) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t('common.error', 'Erreur de chargement')}
          </h3>
          <p className="text-gray-600 mb-4">
            {t('operations.loadingError', 'Impossible de charger les données. Vérifiez votre connexion.')}
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            {t('common.retry', 'Réessayer')}
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-600">{t('common.loading', 'Chargement...')}</p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header Section - Apple-style Compact */}
      <div className="bg-white/95 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-10">
        <div className="px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Title Section */}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                {t('operations.overview', 'Vue d\'ensemble des opérations')}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                {t('operations.overviewSubtitle', 'Statut des clients et leurs opérations en cours')}
              </p>
            </div>
            
            {/* Controls Section */}
            <div className="flex items-center gap-2 sm:gap-3 ml-4">
              {/* Search Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                  <svg className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder={t('operations.searchClients', 'Rechercher...') as string}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-40 sm:w-48 pl-8 pr-3 py-1.5 sm:py-2 border border-gray-200 rounded-lg bg-gray-50/80 focus:bg-white focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 text-gray-900 placeholder-gray-400 text-xs sm:text-sm"
                />
              </div>
              
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                className="px-2.5 py-1.5 sm:py-2 border border-gray-200 rounded-lg bg-gray-50/80 focus:bg-white focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 text-gray-900 text-xs sm:text-sm"
              >
                <option value="all">{t('operations.allClients', 'Tous')}</option>
                <option value="active">{t('operations.activeClients', 'Actifs')}</option>
                <option value="inactive">{t('operations.inactiveClients', 'Inactifs')}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-6 sm:px-6 sm:py-6 sm:space-y-8">

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100/50 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 group">
            <div className="text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25 mx-auto mb-3 group-hover:shadow-xl group-hover:shadow-blue-500/30 transition-all duration-300">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-xs sm:text-sm font-medium text-gray-600 mb-2">
                {t('operations.totalClients', 'Total clients')}
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                {clientStatuses.length}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100/50 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 group">
            <div className="text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25 mx-auto mb-3 group-hover:shadow-xl group-hover:shadow-purple-500/30 transition-all duration-300">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className={`text-xs sm:text-sm font-medium mb-2 ${
                (clientStatuses.reduce((sum, cs) => sum + cs.summary.netOutstanding, 0) * depositPerCrate) > totalCautionAmount
                  ? 'text-red-600 font-bold'
                  : 'text-gray-600'
              }`}>
                {t('operations.cratesOutstanding', 'Caisses dehors')}
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
                {clientStatuses.reduce((sum, cs) => sum + cs.summary.netOutstanding, 0)}
              </p>
              <div className="space-y-2">
                <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
                  <p className="text-xs sm:text-sm text-gray-600 font-medium mb-1">Valeur</p>
                  <p className="text-sm sm:text-base font-bold text-gray-900">
                    {(clientStatuses.reduce((sum, cs) => sum + cs.summary.netOutstanding, 0) * depositPerCrate).toLocaleString()} MAD
                  </p>
                </div>
                <div className={`rounded-lg p-2 sm:p-3 ${
                  (clientStatuses.reduce((sum, cs) => sum + cs.summary.netOutstanding, 0) * depositPerCrate) > totalCautionAmount
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-green-50 border border-green-200'
                }`}>
                  <p className="text-xs text-gray-600 font-medium mb-1">Caution</p>
                  <p className={`text-sm sm:text-base font-bold ${
                    (clientStatuses.reduce((sum, cs) => sum + cs.summary.netOutstanding, 0) * depositPerCrate) > totalCautionAmount
                      ? 'text-red-700'
                      : 'text-green-700'
                  }`}>
                    {totalCautionAmount.toLocaleString()} MAD
                  </p>
                </div>
              </div>
            </div>
          </div>


          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100/50 hover:shadow-md transition-all duration-300 group">
            <div className="text-center">
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-lg shadow-green-500/25 mx-auto mb-2">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="text-xs font-medium text-gray-600 mb-1">
                {t('operations.totalAppleEntries', 'Entrées Pommiers')}
              </p>
              <p className="text-xl font-bold text-gray-900">
                {clientStatuses.reduce((sum, cs) => sum + cs.summary.totalReceived, 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Client Status Cards */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">
              {t('operations.clientsOverview', 'Vue d\'ensemble des clients')}
            </h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs text-gray-500">
              <span>{filteredClientStatuses.length} {t('operations.of', 'sur')} {clientStatuses.length} {t('operations.clients', 'clients')}</span>
              <button
                onClick={cycleSortBy}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 hover:text-green-800 transition-all duration-200 cursor-pointer select-none"
                title={t('operations.clickToChangeSort', 'Cliquer pour changer le tri')}
              >
                {getSortLabel()}
                <svg className="ml-1 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {filteredClientStatuses.map((clientStatus) => (
              <div 
                key={clientStatus.client.id} 
                className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 group cursor-pointer"
              >
                {/* Client Header */}
                <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                      <span className="text-white font-bold text-sm">
                        {clientStatus.client.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white ${
                      clientStatus.summary.lastActivity && 
                      (Date.now() - clientStatus.summary.lastActivity.getTime()) < 7 * 24 * 60 * 60 * 1000
                        ? 'bg-green-500'
                        : 'bg-gray-400'
                    }`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate text-sm">
                      {clientStatus.client.name}
                    </h3>
                    {clientStatus.client.company && (
                      <p className="text-xs text-gray-500 truncate">
                        {clientStatus.client.company}
                      </p>
                    )}
                  </div>
                </div>

                {/* Client Status Summary */}
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-2 sm:p-3 mb-3 sm:mb-4 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        clientStatus.summary.activeReservations > 0 || clientStatus.summary.openLoans > 0
                          ? 'bg-green-500 animate-pulse'
                          : clientStatus.receptions.length > 0
                            ? 'bg-blue-500'
                            : 'bg-gray-400'
                      }`}></div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {(clientStatus.receptions.length > 0 || clientStatus.reservations.length > 0 || clientStatus.emptyCrateLoans.length > 0) && (
                        <span>Dernière activité: {clientStatus.summary.lastActivity?.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) || 'N/A'}</span>
                      )}
                    </div>
                  </div>
                  {clientStatus.summary.netOutstanding > 0 && (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-[11px] font-semibold text-orange-700 shadow-sm">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>{clientStatus.summary.netOutstanding} {t('operations.cratesOutTag', 'caisses dehors')}</span>
                    </div>
                  )}
                </div>

                {/* Simple Metrics */}
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0V7a2 2 0 012-2h4a2 2 0 012 2v0M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-2" />
                        </svg>
                      </div>
                      <span className="text-xs text-gray-600">{t('operations.reserved', 'Réservées')}</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">
                      {clientStatus.summary.totalReserved}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
                        <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </div>
                      <span className="text-xs text-gray-600">{t('operations.loaned', 'Caisses prêtées')}</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">
                      {clientStatus.summary.totalLoaned}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-orange-100 rounded-lg flex items-center justify-center">
                        <svg className="w-3 h-3 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </div>
                      <span className={`text-xs font-medium ${
                        (clientStatus.summary.netOutstanding * depositPerCrate) > getClientCautionAmount(clientStatus.client.id)
                          ? 'text-red-600 font-bold'
                          : 'text-gray-600'
                      }`}>
                        {t('operations.cratesOutTag', 'Caisses dehors')}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-gray-900">
                        {clientStatus.summary.netOutstanding}
                      </span>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-gray-500">
                          {(clientStatus.summary.netOutstanding * depositPerCrate).toLocaleString()} MAD
                        </p>
                        <p className={`text-[9px] font-medium ${
                          (clientStatus.summary.netOutstanding * depositPerCrate) > getClientCautionAmount(clientStatus.client.id)
                            ? 'text-red-600'
                            : 'text-green-600'
                        }`}>
                          Caution: {getClientCautionAmount(clientStatus.client.id).toLocaleString()} MAD
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
                        <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <span className="text-xs text-gray-600">{t('operations.appleEntries', 'Entrées Pommiers')}</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">
                      {clientStatus.summary.totalReceived}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-orange-100 rounded-lg flex items-center justify-center">
                        <svg className="w-3 h-3 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </div>
                      <span className="text-xs text-gray-600">{t('operations.exited', 'Sorties')}</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">
                      {clientStatus.summary.totalExited}
                    </span>
                  </div>
                </div>

                <div className="mt-3 sm:mt-4" />
              </div>
            ))}
          </div>
        </div>

        {filteredClientStatuses.length === 0 && clientStatuses.length > 0 && (
          <div className="bg-white rounded-3xl p-12 shadow-sm border border-gray-100/50 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              {t('operations.noResults', 'Aucun résultat trouvé')}
            </h3>
            <p className="text-gray-500 text-lg">
              {t('operations.noResultsDescription', 'Aucun client ne correspond à vos critères de recherche')}
            </p>
          </div>
        )}

        {clientStatuses.length === 0 && (
          <div className="bg-white rounded-3xl p-12 shadow-sm border border-gray-100/50 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              {t('operations.noClients', 'Aucun client trouvé')}
            </h3>
            <p className="text-gray-500 text-lg">
              {t('operations.noClientsDescription', 'Commencez par ajouter des clients à votre système')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
