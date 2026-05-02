import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../../api/client';

const months = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const paymentTypeLabels = { rent: 'Kira', deposit: 'Depozito' };
const expenseCategoryLabels = {
  maintenance: 'Bakım/Onarım',
  tax: 'Vergi',
  insurance: 'Sigorta',
  dask: 'DASK',
  utility: 'Fatura',
  management_fee: 'Yönetim Ücreti',
  renovation: 'Tadilat',
  other: 'Diğer'
};

export default function Reports() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [siteName, setSiteName] = useState('');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [detailYear, setDetailYear] = useState(new Date().getFullYear());
  const [detailMonth, setDetailMonth] = useState('');

  const { data: ie, isLoading: ieLoading } = useQuery({
    queryKey: ['income-expense', year],
    queryFn: () => api.get('/reports/income-expense', { params: { year } }).then((r) => r.data)
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['report-sites'],
    queryFn: () => api.get('/properties', { params: { limit: 500 } }).then((r) => r.data)
  });

  const { data: profit, isLoading: pLoading } = useQuery({
    queryKey: ['profitability', year, siteName],
    queryFn: () => api.get('/reports/profitability', { params: { year, site_name: siteName || undefined } }).then((r) => r.data)
  });

  const { data: selectedPropertyDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['profitability-detail', selectedProperty?.id, detailYear, detailMonth],
    queryFn: () => api.get(`/reports/profitability/${selectedProperty.id}`, {
      params: { year: detailYear, month: detailMonth || undefined }
    }).then((r) => r.data),
    enabled: Boolean(selectedProperty?.id)
  });

  const siteOptions = [...new Set(properties.map((property) => property.site_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  const totalProfitIncome = (profit || []).reduce((sum, item) => sum + Number(item.income || 0), 0);
  const totalProfitExpense = (profit || []).reduce((sum, item) => sum + Number(item.expenses || 0), 0);
  const totalProfitNet = totalProfitIncome - totalProfitExpense;
  const detailSummary = selectedPropertyDetail?.summary;

  const openPropertyDetail = (property) => {
    setSelectedProperty(property);
    setDetailYear(year);
    setDetailMonth('');
  };

  // Merge income and expenses by month
  const chartData = Array.from({ length: 12 }, (_, i) => {
    const monthKey = `${year}-${String(i + 1).padStart(2, '0')}`;
    const income = ie?.income?.find((x) => x.month === monthKey);
    const expense = ie?.expenses?.find((x) => x.month === monthKey);
    return {
      name: months[i],
      Gelir: Number(income?.total || 0),
      Gider: Number(expense?.total || 0)
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Raporlar</h1>
        <select
          className="input w-28"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {[2023, 2024, 2025, 2026].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold mb-3">Gelir / Gider ({year})</h2>
        {ieLoading ? (
          <div className="text-center text-gray-400 py-4">Yükleniyor...</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
              <Tooltip formatter={(v) => `₺${Number(v).toLocaleString('tr-TR')}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Gelir" fill="#3b82f6" radius={[3,3,0,0]} />
              <Bar dataKey="Gider" fill="#f87171" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Mülk Karlılığı ({year})</h2>
            <div className="text-xs text-gray-500">İsterseniz belirli bir siteye göre filtreleyebilir, mülke tıklayarak detayları açabilirsiniz</div>
          </div>
          <div className="w-44">
            <label className="label">Site</label>
            <select className="input" value={siteName} onChange={(e) => setSiteName(e.target.value)}>
              <option value="">Tüm Siteler</option>
              {siteOptions.map((site) => (
                <option key={site} value={site}>{site}</option>
              ))}
            </select>
          </div>
        </div>
        {pLoading ? (
          <div className="text-center text-gray-400 py-4">Yükleniyor...</div>
        ) : (
          <div className="space-y-2">
            {profit?.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openPropertyDetail(p)}
                className={`flex w-full items-center justify-between rounded-lg py-2 px-2 text-left border-b border-gray-50 last:border-0 hover:bg-gray-50 ${selectedProperty?.id === p.id ? 'bg-blue-50' : ''}`}
              >
                <div>
                  <div className="text-sm font-medium">{p.name}</div>
                  {p.site_name && <div className="text-xs text-gray-400">{p.site_name}</div>}
                  <div className="text-xs text-gray-400">
                    Gelir: ₺{Number(p.income).toLocaleString('tr-TR')} · Gider: ₺{Number(p.expenses).toLocaleString('tr-TR')}
                  </div>
                </div>
                <span className={`text-sm font-bold ${Number(p.net) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  ₺{Number(p.net).toLocaleString('tr-TR')}
                </span>
              </button>
            ))}
            {profit?.length > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm font-semibold">
                <div>
                  <div>Toplam</div>
                  <div className="text-xs font-normal text-gray-500">
                    Gelir: ₺{totalProfitIncome.toLocaleString('tr-TR')} · Gider: ₺{totalProfitExpense.toLocaleString('tr-TR')}
                  </div>
                </div>
                <span className={`${totalProfitNet >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  ₺{totalProfitNet.toLocaleString('tr-TR')}
                </span>
              </div>
            )}
            {!profit?.length && <div className="text-center text-gray-400 py-4">Veri yok</div>}
          </div>
        )}
      </div>

      {selectedProperty && (
        <div className="card space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Mülk Gelir-Gider Detayı</h2>
              <div className="text-xs text-gray-500">
                {selectedPropertyDetail?.property?.name || selectedProperty.name}
                {selectedPropertyDetail?.property?.site_name ? ` · ${selectedPropertyDetail.property.site_name}` : ''}
              </div>
            </div>
            <button type="button" className="text-xs btn-secondary py-1 px-2" onClick={() => setSelectedProperty(null)}>
              Kapat
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className="label">Yıl</label>
              <select className="input" value={detailYear} onChange={(e) => setDetailYear(Number(e.target.value))}>
                {[2023, 2024, 2025, 2026].map((itemYear) => (
                  <option key={itemYear} value={itemYear}>{itemYear}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Ay</label>
              <select className="input" value={detailMonth} onChange={(e) => setDetailMonth(e.target.value)}>
                <option value="">Tüm Aylar</option>
                {months.map((monthLabel, index) => (
                  <option key={monthLabel} value={index + 1}>{monthLabel}</option>
                ))}
              </select>
            </div>
            <div className="rounded-xl bg-green-50 px-3 py-2">
              <div className="text-xs text-green-700">Gelir</div>
              <div className="text-sm font-bold text-green-700">₺{Number(detailSummary?.income || 0).toLocaleString('tr-TR')}</div>
            </div>
            <div className="rounded-xl bg-red-50 px-3 py-2">
              <div className="text-xs text-red-700">Net</div>
              <div className={`text-sm font-bold ${Number(detailSummary?.net || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                ₺{Number(detailSummary?.net || 0).toLocaleString('tr-TR')}
              </div>
            </div>
          </div>

          {detailLoading ? (
            <div className="text-center text-gray-400 py-4">Detay yükleniyor...</div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-green-100 bg-green-50/40 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-green-800">Gelir Detayları</h3>
                  <span className="text-xs text-green-700">₺{Number(detailSummary?.income || 0).toLocaleString('tr-TR')}</span>
                </div>
                <div className="space-y-2">
                  {selectedPropertyDetail?.income_details?.map((item) => (
                    <div key={item.id} className="rounded-lg bg-white px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">{paymentTypeLabels[item.payment_type] || 'Tahsilat'}</div>
                          <div className="text-xs text-gray-500">{item.tenant_name || 'Kiracı bilgisi yok'} · {new Date(item.date).toLocaleDateString('tr-TR')}</div>
                          {(item.method || item.reference_no) && (
                            <div className="text-xs text-gray-400">{item.method || '-'}{item.reference_no ? ` · Ref: ${item.reference_no}` : ''}</div>
                          )}
                          {item.notes && <div className="text-xs text-gray-400 mt-1">{item.notes}</div>}
                        </div>
                        <div className="text-sm font-bold text-green-700">₺{Number(item.amount).toLocaleString('tr-TR')}</div>
                      </div>
                    </div>
                  ))}
                  {!selectedPropertyDetail?.income_details?.length && (
                    <div className="text-center text-sm text-gray-400 py-4">Bu filtrede gelir kaydı yok</div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-red-100 bg-red-50/40 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-red-800">Gider Detayları</h3>
                  <span className="text-xs text-red-700">₺{Number(detailSummary?.expenses || 0).toLocaleString('tr-TR')}</span>
                </div>
                <div className="space-y-2">
                  {selectedPropertyDetail?.expense_details?.map((item) => (
                    <div key={item.id} className="rounded-lg bg-white px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">{expenseCategoryLabels[item.category] || item.category}</div>
                          <div className="text-xs text-gray-500">{new Date(item.date).toLocaleDateString('tr-TR')}{item.vendor ? ` · ${item.vendor}` : ''}</div>
                          {item.description && <div className="text-xs text-gray-400 mt-1">{item.description}</div>}
                        </div>
                        <div className="text-sm font-bold text-red-700">₺{Number(item.amount).toLocaleString('tr-TR')}</div>
                      </div>
                    </div>
                  ))}
                  {!selectedPropertyDetail?.expense_details?.length && (
                    <div className="text-center text-sm text-gray-400 py-4">Bu filtrede gider kaydı yok</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
