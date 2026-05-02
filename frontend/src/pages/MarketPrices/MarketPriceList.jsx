import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import { useForm } from 'react-hook-form';
import api from '../../api/client';

const sourceOptions = [
  ['sahibinden', 'Sahibinden.com'],
  ['emlakjet', 'Emlakjet'],
  ['hurriyet', 'Hürriyet Emlak'],
  ['zingat', 'Zingat'],
  ['manuel', 'Manuel Araştırma'],
  ['diger', 'Diğer']
];

function priceDiff(marketAmount, currentRent) {
  if (!currentRent || !marketAmount) return null;
  const diff = ((marketAmount - currentRent) / currentRent) * 100;
  return diff;
}

export default function MarketPriceList() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState('');
  const { register, handleSubmit, reset } = useForm({
    defaultValues: { noted_date: new Date().toISOString().split('T')[0] }
  });

  const { data: properties } = useQuery({
    queryKey: ['properties-select'],
    queryFn: () => api.get('/properties', { params: { limit: 200 } }).then((r) => r.data)
  });

  const { data, isLoading } = useQuery({
    queryKey: ['market-prices', filterType],
    queryFn: () => api.get('/market-prices', { params: filterType ? { price_type: filterType } : {} }).then((r) => r.data)
  });

  const addMutation = useMutation({
    mutationFn: (d) => api.post('/market-prices', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['market-prices'] }); setShowForm(false); reset(); }
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/market-prices/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['market-prices'] })
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Fiyat Takibi</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary py-2 px-3 text-sm">
          <Plus size={16} /> {showForm ? 'İptal' : 'Ekle'}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[['', 'Tümü'], ['rental', 'Kiralık'], ['sale', 'Satılık']].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilterType(v)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filterType === v ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit((d) => addMutation.mutate(d))} className="card space-y-3">
          <h2 className="font-semibold">Piyasa Fiyatı Ekle</h2>
          <div>
            <label className="label">Mülk</label>
            <select className="input" {...register('property_id')}>
              <option value="">Genel / Karşılaştırmalı</option>
              {properties?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tür *</label>
              <select className="input" {...register('price_type', { required: true })}>
                <option value="rental">Kiralık</option>
                <option value="sale">Satılık</option>
              </select>
            </div>
            <div>
              <label className="label">Tutar (₺) *</label>
              <input className="input" type="number" step="0.01" {...register('amount', { required: true })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Kaynak</label>
              <select className="input" {...register('source')}>
                <option value="">Seçin</option>
                {sourceOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tarih</label>
              <input className="input" type="date" {...register('noted_date')} />
            </div>
          </div>
          <div>
            <label className="label">İlan URL</label>
            <input className="input" type="url" placeholder="https://..." {...register('url')} />
          </div>
          <div>
            <label className="label">Notlar</label>
            <input className="input" {...register('notes')} />
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
            const diff = item.price_type === 'rental' ? priceDiff(Number(item.amount), Number(item.current_rent)) : null;
            return (
              <div key={item.id} className="card space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`badge text-xs ${item.price_type === 'rental' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                        {item.price_type === 'rental' ? 'Kiralık' : 'Satılık'}
                      </span>
                      <span className="font-bold text-sm">₺{Number(item.amount).toLocaleString('tr-TR')}{item.price_type === 'rental' ? '/ay' : ''}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {item.property_name || 'Genel'} • {item.source || '-'} • {new Date(item.noted_date).toLocaleDateString('tr-TR')}
                    </div>
                    {item.current_rent && item.price_type === 'rental' && (
                      <div className="flex items-center gap-1 mt-1 text-xs">
                        <span className="text-gray-500">Mevcut kira: ₺{Number(item.current_rent).toLocaleString('tr-TR')}</span>
                        {diff !== null && (
                          <span className={`flex items-center gap-0.5 font-semibold ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {diff > 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                            {Math.abs(diff).toFixed(1)}% {diff > 0 ? 'piyasa üstü' : 'piyasa altı'}
                          </span>
                        )}
                      </div>
                    )}
                    {item.notes && <div className="text-xs text-gray-400 mt-0.5">{item.notes}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="p-1 text-blue-400 hover:text-blue-600">
                        <ExternalLink size={14} />
                      </a>
                    )}
                    <button onClick={() => deleteMutation.mutate(item.id)} className="p-1 text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {!data?.length && <div className="text-center py-8 text-gray-400">Fiyat kaydı bulunamadı</div>}
        </div>
      )}
    </div>
  );
}
