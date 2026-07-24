import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, orderBy, getDocs, Timestamp, doc, getDoc } from '@/lib/db';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { Card } from '../../components/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/Table';
import { Spinner } from '../../components/Spinner';
import { useTranslation } from 'react-i18next';
import { PartialPaymentModal } from './PartialPaymentModal';

interface UpcomingPayment {
  id: string;
  clientId: string;
  clientName: string;
  reservationId: string;
  reservationReference: string;
  reservedCrates: number;
  advanceAmount: number;
  depositRequired: number;
  depositPaid: number;
  remainingAmount: number;
  dueDate: Timestamp;
  status: 'pending' | 'partial' | 'overdue';
  priority: 'high' | 'medium' | 'low';
}

interface PricingConfig {
  tarif_caisse_saison: number;
}

export const UpcomingPayments: React.FC = () => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const [selectedPayment, setSelectedPayment] = useState<UpcomingPayment | null>(null);
  const [isPartialPaymentOpen, setIsPartialPaymentOpen] = useState(false);

  // Function to calculate end of season based on reservation date
  const calculateEndOfSeason = (reservationDate: Date): Date => {
    const date = new Date(reservationDate);
    const month = date.getMonth(); // 0-11
    
    // Season configuration (can be made configurable later)
    const seasonConfig = {
      summer: { months: [5, 6, 7], duration: 4 }, // June-August, 4 months
      autumn: { months: [8, 9, 10], duration: 5 }, // September-November, 5 months
      winter: { months: [11, 0, 1], duration: 8 }, // December-February, 8 months
      spring: { months: [2, 3, 4], duration: 6 }   // March-May, 6 months
    };
    
    // Find which season the reservation belongs to
    let seasonDuration = 6; // Default fallback
    
    if (seasonConfig.summer.months.includes(month)) {
      seasonDuration = seasonConfig.summer.duration;
    } else if (seasonConfig.autumn.months.includes(month)) {
      seasonDuration = seasonConfig.autumn.duration;
    } else if (seasonConfig.winter.months.includes(month)) {
      seasonDuration = seasonConfig.winter.duration;
    } else if (seasonConfig.spring.months.includes(month)) {
      seasonDuration = seasonConfig.spring.duration;
    }
    
    // Add the season duration to the reservation date
    const endDate = new Date(date);
    endDate.setMonth(endDate.getMonth() + seasonDuration);
    
    return endDate;
  };

  // Fetch pricing configuration
  const { data: pricingConfig, isLoading: configLoading } = useQuery({
    queryKey: ['pricing-config', tenantId],
    queryFn: async (): Promise<PricingConfig> => {
      const docRef = doc(db, 'tenants', tenantId, 'settings', 'pricing');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as PricingConfig;
      }
      return { tarif_caisse_saison: 0 };
    },
  });

  // Fetch active reservations
  const { data: upcomingPayments, isLoading, error } = useQuery({
    queryKey: ['upcoming-payments', tenantId, pricingConfig?.tarif_caisse_saison],
    queryFn: async (): Promise<UpcomingPayment[]> => {
      // First, get all reservations without complex queries
      const q = query(
        collection(db, 'tenants', tenantId, 'reservations')
      );
      const snapshot = await getDocs(q);
      
      // Filter in JavaScript instead of Firestore
      const allReservations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const reservations = allReservations.filter(reservation => 
        reservation.status === 'REQUESTED' || reservation.status === 'APPROVED'
      );
      
      // Use the pricing configuration for crate price
      const pricePerCrate = pricingConfig?.tarif_caisse_saison || 30; // Default 30 MAD per crate
      
      // Calculate upcoming payments based on reservations
      const payments: UpcomingPayment[] = reservations.map(reservation => {
        const totalCautionRequired = reservation.reservedCrates * pricePerCrate;
        const remainingAmount = totalCautionRequired - (reservation.depositPaid || 0);
        
        // Calculate due date (end of season)
        const dueDate = calculateEndOfSeason(reservation.createdAt.toDate());
        
        // Determine status
        let status: 'pending' | 'partial' | 'overdue' = 'pending';
        if (reservation.depositPaid > 0 && remainingAmount > 0) {
          status = 'partial';
        }
        if (new Date() > dueDate && remainingAmount > 0) {
          status = 'overdue';
        }
        
        // Determine priority
        let priority: 'high' | 'medium' | 'low' = 'low';
        if (remainingAmount > 1000) priority = 'high';
        else if (remainingAmount > 500) priority = 'medium';
        
        const payment = {
          id: `payment-${reservation.id}`,
          clientId: reservation.clientId,
          clientName: reservation.clientName,
          reservationId: reservation.id,
          reservationReference: reservation.reference,
          reservedCrates: reservation.reservedCrates,
          advanceAmount: reservation.advanceAmount || 0,
          depositRequired: totalCautionRequired,
          depositPaid: reservation.depositPaid || 0,
          remainingAmount,
          dueDate: Timestamp.fromDate(dueDate),
          status,
          priority,
        };
        
        return payment;
      }).filter(payment => payment.remainingAmount > 0); // Only show payments with remaining amount
      
      return payments;
    },
    // Remove the enabled condition to always run the query
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (timestamp: Timestamp) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(timestamp.toDate());
  };

  const getSeasonName = (month: number): string => {
    if ([5, 6, 7].includes(month)) return 'Été';
    if ([8, 9, 10].includes(month)) return 'Automne';
    if ([11, 0, 1].includes(month)) return 'Hiver';
    if ([2, 3, 4].includes(month)) return 'Printemps';
    return 'Inconnue';
  };

  const getSeasonIcon = (month: number): string => {
    if ([5, 6, 7].includes(month)) return '☀️';
    if ([8, 9, 10].includes(month)) return '🍂';
    if ([11, 0, 1].includes(month)) return '❄️';
    if ([2, 3, 4].includes(month)) return '🌸';
    return '📅';
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      partial: 'bg-blue-100 text-blue-800',
      overdue: 'bg-red-100 text-red-800',
    };
    
    const labels = {
      pending: t('caisse.pending', 'En attente'),
      partial: t('caisse.partial', 'Partiel'),
      overdue: t('caisse.overdue', 'En retard'),
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return '🔴';
      case 'medium':
        return '🟡';
      case 'low':
        return '🟢';
      default:
        return '⚪';
    }
  };

  const totalUpcoming = upcomingPayments?.reduce((sum, payment) => sum + payment.remainingAmount, 0) || 0;
  const overdueAmount = upcomingPayments?.filter(p => p.status === 'overdue').reduce((sum, payment) => sum + payment.remainingAmount, 0) || 0;
  const thisWeekAmount = upcomingPayments?.filter(p => {
    const dueDate = p.dueDate.toDate();
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return dueDate <= nextWeek && p.status !== 'overdue';
  }).reduce((sum, payment) => sum + payment.remainingAmount, 0) || 0;


  if (isLoading || configLoading) {
    return (
      <Card className="p-6">
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <div className="text-red-600 mb-2">Erreur lors du chargement</div>
          <div className="text-sm text-gray-500">{error.message}</div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('caisse.totalToCollect', 'Total à encaisser')}</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(totalUpcoming)}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('caisse.thisWeek', 'Cette semaine')}</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(thisWeekAmount)}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">📅</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('caisse.overdue', 'En retard')}</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(overdueAmount)}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Table */}
        <Card>
          <div className="p-4 md:p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
              <h3 className="text-lg font-semibold">{t('caisse.upcomingPayments', 'Prochains Paiements')}</h3>
              <div className="flex flex-wrap gap-2">
                <button className="px-3 py-1 text-xs sm:text-sm bg-red-100 text-red-700 rounded-full">
                  {t('caisse.overdue', 'En retard')}
                </button>
                <button className="px-3 py-1 text-xs sm:text-sm bg-blue-100 text-blue-700 rounded-full">
                  {t('caisse.thisWeek', 'Cette semaine')}
                </button>
                <button className="px-3 py-1 text-xs sm:text-sm bg-green-100 text-green-700 rounded-full">
                  {t('caisse.all', 'Tous')}
                </button>
              </div>
            </div>
          </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader className="min-w-[60px]">{t('caisse.priority', 'Priorité')}</TableHeader>
                <TableHeader className="min-w-[120px]">{t('caisse.client', 'Client')}</TableHeader>
                <TableHeader className="min-w-[100px]">{t('caisse.reservation', 'Réservation')}</TableHeader>
                <TableHeader className="min-w-[80px]">{t('caisse.crates', 'Caisses')}</TableHeader>
                <TableHeader className="min-w-[100px]">{t('caisse.pricePerCrate', 'Prix/caisse')}</TableHeader>
                <TableHeader className="min-w-[120px]">{t('caisse.requiredAmount', 'Montant requis')}</TableHeader>
                <TableHeader className="min-w-[100px]">{t('caisse.paid', 'Payé')}</TableHeader>
                <TableHeader className="min-w-[100px]">{t('caisse.remaining', 'Restant')}</TableHeader>
                <TableHeader className="min-w-[80px]">{t('caisse.season', 'Saison')}</TableHeader>
                <TableHeader className="min-w-[100px]">{t('caisse.dueDate', 'Échéance')}</TableHeader>
                <TableHeader className="min-w-[100px]">{t('caisse.status', 'Statut')}</TableHeader>
                <TableHeader className="min-w-[100px]">{t('caisse.actions', 'Actions')}</TableHeader>
              </TableRow>
            </TableHead>
          <TableBody>
            {upcomingPayments?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-gray-500">
                  {t('caisse.noPendingPayments', 'Aucun paiement en attente')}
                </TableCell>
              </TableRow>
            ) : (
              upcomingPayments?.map((payment) => {
                const reservationMonth = payment.dueDate.toDate().getMonth();
                const seasonName = getSeasonName(reservationMonth);
                const seasonIcon = getSeasonIcon(reservationMonth);
                const currentPricePerCrate = pricingConfig?.tarif_caisse_saison || 30;
                
                return (
                  <TableRow key={payment.id}>
                    <TableCell className="text-center">
                      <span className="text-lg">{getPriorityIcon(payment.priority)}</span>
                    </TableCell>
                    <TableCell className="font-medium">{payment.clientName}</TableCell>
                    <TableCell className="font-mono text-sm">{payment.reservationReference}</TableCell>
                    <TableCell className="text-center">{payment.reservedCrates}</TableCell>
                    <TableCell className="text-center font-medium text-blue-600">
                      {formatCurrency(currentPricePerCrate)}
                    </TableCell>
                    <TableCell className="font-semibold">{formatCurrency(payment.depositRequired)}</TableCell>
                    <TableCell className="text-green-600">{formatCurrency(payment.depositPaid)}</TableCell>
                    <TableCell className="font-bold text-blue-600">{formatCurrency(payment.remainingAmount)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <span className="text-lg">{seasonIcon}</span>
                        <span className="text-xs font-medium">{seasonName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(payment.dueDate)}</TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col space-y-1">
                        <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                          {t('caisse.collect', 'Encaisser')}
                        </button>
                        {payment.remainingAmount > 0 && (
                          <button 
                            onClick={() => {
                              setSelectedPayment(payment);
                              setIsPartialPaymentOpen(true);
                            }}
                            className="px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600"
                          >
                            {t('caisse.partialPaymentButton', 'Paiement partiel')}
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
          </Table>
        </div>
      </Card>

      {/* Partial Payment Modal */}
      <PartialPaymentModal
        isOpen={isPartialPaymentOpen}
        onClose={() => {
          setIsPartialPaymentOpen(false);
          setSelectedPayment(null);
        }}
        payment={selectedPayment}
      />
    </div>
  );
};
