import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { ArrowLeft } from 'lucide-react';
import DocumentPanel from '../../components/DocumentPanel';

function toDateInput(val) {
  if (!val) return '';
  return val.slice(0, 10); // ISO string → YYYY-MM-DD
}

export default function ContractForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const qc = useQueryClient();
  const isEdit = Boolean(id);

  const { data: properties } = useQuery({
    queryKey: ['properties-select'],
    queryFn: () => api.get('/properties', { params: { status: 'available', limit: 200 } }).then((r) => r.data)
  });
  const { data: tenants } = useQuery({
    queryKey: ['tenants-select'],
    queryFn: () => api.get('/tenants', { params: { is_active: 'true', limit: 200 } }).then((r) => r.data)
  });

  const { data: contract, isLoading: contractLoading } = useQuery({
    queryKey: ['contract', id],
    queryFn: () => api.get(`/contracts/${id}`).then((r) => r.data),
    enabled: isEdit
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { increase_type: 'tüfe', deposit_amount: 0, payment_day: 1 }
  });

  useEffect(() => {
    if (contract) {
      reset({
        property_id:   contract.property_id,
        tenant_id:     contract.tenant_id,
        start_date:    toDateInput(contract.start_date),
        end_date:      toDateInput(contract.end_date),
        monthly_rent:  contract.monthly_rent,
        deposit_amount: contract.deposit_amount,
        increase_type: contract.increase_type || 'tüfe',
        increase_rate: contract.increase_rate || '',
        eviction_date: toDateInput(contract.eviction_date),
        special_terms: contract.special_terms || '',
        payment_day:   contract.payment_day || 1,
      });
    }
  }, [contract, reset]);

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit ? api.put(`/contracts/${id}`, data) : api.post('/contracts', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] });
      qc.invalidateQueries({ queryKey: ['properties'] });
      navigate('/contracts');
    }
  });

  if (isEdit && contractLoading) return <div className="py-8 text-center text-gray-400">Yükleniyor...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary py-2 px-3">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-xl font-bold">{isEdit ? 'Sözleşme Düzenle' : 'Yeni Sözleşme'}</h1>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
        <div>
          <label className="label">Mülk {isEdit ? '' : '*'}</label>
          {isEdit ? (
            <div className="input bg-gray-50 text-gray-600">{contract?.property_name}</div>
          ) : (
            <>
              <select className="input" {...register('property_id', { required: true })}>
                <option value="">Seçin...</option>
                {properties?.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} {p.unit_number ? `(${p.unit_number})` : ''}</option>
                ))}
              </select>
              {errors.property_id && <span className="text-red-500 text-xs">Zorunlu</span>}
            </>
          )}
        </div>

        <div>
          <label className="label">Kiracı {isEdit ? '' : '*'}</label>
          {isEdit ? (
            <div className="input bg-gray-50 text-gray-600">{contract?.tenant_name}</div>
          ) : (
            <>
              <select className="input" {...register('tenant_id', { required: true })}>
                <option value="">Seçin...</option>
                {tenants?.map((t) => (
                  <option key={t.id} value={t.id}>{t.first_name} {t.last_name} — {t.phone}</option>
                ))}
              </select>
              {errors.tenant_id && <span className="text-red-500 text-xs">Zorunlu</span>}
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Başlangıç *</label>
            <input className="input" type="date" {...register('start_date', { required: true })} />
          </div>
          <div>
            <label className="label">Bitiş *</label>
            <input className="input" type="date" {...register('end_date', { required: true })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Aylık Kira (₺) *</label>
            <input className="input" type="number" step="0.01" {...register('monthly_rent', { required: true, min: 1 })} />
            {errors.monthly_rent && <span className="text-red-500 text-xs">Zorunlu</span>}
          </div>
          <div>
            <label className="label">Depozito (₺)</label>
            <input className="input" type="number" step="0.01" {...register('deposit_amount')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Artış Türü</label>
            <select className="input" {...register('increase_type')}>
              <option value="tüfe">TÜFE</option>
              <option value="sabit">Sabit Oran</option>
              <option value="anlaşma">Anlaşma</option>
            </select>
          </div>
          <div>
            <label className="label">Artış Oranı (%)</label>
            <input className="input" type="number" step="0.01" {...register('increase_rate')} />
          </div>
        </div>

        <div>
          <label className="label">Kira Ödeme Günü *</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Her ayın</span>
            <input
              className="input w-20 text-center"
              type="number"
              min="1" max="28"
              {...register('payment_day', { required: true, min: 1, max: 28, valueAsNumber: true })}
            />
            <span className="text-sm text-gray-500">'inde</span>
          </div>
          {errors.payment_day && <span className="text-red-500 text-xs">1-28 arası bir gün girin</span>}
        </div>

        <div>
          <label className="label">Tahliye Taahhütnamesi Tarihi</label>
          <input className="input" type="date" {...register('eviction_date')} />
        </div>

        <div>
          <label className="label">Özel Koşullar</label>
          <textarea className="input" rows={3} {...register('special_terms')} />
        </div>

        <DocumentPanel
          entityType="contract"
          entityId={id}
          title="Sözleşme Belgeleri"
        />

        {mutation.error && <div className="text-red-600 text-sm">{mutation.error.message}</div>}

        <button type="submit" disabled={mutation.isPending} className="btn-primary w-full py-3">
          {mutation.isPending ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Sözleşme Oluştur'}
        </button>
      </form>
    </div>
  );
}
