import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Trash2, CheckCircle2, Clock, AlertCircle, Info } from 'lucide-react';
import { useForm } from 'react-hook-form';
import api from '../../api/client';

// Türkiye vergi takvimi bilgileri
const TAX_TYPES = [
  { value: 'gmsi',          label: 'GMSI – Kira Geliri Beyannamesi',    info: 'Beyanname: 1-31 Mart | 1.taksit: Mart, 2.taksit: Temmuz', annual: true },
  { value: 'emlak_1',       label: 'Emlak Vergisi – 1. Taksit',         info: 'Ödeme: 1-31 Mayıs', annual: true },
  { value: 'emlak_2',       label: 'Emlak Vergisi – 2. Taksit',         info: 'Ödeme: 1-30 Kasım', annual: true },
  { value: 'dask',          label: 'DASK – Zorunlu Deprem Sigortası',   info: 'Poliçe bitiş tarihinde yenile', annual: false },
  { value: 'konut_sigorta', label: 'Konut Sigortası',                   info: 'Poliçe bitiş tarihinde yenile', annual: false },
  { value: 'stopaj',        label: 'Stopaj (Ticari Kira)',              info: 'Her ay 23. gün beyanname, son gün ödeme', annual: false },
  { value: 'kdv',           label: 'KDV (Ticari Kira)',                 info: 'Her ay 24. gün beyanname, son gün ödeme', annual: false },
  { value: 'diger',         label: 'Diğer',                            info: '', annual: false },
];

