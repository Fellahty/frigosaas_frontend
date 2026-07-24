import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, getDocs, addDoc, Timestamp, updateDoc, doc } from '@/lib/db';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { logCreate, logUpdate } from '../../lib/logging';

interface CautionRefundModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Caution {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  type: 'blocked' | 'to_refund';
  createdAt: Timestamp;
  loanId?: string;
  reference?: string;
}

export const CautionRefundModal: React.FC<CautionRefundModalProps> = ({ isOpen, onClose }) => {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    cautionId: '',
    amount: 0,
    reference: '',
    notes: '',
  });

  // Fetch cautions to refund
  const { data: cautions } = useQuery({
    queryKey: ['cautions-to-refund', tenantId],
    queryFn: async (): Promise<Caution[]> => {
      const q = query(
        collection(db, 'tenants', tenantId, 'cautions'),
        where('type', '==', 'to_refund')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Caution));
    },
  });

  // Refund caution mutation
  const refundCaution = useMutation({
    mutationFn: async (data: typeof form) => {
      const selectedCaution = cautions?.find(c => c.id === data.cautionId);
      if (!selectedCaution) throw new Error('Caution non trouvée');

      // Create cash movement
      const movementData = {
        type: 'out' as const,
        reason: 'Remboursement caution',
        clientId: selectedCaution.clientId,
        clientName: selectedCaution.clientName,
        amount: data.amount,
        paymentMethod: 'cash' as const,
        reference: data.reference,
        userId: 'current-user',
        userName: 'Utilisateur actuel',
        createdAt: Timestamp.fromDate(new Date()),
        notes: data.notes || `Remboursement caution - ${selectedCaution.clientName}`,
      };

      const docRef = await addDoc(collection(db, 'tenants', tenantId, 'cashMovements'), movementData);

      // Update caution status
      await updateDoc(doc(db, 'tenants', tenantId, 'cautions', data.cautionId), {
        type: 'refunded',
        refundedAt: Timestamp.fromDate(new Date()),
        refundAmount: data.amount,
        refundReference: data.reference,
      });

      await logCreate('cashMovement', docRef.id, `Caution remboursée: ${data.amount} MAD`, 'admin', 'Administrateur');
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-overview', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['cash-journal', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['cautions-to-refund', tenantId] });
      onClose();
      setForm({
        cautionId: '',
        amount: 0,
        reference: '',
        notes: '',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    refundCaution.mutate(form);
  };

  const selectedCaution = cautions?.find(c => c.id === form.cautionId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100/50">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Rembourser une caution</h2>
            <p className="text-sm text-gray-500 mt-1">Rembourser une caution à un client</p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Caution Selection */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Caution à rembourser</span>
            </label>
            <select
              value={form.cautionId}
              onChange={(e) => {
                const caution = cautions?.find(c => c.id === e.target.value);
                setForm(prev => ({
                  ...prev,
                  cautionId: e.target.value,
                  amount: caution?.amount || 0,
                }));
              }}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200 bg-gray-50 focus:bg-white"
              required
            >
              <option value="">Sélectionner une caution</option>
              {cautions?.map(caution => (
                <option key={caution.id} value={caution.id}>
                  {caution.clientName} - {caution.amount.toFixed(2)} MAD
                </option>
              ))}
            </select>
          </div>

          {/* Client Info */}
          {selectedCaution && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium text-blue-900">Informations de la caution</span>
              </div>
              <div className="space-y-1 text-sm text-blue-800">
                <div><strong>Client:</strong> {selectedCaution.clientName}</div>
                <div><strong>Montant original:</strong> {selectedCaution.amount.toFixed(2)} MAD</div>
                <div><strong>Date de création:</strong> {selectedCaution.createdAt.toDate().toLocaleDateString('fr-FR')}</div>
                {selectedCaution.loanId && (
                  <div><strong>Prêt associé:</strong> {selectedCaution.loanId}</div>
                )}
              </div>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
              <span>Montant à rembourser (MAD)</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              max={selectedCaution?.amount || 0}
              value={form.amount}
              onChange={(e) => setForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200 bg-gray-50 focus:bg-white"
              placeholder="0.00"
              required
            />
            {selectedCaution && form.amount > selectedCaution.amount && (
              <p className="text-sm text-red-600">Le montant ne peut pas dépasser {selectedCaution.amount.toFixed(2)} MAD</p>
            )}
          </div>

          {/* Reference */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Référence du remboursement</span>
            </label>
            <input
              type="text"
              value={form.reference}
              onChange={(e) => setForm(prev => ({ ...prev, reference: e.target.value }))}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 bg-gray-50 focus:bg-white"
              placeholder="REF-REM-001"
              required
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Notes (optionnel)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-gray-500 focus:ring-2 focus:ring-gray-200 transition-all duration-200 bg-gray-50 focus:bg-white"
              placeholder="Notes sur le remboursement..."
              rows={3}
            />
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
              disabled={refundCaution.isPending || !selectedCaution || form.amount <= 0 || form.amount > (selectedCaution?.amount || 0)}
              className="px-6 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm hover:shadow-md flex items-center space-x-2"
            >
              {refundCaution.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Remboursement...</span>
                </>
              ) : (
                <>
                  <span>🔄</span>
                  <span>Rembourser la caution</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
