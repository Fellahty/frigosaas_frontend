import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, getDocs, addDoc, Timestamp, orderBy, limit } from '@/lib/db';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { logCreate } from '../../lib/logging';
import { useTranslation } from 'react-i18next';

interface PaymentRecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Client {
  id: string;
  name: string;
  company?: string;
}

interface Invoice {
  id: string;
  number: string;
  amount: number;
  status: string;
  clientId: string;
}

export const PaymentRecordingModal: React.FC<PaymentRecordingModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    clientId: '',
    invoiceIds: [] as string[],
    amount: 0,
    paymentMethod: 'cash' as 'cash' | 'check' | 'transfer' | 'card',
    reference: '',
    notes: '',
  });

  // Generate automatic reference for payments
  const generatePaymentReference = async () => {
    try {
      // Get the last cash movement to generate next reference
      const movementsQuery = query(
        collection(db, 'tenants', tenantId, 'cashMovements'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(movementsQuery);
      
      let nextNumber = 1;
      if (!snapshot.empty) {
        const lastMovement = snapshot.docs[0].data();
        const lastRef = lastMovement.reference;
        // Extract number from reference like "PAY-2024-001" or "PAY-2024-123"
        const match = lastRef.match(/PAY-\d{4}-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
      
      const currentYear = new Date().getFullYear();
      const paddedNumber = nextNumber.toString().padStart(3, '0');
      return `PAY-${currentYear}-${paddedNumber}`;
    } catch (error) {
      console.error('Erreur lors de la génération de la référence de paiement:', error);
      // Fallback to timestamp-based reference
      const now = new Date();
      const timestamp = now.getTime().toString().slice(-6);
      return `PAY-${now.getFullYear()}-${timestamp}`;
    }
  };

  // Auto-generate reference when modal opens
  useEffect(() => {
    if (isOpen) {
      generatePaymentReference().then(ref => {
        setForm(prev => ({ ...prev, reference: ref }));
      });
    }
  }, [isOpen, tenantId]);

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ['clients', tenantId],
    queryFn: async (): Promise<Client[]> => {
      const q = query(collection(db, 'tenants', tenantId, 'clients'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
    },
  });

  // Fetch invoices for selected client
  const { data: invoices } = useQuery({
    queryKey: ['invoices', tenantId, form.clientId],
    queryFn: async (): Promise<Invoice[]> => {
      if (!form.clientId) return [];
      const q = query(
        collection(db, 'tenants', tenantId, 'invoices'),
        query(where('clientId', '==', form.clientId))
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
    },
    enabled: !!form.clientId,
  });

  // Record payment mutation
  const recordPayment = useMutation({
    mutationFn: async (data: typeof form) => {
      // Get client name from the clients list
      const selectedClient = clients?.find(client => client.id === data.clientId);
      const clientName = selectedClient?.name || 'Client inconnu';
      
      const movementData = {
        type: 'in' as const,
        reason: 'Paiement client',
        clientId: data.clientId,
        clientName: clientName,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        reference: data.reference,
        userId: 'current-user',
        userName: 'Utilisateur actuel',
        createdAt: Timestamp.fromDate(new Date()),
        notes: data.notes || `Paiement pour ${data.invoiceIds.length} facture(s)`,
      };

      const docRef = await addDoc(collection(db, 'tenants', tenantId, 'cashMovements'), movementData);
      await logCreate('cashMovement', docRef.id, `Paiement enregistré: ${data.amount} MAD`, 'admin', 'Administrateur');
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-overview', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['cash-journal', tenantId] });
      onClose();
      setForm({
        clientId: '',
        invoiceIds: [],
        amount: 0,
        paymentMethod: 'cash',
        reference: '',
        notes: '',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    recordPayment.mutate(form);
  };

  const handleInvoiceToggle = (invoiceId: string) => {
    setForm(prev => ({
      ...prev,
      invoiceIds: prev.invoiceIds.includes(invoiceId)
        ? prev.invoiceIds.filter(id => id !== invoiceId)
        : [...prev.invoiceIds, invoiceId]
    }));
  };

  const calculateTotal = () => {
    if (!invoices) return 0;
    return invoices
      .filter(invoice => form.invoiceIds.includes(invoice.id))
      .reduce((sum, invoice) => sum + invoice.amount, 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100/50">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 tracking-tight">{t('caisse.payment.title', 'Enregistrer un paiement')}</h2>
            <p className="text-sm text-gray-500 mt-1">{t('caisse.payment.subtitle', 'Enregistrer un paiement client')}</p>
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
          {/* Client Selection */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Client</span>
            </label>
            <select
              value={form.clientId}
              onChange={(e) => setForm(prev => ({ ...prev, clientId: e.target.value, invoiceIds: [] }))}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200 bg-gray-50 focus:bg-white"
              required
            >
              <option value="">Sélectionner un client</option>
              {clients?.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name} {client.company && `(${client.company})`}
                </option>
              ))}
            </select>
          </div>

          {/* Invoices Selection */}
          {form.clientId && invoices && (
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Factures à payer</span>
              </label>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-2">
                {invoices.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">Aucune facture trouvée</p>
                ) : (
                  invoices.map(invoice => (
                    <label key={invoice.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.invoiceIds.includes(invoice.id)}
                        onChange={() => handleInvoiceToggle(invoice.id)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{invoice.number}</span>
                          <span className="text-sm font-semibold">{invoice.amount.toFixed(2)} MAD</span>
                        </div>
                        <div className="text-xs text-gray-500">Statut: {invoice.status}</div>
                      </div>
                    </label>
                  ))
                )}
              </div>
              {form.invoiceIds.length > 0 && (
                <div className="text-sm text-indigo-600 font-medium">
                  Total sélectionné: {calculateTotal().toFixed(2)} MAD
                </div>
              )}
            </div>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
              <span>Montant payé (MAD)</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200 bg-gray-50 focus:bg-white"
              placeholder="0.00"
              required
            />
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span>Mode de paiement</span>
            </label>
            <select
              value={form.paymentMethod}
              onChange={(e) => setForm(prev => ({ ...prev, paymentMethod: e.target.value as any }))}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-gray-50 focus:bg-white"
            >
              <option value="cash">💵 Espèces</option>
              <option value="check">📄 Chèque</option>
              <option value="transfer">🏦 Virement</option>
              <option value="card">💳 Carte bancaire</option>
            </select>
          </div>

          {/* Reference */}
          <div className="space-y-2">
            <label className="flex items-center justify-between text-sm font-medium text-gray-700">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>{t('caisse.payment.reference', 'Référence')}</span>
              </div>
              <button
                type="button"
                onClick={() => generatePaymentReference().then(ref => setForm(prev => ({ ...prev, reference: ref })))}
                className="flex items-center space-x-1 text-xs text-purple-600 hover:text-purple-800 hover:bg-purple-50 px-2 py-1 rounded-lg transition-colors duration-200"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{t('caisse.payment.regenerate', 'Régénérer')}</span>
              </button>
            </label>
            <div className="relative">
              <input
                type="text"
                value={form.reference}
                onChange={(e) => setForm(prev => ({ ...prev, reference: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 pr-12 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 bg-gray-50 focus:bg-white font-mono text-sm"
                placeholder={t('caisse.payment.referencePlaceholder', 'Référence du paiement')}
                required
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            </div>
            <p className="text-xs text-gray-500 flex items-center space-x-1">
              <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{t('caisse.payment.autoGenerated', 'Référence générée automatiquement')}</span>
            </p>
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
              placeholder="Notes additionnelles..."
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
              disabled={recordPayment.isPending}
              className="px-6 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm hover:shadow-md flex items-center space-x-2"
            >
              {recordPayment.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <span>💵</span>
                  <span>Enregistrer le paiement</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