const STATUS_CONFIG = {
  bekliyor: { label: 'Bekliyor',    color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  odendi:   { label: 'Ödendi',      color: 'bg-green-100 text-green-700',   icon: CheckCircle2 },
  gecikti:  { label: 'GECİKTİ',    color: 'bg-red-100 text-red-700',       icon: AlertCircle },
  muaf:     { label: 'Muaf',        color: 'bg-gray-100 text-gray-500',     icon: Info },
};

function isOverdue(item) {
  return item.status === 'bekliyor' && item.due_date && new Date(item.due_date) < new Date();
}

export default function TaxList() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const [showInfo, setShowInfo] = useState(false);
  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: { year: new Date().getFullYear(), status: 'bekliyor' }
  });

  const { data: properties } = useQuery({
    queryKey: ['properties-select'],
    queryFn: () => api.get('/properties', { params: { limit: 200 } }).then((r) => r.data)
  });

  const { data, isLoading } = useQuery({
    queryKey: ['taxes', filterStatus, yearFilter],
    queryFn: () => api.get('/taxes', {
      params: { year: yearFilter, ...(filterStatus ? { status: filterStatus } : {}) }
    }).then((r) => r.data)
  });

  const addMutation = useMutation({
    mutationFn: (d) => api.post('/taxes', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['taxes'] }); setShowForm(false); reset(); }
  });

  const markPaid = useMutation({
    mutationFn: ({ id, paid_date }) => api.put(`/taxes/${id}`, { status: 'odendi', paid_date }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taxes'] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/taxes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taxes'] })
  });

  const selectedType = TAX_TYPES.find(t => t.value === watch('tax_type'));

  // Summary
  const summary = data?.reduce((acc, t) => {
    if (t.status === 'bekliyor') acc.pending++;
    if (isOverdue(t)) acc.overdue++;
    if (t.status === 'odendi' && t.amount) acc.paid += Number(t.amount);
    return acc;
  }, { pending: 0, overdue: 0, paid: 0 });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Vergi / Beyanname</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowInfo(!showInfo)} className="p-2 text-gray-500 hover:text-gray-700">
            <Info size={18} />
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary py-2 px-3 text-sm">
            <Plus size={16} /> {showForm ? 'İptal' : 'Ekle'}
          </button>
        </div>
      </div>

      {/* Vergi takvimi bilgisi */}
      {showInfo && (
        <div className="card bg-blue-50 border border-blue-200 space-y-1.5 text-xs text-blue-800">
          <div className="font-semibold text-sm mb-1">🗓 Türkiye Mülk Sahibi Vergi Takvimi</div>
          {TAX_TYPES.filter(t => t.info).map(t => (
            <div key={t.value}><span className="font-medium">{t.label}:</span> {t.info}</div>
          ))}
        </div>
      )}

      {/* Year filter */}
      <div className="flex items-center gap-2">
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(Number(e.target.value))}
          className="input py-1.5 text-sm"
        >
          {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="flex gap-1 flex-1 overflow-x-auto">
          {[['', 'Tümü'], ['bekliyor', 'Bekliyor'], ['gecikti', 'Gecikti'], ['odendi', 'Ödendi']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilterStatus(v)}
              className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filterStatus === v ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-2">
          <div className="card text-center py-2">
            <div className="text-lg font-bold text-yellow-600">{summary.pending}</div>
            <div className="text-xs text-gray-500">Bekliyor</div>
          </div>
          <div className="card text-center py-2">
            <div className="text-lg font-bold text-red-600">{summary.overdue}</div>
            <div className="text-xs text-gray-500">Gecikmiş</div>
          </div>
          <div className="card text-center py-2">
            <div className="text-sm font-bold text-green-600">₺{(summary.paid / 1000).toFixed(1)}K</div>
            <div className="text-xs text-gray-500">Ödenen</div>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit((d) => addMutation.mutate(d))} className="card space-y-3">
          <h2 className="font-semibold">Vergi / Yükümlülük Ekle</h2>
          <div>
            <label className="label">Vergi / Yükümlülük Türü *</label>
            <select className="input" {...register('tax_type', { required: true })}>
              <option value="">Seçin</option>
              {TAX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {selectedType?.info && (
              <p className="text-xs text-blue-600 mt-1">ℹ️ {selectedType.info}</p>
            )}
          </div>
          <div>
            <label className="label">Mülk</label>
            <select className="input" {...register('property_id')}>
              <option value="">Genel (tüm mülkler)</option>
              {properties?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Yıl *</label>
              <input className="input" type="number" {...register('year', { required: true })} />
            </div>
            <div>
              <label className="label">Ay (aylık için)</label>
              <select className="input" {...register('month')}>
                <option value="">Yıllık</option>
                {['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'].map((m, i) => (
                  <option key={i+1} value={i+1}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tutar (₺)</label>
              <input className="input" type="number" step="0.01" {...register('amount')} />
            </div>
            <div>
              <label className="label">Son Ödeme Tarihi</label>
              <input className="input" type="date" {...register('due_date')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Durum</label>
              <select className="input" {...register('status')}>
                <option value="bekliyor">Bekliyor</option>
                <option value="odendi">Ödendi</option>
                <option value="gecikti">Gecikti</option>
                <option value="muaf">Muaf</option>
              </select>
            </div>
            <div>
              <label className="label">Referans No</label>
              <input className="input" {...register('reference_no')} />
            </div>
          </div>
          <div>
            <label className="label">Notlar</label>
            <textarea className="input" rows={2} {...register('notes')} />
          </div>
          <button type="submit" disabled={addMutation.isPending} className="btn-primary w-full">
            {addMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Yükleniyor...</div>
      ) : (
        <div className="space-y-2">
          {data?.map((item) => {
            const overdue = isOverdue(item);
            const st = STATUS_CONFIG[overdue ? 'gecikti' : item.status] || STATUS_CONFIG.bekliyor;
            const StatusIcon = st.icon;
            const typeInfo = TAX_TYPES.find(t => t.value === item.tax_type);
            return (
              <div key={item.id} className={`card space-y-1 ${overdue ? 'border-l-4 border-red-400' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <StatusIcon size={13} className={overdue ? 'text-red-500' : ''} />
                      <span className="font-semibold text-sm truncate">{typeInfo?.label || item.tax_type}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {item.property_name || 'Genel'} • {item.year}{item.month ? `/${String(item.month).padStart(2,'0')}` : ''}
                    </div>
                    {item.due_date && (
                      <div className={`text-xs mt-0.5 ${overdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                        Son tarih: {new Date(item.due_date).toLocaleDateString('tr-TR')}
                      </div>
                    )}
                    {item.amount && <div className="text-xs font-semibold text-gray-700">₺{Number(item.amount).toLocaleString('tr-TR')}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`badge text-xs ${st.color}`}>{st.label}</span>
                    {item.status === 'bekliyor' && (
                      <button
                        onClick={() => markPaid.mutate({ id: item.id, paid_date: new Date().toISOString().split('T')[0] })}
                        className="p-1 text-green-500 hover:text-green-700"
                        title="Ödendi olarak işaretle"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    )}
                    <button onClick={() => deleteMutation.mutate(item.id)} className="p-1 text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {item.notes && <div className="text-xs text-gray-400 border-t border-gray-100 pt-1">{item.notes}</div>}
              </div>
            );
          })}
          {!data?.length && <div className="text-center py-8 text-gray-400">Vergi kaydı bulunamadı</div>}
        </div>
      )}
    </div>
  );
}
