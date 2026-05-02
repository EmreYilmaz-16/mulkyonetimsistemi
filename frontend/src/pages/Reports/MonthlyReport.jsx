import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import api from '../../api/client';

const MONTH_NAMES = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

function formatTL(value) {
  if (value >= 1000000) return `₺${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `₺${(value / 1000).toFixed(0)}K`;
  return `₺${value.toLocaleString('tr-TR')}`;
}

export default function MonthlyReport() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [siteName, setSiteName] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['income-expense', year],
    queryFn: () => api.get('/reports/income-expense', { params: { year } }).then((r) => r.data)
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['report-sites'],
    queryFn: () => api.get('/properties', { params: { limit: 500 } }).then((r) => r.data)
  });

  const { data: profitData } = useQuery({
    queryKey: ['profitability', year, siteName],
    queryFn: () => api.get('/reports/profitability', { params: { year, site_name: siteName || undefined } }).then((r) => r.data)
  });

  // Build full 12-month chart data
  const chartData = MONTH_NAMES.map((name, idx) => {
    const monthStr = `${year}-${String(idx + 1).padStart(2, '0')}`;
    const income = data?.income?.find((i) => i.month === monthStr);
    const expense = data?.expenses?.find((e) => e.month === monthStr);
    return {
      name,
      Gelir: income ? Number(income.total) : 0,
      Gider: expense ? Number(expense.total) : 0,
      Net: (income ? Number(income.total) : 0) - (expense ? Number(expense.total) : 0)
    };
  });

  const totalIncome = chartData.reduce((s, d) => s + d.Gelir, 0);
  const totalExpense = chartData.reduce((s, d) => s + d.Gider, 0);
  const totalNet = totalIncome - totalExpense;
  const totalProfitIncome = (profitData || []).reduce((sum, item) => sum + Number(item.income || 0), 0);
  const totalProfitExpense = (profitData || []).reduce((sum, item) => sum + Number(item.expenses || 0), 0);
  const totalProfitNet = totalProfitIncome - totalProfitExpense;
  const siteOptions = [...new Set(properties.map((property) => property.site_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-2 text-xs shadow-lg">
        <div className="font-semibold mb-1">{label}</div>
        {payload.map((p) => (
          <div key={p.name} style={{ color: p.color }}>
            {p.name}: ₺{Number(p.value).toLocaleString('tr-TR')}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Aylık Gelir-Gider</h1>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="input py-1.5 text-sm w-24"
        >
          {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card text-center py-2">
          <div className="text-xs text-gray-500 mb-0.5">Toplam Gelir</div>
          <div className="text-sm font-bold text-green-600">{formatTL(totalIncome)}</div>
        </div>
        <div className="card text-center py-2">
          <div className="text-xs text-gray-500 mb-0.5">Toplam Gider</div>
          <div className="text-sm font-bold text-red-600">{formatTL(totalExpense)}</div>
        </div>
        <div className="card text-center py-2">
          <div className="text-xs text-gray-500 mb-0.5">Net Kar</div>
          <div className={`text-sm font-bold flex items-center justify-center gap-0.5 ${totalNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {totalNet >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {formatTL(Math.abs(totalNet))}
          </div>
        </div>
      </div>

      {/* Bar chart */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Yükleniyor...</div>
      ) : (
        <div className="card p-3">
          <h2 className="text-sm font-semibold mb-3">{year} Yılı – Gelir / Gider Grafiği</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -15 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${v / 1000}K` : v} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Gelir" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={18} />
              <Bar dataKey="Gider" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Monthly table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2 font-semibold text-gray-600">Ay</th>
              <th className="text-right p-2 font-semibold text-green-600">Gelir</th>
              <th className="text-right p-2 font-semibold text-red-600">Gider</th>
              <th className="text-right p-2 font-semibold text-gray-700">Net</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((row, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="p-2 text-gray-700">{row.name}</td>
                <td className="p-2 text-right text-green-700">{row.Gelir > 0 ? `₺${row.Gelir.toLocaleString('tr-TR')}` : '-'}</td>
                <td className="p-2 text-right text-red-700">{row.Gider > 0 ? `₺${row.Gider.toLocaleString('tr-TR')}` : '-'}</td>
                <td className={`p-2 text-right font-semibold ${row.Net > 0 ? 'text-green-700' : row.Net < 0 ? 'text-red-700' : 'text-gray-400'}`}>
                  {row.Net !== 0 ? `₺${row.Net.toLocaleString('tr-TR')}` : '-'}
                </td>
              </tr>
            ))}
            {/* Totals row */}
            <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
              <td className="p-2">Toplam</td>
              <td className="p-2 text-right text-green-700">₺{totalIncome.toLocaleString('tr-TR')}</td>
              <td className="p-2 text-right text-red-700">₺{totalExpense.toLocaleString('tr-TR')}</td>
              <td className={`p-2 text-right ${totalNet >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                ₺{totalNet.toLocaleString('tr-TR')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Per-property profitability */}
      {profitData?.length > 0 && (
        <div className="card space-y-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">{year} – Mülk Bazlı Kârlılık</h2>
              <div className="text-xs text-gray-500">Mülk kârlılığını site bazında filtreleyebilirsiniz</div>
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
          {profitData.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0 text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{p.name}{p.unit_number ? ` (${p.unit_number})` : ''}</div>
                {p.site_name && <div className="text-xs text-gray-400 truncate">{p.site_name}</div>}
                <div className="text-xs text-gray-500">
                  Gelir: ₺{Number(p.income).toLocaleString('tr-TR')} &nbsp;|&nbsp; Gider: ₺{Number(p.expenses).toLocaleString('tr-TR')}
                </div>
              </div>
              <div className={`flex items-center gap-1 font-bold text-sm shrink-0 ml-2 ${Number(p.net) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Number(p.net) >= 0 ? <TrendingUp size={13}/> : <TrendingDown size={13}/>}
                ₺{Number(p.net).toLocaleString('tr-TR')}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm font-semibold">
            <div>
              <div>Toplam</div>
              <div className="text-xs font-normal text-gray-500">
                Gelir: ₺{totalProfitIncome.toLocaleString('tr-TR')} &nbsp;|&nbsp; Gider: ₺{totalProfitExpense.toLocaleString('tr-TR')}
              </div>
            </div>
            <div className={`${totalProfitNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₺{totalProfitNet.toLocaleString('tr-TR')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
