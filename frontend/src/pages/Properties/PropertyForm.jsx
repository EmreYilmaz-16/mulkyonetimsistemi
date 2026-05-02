import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { ArrowLeft } from 'lucide-react';
import DocumentPanel from '../../components/DocumentPanel';

export default function PropertyForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const qc = useQueryClient();
  const isEdit = Boolean(id);

  const [selectedCityId, setSelectedCityId] = useState('');
  const [selectedDistrictId, setSelectedDistrictId] = useState('');

  const { data: property, isLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: () => api.get(`/properties/${id}`).then((r) => r.data),
    enabled: isEdit
  });

  const { data: cities = [] } = useQuery({
    queryKey: ['cities'],
    queryFn: () => api.get('/locations/cities').then((r) => r.data)
  });

  const { data: districts = [] } = useQuery({
    queryKey: ['districts', selectedCityId],
    queryFn: () => api.get(`/locations/districts?city_id=${selectedCityId}`).then((r) => r.data),
    enabled: Boolean(selectedCityId)
  });

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();

  useEffect(() => {
    if (property) {
      reset(property);
      if (property.city_id) setSelectedCityId(String(property.city_id));
      if (property.district_id) setSelectedDistrictId(String(property.district_id));
    }
  }, [property, reset]);

  // districts yüklenince kayıtlı district_id'yi uygula
  useEffect(() => {
    if (districts.length > 0 && selectedDistrictId) {
      setValue('district_id', selectedDistrictId);
    }
  }, [districts, selectedDistrictId, setValue]);

  const handleCityChange = (e) => {
    const val = e.target.value;
    setSelectedCityId(val);
    setSelectedDistrictId('');
    setValue('city_id', val || null);
    setValue('district_id', '');
  };

  const handleDistrictChange = (e) => {
    const val = e.target.value;
    setSelectedDistrictId(val);
    setValue('district_id', val || null);
  };

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit ? api.put(`/properties/${id}`, data) : api.post('/properties', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['properties'] });
      navigate('/properties');
    }
  });

  if (isEdit && isLoading) return <div className="py-8 text-center text-gray-400">Yükleniyor...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary py-2 px-3">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-xl font-bold">{isEdit ? 'Mülk Düzenle' : 'Yeni Mülk'}</h1>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
        <div>
          <label className="label">Mülk Adı *</label>
          <input className="input" {...register('name', { required: true })} placeholder="Örn: Daire No:3" />
          {errors.name && <span className="text-red-500 text-xs">Zorunlu alan</span>}
        </div>

        <div>
          <label className="label">Site</label>
          <input className="input" {...register('site_name')} placeholder="Örn: Gülpark Sitesi" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Tür *</label>
            <select className="input" {...register('type', { required: true })}>
              <option value="residential">Konut</option>
              <option value="commercial">Ticari</option>
              <option value="parking">Otopark</option>
              <option value="other">Diğer</option>
            </select>
          </div>
          <div>
            <label className="label">Durum</label>
            <select className="input" {...register('status')}>
              <option value="available">Boş</option>
              <option value="rented">Kiralık</option>
              <option value="maintenance">Tadilatta</option>
              <option value="for_sale">Satılık</option>
            </select>
          </div>
        </div>

        {/* Location: City / District / Neighborhood */}
        <div>
          <label className="label">İl</label>
          <select
            className="input"
            value={selectedCityId}
            onChange={handleCityChange}
          >
            <option value="">— Seçiniz —</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>{c.plate_code} - {c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">İlçe</label>
          <select
            className="input"
            value={selectedDistrictId}
            onChange={handleDistrictChange}
            disabled={!selectedCityId}
          >
            <option value="">— Seçiniz —</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Mahalle</label>
          <input className="input" {...register('neighborhood')} placeholder="Mahalle adı" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Kat</label>
            <input className="input" type="number" {...register('floor')} />
          </div>
          <div>
            <label className="label">Daire No</label>
            <input className="input" {...register('unit_number')} />
          </div>
        </div>

        <div>
          <label className="label">Alan (m²)</label>
          <input className="input" type="number" step="0.01" {...register('area_sqm')} />
        </div>

        <div>
          <label className="label">Tapu Bilgisi</label>
          <textarea className="input" rows={2} {...register('deed_info')} />
        </div>

        <div>
          <label className="label">Açıklama</label>
          <textarea className="input" rows={2} {...register('description')} />
        </div>

        <DocumentPanel
          entityType="property"
          entityId={id}
          title="Mülk Belgeleri"
        />

        {mutation.error && (
          <div className="text-red-600 text-sm">{mutation.error.message}</div>
        )}

        <button type="submit" disabled={mutation.isPending} className="btn-primary w-full py-3">
          {mutation.isPending ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Ekle'}
        </button>
      </form>
    </div>
  );
}
