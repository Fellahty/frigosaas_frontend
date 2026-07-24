import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, addDoc, Timestamp, updateDoc, doc, deleteDoc } from '@/lib/db';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { 
  useLoansPageData,
  type LoanItem,
  type ClientStats,
  type CrateType
} from '../../lib/hooks/useLoansData';
import { Card } from '../../components/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/Table';
import { Spinner } from '../../components/Spinner';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { EnhancedSelect } from '../../components/EnhancedSelect';
import QRCode from 'qrcode';


// Component for displaying client information
const ClientInfoDisplay: React.FC<{ 
  clientStats: ClientStats; 
  onNavigateToReservations: () => void;
}> = ({ clientStats, onNavigateToReservations }) => {
  const { t } = useTranslation();
  
  return (
    <div className="md:col-span-2 lg:col-span-3">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 sm:p-4 shadow-sm">
        {/* Compact Header */}
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm sm:text-base font-semibold text-blue-900 flex items-center">
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('loans.clientInfo.title', 'Info Client')}
          </h4>
          {/* Mobile: Show key info in header */}
          <div className="sm:hidden flex items-center gap-2">
            <span className="text-xs font-bold text-green-600">{clientStats.cratesCanTake}</span>
            <span className="text-xs text-gray-500">caisses</span>
          </div>
        </div>
        
        {/* Room Reservations - Compact */}
        {clientStats.reservedRooms.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1 mb-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="text-xs font-medium text-gray-700">{t('loans.clientInfo.reservedRooms', 'Chambres')}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {clientStats.reservedRooms.slice(0, 3).map((room, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {room}
                </span>
              ))}
              {clientStats.reservedRooms.length > 3 && (
                <span className="text-xs text-gray-500">+{clientStats.reservedRooms.length - 3}</span>
              )}
            </div>
          </div>
        )}

        {/* Compact Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {/* Caution Paid */}
          <div className="bg-white rounded-lg p-2 sm:p-3 border border-gray-200 text-center">
            <div className="text-sm sm:text-lg font-bold text-green-600">{clientStats.totalCautionPaid.toLocaleString()}</div>
            <div className="text-xs text-gray-600">{t('loans.clientInfo.cautionPaid', 'Caution')}</div>
          </div>
          
          {/* Total Sortie */}
          <div className="bg-white rounded-lg p-2 sm:p-3 border border-gray-200 text-center">
            <div className="text-sm sm:text-lg font-bold text-purple-600">{clientStats.totalSortieAmount.toLocaleString()}</div>
            <div className="text-xs text-gray-600">{t('loans.clientInfo.totalSortie', 'Sortie')}</div>
          </div>
          
          {/* Crates Can Take - Desktop */}
          <div className="hidden sm:block bg-white rounded-lg p-3 border border-gray-200 text-center">
            <div className={`text-lg font-bold ${clientStats.cratesCanTake > 1000 ? 'text-red-600' : 'text-blue-600'}`}>
              {clientStats.cratesCanTake}
            </div>
            <div className="text-xs text-gray-600 mb-2">{t('loans.clientInfo.cratesCanTake', 'Disponibles')}</div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  clientStats.cratesCanTake > 1000 
                    ? 'bg-gradient-to-r from-red-500 to-red-600' 
                    : 'bg-gradient-to-r from-blue-500 to-blue-600'
                }`}
                style={{ 
                  width: `${Math.min(Math.max((clientStats.cratesCanTake / 1000) * 100, 0), 100)}%` 
                }}
              ></div>
            </div>
            
            {/* Progress Label */}
            <div className="text-xs text-gray-500 mt-1">
              {clientStats.cratesCanTake > 1000 ? (
                <span className="text-red-600 font-medium">Limite!</span>
              ) : (
                <span>{clientStats.cratesCanTake}/1000</span>
              )}
            </div>
          </div>
          
          {/* Empty Crates Needed */}
          <div className="bg-white rounded-lg p-2 sm:p-3 border border-gray-200 text-center">
            <div className="text-sm sm:text-lg font-bold text-green-600">{clientStats.totalEmptyCratesNeeded}</div>
            <div className="text-xs text-gray-600">{t('loans.clientInfo.emptyCratesNeeded', 'Nécessaires')}</div>
          </div>
        </div>
        
        {/* Action button when no reservations - Compact */}
        {clientStats.totalEmptyCratesNeeded === 0 && (
          <div className="mt-3 pt-3 border-t border-blue-200">
            <div className="text-center">
              <p className="text-xs text-blue-700 mb-2">
                {t('loans.clientInfo.noReservations', 'Aucune réservation active')}
              </p>
              <button
                onClick={onNavigateToReservations}
                className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded text-xs hover:bg-blue-700 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {t('loans.clientInfo.goToReservations', 'Réservations')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const EmptyCrateLoansPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Helper function to translate crate types
  const translateCrateType = (type: CrateType | string | undefined): string => {
    if (!type) return 'N/A';
    return t(`loans.crateTypes.${type}`, type) as string;
  };

  // Helper function to translate colors
  const translateColor = (color: string): string => {
    return t(`loans.colors.${color.toLowerCase()}`, color);
  };

  // Card view component - Apple-style design
  const LoanCard: React.FC<{ loan: LoanItem }> = ({ loan }) => (
    <div className="group relative">
      <div className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/5 hover:shadow-3xl hover:shadow-black/10 transition-all duration-500 hover:-translate-y-1 sm:hover:-translate-y-2 hover:scale-[1.01] sm:hover:scale-[1.02] overflow-hidden">
        {/* Status indicator bar */}
        <div className={`h-1 w-full ${
          loan.status === 'open' 
            ? 'bg-gradient-to-r from-orange-400 to-orange-500' 
            : 'bg-gradient-to-r from-green-400 to-green-500'
        }`}></div>
        
        <div className="p-4 sm:p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4 sm:mb-6">
            <div className="flex-1 min-w-0 mr-3">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 tracking-tight break-words">
                {loan.clientName || '-'}
              </h3>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <p className="text-sm font-medium text-gray-600">
                  {loan.crates} {loan.crates > 1 ? 'caisses' : 'caisse'}
                </p>
              </div>
            </div>
            <div className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm flex-shrink-0 ${
              loan.status === 'open' 
                ? 'bg-orange-100/80 text-orange-800 border border-orange-200/50' 
                : 'bg-green-100/80 text-green-800 border border-green-200/50'
            }`}>
              {loan.status === 'open' ? 'Ouvert' : 'Rendu'}
            </div>
          </div>
          
          {/* Crate Type Section */}
          <div className="mb-4 sm:mb-6">
            <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gradient-to-br from-gray-50/50 to-gray-100/30 rounded-xl sm:rounded-2xl border border-gray-100/50">
              <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full shadow-lg flex-shrink-0 ${
                loan.crateColor === 'blue' ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
                loan.crateColor === 'green' ? 'bg-gradient-to-br from-green-400 to-green-600' :
                loan.crateColor === 'red' ? 'bg-gradient-to-br from-red-400 to-red-600' :
                loan.crateColor === 'yellow' ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                loan.crateColor === 'white' ? 'bg-gradient-to-br from-gray-100 to-gray-300 border-2 border-gray-300' :
                loan.crateColor === 'black' ? 'bg-gradient-to-br from-gray-800 to-black' :
                loan.crateColor === 'gray' ? 'bg-gradient-to-br from-gray-400 to-gray-600' :
                loan.crateColor === 'brown' ? 'bg-gradient-to-br from-amber-500 to-amber-700' : 'bg-gradient-to-br from-gray-400 to-gray-600'
              }`}></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base font-semibold text-gray-900 break-words">
                  {loan.crateTypeName || 'N/A'}
                </p>
                <p className="text-xs sm:text-sm text-gray-600 capitalize break-words">
                  {translateCrateType(loan.crateType)} • {loan.crateColor}
                </p>
              </div>
            </div>
          </div>
          
          {/* Info Section - Vertical Layout */}
          <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
            {/* Date */}
            <div className="flex items-center gap-3 p-3 sm:p-4 bg-white/60 backdrop-blur-sm rounded-lg sm:rounded-xl border border-gray-100/50">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Date de création</p>
                <p className="text-sm sm:text-base font-semibold text-gray-900 break-words">{loan.createdAt.toLocaleDateString('fr-FR')}</p>
              </div>
            </div>
            
            {/* Ticket ID */}
            <div className="flex items-center gap-3 p-3 sm:p-4 bg-white/60 backdrop-blur-sm rounded-lg sm:rounded-xl border border-gray-100/50">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Numéro de ticket</p>
                <p className="text-sm sm:text-base font-semibold text-gray-900 font-mono break-all">{loan.ticketId}</p>
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {loan.status === 'open' && (
                <button
                  onClick={() => handleMarkReturned(loan)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white text-xs font-semibold rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Rendu</span>
                </button>
              )}
              
              <button
                onClick={() => handlePrintTicket(loan)}
                className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-semibold rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Print</span>
              </button>
            </div>
            
            <div className="flex items-center gap-1 justify-end sm:justify-start">
              <button
                onClick={() => handleEditLoan(loan)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 hover:scale-110"
                title="Modifier"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              
              <button
                onClick={() => handleDeleteLoan(loan)}
                className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-all duration-200 hover:scale-110"
                title="Supprimer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );


  const [isAdding, setIsAdding] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editingLoan, setEditingLoan] = React.useState<LoanItem | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = React.useState(false);
  const [loanToReturn, setLoanToReturn] = React.useState<LoanItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [loanToDelete, setLoanToDelete] = React.useState<LoanItem | null>(null);
  const [viewType, setViewType] = React.useState<'table' | 'cards'>('table');
  const [nameFilter, setNameFilter] = React.useState('');
  const [clientFilter, setClientFilter] = React.useState('');
  const [sortBy, setSortBy] = React.useState<'date' | 'client' | 'crates' | 'cumulative'>('date');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('asc');
  const [showCumulativeTable, setShowCumulativeTable] = React.useState(false);
  const [isAddingTruck, setIsAddingTruck] = React.useState(false);
  const [editingTruckId, setEditingTruckId] = React.useState<string | null>(null);
  const [truckForm, setTruckForm] = React.useState({
    number: '',
    color: '',
    photoUrl: '',
  });
  const [isAddingDriver, setIsAddingDriver] = React.useState(false);
  const [editingDriverId, setEditingDriverId] = React.useState<string | null>(null);
  const [driverForm, setDriverForm] = React.useState({
    name: '',
    phone: '',
    licenseNumber: '',
  });
  const [form, setForm] = React.useState<{ 
    clientId: string; 
    crates: number; 
    crateTypeId: string;
    customDate: string;
    truckId: string;
    driverId: string;
  }>({
    clientId: '',
    crates: 1,
    crateTypeId: '',
    customDate: new Date().toISOString().split('T')[0], // Default to today
    truckId: '',
    driverId: '',
  });


  // Use the new combined data fetching hook
  const {
    loans,
    clients: clientOptions,
    trucks,
    drivers,
    crateTypes,
    rooms,
    clientReservations,
    depositPerCrate,
    cautionRecords,
    siteSettings,
    isLoading,
    hasError,
    refetchAll
  } = useLoansPageData(form.clientId);

  // Calculate client statistics
  const clientStats = React.useMemo(() => {
    if (!clientReservations || clientReservations.length === 0) {
      return {
        totalEmptyCratesNeeded: 0,
        reservedRooms: [],
        totalCautionPaid: 0,
        totalSortieAmount: 0,
        cratesCanTake: 0
      };
    }

    const stats = clientReservations.reduce((acc, reservation: any) => {
      const reservedCrates = reservation.reservedCrates || 0;
      acc.totalEmptyCratesNeeded += reservedCrates; // Assuming each reserved crate needs an empty crate

      // Collect room names
      if (reservation.selectedRooms && Array.isArray(reservation.selectedRooms)) {
        reservation.selectedRooms.forEach((roomId: string) => {
          const room = rooms?.find((r: any) => r.id === roomId);
          if (room) {
            const roomName = (room as any).room || (room as any).name || `Chambre ${roomId}`;
            if (!(acc.reservedRooms as string[]).includes(roomName)) {
              (acc.reservedRooms as string[]).push(roomName);
            }
          }
        });
      }
      
      return acc;
    }, {
      totalEmptyCratesNeeded: 0,
      reservedRooms: [],
      totalCautionPaid: 0,
      totalSortieAmount: 0,
      cratesCanTake: 0
    });

    // Calculate caution information
    if (cautionRecords && cautionRecords.length > 0) {
      // Calculate total deposits (only completed deposits)
      stats.totalCautionPaid = cautionRecords
        .filter((record: any) => record.type === 'deposit' && record.status === 'completed')
        .reduce((sum: number, record: any) => sum + (record.amount || 0), 0);
      
      // Calculate total sortie amount (all completed records)
      stats.totalSortieAmount = cautionRecords
        .filter((record: any) => record.status === 'completed')
        .reduce((sum: number, record: any) => sum + (record.amount || 0), 0);
    }
    
    // Calculate how many crates the client can take based on their caution amount
    if (depositPerCrate > 0) {
      stats.cratesCanTake = Math.floor(stats.totalCautionPaid / depositPerCrate);
    } else {
      stats.cratesCanTake = 0;
    }

    // Debug logging
    console.log('Client Stats Debug:', {
      totalCautionPaid: stats.totalCautionPaid,
      totalSortieAmount: stats.totalSortieAmount,
      depositPerCrate,
      cratesCanTake: stats.cratesCanTake,
      cautionRecords: cautionRecords?.length || 0
    });

    return stats;
  }, [clientReservations, rooms, cautionRecords, depositPerCrate]);




  // Calculer le total des caisses vides à partir des types de caisses
  const totalEmptyCrates = React.useMemo(() => {
    if (!crateTypes) return 0;
    return crateTypes.reduce((total, crateType) => total + crateType.quantity, 0);
  }, [crateTypes]);

  // Calculer les caisses vides disponibles (total - prêts en cours)
  const availableEmptyCrates = React.useMemo(() => {
    if (!totalEmptyCrates || !loans) return 0;
    
    const totalLoaned = loans
      .filter(loan => loan.status === 'open')
      .reduce((sum, loan) => sum + loan.crates, 0);
    
    return Math.max(0, totalEmptyCrates - totalLoaned);
  }, [totalEmptyCrates, loans]);

  // Filter loans by client name and client selection
  const filteredLoans = React.useMemo(() => {
    if (!loans) return [];
    
    let filtered = loans;
    
    // Filter by name search
    if (nameFilter.trim()) {
      filtered = filtered.filter(loan => 
        loan.clientName.toLowerCase().includes(nameFilter.toLowerCase())
      );
    }
    
    // Filter by selected client
    if (clientFilter) {
      filtered = filtered.filter(loan => loan.clientId === clientFilter);
    }
    
    return filtered;
  }, [loans, nameFilter, clientFilter]);

  // Add cumulative data to each loan
  const loansWithCumulative = React.useMemo(() => {
    if (!filteredLoans) return [];
    
    // Group loans by client and sort by date
    const clientLoans = new Map<string, LoanItem[]>();
    filteredLoans.forEach(loan => {
      if (!clientLoans.has(loan.clientName)) {
        clientLoans.set(loan.clientName, []);
      }
      clientLoans.get(loan.clientName)!.push(loan);
    });

    // Sort each client's loans by date and calculate cumulative
    const result: (LoanItem & { cumulativeCrates: number })[] = [];
    
    clientLoans.forEach(clientLoanList => {
      // Sort by creation date
      const sortedLoans = clientLoanList.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      
      let cumulative = 0;
      sortedLoans.forEach(loan => {
        cumulative += loan.crates;
        result.push({
          ...loan,
          cumulativeCrates: cumulative
        });
      });
    });

    // Sort results based on selected criteria
    return result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'client':
          comparison = a.clientName.localeCompare(b.clientName);
          break;
        case 'crates':
          comparison = a.crates - b.crates;
          break;
        case 'cumulative':
          comparison = a.cumulativeCrates - b.cumulativeCrates;
          break;
        default:
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredLoans, sortBy, sortOrder]);

  // Calculate cumulative data for each client
  const cumulativeData = React.useMemo(() => {
    if (!loans) return [];
    
    const clientTotals = new Map<string, {
      clientName: string;
      totalCrates: number;
      firstLoanDate: Date;
      lastLoanDate: Date;
      loanCount: number;
    }>();

    loans.forEach(loan => {
      const key = loan.clientName;
      if (!clientTotals.has(key)) {
        clientTotals.set(key, {
          clientName: loan.clientName,
          totalCrates: 0,
          firstLoanDate: loan.createdAt,
          lastLoanDate: loan.createdAt,
          loanCount: 0
        });
      }
      
      const clientData = clientTotals.get(key)!;
      clientData.totalCrates += loan.crates;
      clientData.loanCount += 1;
      
      if (loan.createdAt < clientData.firstLoanDate) {
        clientData.firstLoanDate = loan.createdAt;
      }
      if (loan.createdAt > clientData.lastLoanDate) {
        clientData.lastLoanDate = loan.createdAt;
      }
    });

    return Array.from(clientTotals.values())
      .sort((a, b) => b.totalCrates - a.totalCrates);
  }, [loans]);


  const addTruck = useMutation({
    mutationFn: async (payload: typeof truckForm) => {
      const docRef = await addDoc(collection(db, 'trucks'), {
        tenantId,
        ...payload,
        isActive: true,
        createdAt: Timestamp.fromDate(new Date()),
      });
      return docRef.id;
    },
    onSuccess: async (truckId) => {
      await queryClient.invalidateQueries({ queryKey: ['trucks', tenantId] });
      setIsAddingTruck(false);
      setTruckForm({ number: '', color: '', photoUrl: '' });
      // Auto-select the newly created truck
      setForm(prev => ({ ...prev, truckId }));
    },
  });

  const updateTruck = useMutation({
    mutationFn: async (payload: { id: string } & typeof truckForm) => {
      await updateDoc(doc(db, 'trucks', payload.id), {
        number: payload.number,
        color: payload.color,
        photoUrl: payload.photoUrl,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['trucks', tenantId] });
      setIsAddingTruck(false);
      setEditingTruckId(null);
      setTruckForm({ number: '', color: '', photoUrl: '' });
    },
  });

  const addDriver = useMutation({
    mutationFn: async (payload: typeof driverForm) => {
      const docRef = await addDoc(collection(db, 'drivers'), {
        tenantId,
        ...payload,
        isActive: true,
        createdAt: Timestamp.fromDate(new Date()),
      });
      return docRef.id;
    },
    onSuccess: async (driverId) => {
      await queryClient.invalidateQueries({ queryKey: ['drivers', tenantId] });
      setIsAddingDriver(false);
      setDriverForm({ name: '', phone: '', licenseNumber: '' });
      // Auto-select the newly created driver
      setForm(prev => ({ ...prev, driverId }));
    },
  });

  const updateDriver = useMutation({
    mutationFn: async (payload: { id: string } & typeof driverForm) => {
      await updateDoc(doc(db, 'drivers', payload.id), {
        name: payload.name,
        phone: payload.phone,
        licenseNumber: payload.licenseNumber,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['drivers', tenantId] });
      setIsAddingDriver(false);
      setEditingDriverId(null);
      setDriverForm({ name: '', phone: '', licenseNumber: '' });
    },
  });

  const addLoan = useMutation({
    mutationFn: async (payload: typeof form) => {
      const client = (clientOptions || []).find((c) => c.id === payload.clientId);
      const crateType = (crateTypes || []).find((c) => c.id === payload.crateTypeId);
      const selectedTruck = trucks?.find(t => t.id === payload.truckId);
      const selectedDriver = drivers?.find(d => d.id === payload.driverId);
      const ticketId = `${tenantId}-${Date.now()}`;
      await addDoc(collection(db, 'empty_crate_loans'), {
        tenantId,
        ticketId,
        clientId: payload.clientId || null,
        clientName: client?.name || '',
        crates: Number(payload.crates) || 0,
        crateTypeId: payload.crateTypeId || '',
        crateTypeName: crateType?.name || '',
        crateType: crateType?.type || 'plastic',
        crateColor: crateType?.color || 'blue',
        truckId: payload.truckId || null,
        truckNumber: selectedTruck?.number || '',
        driverId: payload.driverId || null,
        driverName: selectedDriver?.name || '',
        driverPhone: selectedDriver?.phone || '',
        status: 'open',
        createdAt: Timestamp.fromDate(new Date(payload.customDate)),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['empty-crate-loans', tenantId] });
      setIsAdding(false);
      setForm({ 
        clientId: '', 
        crates: 1, 
        crateTypeId: '',
        customDate: new Date().toISOString().split('T')[0],
        truckId: '',
        driverId: ''
      });
    },
  });

  const editLoan = useMutation({
    mutationFn: async (payload: { id: string; updates: typeof form }) => {
      const client = (clientOptions || []).find((c) => c.id === payload.updates.clientId);
      const crateType = (crateTypes || []).find((c) => c.id === payload.updates.crateTypeId);
      const selectedTruck = trucks?.find(t => t.id === payload.updates.truckId);
      const selectedDriver = drivers?.find(d => d.id === payload.updates.driverId);
      await updateDoc(doc(db, 'empty_crate_loans', payload.id), {
        clientId: payload.updates.clientId || null,
        clientName: client?.name || '',
        crates: Number(payload.updates.crates) || 0,
        crateTypeId: payload.updates.crateTypeId || '',
        crateTypeName: crateType?.name || '',
        crateType: crateType?.type || 'plastic',
        crateColor: crateType?.color || 'blue',
        truckId: payload.updates.truckId || null,
        truckNumber: selectedTruck?.number || '',
        driverId: payload.updates.driverId || null,
        driverName: selectedDriver?.name || '',
        driverPhone: selectedDriver?.phone || '',
        createdAt: Timestamp.fromDate(new Date(payload.updates.customDate)),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['empty-crate-loans', tenantId] });
      setIsEditing(false);
      setEditingLoan(null);
    },
  });

  const markReturned = useMutation({
    mutationFn: async (item: LoanItem) => {
      await updateDoc(doc(db, 'empty_crate_loans', item.id), { status: 'returned' });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['empty-crate-loans', tenantId] });
    },
  });

  const deleteLoan = useMutation({
    mutationFn: async (item: LoanItem) => {
      await deleteDoc(doc(db, 'empty_crate_loans', item.id));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['empty-crate-loans', tenantId] });
    },
  });


  const handleEditLoan = (item: LoanItem) => {
    setEditingLoan(item);
    setForm({
      clientId: item.clientId || '',
      crates: item.crates,
      crateTypeId: item.crateTypeId || '',
      customDate: item.createdAt.toISOString().split('T')[0],
      truckId: item.truckId || '',
      driverId: item.driverId || '',
    });
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editingLoan) {
      editLoan.mutate({
        id: editingLoan.id,
        updates: form
      });
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingLoan(null);
    setForm({
      clientId: '',
      crates: 1,
      crateTypeId: '',
      customDate: new Date().toISOString().split('T')[0],
      truckId: '',
      driverId: '',
    });
  };


  const handleMarkReturned = (item: LoanItem) => {
    setLoanToReturn(item);
    setIsConfirmModalOpen(true);
  };

  const confirmReturn = () => {
    if (loanToReturn) {
      markReturned.mutate(loanToReturn);
      setIsConfirmModalOpen(false);
      setLoanToReturn(null);
    }
  };

  const cancelReturn = () => {
    setIsConfirmModalOpen(false);
    setLoanToReturn(null);
  };

  const handleDeleteLoan = (item: LoanItem) => {
    setLoanToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (loanToDelete) {
      deleteLoan.mutate(loanToDelete);
      setIsDeleteModalOpen(false);
      setLoanToDelete(null);
    }
  };

  const cancelDelete = () => {
    setIsDeleteModalOpen(false);
    setLoanToDelete(null);
  };

  const getConfirmMessage = () => {
    if (i18n.language === 'ar') {
      return `هل أنت متأكد من أن الصناديق قد رجعت إلى المخزن؟`;
    }
    return `Êtes-vous sûr que les caisses sont rentrées au frigo ?`;
  };

  const getDeleteConfirmMessage = (item: LoanItem) => {
    if (i18n.language === 'ar') {
      return `هل أنت متأكد من حذف هذا السجل نهائياً؟\n\nالعميل: ${item.clientName}\nعدد الصناديق: ${item.crates}\n\nهذا الإجراء لا يمكن التراجع عنه.`;
    }
    return `Êtes-vous sûr de vouloir supprimer définitivement ce prêt ?\n\nClient: ${item.clientName}\nCaisses: ${item.crates}\n\nCette action est irréversible.`;
  };

  // Handle print ticket for thermal POS-80 printer - configured for 2 copies
  const handlePrintTicket = (item: LoanItem) => {
    const currentDate = item.createdAt;
    const qrUrl = `${window.location.origin}/loan?ticket=${item.ticketId}`;
    
    // Try to open print window
    const printWindow = window.open('', '_blank', 'width=400,height=600,scrollbars=yes,resizable=yes');
    
    if (!printWindow) {
      // Fallback: use current window
      console.log('Popup blocked, using current window for printing');
      printTicketInCurrentWindow(item, qrUrl, currentDate);
      return;
    }

    // Write the HTML content
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ticket de Prêt - ${item.clientName}</title>
        <meta charset="UTF-8">
        <script>
          // QR code will be generated by the parent window using local library
          function generateQRCode(text, element) {
            // This will be called from the parent window
            element.innerHTML = '<div style="font-size: 8px; color: #666;">Generating QR code...</div>';
          }
        </script>
        <style>
            @page { 
              size: 80mm auto; 
              margin: 0; 
            }
            @media print {
              body { 
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
            body { 
              font-family: 'Courier New', monospace; 
              font-size: 12px; 
              margin: 0; 
              padding: 0; 
              background: white;
              line-height: 1.2;
            }
            .ticket { 
              width: 80mm; 
              margin: 0 auto; 
              padding: 2mm; 
              border: 2px solid #000;
            }
            .header { 
              text-align: center; 
              border-bottom: 2px solid #000; 
              padding-bottom: 2mm; 
              margin-bottom: 2mm; 
            }
            .title { 
              font-size: 16px; 
              font-weight: bold; 
              margin-bottom: 1mm; 
              letter-spacing: 1px; 
            }
            .subtitle { 
              font-size: 14px; 
              font-weight: bold; 
              margin-bottom: 1mm; 
            }
            .ticket-number { 
              font-size: 12px; 
              color: #000; 
              margin-bottom: 1mm; 
              font-weight: bold;
            }
            .section { 
              margin: 1.5mm 0; 
              border: 1px solid #000; 
              padding: 2mm; 
            }
            .section-title { 
              font-weight: bold; 
              font-size: 12px; 
              margin-bottom: 1mm; 
              text-decoration: underline; 
              text-transform: uppercase; 
            }
            .row { 
              display: flex; 
              justify-content: space-between; 
              margin: 1mm 0; 
              padding: 0.5mm 0; 
              font-size: 11px; 
            }
            .label { 
              font-weight: bold; 
              flex: 1; 
            }
            .value { 
              text-align: right; 
              flex: 1; 
              font-weight: normal; 
            }
            .highlight { 
              background-color: #000; 
              color: white; 
              padding: 2mm 3mm; 
              font-weight: bold; 
              text-align: center; 
              margin: 2mm 0; 
              font-size: 14px;
            }
            .qr-section { 
              text-align: center; 
              margin: 2mm 0; 
              padding: 2mm; 
              border: 2px dashed #000; 
            }
            .qr-label { 
              text-align: center; 
              font-size: 10px; 
              margin-bottom: 1mm; 
              font-weight: bold;
            }
            .qr-code { 
              text-align: center; 
              font-family: monospace; 
              font-size: 12px; 
              font-weight: bold; 
            }
            .footer { 
              text-align: center; 
              margin: 2mm 0; 
              font-size: 10px; 
              font-weight: bold;
            }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="header">
            <div class="title">${siteSettings?.name || 'Domaine LYAZAMI'}</div>
            <div class="subtitle">TICKET DE PRÊT CAISSES VIDES</div>
            <div class="ticket-number">N° ${item.ticketId}</div>
            <div style="font-size: 10px; color: #666; margin-top: 1mm; font-style: italic;">
              * Imprimer 2 exemplaires - 1 pour Frigo, 1 pour Chauffeur *
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Informations</div>
            <div class="row">
              <span class="label">Date:</span>
              <span class="value">${currentDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
            </div>
            <div class="row">
              <span class="label">Heure:</span>
              <span class="value">${currentDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Client</div>
            <div class="row">
              <span class="label">Nom:</span>
              <span class="value">${item.clientName}</span>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Transport</div>
            ${item.truckNumber ? `
            <div class="row">
              <span class="label">Matricule:</span>
              <span class="value">${item.truckNumber}</span>
            </div>
            ` : ''}
            ${item.driverName ? `
            <div class="row">
              <span class="label">Chauffeur:</span>
              <span class="value">${item.driverName}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="section">
            <div class="section-title">Prêt</div>
            <div class="row">
              <span class="label">Caisses vides:</span>
              <span class="value">${item.crates}</span>
            </div>
            <div class="row">
              <span class="label">Type:</span>
              <span class="value">${item.crateTypeName}</span>
            </div>
          </div>
          
          <div class="highlight">
            <div style="text-align: center;">CAISSES PRÊTÉES: ${item.crates}</div>
          </div>
          
          <div class="qr-section">
            <div class="qr-label">Code de suivi</div>
            <div class="qr-code">${item.ticketId}</div>
            <div style="text-align: center; margin-top: 2mm;">
              <div id="qrcode" style="display: inline-block;"></div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Signatures</div>
            <div style="margin: 2mm 0;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 5mm;">
                <div style="text-align: center; width: 45%;">
                  <div style="border-bottom: 1px solid #000; height: 10mm; margin-bottom: 1mm;"></div>
                  <div style="font-size: 8px; font-weight: bold;">Signature Frigo</div>
                </div>
                <div style="text-align: center; width: 45%;">
                  <div style="border-bottom: 1px solid #000; height: 10mm; margin-bottom: 1mm;"></div>
                  <div style="font-size: 8px; font-weight: bold;">Signature Camion</div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="footer">═══════════════════════════════</div>
          <div class="footer">Merci pour votre confiance</div>
          <div class="footer">${siteSettings?.name || 'Domaine LYAZAMI'} - Gestion Frigorifique</div>
        </div>
      </body>
    </html>
    `);
    
    // Close the document and trigger print
    printWindow.document.close();
    
    // Wait for content to load then print
    printWindow.onload = function() {
      console.log('Print window loaded, generating QR code...');
      
      // Generate QR code using local library
      setTimeout(() => {
        const qrElement = printWindow.document.getElementById('qrcode');
        
        if (qrElement) {
          console.log('Generating QR code in print window...');
          const canvas = printWindow.document.createElement('canvas');
          qrElement.appendChild(canvas);
          
          QRCode.toCanvas(canvas, qrUrl, {
            width: 100,
            margin: 1,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          }).then(() => {
            console.log('QR code généré avec succès');
          }).catch((error) => {
            console.error('Erreur génération QR code:', error);
            qrElement.innerHTML = '<div style="font-size: 8px; color: #666;">QR: ' + qrUrl + '</div>';
          });
        } else {
          console.error('QR element not found in print window');
        }
        
        // Print after QR code is generated (or failed)
        setTimeout(() => {
          try {
            // Configure print for 2 copies
            printWindow.print();
            console.log('Print dialog opened successfully - configured for 2 copies');
          } catch (error) {
            console.error('Erreur lors de l\'impression:', error);
            alert(t('loans.errors.printError'));
          }
        }, 1000);
      }, 500);
    };
  };

  // Fallback function for printing in current window
  const printTicketInCurrentWindow = (item: LoanItem, qrUrl: string, currentDate: Date) => {
    const printContent = `
      <div style="font-family: 'Courier New', monospace; font-size: 10px; width: 80mm; margin: 0 auto; padding: 2mm; border: 1px solid #000;">
        <div style="text-align: center; border-bottom: 1px solid #000; padding-bottom: 3mm; margin-bottom: 3mm;">
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 1mm; letter-spacing: 1px;">${siteSettings?.name || 'Frigo SaaS'}</div>
          <div style="font-size: 12px; font-weight: bold; margin-bottom: 1mm;">TICKET DE PRÊT CAISSES VIDES</div>
          <div style="font-size: 10px; color: #666; margin-bottom: 2mm;">N° ${item.ticketId}</div>
        </div>
        
        <div style="margin: 2mm 0; border: 1px solid #000; padding: 2mm;">
          <div style="font-weight: bold; font-size: 10px; margin-bottom: 1mm; text-decoration: underline; text-transform: uppercase;">Informations</div>
          <div style="display: flex; justify-content: space-between; margin: 1mm 0; padding: 0.5mm 0; font-size: 9px;">
            <span style="font-weight: bold; flex: 1;">Date:</span>
            <span style="text-align: right; flex: 1; font-weight: normal;">${currentDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 1mm 0; padding: 0.5mm 0; font-size: 9px;">
            <span style="font-weight: bold; flex: 1;">Heure:</span>
            <span style="text-align: right; flex: 1; font-weight: normal;">${currentDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
        
        <div style="margin: 2mm 0; border: 1px solid #000; padding: 2mm;">
          <div style="font-weight: bold; font-size: 10px; margin-bottom: 1mm; text-decoration: underline; text-transform: uppercase;">Client</div>
          <div style="display: flex; justify-content: space-between; margin: 1mm 0; padding: 0.5mm 0; font-size: 9px;">
            <span style="font-weight: bold; flex: 1;">Nom:</span>
            <span style="text-align: right; flex: 1; font-weight: normal;">${item.clientName}</span>
          </div>
        </div>
        
        <div style="margin: 2mm 0; border: 1px solid #000; padding: 2mm;">
          <div style="font-weight: bold; font-size: 10px; margin-bottom: 1mm; text-decoration: underline; text-transform: uppercase;">Prêt</div>
          <div style="display: flex; justify-content: space-between; margin: 1mm 0; padding: 0.5mm 0; font-size: 9px;">
            <span style="font-weight: bold; flex: 1;">Caisses vides:</span>
            <span style="text-align: right; flex: 1; font-weight: normal;">${item.crates}</span>
          </div>
        </div>
        
        <div style="background-color: #000; color: white; padding: 1mm 2mm; font-weight: bold; text-align: center; margin: 1mm 0;">
          <div style="text-align: center;">CAISSES PRÊTÉES: ${item.crates}</div>
        </div>
        
        <div style="text-align: center; margin: 2mm 0; padding: 2mm; border: 1px dashed #000;">
          <div style="text-align: center; font-size: 8px; margin-bottom: 1mm;">Code de suivi</div>
          <div style="text-align: center; font-family: monospace; font-size: 10px; font-weight: bold;">${item.ticketId}</div>
          <div style="text-align: center; margin-top: 2mm;">
            <div id="qrcode-fallback" style="display: inline-block;"></div>
          </div>
        </div>
        
        <div style="text-align: center; margin: 2mm 0; font-size: 8px;">═══════════════════════════════</div>
        <div style="text-align: center; margin: 2mm 0; font-size: 8px;">Merci pour votre confiance</div>
        <div style="text-align: center; margin: 2mm 0; font-size: 8px;">${siteSettings?.name || 'Frigo SaaS'} - Gestion Frigorifique</div>
      </div>
    `;
    
    // Create a print div
    const printDiv = document.createElement('div');
    printDiv.innerHTML = printContent;
    printDiv.style.position = 'absolute';
    printDiv.style.left = '-9999px';
    printDiv.style.top = '0';
    printDiv.style.zIndex = '9999';
    printDiv.style.overflow = 'auto';
    
    document.body.appendChild(printDiv);
    
    // Generate QR code using local library
    const qrElement = printDiv.querySelector('#qrcode-fallback') as HTMLElement;
    if (qrElement) {
      console.log('Generating QR code in fallback...');
      // Create a canvas element
      const canvas = document.createElement('canvas');
      qrElement.appendChild(canvas);
      
      QRCode.toCanvas(canvas, qrUrl, {
        width: 100,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }).then(() => {
        console.log('QR code généré avec succès dans fallback');
        // Print after QR code is generated
        setTimeout(() => {
          window.print();
          // Remove the print div after a delay
          setTimeout(() => {
            document.body.removeChild(printDiv);
          }, 1000);
        }, 500);
      }).catch((error) => {
        console.error('Erreur génération QR code fallback:', error);
        qrElement.innerHTML = '<div style="font-size: 8px; color: #666;">QR: ' + qrUrl + '</div>';
        // Print anyway
        setTimeout(() => {
          window.print();
          setTimeout(() => {
            document.body.removeChild(printDiv);
          }, 1000);
        }, 500);
      });
    } else {
      console.log('QR element not found in fallback');
      // Print without QR code
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          document.body.removeChild(printDiv);
        }, 1000);
      }, 500);
    }
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

  if (hasError) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        <p className="font-medium">{t('loans.errorLoading', 'Erreur de chargement')}</p>
        <button 
          onClick={() => refetchAll()} 
          className="mt-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 text-sm md:text-base">
      {/* Mobile-Optimized Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          {/* Title Section */}
          <div className="text-center sm:text-left">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-1 tracking-tight">
              {t('loans.title', 'Sortie Caisses Vides')}
            </h1>
            <p className="text-sm text-gray-600">
              {t('loans.subtitle', 'Gestion des prêts de caisses vides')}
            </p>
          </div>
          
          {/* Mobile Stats */}
          <div className="grid grid-cols-3 gap-2 sm:hidden">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-blue-600">{loansWithCumulative?.length || 0}</div>
              <div className="text-xs text-blue-600">Total</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-green-600">
                {loansWithCumulative?.filter(l => l.status === 'open').length || 0}
              </div>
              <div className="text-xs text-green-600">Ouverts</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-orange-600">
                {loansWithCumulative?.filter(l => l.status === 'returned').length || 0}
              </div>
              <div className="text-xs text-orange-600">Retournés</div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Mobile: Stack buttons vertically, Desktop: horizontal */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              {/* View Toggle - Mobile optimized */}
              <div className="flex bg-gray-100 rounded-lg p-1 w-full sm:w-auto">
                <button
                  onClick={() => setViewType('table')}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex-1 sm:flex-none ${
                    viewType === 'table'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 4h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="hidden sm:inline">{t('loans.views.table')}</span>
                </button>
                <button
                  onClick={() => setViewType('cards')}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex-1 sm:flex-none ${
                    viewType === 'cards'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span className="hidden sm:inline">{t('loans.views.cards')}</span>
                </button>
              </div>
              
              {/* Cumulative Toggle - Mobile optimized */}
              <button 
                onClick={() => setShowCumulativeTable(!showCumulativeTable)} 
                className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-all duration-200 font-medium text-sm w-full sm:w-auto ${
                  showCumulativeTable 
                    ? 'bg-gray-200 text-gray-900' 
                    : 'bg-gray-100 text-gray-700 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="hidden sm:inline">{showCumulativeTable ? 'Masquer cumulatif' : 'Voir cumulatif'}</span>
                <span className="sm:hidden">{showCumulativeTable ? 'Masquer' : 'Cumulatif'}</span>
              </button>
            </div>
            
            {/* Add Button - Prominent on mobile */}
            <button 
              onClick={() => setIsAdding((v) => !v)} 
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold text-sm w-full sm:w-auto"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M12 4.5a.75.75 0 01.75.75V11h5.75a.75.75 0 010 1.5H12.75v5.75a.75.75 0 01-1.5 0V12.5H5.5a.75.75 0 010-1.5h5.75V5.25A.75.75 0 0112 4.5z" clipRule="evenodd" />
              </svg>
              {t('loans.add', 'Nouveau prêt')}
            </button>
          </div>
        </div>
      </div>

      {/* Résumé des caisses vides - Apple-style design */}
      <Card className="bg-white border-0 shadow-lg rounded-2xl sm:rounded-3xl overflow-hidden hover:shadow-xl transition-all duration-300">
        <div className="bg-gradient-to-br from-gray-50 via-white to-gray-100 p-4 sm:p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
            {/* Left side - Icon and title */}
            <div className="flex items-center gap-3 sm:gap-4 md:gap-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-white rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-lg border border-gray-100 overflow-hidden relative">
                {/* Modern gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-gray-50/50 rounded-2xl sm:rounded-3xl"></div>
                <img 
                  src="/images/Caisse_emty.png" 
                  alt="Caisse vide" 
                  className="w-7 h-7 sm:w-10 sm:h-10 md:w-12 md:h-12 object-contain relative z-10 drop-shadow-sm"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                    if (nextElement) {
                      nextElement.style.display = 'block';
                    }
                  }}
                />
                <svg className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 text-gray-400 hidden relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 tracking-tight">
                  {t('loans.emptyCratesTitle', 'Caisses vides')}
                </h3>
                <p className="text-xs sm:text-sm md:text-base text-gray-600 mt-0.5 sm:mt-1 font-medium">
                  {t('loans.availableEmptyCrates', 'Disponibles')}
                </p>
              </div>
            </div>
            
            {/* Right side - Numbers and stats */}
            <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6">
              <div className="text-right">
                <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-1 sm:mb-2 tracking-tight">
                  {availableEmptyCrates.toLocaleString()}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 font-medium">
                  {t('loans.totalConfigured', 'Total')}: {totalEmptyCrates.toLocaleString()}
                </div>
              </div>
              
              {/* Enhanced status indicator */}
              <div className="flex flex-col items-center gap-1 sm:gap-2">
                <div className={`w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 rounded-full shadow-sm ${
                  availableEmptyCrates > totalEmptyCrates * 0.3 
                    ? 'bg-green-400' 
                    : availableEmptyCrates > totalEmptyCrates * 0.1 
                      ? 'bg-yellow-400' 
                      : 'bg-red-400'
                }`}></div>
                <div className="text-xs text-gray-500 font-medium hidden sm:block">
                  {availableEmptyCrates > totalEmptyCrates * 0.3 
                    ? 'Bon' 
                    : availableEmptyCrates > totalEmptyCrates * 0.1 
                      ? 'Faible' 
                      : 'Critique'
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Filter and Cumulative Table Section - Hidden during add/edit */}
      {!isAdding && !isEditing && (
        <div className="space-y-4">
          {/* Modern Filter Section - Mobile Optimized */}
          <Card className="bg-white border-0 shadow-sm rounded-xl">
          <div className="p-3 sm:p-4 md:p-6">
            <div className="space-y-3 sm:space-y-4">
              {/* Mobile-First Filter Controls */}
              <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
                {/* Client Select Filter - Full width on mobile */}
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700">
                    {t('loans.filterByClient', 'Client')}
                  </label>
                  <div className="relative">
                    <select
                      value={clientFilter}
                      onChange={(e) => setClientFilter(e.target.value)}
                      className="block w-full pl-3 pr-8 py-2 sm:py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                    >
                      <option value="">{t('loans.allClients', 'Tous les clients')}</option>
                      {(clientOptions || []).map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:pr-3 pointer-events-none">
                      <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Name Search Filter - Full width on mobile */}
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700">
                    {t('loans.searchByName', 'Rechercher')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={nameFilter}
                      onChange={(e) => setNameFilter(e.target.value)}
                      placeholder={t('loans.searchPlaceholder', 'Rechercher...') as string}
                      className="block w-full pl-9 sm:pl-10 pr-8 sm:pr-10 py-2 sm:py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {nameFilter && (
                      <button
                        onClick={() => setNameFilter('')}
                        className="absolute inset-y-0 right-0 pr-2 sm:pr-3 flex items-center hover:text-gray-600"
                      >
                        <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sort By - Full width on mobile */}
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700">
                    {t('loans.sortBy', 'Trier par')}
                  </label>
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="block w-full pl-3 pr-8 sm:pr-10 py-2 sm:py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                    >
                      <option value="date">{t('loans.sortByDate', 'Date')}</option>
                      <option value="client">{t('loans.sortByClient', 'Client')}</option>
                      <option value="crates">{t('loans.sortByCrates', 'Caisses')}</option>
                      <option value="cumulative">{t('loans.sortByCumulative', 'Cumulatif')}</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:pr-3 pointer-events-none">
                      <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Sort Order - Compact on mobile */}
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700">
                    {t('loans.sortOrder', 'Ordre')}
                  </label>
                  <div className="flex gap-1 sm:gap-2">
                    <button
                      onClick={() => setSortOrder('asc')}
                      className={`flex-1 px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                        sortOrder === 'asc'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      title="Ascendant"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                        <span className="hidden sm:inline">↑</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setSortOrder('desc')}
                      className={`flex-1 px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                        sortOrder === 'desc'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      title="Descendant"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        <span className="hidden sm:inline">↓</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Mobile-Optimized Results Summary */}
              <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="text-xs sm:text-sm text-gray-600">
                    <span className="font-medium">{loansWithCumulative.length}</span> {loansWithCumulative.length === 1 ? 'prêt' : 'prêts'}
                    {(nameFilter || clientFilter) && (
                      <span className="ml-1 text-blue-600">
                        (filtré)
                      </span>
                    )}
                  </div>
                  {(nameFilter || clientFilter) && (
                    <button
                      onClick={() => {
                        setNameFilter('');
                        setClientFilter('');
                      }}
                      className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded-md hover:bg-blue-50 transition-colors"
                    >
                      Effacer
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Cumulative Table */}
        {showCumulativeTable && (
          <Card className="bg-white border-0 shadow-sm rounded-xl">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('loans.cumulativeTable.title', 'Tableau cumulatif des prêts')}
                </h3>
                <div className="text-sm text-gray-600">
                  {cumulativeData.length} {cumulativeData.length === 1 ? 'client' : 'clients'}
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <Table>
                  <TableHead>
                    <TableRow className="border-b border-gray-200">
                      <TableHeader className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">
                        {t('billing.client', 'Client')}
                      </TableHeader>
                      <TableHeader className="text-center py-3 px-4 font-semibold text-gray-900 text-sm">
                        {t('loans.cumulativeTable.totalCrates', 'Total caisses')}
                      </TableHeader>
                      <TableHeader className="text-center py-3 px-4 font-semibold text-gray-900 text-sm">
                        {t('loans.cumulativeTable.loanCount', 'Nombre de prêts')}
                      </TableHeader>
                      <TableHeader className="text-center py-3 px-4 font-semibold text-gray-900 text-sm">
                        {t('loans.cumulativeTable.firstLoan', 'Premier prêt')}
                      </TableHeader>
                      <TableHeader className="text-center py-3 px-4 font-semibold text-gray-900 text-sm">
                        {t('loans.cumulativeTable.lastLoan', 'Dernier prêt')}
                      </TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cumulativeData.length > 0 ? (
                      cumulativeData.map((client) => (
                        <TableRow key={client.clientName} className="hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
                          <TableCell className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-semibold text-blue-600">
                                  {client.clientName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div className="font-medium text-gray-900">
                                {client.clientName}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 px-4 text-center">
                            <div className="text-lg font-bold text-blue-600">
                              {client.totalCrates}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 px-4 text-center">
                            <div className="text-sm font-medium text-gray-600">
                              {client.loanCount}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 px-4 text-center">
                            <div className="text-sm text-gray-600">
                              {client.firstLoanDate.toLocaleDateString(i18n.language)}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 px-4 text-center">
                            <div className="text-sm text-gray-600">
                              {client.lastLoanDate.toLocaleDateString(i18n.language)}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                          <div className="flex flex-col items-center gap-2">
                            <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span className="text-sm font-medium">Aucun prêt enregistré</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </Card>
        )}
        </div>
      )}

      {isAdding && (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('billing.client', 'Client')}</label>
              <select
                value={form.clientId}
                onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">{t('billing.selectClient', 'Sélectionner un client')}</option>
                {(clientOptions || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('loans.crateType', 'Type de caisse')}</label>
              <select
                value={form.crateTypeId}
                onChange={(e) => setForm((f) => ({ ...f, crateTypeId: e.target.value }))}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">Sélectionner un type de caisse</option>
                {(crateTypes || []).map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.customName || ct.name} - {translateCrateType(ct.type)} - {translateColor(ct.color)}
                  </option>
                ))}
              </select>
              
              {/* Stock Information */}
              {form.crateTypeId && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-900">
                      {t('loans.stockAvailable', 'Stock disponible')}:
                    </span>
                    <span className="text-lg font-bold text-blue-600">
                      {(() => {
                        const selectedCrateType = crateTypes?.find(ct => ct.id === form.crateTypeId);
                        return selectedCrateType ? selectedCrateType.quantity || 0 : 0;
                      })()}
                    </span>
                  </div>
                  <div className="text-xs text-blue-700 mt-1">
                    {t('loans.stockDescription', 'Caisses vides disponibles pour ce type')}
                  </div>
                </div>
              )}
            </div>
            
            {/* Client Information Display */}
            {form.clientId && clientStats && (
              <ClientInfoDisplay 
                clientStats={clientStats} 
                onNavigateToReservations={() => navigate('/reservations')} 
              />
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('loans.crates', 'Caisses')}</label>
              <input type="number" min={1} value={form.crates} onChange={(e) => setForm((f)=>({ ...f, crates: Number(e.target.value) }))} className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('loans.date', 'Date')}</label>
              <input 
                type="date" 
                value={form.customDate} 
                onChange={(e) => setForm((f)=>({ ...f, customDate: e.target.value }))} 
                className="w-full border rounded-md px-3 py-2" 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('reception.truck', 'Camion')}</label>
              <EnhancedSelect
                value={form.truckId}
                onChange={(value) => setForm((f) => ({ ...f, truckId: value }))}
                placeholder={t('reception.selectTruck', 'Sélectionner un camion')}
                options={trucks?.map(truck => ({
                  id: truck.id,
                  value: truck.id,
                  label: `${truck.number} ${truck.color ? `(${truck.color})` : ''}`,
                  icon: '🚛'
                })) || []}
                editOptions={trucks?.map(truck => ({
                  id: truck.id,
                  value: truck.id,
                  label: truck.number,
                  icon: '🚛'
                })) || []}
                addLabel={t('reception.addTruck', 'Ajouter un camion')}
                editLabel={t('reception.editTruck', 'Éditer')}
                onAdd={() => setIsAddingTruck(true)}
                onEdit={(truckId) => {
                  const truck = trucks?.find(t => t.id === truckId);
                  if (truck) {
                    setTruckForm({
                      number: truck.number,
                      color: truck.color || '',
                      photoUrl: truck.photoUrl || ''
                    });
                    setEditingTruckId(truckId);
                    setIsAddingTruck(true);
                  }
                }}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('reception.driver', 'Chauffeur')}</label>
              <EnhancedSelect
                value={form.driverId}
                onChange={(value) => setForm((f) => ({ ...f, driverId: value }))}
                placeholder={t('reception.selectDriver', 'Sélectionner un chauffeur')}
                options={drivers?.map(driver => ({
                  id: driver.id,
                  value: driver.id,
                  label: `${driver.name} (${driver.licenseNumber})`,
                  icon: '👨‍💼'
                })) || []}
                editOptions={drivers?.map(driver => ({
                  id: driver.id,
                  value: driver.id,
                  label: driver.name,
                  icon: '👨‍💼'
                })) || []}
                addLabel={t('reception.addDriver', 'Ajouter un chauffeur')}
                editLabel={t('reception.editDriver', 'Éditer')}
                onAdd={() => setIsAddingDriver(true)}
                onEdit={(driverId) => {
                  const driver = drivers?.find(d => d.id === driverId);
                  if (driver) {
                    setDriverForm({
                      name: driver.name,
                      phone: driver.phone || '',
                      licenseNumber: driver.licenseNumber || ''
                    });
                    setEditingDriverId(driverId);
                    setIsAddingDriver(true);
                  }
                }}
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={() => addLoan.mutate(form)} disabled={!form.clientId || form.crates <=0 || addLoan.isLoading} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-60">
              {addLoan.isLoading ? t('common.loading') : t('common.save')}
            </button>
            <button onClick={() => setIsAdding(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200">{t('common.cancel')}</button>
          </div>
        </Card>
      )}

      {isEditing && (
        <Card>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{t('common.edit', 'Modifier')} - {editingLoan?.clientName}</h3>
            <p className="text-sm text-gray-600">{t('loans.editLoanInfo', 'Modifier toutes les informations du prêt')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('billing.client', 'Client')}</label>
              <select
                value={form.clientId}
                onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">{t('billing.selectClient', 'Sélectionner un client')}</option>
                {(clientOptions || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            
            {/* Client Information Display */}
            {form.clientId && clientStats && (
              <ClientInfoDisplay 
                clientStats={clientStats} 
                onNavigateToReservations={() => navigate('/reservations')} 
              />
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('loans.crates', 'Caisses')}</label>
              <input type="number" min={1} value={form.crates} onChange={(e) => setForm((f)=>({ ...f, crates: Number(e.target.value) }))} className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('loans.date', 'Date')}</label>
              <input 
                type="date" 
                value={form.customDate} 
                onChange={(e) => setForm((f)=>({ ...f, customDate: e.target.value }))} 
                className="w-full border rounded-md px-3 py-2" 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('reception.truck', 'Camion')}</label>
              <EnhancedSelect
                value={form.truckId}
                onChange={(value) => setForm((f) => ({ ...f, truckId: value }))}
                placeholder={t('reception.selectTruck', 'Sélectionner un camion')}
                options={trucks?.map(truck => ({
                  id: truck.id,
                  value: truck.id,
                  label: `${truck.number} ${truck.color ? `(${truck.color})` : ''}`,
                  icon: '🚛'
                })) || []}
                editOptions={trucks?.map(truck => ({
                  id: truck.id,
                  value: truck.id,
                  label: truck.number,
                  icon: '🚛'
                })) || []}
                addLabel={t('reception.addTruck', 'Ajouter un camion')}
                editLabel={t('reception.editTruck', 'Éditer')}
                onAdd={() => setIsAddingTruck(true)}
                onEdit={(truckId) => {
                  const truck = trucks?.find(t => t.id === truckId);
                  if (truck) {
                    setTruckForm({
                      number: truck.number,
                      color: truck.color || '',
                      photoUrl: truck.photoUrl || ''
                    });
                    setEditingTruckId(truckId);
                    setIsAddingTruck(true);
                  }
                }}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('reception.driver', 'Chauffeur')}</label>
              <EnhancedSelect
                value={form.driverId}
                onChange={(value) => setForm((f) => ({ ...f, driverId: value }))}
                placeholder={t('reception.selectDriver', 'Sélectionner un chauffeur')}
                options={drivers?.map(driver => ({
                  id: driver.id,
                  value: driver.id,
                  label: `${driver.name} (${driver.licenseNumber})`,
                  icon: '👨‍💼'
                })) || []}
                editOptions={drivers?.map(driver => ({
                  id: driver.id,
                  value: driver.id,
                  label: driver.name,
                  icon: '👨‍💼'
                })) || []}
                addLabel={t('reception.addDriver', 'Ajouter un chauffeur')}
                editLabel={t('reception.editDriver', 'Éditer')}
                onAdd={() => setIsAddingDriver(true)}
                onEdit={(driverId) => {
                  const driver = drivers?.find(d => d.id === driverId);
                  if (driver) {
                    setDriverForm({
                      name: driver.name,
                      phone: driver.phone || '',
                      licenseNumber: driver.licenseNumber || ''
                    });
                    setEditingDriverId(driverId);
                    setIsAddingDriver(true);
                  }
                }}
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={handleSaveEdit} disabled={!form.clientId || form.crates <=0 || editLoan.isLoading} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-60">
              {editLoan.isLoading ? t('common.loading') : t('common.save')}
            </button>
            <button onClick={handleCancelEdit} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200">{t('common.cancel')}</button>
          </div>
        </Card>
      )}

      {/* Loans Display - Table or Cards */}
      {viewType === 'table' ? (
        <Card className="bg-white border-0 shadow-sm rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
            <TableHead>
              <TableRow className="border-b border-gray-100">
                <TableHeader className="text-left py-2 px-2 sm:py-3 sm:px-3 md:px-4 lg:px-6 font-semibold text-gray-900 text-xs sm:text-sm">
                  {t('billing.client', 'Client')}
                </TableHeader>
                <TableHeader className="text-center py-2 px-1 sm:py-3 sm:px-2 md:px-3 lg:px-4 font-semibold text-gray-900 text-xs sm:text-sm">
                  {t('loans.crates', 'Caisses')}
                </TableHeader>
                <TableHeader className="text-center py-2 px-1 sm:py-3 sm:px-2 md:px-3 lg:px-4 font-semibold text-gray-900 text-xs sm:text-sm hidden sm:table-cell">
                  {t('loans.cumulative', 'Cumulatif')}
                </TableHeader>
                <TableHeader className="text-center py-2 px-1 sm:py-3 sm:px-2 md:px-3 lg:px-4 font-semibold text-gray-900 text-xs sm:text-sm hidden md:table-cell">
                  {t('loans.crateType', 'Type')}
                </TableHeader>
                <TableHeader className="text-center py-2 px-1 sm:py-3 sm:px-2 md:px-3 lg:px-4 font-semibold text-gray-900 text-xs sm:text-sm hidden lg:table-cell">
                  {t('clients.created', 'Créé le')}
                </TableHeader>
                <TableHeader className="text-center py-2 px-1 sm:py-3 sm:px-2 md:px-3 lg:px-4 font-semibold text-gray-900 text-xs sm:text-sm hidden md:table-cell">
                  {t('reception.truck', 'Matricule Camion')}
                </TableHeader>
                <TableHeader className="text-center py-2 px-1 sm:py-3 sm:px-2 md:px-3 lg:px-4 font-semibold text-gray-900 text-xs sm:text-sm hidden lg:table-cell">
                  {t('reception.driver', 'Chauffeur')}
                </TableHeader>
                <TableHeader className="text-center py-2 px-1 sm:py-3 sm:px-2 md:px-3 lg:px-4 font-semibold text-gray-900 text-xs sm:text-sm">
                  {t('billing.status', 'Statut')}
                </TableHeader>
                <TableHeader className="text-center py-2 px-1 sm:py-3 sm:px-2 md:px-3 lg:px-4 font-semibold text-gray-900 text-xs sm:text-sm">
                  {t('loans.print', 'Imprimer')}
                </TableHeader>
                <TableHeader className="text-center py-2 px-1 sm:py-3 sm:px-2 md:px-3 lg:px-4 font-semibold text-gray-900 text-xs sm:text-sm">
                  {t('billing.actions', 'Actions')}
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
            {Array.isArray(loansWithCumulative) && loansWithCumulative.length > 0 ? (
              loansWithCumulative.map((l) => (
                <TableRow key={l.id} className="hover:bg-gray-50/50 border-b border-gray-100 last:border-b-0 transition-colors">
                  <TableCell className="py-2 px-2 sm:py-3 sm:px-3 md:px-4 lg:px-6">
                    <div className="font-medium text-xs sm:text-sm text-gray-900">
                      {l.clientName || '-'}
                    </div>
                    {/* Mobile: Show cumulative, date, truck, and driver info below client name */}
                    <div className="sm:hidden mt-1 space-y-1">
                      <div className="text-xs text-blue-600 font-semibold">
                        Cumulatif: {l.cumulativeCrates}
                      </div>
                      <div className="text-xs text-gray-500">
                        {l.createdAt.toLocaleDateString(i18n.language)}
                      </div>
                      {l.truckNumber && (
                        <div className="text-xs text-gray-600">
                          Camion: {l.truckNumber}
                        </div>
                      )}
                      {l.driverName && (
                        <div className="text-xs text-gray-600">
                          Chauffeur: {l.driverName}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 px-1 sm:py-3 sm:px-2 md:px-3 lg:px-4 text-center">
                    <div className="text-xs sm:text-sm font-semibold text-gray-900">
                      {l.crates}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 px-1 sm:py-3 sm:px-2 md:px-3 lg:px-4 text-center hidden sm:table-cell">
                    <div className="text-xs sm:text-sm font-bold text-blue-600">
                      {l.cumulativeCrates}
                    </div>
                    <div className="text-xs text-gray-500">
                      total
                    </div>
                  </TableCell>
                  <TableCell className="py-2 px-1 sm:py-3 sm:px-2 md:px-3 lg:px-4 text-center hidden md:table-cell">
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-xs sm:text-sm font-medium text-gray-900">
                        {l.crateTypeName || 'N/A'}
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${
                          l.crateColor === 'blue' ? 'bg-blue-500' :
                          l.crateColor === 'green' ? 'bg-green-500' :
                          l.crateColor === 'red' ? 'bg-red-500' :
                          l.crateColor === 'yellow' ? 'bg-yellow-500' :
                          l.crateColor === 'white' ? 'bg-white border border-gray-300' :
                          l.crateColor === 'black' ? 'bg-black' :
                          l.crateColor === 'gray' ? 'bg-gray-500' :
                          l.crateColor === 'brown' ? 'bg-amber-600' : 'bg-gray-400'
                        }`}></div>
                        <span className="text-xs text-gray-600 capitalize">{translateCrateType(l.crateType)}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 px-1 sm:py-3 sm:px-2 md:px-3 lg:px-4 text-center hidden lg:table-cell">
                    <div className="text-xs sm:text-sm text-gray-600">
                      {l.createdAt.toLocaleDateString(i18n.language)}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 px-1 sm:py-3 sm:px-2 md:px-3 lg:px-4 text-center hidden md:table-cell">
                    <div className="text-xs sm:text-sm text-gray-600">
                      {l.truckNumber ? (
                        <div className="flex flex-col items-center gap-1">
                          <div className="font-medium text-gray-900">
                            {l.truckNumber}
                          </div>
                          <div className="text-xs text-gray-500">
                            Matricule
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 px-1 sm:py-3 sm:px-2 md:px-3 lg:px-4 text-center hidden lg:table-cell">
                    <div className="text-xs sm:text-sm text-gray-600">
                      {l.driverName ? (
                        <div className="flex flex-col items-center gap-1">
                          <div className="font-medium text-gray-900">
                            {l.driverName}
                          </div>
                          <div className="text-xs text-gray-500">
                            Chauffeur
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 px-1 sm:py-3 sm:px-2 md:px-3 lg:px-4 text-center">
                    <span className={`inline-flex items-center px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-xs font-medium ${
                      l.status === 'open' 
                        ? 'bg-yellow-100 text-yellow-700' 
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {l.status === 'open' ? 'Ouvert' : 'Retourné'}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 px-1 sm:py-3 sm:px-2 md:px-3 lg:px-4 text-center">
                    <button 
                      onClick={() => handlePrintTicket(l)} 
                      className="px-2 py-1.5 sm:px-3 sm:py-2 rounded-md bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-medium transition-colors w-full sm:w-auto"
                      title="Imprimer ticket"
                    >
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 mx-auto sm:mx-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      <span className="hidden sm:inline ml-1">Imprimer</span>
                    </button>
                  </TableCell>
                  <TableCell className="py-2 px-1 sm:py-3 sm:px-2 md:px-3 lg:px-4">
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      {l.status === 'open' && (
                        <>
                          <button 
                            onClick={() => handleEditLoan(l)} 
                            className="px-1.5 py-1 sm:px-2 sm:py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                            title="Modifier"
                          >
                            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => handleMarkReturned(l)} 
                            className="px-1.5 py-1 sm:px-2 sm:py-1.5 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium transition-colors"
                            title="Retourner"
                          >
                            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => handleDeleteLoan(l)} 
                        className="px-1.5 py-1 sm:px-2 sm:py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors"
                        title="Supprimer"
                      >
                        <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <span className="text-sm font-medium">Aucun prêt enregistré</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
          </div>
        </Card>
      ) : (
        <div className="w-full">
          {Array.isArray(loansWithCumulative) && loansWithCumulative.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8 justify-items-center px-4 sm:px-0">
              {loansWithCumulative.map((loan) => (
                <div key={loan.id} className="w-full max-w-xs sm:max-w-sm">
                  <LoanCard loan={loan} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex justify-center">
              <Card className="bg-white border-0 shadow-sm rounded-2xl overflow-hidden max-w-md w-full">
                <div className="text-center py-12 text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <span className="text-sm font-medium">Aucun prêt enregistré</span>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Return */}
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={cancelReturn}
        onConfirm={confirmReturn}
        title={t('loans.confirmReturnTitle', 'Confirmer le retour')}
        message={loanToReturn ? getConfirmMessage() : ''}
        confirmText={t('loans.confirmReturn', 'Confirmer le retour') as string}
        cancelText={t('common.cancel', 'Annuler') as string}
        type="warning"
        isLoading={markReturned.isLoading}
      />

      {/* Confirmation Modal for Delete */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title={t('loans.confirmDeleteTitle', 'Confirmer la suppression')}
        message={loanToDelete ? getDeleteConfirmMessage(loanToDelete) : ''}
        confirmText={t('common.delete', 'Supprimer') as string}
        cancelText={t('common.cancel', 'Annuler') as string}
        type="danger"
        isLoading={deleteLoan.isLoading}
      />

      {/* Add Truck Modal */}
      {isAddingTruck && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {editingTruckId ? t('reception.editTruck', 'Éditer le camion') : t('reception.addTruck', 'Ajouter un camion')}
                </h3>
                <button
                  onClick={() => {
                    setIsAddingTruck(false);
                    setEditingTruckId(null);
                    setTruckForm({ number: '', color: '', photoUrl: '' });
                  }}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('reception.truckNumber', 'Matricule du camion')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={truckForm.number}
                    onChange={(e) => setTruckForm((f) => ({ ...f, number: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder={t('reception.truckNumberPlaceholder', 'Ex: TR-2025-001') as string}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('reception.truckColor', 'Couleur')}</label>
                  <input
                    type="text"
                    value={truckForm.color}
                    onChange={(e) => setTruckForm((f) => ({ ...f, color: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder={t('reception.truckColorPlaceholder', 'Ex: Rouge, Bleu, Blanc...') as string}
                  />
                </div>
              </div>
              
              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={() => {
                    if (editingTruckId) {
                      // Update existing truck
                      updateTruck.mutate({ id: editingTruckId, ...truckForm });
                    } else {
                      // Add new truck
                      addTruck.mutate(truckForm);
                    }
                  }}
                  disabled={!truckForm.number || addTruck.isLoading || updateTruck.isLoading}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-60"
                >
                  {addTruck.isLoading || updateTruck.isLoading ? t('common.loading') : (editingTruckId ? t('common.update') : t('common.save'))}
                </button>
                <button
                  onClick={() => {
                    setIsAddingTruck(false);
                    setEditingTruckId(null);
                    setTruckForm({ number: '', color: '', photoUrl: '' });
                  }}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Driver Modal */}
      {isAddingDriver && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {editingDriverId ? t('reception.editDriver', 'Éditer le chauffeur') : t('reception.addDriver', 'Ajouter un chauffeur')}
                </h3>
                <button
                  onClick={() => {
                    setIsAddingDriver(false);
                    setEditingDriverId(null);
                    setDriverForm({ name: '', phone: '', licenseNumber: '' });
                  }}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('reception.driverName', 'Nom du chauffeur')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={driverForm.name}
                    onChange={(e) => setDriverForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder={t('reception.driverNamePlaceholder', 'Ex: Ahmed Benali') as string}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('reception.driverPhone', 'Téléphone')}</label>
                  <input
                    type="tel"
                    value={driverForm.phone}
                    onChange={(e) => setDriverForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder={t('reception.driverPhonePlaceholder', 'Ex: +213 123 456 789') as string}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('reception.driverLicense', 'Numéro de permis')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={driverForm.licenseNumber}
                    onChange={(e) => setDriverForm((f) => ({ ...f, licenseNumber: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder={t('reception.driverLicensePlaceholder', 'Ex: DL-2025-001') as string}
                    required
                  />
                </div>
              </div>
              
              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={() => {
                    if (editingDriverId) {
                      // Update existing driver
                      updateDriver.mutate({ id: editingDriverId, ...driverForm });
                    } else {
                      // Add new driver
                      addDriver.mutate(driverForm);
                    }
                  }}
                  disabled={!driverForm.name || !driverForm.licenseNumber || addDriver.isLoading || updateDriver.isLoading}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-60"
                >
                  {addDriver.isLoading || updateDriver.isLoading ? t('common.loading') : (editingDriverId ? t('common.update') : t('common.save'))}
                </button>
                <button
                  onClick={() => {
                    setIsAddingDriver(false);
                    setEditingDriverId(null);
                    setDriverForm({ name: '', phone: '', licenseNumber: '' });
                  }}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


