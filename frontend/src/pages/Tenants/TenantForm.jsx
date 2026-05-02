import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { ArrowLeft, FileText } from 'lucide-react';
import DocumentPanel from '../../components/DocumentPanel';

export default function TenantForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const qc = useQueryClient();
  const isEdit = Boolean(id);

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => api.get(`/tenants/${id}`).then((r) => r.data),
    enabled: isEdit
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const activeContracts = (tenant?.contracts || []).filter((contract) => contract.status === 'active');

  useEffect(() => {
    if (tenant) reset(tenant);
  }, [tenant, reset]);

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit ? api.put(`/tenants/${id}`, data) : api.post('/tenants', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      navigate('/tenants');
    }
  });

  if (isEdit && isLoading) return <div className="py-8 text-center text-gray-400">Yükleniyor...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary py-2 px-3">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-xl font-bold">{isEdit ? 'Kiracı Düzenle' : 'Yeni Kiracı'}</h1>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Ad *</label>
            <input className="input" {...register('first_name', { required: true })} />
            {errors.first_name && <span className="text-red-500 text-xs">Zorunlu</span>}
          </div>
          <div>
            <label className="label">Soyad *</label>
            <input className="input" {...register('last_name', { required: true })} />
            {errors.last_name && <span className="text-red-500 text-xs">Zorunlu</span>}
          </div>
        </div>

        <div>
          <label className="label">Telefon *</label>
          <input className="input" type="tel" {...register('phone', { required: true })} placeholder="05XX XXX XXXX" />
          {errors.phone && <span className="text-red-500 text-xs">Zorunlu</span>}
        </div>

        <div>
          <label className="label">E-posta</label>
          <input className="input" type="email" {...register('email')} />
        </div>

        <div>
          <label className="label">TC Kimlik No</label>
          <input className="input" {...register('tc_no')} maxLength={11} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Acil İletişim Adı</label>
            <input className="input" {...register('emergency_contact')} />
          </div>
          <div>
            <label className="label">Acil Telefon</label>
            <input className="input" type="tel" {...register('emergency_phone')} />
          </div>
        </div>

        <div>
          <label className="label">Findeks Puanı</label>
          <input className="input" type="number" {...register('findeks_score')} min={0} max={1900} />
        </div>

        <div>
          <label className="label">Notlar</label>
          <textarea className="input" rows={3} {...register('notes')} />
        </div>

        {isEdit && (
          <div className="card space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-gray-800 font-semibold">
                <FileText size={16} />
                <span>Aktif Sözleşmeler</span>
              </div>
              <button
                type="button"
                className="btn-secondary py-2 px-3 text-sm"
                onClick={() => navigate(`/contracts?tenant_id=${id}&status=active`)}
              >
                Tümünü Gör
              </button>
            </div>

            {!activeContracts.length ? (
              <div className="text-sm text-gray-500">Bu kiracıya ait aktif sözleşme bulunmuyor.</div>
            ) : (
              <div className="space-y-2">
                {activeContracts.map((contract) => (
                  <button
                    key={contract.id}
                    type="button"
                    onClick={() => navigate(`/contracts/edit/${contract.id}`)}
                    className="w-full rounded-xl border border-gray-100 px-3 py-3 text-left hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-800">{contract.property_name}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(contract.start_date).toLocaleDateString('tr-TR')} - {new Date(contract.end_date).toLocaleDateString('tr-TR')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="badge bg-green-100 text-green-700">Aktif</div>
                        <div className="text-xs font-semibold text-gray-700 mt-1">
                          ₺{Number(contract.monthly_rent).toLocaleString('tr-TR')}/ay
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <DocumentPanel
          entityType="tenant"
          entityId={id}
          title="Kiracı Belgeleri"
        />

        {mutation.error && <div className="text-red-600 text-sm">{mutation.error.message}</div>}

        <button type="submit" disabled={mutation.isPending} className="btn-primary w-full py-3">
          {mutation.isPending ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Ekle'}
        </button>
      </form>
    </div>
  );
}
