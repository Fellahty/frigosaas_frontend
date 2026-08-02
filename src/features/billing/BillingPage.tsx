import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, Timestamp, query, where, doc, getDoc, setDoc, updateDoc } from '@/lib/db';
import { useTranslation } from 'react-i18next';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { useSeasonContext } from '../../lib/seasons/SeasonProvider';
import { Card } from '../../components/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/Table';
import { Spinner } from '../../components/Spinner';

interface Invoice {
  id: string;
  number: string;
  clientName: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  dueDate: Date;
  createdAt: Date;
}
interface ClientOption { id: string; name: string }

export const BillingPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  const { isReadOnly } = useSeasonContext();

  const [isAdding, setIsAdding] = React.useState(false);
  const [form, setForm] = React.useState({
    number: '',
    clientId: '',
    amount: 0,
    status: 'draft' as Invoice['status'],
    dueDate: '' as string,
  });

  // Load clients for selection
  const { data: clientOptions } = useQuery({
    queryKey: ['clients', tenantId, 'for-billing'],
    queryFn: async (): Promise<ClientOption[]> => {
      const q = query(collection(db, 'clients'), where('tenantId', '==', tenantId));
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data() as any;
        return { id: d.id, name: data.name || '—' };
      });
    },
  });

  const { data: invoices, isLoading, error } = useQuery({
    queryKey: ['invoices', tenantId],
    queryFn: async (): Promise<Invoice[]> => {
      const q = query(collection(db, 'invoices'), where('tenantId', '==', tenantId));
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          number: data.number || '',
          clientName: data.clientName || '',
          amount: Number(data.amount) || 0,
          status: (data.status as Invoice['status']) || 'draft',
          dueDate: data.dueDate?.toDate?.() || new Date(),
          createdAt: data.createdAt?.toDate?.() || new Date(),
        };
      });
    },
  });

  const addInvoice = useMutation({
    mutationFn: async (payload: typeof form) => {
      const selectedClient = (clientOptions || []).find((c) => c.id === payload.clientId);
      await addDoc(collection(db, 'invoices'), {
        tenantId,
        number: payload.number,
        clientId: payload.clientId || null,
        clientName: selectedClient?.name || '',
        amount: Number(payload.amount) || 0,
        status: payload.status,
        dueDate: payload.dueDate ? Timestamp.fromDate(new Date(payload.dueDate)) : Timestamp.fromDate(new Date()),
        createdAt: Timestamp.fromDate(new Date()),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
      setIsAdding(false);
      setForm({ number: '', clientId: '', amount: 0, status: 'draft', dueDate: '' });
    },
  });

  const generateNextInvoiceNumber = React.useCallback(async (): Promise<string> => {
    const countersRef = doc(db, 'counters', tenantId);
    const snap = await getDoc(countersRef);
    let next = 1;
    if (snap.exists()) {
      const curr = Number((snap.data() as any).invoiceCounter || 0);
      next = curr + 1;
      await updateDoc(countersRef, { invoiceCounter: next, tenantId });
    } else {
      await setDoc(countersRef, { invoiceCounter: 1, tenantId });
      next = 1;
    }
    const year = new Date().getFullYear();
    return `FAC-${year}-${String(next).padStart(4, '0')}`;
  }, [tenantId]);

  const handleGenerateNumber = async () => {
    const num = await generateNextInvoiceNumber();
    setForm((f) => ({ ...f, number: num }));
  };

  const handleSave = async () => {
    let payload = { ...form };
    if (!payload.number) {
      const num = await generateNextInvoiceNumber();
      payload.number = num;
      setForm((f) => ({ ...f, number: num }));
    }
    addInvoice.mutate(payload);
  };

  const openPrintableInvoice = (inv: Invoice) => {
    const lblInvoice = t('billing.title', 'Facturation');
    const lblClient = t('billing.client', 'Client');
    const lblAmount = t('billing.amount', 'Montant');
    const lblDue = t('billing.dueDate', 'Échéance');
    const lblCreated = t('clients.created', 'Créé le');
    const lblStatus = t('billing.status', 'Statut');
    const lblTotal = t('billing.total', 'Total');
    const lblSubTotal = t('billing.subtotal', 'Sous-total');
    const lblTax = t('billing.tax', 'TVA');
    const lblNotes = t('billing.notes', 'Notes');
    const lang = i18n?.language || 'fr-FR';
    const dir = lang.startsWith('ar') ? 'rtl' : 'ltr';
    const amountFmt = new Intl.NumberFormat(lang, { style: 'currency', currency: 'MAD' });
    const fmtAmount = (n: number) => amountFmt.format(n);
    const win = window.open('', '_blank');
    if (!win) return;
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${lblInvoice} ${inv.number}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root { --border:#e5e7eb; --text:#0f172a; --muted:#64748b; --primary:#2563eb; --bg:#f8fafc; }
    @page { size: A4; margin: 12mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .card { box-shadow: none !important; }
    }
    body { font-family: ${dir === 'rtl' ? "'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" : "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif"}; color: var(--text); margin: 0; background: white; }
    .container { width: 100%; max-width: 186mm; /* 210mm - 2*12mm margins */ margin: 0 auto; padding: 0; direction: ${'${dir}'}; }
    .card { background:white; border:1px solid var(--border); border-radius: 12px; box-shadow: 0 6px 16px rgba(2,6,23,0.07); overflow: hidden; }
    .hero { padding: 10px 14px; background: linear-gradient(135deg, #1d4ed8, #7c3aed); color: white; display:flex; justify-content: space-between; align-items:center; }
    .brand { display:flex; align-items:center; gap:8px; }
    .logo { width:32px; height:32px; background:linear-gradient(135deg,#60a5fa,#a78bfa); border-radius:8px; box-shadow: inset 0 0 10px rgba(255,255,255,0.2); }
    .brand-name { font-weight:800; font-size:12px; letter-spacing:.2px; }
    .invoice-meta { text-align:${'${dir}'}==='rtl' ? 'left' : 'right'; }
    .invoice-title { font-size: 14px; font-weight: 900; margin:0 0 2px; }
    .badge { display:inline-block; padding: 2px 8px; border-radius: 9999px; background:rgba(255,255,255,0.18); color:#fff; font-weight:700; font-size:10px; border:1px solid rgba(255,255,255,0.3); }
    .body { padding: 10px 14px; }
    .grid { display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:8px; }
    .panel { border:1px dashed var(--border); border-radius:10px; padding:10px; background: #ffffff; }
    .panel h3 { margin:0 0 6px; font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; font-weight:700; }
    table { width:100%; border-collapse: collapse; margin-top: 10px; overflow:hidden; border-radius: 10px; font-size: 10px; }
    th, td { padding:8px 10px; border-bottom:1px solid var(--border); text-align:${'${dir}'}==='rtl' ? 'right' : 'left'; }
    thead th { background:#f1f5f9; font-size:9px; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; }
    tbody tr:nth-child(odd) { background:#fafafa; }
    .totals { margin-top: 10px; width: 70mm; margin-${'${dir}'}==='rtl' ? 'right' : 'left':auto; font-size: 10px; }
    .totals .row { display:flex; justify-content:space-between; padding:4px 0; }
    .totals .grand { font-weight:900; font-size:12px; }
    .notes { margin-top: 10px; font-size:10px; color:var(--muted); }
    .footer { margin: 0 14px 12px; font-size: 9px; color:var(--muted); text-align:center; }
    hr { border: none; border-top: 1px solid var(--border); margin: 0; }
  </style>
  <script>function doPrint(){ setTimeout(() => window.print(), 100); }</script>
</head>
<body onload="doPrint()">
  <div class="container">
    <div class="card">
      <div class="hero">
        <div class="brand">
          <div class="logo"></div>
          <div class="brand-name">Frigo SaaS</div>
        </div>
        <div class="invoice-meta">
          <div class="invoice-title">${lblInvoice} • ${inv.number}</div>
          <div class="badge">${lblStatus}: ${inv.status.toUpperCase()}</div>
        </div>
      </div>
      <div class="body">
        <div class="grid">
          <div class="panel">
            <h3>${lblClient}</h3>
            <div>${inv.clientName || '-'}</div>
          </div>
          <div class="panel">
            <h3>Infos</h3>
            <div>${lblCreated}: ${inv.createdAt.toLocaleDateString(lang)}</div>
            <div>${lblDue}: ${inv.dueDate.toLocaleDateString(lang)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align:right">${lblAmount}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Prestation</td>
              <td style="text-align:right">${fmtAmount(inv.amount)}</td>
            </tr>
          </tbody>
        </table>

        <div class="totals">
          <div class="row"><div>${lblSubTotal}</div><div>${fmtAmount(inv.amount)}</div></div>
          <div class="row"><div>${lblTax} (0%)</div><div>${fmtAmount(0)}</div></div>
          <div class="row grand"><div>${lblTotal}</div><div>${fmtAmount(inv.amount)}</div></div>
        </div>

        <div class="notes">${lblNotes}: —</div>
      </div>
      <div class="footer">Frigo SaaS • ${new Date().toLocaleDateString(lang)}</div>
    </div>
  </div>
</body>
</html>`;
    win.document.write(html);
    win.document.close();
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

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        <p className="font-medium">{t('billing.errorLoading', 'Erreur de chargement')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-sm md:text-base">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{t('billing.title', 'Facturation')}</h1>
          <p className="text-gray-600">{t('billing.subtitle', 'Gérez vos factures')}</p>
        </div>
        <button
          disabled={isReadOnly}
          title={isReadOnly ? 'Saison clôturée — modifications désactivées' : undefined}
          onClick={() => {
            if (isReadOnly) return;
            setIsAdding((v) => !v);
          }}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M12 4.5a.75.75 0 01.75.75V11h5.75a.75.75 0 010 1.5H12.75v5.75a.75.75 0 01-1.5 0V12.5H5.5a.75.75 0 010-1.5h5.75V5.25A.75.75 0 0112 4.5z" clipRule="evenodd" /></svg>
          {t('billing.addInvoice', 'Ajouter une facture')}
        </button>
      </div>

      {isAdding && (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('billing.number', 'Numéro')}</label>
              <div className="flex gap-2">
                <input
                  value={form.number}
                  onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder={t('billing.numberPlaceholder', 'FAC-2025-0001') as string}
                />
                <button
                  type="button"
                  onClick={handleGenerateNumber}
                  className="px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 whitespace-nowrap"
                >
                  {t('billing.generateNumber', 'Générer')}
                </button>
              </div>
            </div>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('billing.amount', 'Montant')}</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                className="w-full border rounded-md px-3 py-2"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('billing.status', 'Statut')}</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Invoice['status'] }))}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="draft">{t('billing.statusDraft', 'Brouillon')}</option>
                <option value="sent">{t('billing.statusSent', 'Envoyée')}</option>
                <option value="paid">{t('billing.statusPaid', 'Payée')}</option>
                <option value="overdue">{t('billing.statusOverdue', 'En retard')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('billing.dueDate', 'Échéance')}</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={!form.clientId || addInvoice.isLoading}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-60"
            >
              {addInvoice.isLoading ? t('common.loading') : t('common.save')}
            </button>
            <button onClick={() => setIsAdding(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200">
              {t('common.cancel')}
            </button>
          </div>
        </Card>
      )}

      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>{t('billing.number', 'Numéro')}</TableHeader>
              <TableHeader>{t('billing.client', 'Client')}</TableHeader>
              <TableHeader>{t('billing.amount', 'Montant')}</TableHeader>
              <TableHeader>{t('billing.status', 'Statut')}</TableHeader>
              <TableHeader>{t('billing.dueDate', 'Échéance')}</TableHeader>
              <TableHeader>{t('clients.created', 'Créé le')}</TableHeader>
              <TableHeader>{t('billing.actions', 'Actions')}</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.isArray(invoices) && invoices.length > 0 ? (
              invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.number}</TableCell>
                  <TableCell>{inv.clientName}</TableCell>
                  <TableCell>{inv.amount.toFixed(2)}</TableCell>
                  <TableCell className="capitalize">{t(`billing.status_${inv.status}`, inv.status)}</TableCell>
                  <TableCell>{inv.dueDate.toLocaleDateString()}</TableCell>
                  <TableCell>{inv.createdAt.toLocaleDateString()}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => openPrintableInvoice(inv)}
                      className="px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
                    >
                      {t('billing.generatePdf', 'Générer PDF')}
                    </button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  {t('billing.noInvoices', 'Aucune facture')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};


