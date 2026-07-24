import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, addDoc, Timestamp, query, orderBy, limit, getDocs } from '@/lib/db';
import { ref, uploadBytes, getDownloadURL } from '@/lib/storage';
import { db, storage } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { logCreate } from '../../lib/logging';
import { useTranslation } from 'react-i18next';

interface CashOutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CashOutModal: React.FC<CashOutModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    amount: 0,
    reason: '',
    reference: '',
    notes: '',
    image: null as File | null,
  });

  // Generate automatic reference
  const generateReference = async () => {
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
        // Extract number from reference like "SORT-2024-001" or "SORT-2024-123"
        const match = lastRef.match(/SORT-\d{4}-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
      
      const currentYear = new Date().getFullYear();
      const paddedNumber = nextNumber.toString().padStart(3, '0');
      return `SORT-${currentYear}-${paddedNumber}`;
    } catch (error) {
      console.error('Erreur lors de la génération de la référence:', error);
      // Fallback to timestamp-based reference
      const now = new Date();
      const timestamp = now.getTime().toString().slice(-6);
      return `SORT-${now.getFullYear()}-${timestamp}`;
    }
  };

  // Auto-generate reference when modal opens
  useEffect(() => {
    if (isOpen) {
      generateReference().then(ref => {
        setForm(prev => ({ ...prev, reference: ref }));
      });
    }
  }, [isOpen, tenantId]);

  // Cash out mutation
  const cashOut = useMutation({
    mutationFn: async (data: typeof form) => {
      let imageUrl = null;
      
      // Upload image if provided
      if (data.image) {
        const imageRef = ref(storage, `tenants/${tenantId}/cash-out-images/${Date.now()}-${data.image.name}`);
        await uploadBytes(imageRef, data.image);
        imageUrl = await getDownloadURL(imageRef);
      }

      const movementData = {
        type: 'out' as const,
        reason: data.reason,
        amount: data.amount,
        paymentMethod: 'cash' as const,
        reference: data.reference,
        userId: 'current-user',
        userName: 'Utilisateur actuel',
        createdAt: Timestamp.fromDate(new Date()),
        notes: data.notes || 'Sortie de caisse',
        imageUrl: imageUrl,
      };

      const docRef = await addDoc(collection(db, 'tenants', tenantId, 'cashMovements'), movementData);
      await logCreate('cashMovement', docRef.id, `Sortie de caisse: ${data.amount} MAD`, 'admin', 'Administrateur');
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-overview', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['cash-journal', tenantId] });
      onClose();
      setForm({
        amount: 0,
        reason: '',
        reference: '',
        notes: '',
        image: null,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    cashOut.mutate(form);
  };

  const predefinedReasons = [
    { value: 'electricity', label: t('caisse.cashOut.reasons.electricity') },
    { value: 'supplier', label: t('caisse.cashOut.reasons.supplier') },
    { value: 'maintenance', label: t('caisse.cashOut.reasons.maintenance') },
    { value: 'transport', label: t('caisse.cashOut.reasons.transport') },
    { value: 'material', label: t('caisse.cashOut.reasons.material') },
    { value: 'admin', label: t('caisse.cashOut.reasons.admin') },
    { value: 'other', label: t('caisse.cashOut.reasons.other') },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100/50">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 tracking-tight">{t('caisse.cashOut.title')}</h2>
            <p className="text-sm text-gray-500 mt-1">{t('caisse.cashOut.subtitle')}</p>
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
          {/* Amount */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
              <span>{t('caisse.cashOut.amount')}</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all duration-200 bg-gray-50 focus:bg-white"
              placeholder="0.00"
              required
            />
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span>{t('caisse.cashOut.reason')}</span>
            </label>
            <select
              value={form.reason}
              onChange={(e) => setForm(prev => ({ ...prev, reason: e.target.value }))}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all duration-200 bg-gray-50 focus:bg-white"
              required
            >
              <option value="">{t('caisse.cashOut.selectReason')}</option>
              {predefinedReasons.map(reason => (
                <option key={reason.value} value={reason.value}>{reason.label}</option>
              ))}
            </select>
          </div>

          {/* Custom Reason */}
          {form.reason === 'other' && (
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>{t('caisse.cashOut.customReason')}</span>
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-gray-500 focus:ring-2 focus:ring-gray-200 transition-all duration-200 bg-gray-50 focus:bg-white"
                placeholder={t('caisse.cashOut.customReasonPlaceholder')}
                required
              />
            </div>
          )}

          {/* Image Upload for Electricity Bill */}
          {form.reason === 'electricity' && (
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{t('caisse.cashOut.billImage')}</span>
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Validate file size (10MB max)
                      if (file.size > 10 * 1024 * 1024) {
                        alert(t('caisse.cashOut.errors.fileTooLarge'));
                        return;
                      }
                      // Validate file type
                      if (!file.type.startsWith('image/')) {
                        alert(t('caisse.cashOut.errors.invalidFileType'));
                        return;
                      }
                      setForm(prev => ({ ...prev, image: file }));
                    }
                  }}
                  className="hidden"
                  id="bill-image"
                />
                <label htmlFor="bill-image" className="cursor-pointer">
                  {form.image ? (
                    <div className="space-y-3">
                      <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                      <p className="text-sm text-green-600 font-medium">{form.image.name}</p>
                      <p className="text-xs text-gray-500">{(form.image.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setForm(prev => ({ ...prev, image: null }));
                        }}
                        className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                      >
                        {t('caisse.cashOut.removeImage')}
                      </button>
                      <span className="text-xs text-gray-500">{t('caisse.cashOut.imageUploaded')}</span>
                    </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-600">{t('caisse.cashOut.uploadImage')}</p>
                      <p className="text-xs text-gray-500">{t('caisse.cashOut.imageSize')}</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
          )}

          {/* Reference */}
          <div className="space-y-2">
            <label className="flex items-center justify-between text-sm font-medium text-gray-700">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>{t('caisse.cashOut.reference')}</span>
              </div>
              <button
                type="button"
                onClick={() => generateReference().then(ref => setForm(prev => ({ ...prev, reference: ref })))}
                className="flex items-center space-x-1 text-xs text-purple-600 hover:text-purple-800 hover:bg-purple-50 px-2 py-1 rounded-lg transition-colors duration-200"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{t('caisse.cashOut.regenerate')}</span>
              </button>
            </label>
            <div className="relative">
              <input
                type="text"
                value={form.reference}
                onChange={(e) => setForm(prev => ({ ...prev, reference: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 pr-12 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 bg-gray-50 focus:bg-white font-mono text-sm"
                placeholder={t('caisse.cashOut.referencePlaceholder')}
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
              <span>{t('caisse.cashOut.autoGenerated')}</span>
            </p>
          </div>

          {/* Additional Notes */}
          {form.reason !== 'other' && (
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>{t('caisse.cashOut.notes')}</span>
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-gray-500 focus:ring-2 focus:ring-gray-200 transition-all duration-200 bg-gray-50 focus:bg-white"
                placeholder={t('caisse.cashOut.notesPlaceholder')}
                rows={3}
              />
            </div>
          )}

          {/* Warning */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-orange-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-orange-800">{t('caisse.cashOut.warning')}</h4>
                <p className="text-sm text-orange-700 mt-1">
                  {t('caisse.cashOut.warningMessage')}
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
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={cashOut.isPending || form.amount <= 0 || !form.reason || !form.reference}
              className="px-6 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm hover:shadow-md flex items-center space-x-2"
            >
              {cashOut.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{t('caisse.cashOut.saving')}</span>
                </>
              ) : (
                <>
                  <span>📤</span>
                  <span>{t('caisse.cashOut.save')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
