import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import api from '../../api/client';

const typeLabel  = { rent: 'Kira', deposit: 'Depozito Mahsubu' };
const typeBadge  = { rent: 'bg-green-100 text-green-700', deposit: 'bg-orange-100 text-orange-700' };
const methodLabel = { cash: 'Nakit', bank: 'Banka', card: 'Kart', eft: 'EFT', other: 'Diğer' };

function getType(payment) {
  return payment.notes && payment.notes.startsWith('Depozito mahsubu') ? 'deposit' : 'rent';
}

export default function IncomeList() {
  const now   = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [typeFilter, setTypeFilter] = useState('');

  const lastDay = new Date(year, month, 0).getDate();
  const fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const toDate   = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['income', year, month],
    queryFn: () =>
      api.get('/payments', {
        params: { status: 'paid', from_date: fromDate, to_date: toDate, limit: 500 }
      }).then((r) => r.data)
  });

  const filtered = useMemo(() => {
    if (!typeFilter) return rows;
    return rows.filter((p) => getType(p) === typeFilter);
  }, [rows, typeFilter]);

  const totalAll     = useMemo(() => rows.reduce((s, p) => s + Number(p.amount), 0), [rows]);
  const totalRent    = useMemo(() => rows.filter(p => getType(p) === 'rent').reduce((s, p) => s + Number(p.amount), 0), [rows]);
  const totalDeposit = useMemo(() => rows.filter(p => getType(p) === 'deposit').reduce((s, p) => s + Number(p.amount), 0), [rows]);

  const monthNames = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Gelirler</h1>

      {/* Dönem seçici */}
      <div className="flex gap-2">
        <select className="input flex-1" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {monthNames.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <select className="input w-24" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card text-center py-3">
          <p className="text-xs text-gray-500 mb-1">Toplam</p>
          <p className="font-bold text-sm text-gray-900">₺{totalAll.toLocaleString('tr-TR')}</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-xs text-gray-500 mb-1">Kira</p>
          <p className="font-bold text-sm text-green-700">₺{totalRent.toLocaleString('tr-TR')}</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-xs text-gray-500 mb-1">Depozito</p>
          <p className="font-bold text-sm text-orange-600">₺{totalDeposit.toLocaleString('tr-TR')}</p>
        </div>
      </div>

      {/* Tür filtresi */}
      <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
        <option value="">Tüm Türler</option>
        <option value="rent">Kira</option>
        <option value="deposit">Depozito Mahsubu</option>
      </select>

      {/* Liste */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <TrendingUp size={36} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Bu dönemde gelir kaydı yok</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const type = getType(p);
            return (
              <div key={p.id} className="card">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{p.property_name}</div>
                    <div className="text-xs text-gray-500">{p.tenant_name}</div>
                    {p.payment_date && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        {new Date(p.payment_date).toLocaleDateString('tr-TR')}
                        {p.method && ` • ${methodLabel[p.method] || p.method}`}
                      </div>
                    )}
                    {type === 'deposit' && p.notes && (
                      <div className="text-xs text-orange-600 mt-0.5 leading-snug line-clamp-2">{p.notes}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="font-bold text-sm">₺{Number(p.amount).toLocaleString('tr-TR')}</span>
                    <span className={`badge ${typeBadge[type]}`}>{typeLabel[type]}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
