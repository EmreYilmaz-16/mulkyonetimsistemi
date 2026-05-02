import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, PlusCircle, X } from 'lucide-react';
import api from '../../api/client';

const statusColor = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  late: 'bg-red-100 text-red-700',
  partial: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-gray-100 text-gray-500'
};
const statusLabel = { paid: 'Ödendi', pending: 'Bekliyor', late: 'Gecikti', partial: 'Eksik', cancelled: 'İptal' };

const getMonthDateRange = (monthValue) => {
  if (!monthValue) return { fromDate: undefined, toDate: undefined };

  const [yearStr, monthStr] = monthValue.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);

  if (!year || !month) return { fromDate: undefined, toDate: undefined };

  const lastDay = new Date(year, month, 0).getDate();

  return {
    fromDate: `${year}-${String(month).padStart(2, '0')}-01`,
    toDate: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  };
};

export default function PaymentList() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [overdueOnly, setOverdueOnly] = useState(searchParams.get('overdue') === 'true');
  const [tenantName, setTenantName] = useState(searchParams.get('tenant') || '');
  const [siteName, setSiteName] = useState(searchParams.get('site') || '');
  const [dueMonth, setDueMonth] = useState(searchParams.get('month') || '');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState(null);

  const now = new Date();
  const [genYear, setGenYear]   = useState(now.getFullYear());
  const [genMonth, setGenMonth] = useState(now.getMonth() + 1);

  useEffect(() => {
    setStatus(searchParams.get('status') || '');
    setOverdueOnly(searchParams.get('overdue') === 'true');
    setTenantName(searchParams.get('tenant') || '');
    setSiteName(searchParams.get('site') || '');
    setDueMonth(searchParams.get('month') || '');
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);

    if (overdueOnly) {
      nextParams.set('overdue', 'true');
      nextParams.delete('status');
    } else {
      nextParams.delete('overdue');
      if (status) {
        nextParams.set('status', status);
      } else {
        nextParams.delete('status');
      }
    }

    if (tenantName.trim()) {
      nextParams.set('tenant', tenantName.trim());
    } else {
      nextParams.delete('tenant');
    }

    if (siteName.trim()) {
      nextParams.set('site', siteName.trim());
    } else {
      nextParams.delete('site');
    }

    if (dueMonth) {
      nextParams.set('month', dueMonth);
    } else {
      nextParams.delete('month');
    }

    setSearchParams(nextParams, { replace: true });
  }, [dueMonth, overdueOnly, searchParams, setSearchParams, siteName, status, tenantName]);

  const { fromDate, toDate } = getMonthDateRange(dueMonth);

  const { data: tenants = [] } = useQuery({
    queryKey: ['payment-filter-tenants'],
    queryFn: () => api.get('/tenants', { params: { limit: 200 } }).then((r) => r.data)
  });

  const { data, isLoading } = useQuery({
    queryKey: ['payments', status, overdueOnly, tenantName, siteName, dueMonth],
    queryFn: () => api.get('/payments', {
      params: {
        status: overdueOnly ? undefined : status || undefined,
        overdue: overdueOnly ? 'true' : undefined,
        tenant_name: tenantName.trim() || undefined,
        site_name: siteName.trim() || undefined,
        from_date: fromDate,
        to_date: toDate,
        limit: 200
      }
    }).then((r) => r.data)
  });

  const markPaid = useMutation({
    mutationFn: (id) => api.put(`/payments/${id}/mark-paid`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] })
  });

  const generateMonthly = async () => {
    setGenerating(true);
    setGenResult(null);
    try {
      const res = await api.post('/payments/generate-monthly', { year: genYear, month: genMonth });
      setGenResult(res.message || res.data?.message || `${genMonth}/${genYear} için tahakkuk oluşturuldu`);
      qc.invalidateQueries({ queryKey: ['payments'] });
      setShowGenerateModal(false);
    } catch (e) {
      setGenResult(e?.message || 'Hata oluştu');
    } finally {
      setGenerating(false);
    }
  };

  const monthNames = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const tenantOptions = tenants.map((tenant) => `${tenant.first_name} ${tenant.last_name}`.trim()).filter(Boolean);
  const clearFilters = () => {
    setStatus('');
    setOverdueOnly(false);
    setTenantName('');
    setSiteName('');
    setDueMonth('');
  };
  const hasFilters = Boolean(status || overdueOnly || tenantName.trim() || siteName.trim() || dueMonth);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Kiralar</h1>
        <button onClick={() => { setGenResult(null); setShowGenerateModal(true); }} className="btn-primary py-2 px-3 text-sm">
          <PlusCircle size={15} /> Tahakkuk Oluştur
        </button>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-gray-800">Filtreler</div>
            <div className="text-xs text-gray-500">Ay, kiracı, site ve durum bazlı filtreleme yapabilirsiniz</div>
          </div>
          {hasFilters ? (
            <button type="button" onClick={clearFilters} className="text-xs font-medium text-primary-600">
              Temizle
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Ay</label>
            <input
              type="month"
              className="input"
              value={dueMonth}
              onChange={(e) => setDueMonth(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Durum</label>
            <select className="input" value={overdueOnly ? 'overdue' : status} onChange={(e) => {
              const value = e.target.value;
              if (value === 'overdue') {
                setOverdueOnly(true);
                setStatus('');
                return;
              }

              setOverdueOnly(false);
              setStatus(value);
            }}>
              <option value="">Tüm Durumlar</option>
              <option value="overdue">Gecikmiş</option>
              <option value="pending">Bekliyor</option>
              <option value="late">Geciken</option>
              <option value="paid">Ödendi</option>
              <option value="partial">Eksik</option>
              <option value="cancelled">İptal</option>
            </select>
          </div>

          <div>
            <label className="label">Kiracı</label>
            <input
              className="input"
              list="tenant-options"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="Kiracı seçin veya yazın"
            />
            <datalist id="tenant-options">
              {tenantOptions.map((tenant) => (
                <option key={tenant} value={tenant} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="label">Site</label>
            <input
              className="input"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="Site adına göre filtrele"
            />
          </div>
        </div>
      </div>

      {genResult && (
        <div className="card border border-blue-100 bg-blue-50 text-sm font-medium text-blue-700">
          {genResult}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Yükleniyor...</div>
      ) : (
        <div className="space-y-2">
          {data?.map((p) => (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{p.property_name}</div>
                  <div className="text-xs text-gray-500">{p.tenant_name}</div>
                  {p.site_name && <div className="text-xs text-gray-400">Site: {p.site_name}</div>}
                  <div className="text-xs text-gray-400 mt-0.5">
                    Vade: {new Date(p.due_date).toLocaleDateString('tr-TR')}
                    {p.payment_date && ` • Ödeme: ${new Date(p.payment_date).toLocaleDateString('tr-TR')}`}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="font-bold text-sm">₺{Number(p.amount).toLocaleString('tr-TR')}</span>
                  <span className={`badge ${statusColor[p.status]}`}>{statusLabel[p.status]}</span>
                  {p.status === 'pending' || p.status === 'late' ? (
                    <button
                      onClick={() => markPaid.mutate(p.id)}
                      disabled={markPaid.isPending}
                      className="text-xs text-green-600 flex items-center gap-0.5 hover:underline"
                    >
                      <CheckCircle size={12} /> Tahsil Et
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {!data?.length && <div className="text-center py-8 text-gray-400">Ödeme bulunamadı</div>}
        </div>
      )}

      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <div className="text-base font-semibold text-gray-900">Aylık Tahakkuk Oluştur</div>
                <div className="text-xs text-gray-500">Seçilen ay için aktif sözleşmelere otomatik kira kaydı oluşturulur</div>
              </div>
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Kapat"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Ay</label>
                  <select className="input" value={genMonth} onChange={(e) => setGenMonth(Number(e.target.value))}>
                    {monthNames.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Yıl</label>
                  <select className="input" value={genYear} onChange={(e) => setGenYear(Number(e.target.value))}>
                    {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((year) => <option key={year} value={year}>{year}</option>)}
                  </select>
                </div>
              </div>

              {genResult && <p className="text-xs font-medium text-blue-700">{genResult}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button type="button" onClick={() => setShowGenerateModal(false)} className="btn-secondary py-2 px-3 text-sm">
                Vazgeç
              </button>
              <button type="button" onClick={generateMonthly} disabled={generating} className="btn-primary py-2 px-3 text-sm">
                <PlusCircle size={15} /> {generating ? 'Oluşturuluyor...' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
