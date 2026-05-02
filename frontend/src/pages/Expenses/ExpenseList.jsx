import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import api from '../../api/client';

const categories = [
  ['maintenance', 'Bakım/Onarım'],
  ['tax', 'Emlak Vergisi'],
  ['insurance', 'Sigorta'],
  ['dask', 'DASK'],
  ['utility', 'Fatura'],
  ['management_fee', 'Yönetim Ücreti'],
  ['renovation', 'Tadilat'],
  ['other', 'Diğer']
];

export default function ExpenseList() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  const { data: properties } = useQuery({
    queryKey: ['properties-select'],
    queryFn: () => api.get('/properties', { params: { limit: 200 } }).then((r) => r.data)
  });

  const { data, isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api.get('/expenses', { params: { limit: 50 } }).then((r) => r.data)
  });

  const addMutation = useMutation({
    mutationFn: (d) => api.post('/expenses', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); setShowForm(false); reset(); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/expenses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] })
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Giderler</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary py-2 px-3 text-sm">
          <Plus size={16} /> {showForm ? 'İptal' : 'Ekle'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit((d) => addMutation.mutate(d))} className="card space-y-3">
          <div>
            <label className="label">Mülk</label>
            <select className="input" {...register('property_id')}>
              <option value="">Genel</option>
              {properties?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Kategori *</label>
              <select className="input" {...register('category', { required: true })}>
                {categories.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tarih *</label>
              <input className="input" type="date" {...register('date', { required: true })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tutar (₺) *</label>
              <input className="input" type="number" step="0.01" {...register('amount', { required: true })} />
            </div>
            <div>
              <label className="label">Tedarikçi</label>
              <input className="input" {...register('vendor')} />
            </div>
          </div>
          <div>
            <label className="label">Açıklama</label>
            <input className="input" {...register('description')} />
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
          {data?.map((e) => (
            <div key={e.id} className="card flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{e.description || categories.find(c => c[0] === e.category)?.[1]}</div>
                <div className="text-xs text-gray-500">{e.property_name || 'Genel'} • {new Date(e.date).toLocaleDateString('tr-TR')}</div>
                {e.vendor && <div className="text-xs text-gray-400">{e.vendor}</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold text-sm">₺{Number(e.amount).toLocaleString('tr-TR')}</span>
                <button
                  onClick={() => deleteMutation.mutate(e.id)}
                  className="text-red-400 hover:text-red-600 p-1"
                  aria-label="Sil"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {!data?.length && <div className="text-center py-8 text-gray-400">Gider bulunamadı</div>}
        </div>
      )}
    </div>
  );
}
