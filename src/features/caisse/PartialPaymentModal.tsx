import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, addDoc, Timestamp, doc, updateDoc, getDoc } from '@/lib/db';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { logCreate, logUpdate } from '../../lib/logging';
import { useTranslation } from 'react-i18next';

interface PartialPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: {
    id: string;
    clientId: string;
    clientName: string;
    reservationId: string;
    reservationReference: string;
    reservedCrates: number;
    depositRequired: number;
    depositPaid: number;
    remainingAmount: number;
    dueDate: Timestamp;
    status: 'pending' | 'partial' | 'overdue';
    priority: 'high' | 'medium' | 'low';
  } | null;
}

export const PartialPaymentModal: React.FC<PartialPaymentModalProps> = ({ isOpen, onClose, payment }) => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    amount: 0,
    paymentMethod: 'cash' as 'cash' | 'check' | 'transfer' | 'card',
    reference: '',
    notes: '',
  });

  // Generate automatic reference for partial payments
  const generatePartialPaymentReference = async () => {
    try {
      const movementsQuery = collection(db, 'tenants', tenantId, 'cashMovements');
      const snapshot = await getDocs(movementsQuery);
      
      let nextNumber = 1;
      if (!snapshot.empty) {
        const lastMovement = snapshot.docs[0].data();
        const lastRef = lastMovement.reference;
        const match = lastRef.match(/PARTIAL-\d{4}-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
      
      const currentYear = new Date().getFullYear();
      const paddedNumber = nextNumber.toString().padStart(3, '0');
      return `PARTIAL-${currentYear}-${paddedNumber}`;
    } catch (error) {
      console.error('Erreur lors de la génération de la référence de paiement partiel:', error);
      const now = new Date();
      const timestamp = now.getTime().toString().slice(-6);
      return `PARTIAL-${now.getFullYear()}-${timestamp}`;
    }
  };

  // Auto-generate reference when modal opens
  useEffect(() => {
    if (isOpen && payment) {
      generatePartialPaymentReference().then(ref => {
        setForm(prev => ({ ...prev, reference: ref }));
      });
    }
  }, [isOpen, payment, tenantId]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setForm({
        amount: 0,
        paymentMethod: 'cash',
        reference: '',
        notes: '',
      });
    }
  }, [isOpen]);

  // Partial payment mutation
  const recordPartialPayment = useMutation({
    mutationFn: async (data: typeof form) => {
      if (!payment) throw new Error('Aucun paiement sélectionné');

      // Record the cash movement
      const movementData = {
        type: 'in' as const,
        reason: 'Paiement partiel client',
        clientId: payment.clientId,
        clientName: payment.clientName || 'Client inconnu',
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        reference: data.reference,
        userId: 'current-user',
        userName: 'Utilisateur actuel',
        createdAt: Timestamp.fromDate(new Date()),
        notes: data.notes || `Paiement partiel pour ${payment.reservationReference} - ${payment.reservedCrates} caisses`,
        reservationId: payment.reservationId,
      };

      const docRef = await addDoc(collection(db, 'tenants', tenantId, 'cashMovements'), movementData);

      // Update the reservation with the new paid amount
      const reservationRef = doc(db, 'tenants', tenantId, 'reservations', payment.reservationId);
      const newPaidAmount = payment.depositPaid + data.amount;
      
      await updateDoc(reservationRef, {
        depositPaid: newPaidAmount,
        lastPaymentDate: Timestamp.fromDate(new Date()),
        lastPaymentAmount: data.amount,
      });

      await logCreate('cashMovement', docRef.id, `Paiement partiel enregistré: ${data.amount} MAD`, 'admin', 'Administrateur');
      await logUpdate('reservation', payment.reservationId, `Paiement partiel: ${data.amount} MAD`, 'admin', 'Administrateur');
      
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-overview', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['cash-journal', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-payments', tenantId] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.amount <= 0 || form.amount > (payment?.remainingAmount || 0)) {
      alert(t('caisse.partialPayment.invalidAmount', 'Montant invalide'));
      return;
    }
    recordPartialPayment.mutate(form);
  };

  const printReceipt = () => {
    if (!payment) return;

    const receiptHTML = `
      <html>
        <head>
          <title>Reçu de Paiement Partiel - ${payment.clientName} - LYAZAMI</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Courier New', monospace; 
              font-size: 12px;
              line-height: 1.2;
              color: #000;
              background: #fff;
              width: 80mm;
              margin: 0 auto;
              padding: 2mm;
            }
            .receipt-container {
              width: 100%;
              background: #fff;
            }
            .header { 
              text-align: center; 
              border-bottom: 2px solid #000; 
              padding-bottom: 8px; 
              margin-bottom: 8px;
            }
            .company { 
              font-size: 16px; 
              font-weight: bold; 
              margin-bottom: 2px;
            }
            .subtitle {
              font-size: 8px;
              text-transform: uppercase;
              margin-bottom: 2px;
            }
            .title { 
              font-size: 12px; 
              font-weight: bold;
              margin-bottom: 4px;
            }
            .receipt-number {
              font-size: 10px;
              font-family: monospace;
            }
            .divider {
              border-bottom: 1px solid #000;
              margin: 6px 0;
            }
            .info-row { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 3px;
              font-size: 10px;
            }
            .label { 
              font-weight: bold; 
            }
            .value { 
              text-align: right;
            }
            .amounts { 
              border: 1px solid #000;
              padding: 6px; 
              margin: 8px 0;
            }
            .amount-row { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 2px;
              font-size: 10px;
            }
            .amount-label {
              font-weight: bold;
            }
            .amount-value {
              font-weight: bold;
            }
            .total-remaining { 
              font-weight: bold; 
              font-size: 11px; 
              border-top: 1px solid #000; 
              padding-top: 4px;
              margin-top: 4px;
            }
            .payment-today {
              font-weight: bold;
            }
            .notes-section {
              margin-top: 8px;
              border: 1px solid #000;
              padding: 4px;
            }
            .notes-title {
              font-weight: bold;
              margin-bottom: 2px;
              font-size: 10px;
            }
            .notes-content {
              font-size: 9px;
              line-height: 1.1;
            }
            .footer { 
              text-align: center; 
              margin-top: 12px; 
              font-size: 8px; 
              border-top: 1px solid #000;
              padding-top: 6px;
            }
            .reference { 
              font-family: monospace; 
              font-size: 9px;
            }
            .status-badge {
              font-size: 8px;
              font-weight: bold;
              text-transform: uppercase;
            }
            .signature-section {
              margin-top: 12px;
              display: flex;
              justify-content: space-between;
              border-top: 1px solid #000;
              padding-top: 8px;
            }
            .signature-box {
              text-align: center;
              width: 45%;
            }
            .signature-line {
              border-bottom: 1px solid #000;
              margin-bottom: 2px;
              height: 20px;
            }
            .signature-label {
              font-size: 8px;
              text-transform: uppercase;
            }
            .center {
              text-align: center;
            }
            .right {
              text-align: right;
            }
            .bold {
              font-weight: bold;
            }
            @media print {
              body { 
                margin: 0; 
                padding: 0;
                width: 80mm;
              }
              .receipt-container {
                width: 100%;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">
              <div class="subtitle">Systeme de Gestion</div>
              <div class="company">Domaine LYAZAMI</div>
              <div class="title">RECU DE PAIEMENT PARTIEL</div>
              <div class="receipt-number">N° ${form.reference}</div>
            </div>
            
            <div class="divider"></div>
            
            <div class="info-row">
              <span class="label">Client:</span>
              <span class="value">${payment.clientName}</span>
            </div>
            <div class="info-row">
              <span class="label">Reservation:</span>
              <span class="value reference">${payment.reservationReference}</span>
            </div>
            <div class="info-row">
              <span class="label">Caisses:</span>
              <span class="value">${payment.reservedCrates}</span>
            </div>
            
            <div class="divider"></div>
            
            <div class="info-row">
              <span class="label">Paiement:</span>
              <span class="value reference">${form.reference}</span>
            </div>
            <div class="info-row">
              <span class="label">Mode:</span>
              <span class="value">${form.paymentMethod === 'cash' ? 'ESPECES' : 
                form.paymentMethod === 'check' ? 'CHEQUE' :
                form.paymentMethod === 'transfer' ? 'VIREMENT' : 'CARTE'}</span>
            </div>
            <div class="info-row">
              <span class="label">Date:</span>
              <span class="value">${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}</span>
            </div>
            <div class="info-row">
              <span class="label">Statut:</span>
              <span class="value status-badge">PARTIEL</span>
            </div>
            
            <div class="amounts">
              <div class="amount-row">
                <span class="amount-label">Total requis:</span>
                <span class="amount-value">${formatCurrency(payment.depositRequired)}</span>
              </div>
              <div class="amount-row">
                <span class="amount-label">Deja paye:</span>
                <span class="amount-value">${formatCurrency(payment.depositPaid)}</span>
              </div>
              <div class="amount-row">
                <span class="amount-label">Paye aujourd'hui:</span>
                <span class="amount-value payment-today">${formatCurrency(form.amount)}</span>
              </div>
              <div class="amount-row total-remaining">
                <span class="amount-label">RESTANT:</span>
                <span class="amount-value">${formatCurrency(payment.remainingAmount - form.amount)}</span>
              </div>
            </div>
            
            ${form.notes ? `
            <div class="notes-section">
              <div class="notes-title">NOTES:</div>
              <div class="notes-content">${form.notes}</div>
            </div>
            ` : ''}
            
            <div class="signature-section">
              <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-label">Client</div>
              </div>
              <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-label">Agent</div>
              </div>
            </div>
            
            <div class="footer">
              <div class="bold">Merci pour votre confiance</div>
              <div>${new Date().toLocaleString('fr-FR')}</div>
              <div>LYAZAMI - Systeme Frigo</div>
            </div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (!isOpen || !payment) return null;

  const maxAmount = payment.remainingAmount;
  const newRemainingAmount = payment.remainingAmount - form.amount;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100/50">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 tracking-tight">
              {t('caisse.partialPayment.title', 'Paiement partiel')}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {t('caisse.partialPayment.subtitle', 'Client')}: {payment.clientName}
            </p>
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

        {/* Payment Summary */}
        <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100/50">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">{t('caisse.partialPayment.totalRequired', 'Total requis')}</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(payment.depositRequired)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">{t('caisse.partialPayment.alreadyPaid', 'Déjà payé')}</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(payment.depositPaid)}</p>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">{t('caisse.partialPayment.remaining', 'Montant restant')}</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(payment.remainingAmount)}</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Amount */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
              <span>{t('caisse.partialPayment.amount', 'Montant à payer')}</span>
              <span className="text-xs text-gray-500">(max: {formatCurrency(maxAmount)})</span>
            </label>
            <input
              type="number"
              min="0.01"
              max={maxAmount}
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200 bg-gray-50 focus:bg-white"
              placeholder="0.00"
              required
            />
            {form.amount > 0 && (
              <div className="text-sm text-gray-600">
                {t('caisse.partialPayment.afterPayment', 'Après paiement')}: 
                <span className="font-semibold text-blue-600 ml-1">
                  {formatCurrency(newRemainingAmount)} {t('caisse.partialPayment.remaining', 'restant')}
                </span>
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span>{t('caisse.partialPayment.paymentMethod', 'Mode de paiement')}</span>
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
                <span>{t('caisse.partialPayment.reference', 'Référence')}</span>
              </div>
              <button
                type="button"
                onClick={() => generatePartialPaymentReference().then(ref => setForm(prev => ({ ...prev, reference: ref })))}
                className="flex items-center space-x-1 text-xs text-purple-600 hover:text-purple-800 hover:bg-purple-50 px-2 py-1 rounded-lg transition-colors duration-200"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{t('caisse.partialPayment.regenerate', 'Régénérer')}</span>
              </button>
            </label>
            <div className="relative">
              <input
                type="text"
                value={form.reference}
                onChange={(e) => setForm(prev => ({ ...prev, reference: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 pr-12 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 bg-gray-50 focus:bg-white font-mono text-sm"
                placeholder={t('caisse.partialPayment.referencePlaceholder', 'Référence du paiement partiel')}
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
              <span>{t('caisse.partialPayment.autoGenerated', 'Référence générée automatiquement')}</span>
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>{t('caisse.partialPayment.notes', 'Notes (optionnel)')}</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-gray-500 focus:ring-2 focus:ring-gray-200 transition-all duration-200 bg-gray-50 focus:bg-white"
              placeholder={t('caisse.partialPayment.notesPlaceholder', 'Notes additionnelles...')}
              rows={3}
            />
          </div>

          {/* Warning */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-orange-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-orange-800">{t('caisse.partialPayment.warning', 'Attention')}</h4>
                <p className="text-sm text-orange-700 mt-1">
                  {t('caisse.partialPayment.warningMessage', 'Ce paiement partiel sera enregistré et le montant restant sera mis à jour.')}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row justify-between space-y-3 sm:space-y-0 pt-6 border-t border-gray-100/50">
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={printReceipt}
                disabled={form.amount <= 0}
                className="px-4 py-2.5 bg-gray-500 text-white rounded-xl hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm hover:shadow-md flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>{t('caisse.partialPayment.printReceipt', 'Imprimer le reçu')}</span>
              </button>
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all duration-200 font-medium"
              >
                {t('common.cancel', 'Annuler')}
              </button>
              <button
                type="submit"
                disabled={recordPartialPayment.isPending || form.amount <= 0 || form.amount > maxAmount || !form.reference}
                className="px-6 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm hover:shadow-md flex items-center space-x-2"
              >
                {recordPartialPayment.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>{t('caisse.partialPayment.saving', 'Enregistrement...')}</span>
                  </>
                ) : (
                  <>
                    <span>💰</span>
                    <span>{t('caisse.partialPayment.save', 'Enregistrer le paiement partiel')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
