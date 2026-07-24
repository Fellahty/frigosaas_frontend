import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, getDocs, addDoc, Timestamp, updateDoc, doc } from '@/lib/db';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { logCreate, logUpdate } from '../../lib/logging';

interface DayClosureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DaySummary {
  date: string;
  totalReceipts: number;
  totalPayments: number;
  netAmount: number;
  movementCount: number;
  movements: any[];
}

export const DayClosureModal: React.FC<DayClosureModalProps> = ({ isOpen, onClose }) => {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    actualCash: 0,
    notes: '',
  });

  // Fetch today's movements
  const { data: daySummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['day-summary', tenantId],
    queryFn: async (): Promise<DaySummary> => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const movementsQuery = query(
        collection(db, 'tenants', tenantId, 'cashMovements'),
        where('createdAt', '>=', Timestamp.fromDate(today)),
        where('createdAt', '<', Timestamp.fromDate(tomorrow))
      );
      const movementsSnapshot = await getDocs(movementsQuery);
      const movements = movementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const totalReceipts = movements
        .filter(m => m.type === 'in')
        .reduce((sum, m) => sum + m.amount, 0);
      
      const totalPayments = movements
        .filter(m => m.type === 'out')
        .reduce((sum, m) => sum + m.amount, 0);

      return {
        date: today.toLocaleDateString('fr-FR'),
        totalReceipts,
        totalPayments,
        netAmount: totalReceipts - totalPayments,
        movementCount: movements.length,
        movements,
      };
    },
  });

  // Check if day is already closed
  const { data: isDayClosed } = useQuery({
    queryKey: ['day-closure-status', tenantId],
    queryFn: async (): Promise<boolean> => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const closureQuery = query(
        collection(db, 'tenants', tenantId, 'dayClosures'),
        where('date', '>=', Timestamp.fromDate(today)),
        where('date', '<', Timestamp.fromDate(tomorrow))
      );
      const closureSnapshot = await getDocs(closureQuery);
      return !closureSnapshot.empty;
    },
  });

  // Close day mutation
  const closeDay = useMutation({
    mutationFn: async (data: typeof form) => {
      if (!daySummary) throw new Error('Résumé du jour non disponible');

      const closureData = {
        date: Timestamp.fromDate(new Date()),
        expectedCash: daySummary.netAmount,
        actualCash: data.actualCash,
        difference: data.actualCash - daySummary.netAmount,
        totalReceipts: daySummary.totalReceipts,
        totalPayments: daySummary.totalPayments,
        movementCount: daySummary.movementCount,
        notes: data.notes,
        closedBy: 'current-user',
        closedByName: 'Utilisateur actuel',
        closedAt: Timestamp.fromDate(new Date()),
        status: 'closed' as const,
      };

      const docRef = await addDoc(collection(db, 'tenants', tenantId, 'dayClosures'), closureData);

      // Mark all today's movements as closed
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const movementsQuery = query(
        collection(db, 'tenants', tenantId, 'cashMovements'),
        where('createdAt', '>=', Timestamp.fromDate(today)),
        where('createdAt', '<', Timestamp.fromDate(tomorrow))
      );
      const movementsSnapshot = await getDocs(movementsQuery);
      
      const updatePromises = movementsSnapshot.docs.map(doc => 
        updateDoc(doc.ref, { dayClosed: true, closureId: docRef.id })
      );
      
      await Promise.all(updatePromises);

      await logCreate('dayClosure', docRef.id, `Clôture de journée: ${data.actualCash} MAD`, 'admin', 'Administrateur');
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-overview', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['day-closure-status', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['day-summary', tenantId] });
      onClose();
      setForm({
        actualCash: 0,
        notes: '',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    closeDay.mutate(form);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100/50">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Clôture de journée</h2>
            <p className="text-sm text-gray-500 mt-1">Verrouiller le journal du jour</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Day Status */}
          {isDayClosed ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-red-800">Journée déjà clôturée</h4>
                  <p className="text-sm text-red-700 mt-1">
                    Cette journée a déjà été clôturée et ne peut plus être modifiée.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Day Summary */}
              {summaryLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : daySummary ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-blue-900 mb-4">Résumé du jour ({daySummary.date})</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-blue-700">Encaissements</p>
                      <p className="text-xl font-bold text-green-600">{formatCurrency(daySummary.totalReceipts)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-blue-700">Décaissements</p>
                      <p className="text-xl font-bold text-red-600">{formatCurrency(daySummary.totalPayments)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-blue-700">Solde théorique</p>
                      <p className="text-xl font-bold text-blue-600">{formatCurrency(daySummary.netAmount)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-blue-700">Mouvements</p>
                      <p className="text-xl font-bold text-gray-600">{daySummary.movementCount}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Actual Cash */}
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                    <span>Solde réel en caisse (MAD)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.actualCash}
                    onChange={(e) => setForm(prev => ({ ...prev, actualCash: Number(e.target.value) }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200 bg-gray-50 focus:bg-white"
                    placeholder="0.00"
                    required
                  />
                  {daySummary && (
                    <p className="text-sm text-gray-600">
                      Solde théorique: {formatCurrency(daySummary.netAmount)}
                      {form.actualCash > 0 && (
                        <span className={`ml-2 font-medium ${
                          form.actualCash === daySummary.netAmount 
                            ? 'text-green-600' 
                            : form.actualCash > daySummary.netAmount 
                              ? 'text-blue-600' 
                              : 'text-red-600'
                        }`}>
                          (Écart: {formatCurrency(form.actualCash - daySummary.netAmount)})
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Notes de clôture (optionnel)</span>
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-gray-500 focus:ring-2 focus:ring-gray-200 transition-all duration-200 bg-gray-50 focus:bg-white"
                    placeholder="Notes sur la clôture de journée..."
                    rows={3}
                  />
                </div>

                {/* Warning */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-medium text-yellow-800">Attention</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        La clôture de journée verrouillera tous les mouvements du jour et ne pourra plus être annulée.
                        Assurez-vous que tous les mouvements sont correctement enregistrés.
                      </p>
                    </div>
                  </div>
                </div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-6 border-t border-gray-100/50">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all duration-200 font-medium"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={closeDay.isPending || form.actualCash < 0}
                    className="px-6 py-2.5 bg-purple-500 text-white rounded-xl hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm hover:shadow-md flex items-center space-x-2"
                  >
                    {closeDay.isPending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Clôture...</span>
                      </>
                    ) : (
                      <>
                        <span>🔒</span>
                        <span>Clôturer la journée</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
