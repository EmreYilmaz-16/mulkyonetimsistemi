import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import api from '../../api/client';

const priorityColor = { low: 'bg-gray-100 text-gray-500', normal: 'bg-blue-100 text-blue-600', high: 'bg-orange-100 text-orange-600', urgent: 'bg-red-100 text-red-700' };
const statusColor = { open: 'bg-yellow-100 text-yellow-700', in_progress: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-400' };
const priorityLabel = { low: 'Düşük', normal: 'Normal', high: 'Yüksek', urgent: 'Acil' };
const statusLabel = { open: 'Açık', in_progress: 'İşlemde', completed: 'Tamamlandı', cancelled: 'İptal' };

export default function MaintenanceList() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const { data: properties } = useQuery({
    queryKey: ['properties-select'],
    queryFn: () => api.get('/properties', { params: { limit: 200 } }).then((r) => r.data)
  });

  const { data, isLoading } = useQuery({
    queryKey: ['maintenance', statusFilter],
    queryFn: () => api.get('/maintenance', { params: { status: statusFilter || undefined, limit: 50 } }).then((r) => r.data)
  });

  const { register, handleSubmit, reset } = useForm({ defaultValues: { priority: 'normal' } });

  const addMutation = useMutation({
    mutationFn: (d) => api.post('/maintenance', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['maintenance'] }); setShowForm(false); reset(); }
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => api.put(`/maintenance/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance'] })
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Bakım & Arıza</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary py-2 px-3 text-sm">
          <Plus size={16} /> {showForm ? 'İptal' : 'Talep'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit((d) => addMutation.mutate(d))} className="card space-y-3">
          <div>
            <label className="label">Mülk *</label>
            <select className="input" {...register('property_id', { required: true })}>
              <option value="">Seçin...</option>
              {properties?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Başlık *</label>
            <input className="input" {...register('title', { required: true })} placeholder="Örn: Musluk arızası" />
          </div>
          <div>
            <label className="label">Öncelik</label>
            <select className="input" {...register('priority')}>
              <option value="low">Düşük</option>
              <option value="normal">Normal</option>
              <option value="high">Yüksek</option>
              <option value="urgent">Acil</option>
            </select>
          </div>
          <div>
            <label className="label">Açıklama</label>
            <textarea className="input" rows={2} {...register('description')} />
          </div>
          <button type="submit" disabled={addMutation.isPending} className="btn-primary w-full">
            {addMutation.isPending ? 'Kaydediliyor...' : 'Talep Oluştur'}
          </button>
        </form>
      )}

      <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
        <option value="">Tüm Durumlar</option>
        <option value="open">Açık</option>
        <option value="in_progress">İşlemde</option>
        <option value="completed">Tamamlandı</option>
      </select>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Yükleniyor...</div>
      ) : (
        <div className="space-y-2">
          {data?.map((m) => (
            <div key={m.id} className="card space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{m.title}</div>
                  <div className="text-xs text-gray-500">{m.property_name}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <span className={`badge ${priorityColor[m.priority]}`}>{priorityLabel[m.priority]}</span>
                  <span className={`badge ${statusColor[m.status]}`}>{statusLabel[m.status]}</span>
                </div>
              </div>
              {m.status === 'open' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => updateStatus.mutate({ id: m.id, status: 'in_progress' })}
                    className="text-xs btn-secondary py-1 px-2"
                  >İşleme Al</button>
                  <button
                    onClick={() => updateStatus.mutate({ id: m.id, status: 'completed' })}
                    className="text-xs btn-primary py-1 px-2"
                  >Tamamla</button>
                </div>
              )}
              {m.status === 'in_progress' && (
                <button
                  onClick={() => updateStatus.mutate({ id: m.id, status: 'completed' })}
                  className="text-xs btn-primary py-1 px-2"
                >Tamamla</button>
              )}
            </div>
          ))}
          {!data?.length && <div className="text-center py-8 text-gray-400">Talep bulunamadı</div>}
        </div>
      )}
    </div>
  );
}
