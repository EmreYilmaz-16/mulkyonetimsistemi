import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Trash2, Scale, Phone, Mail, ChevronDown, ChevronUp } from 'lucide-react';
import { useForm } from 'react-hook-form';
import api from '../../api/client';

const caseTypeLabel = {
  tahliye: 'Tahliye', icra: 'İcra', kira_tespit: 'Kira Tespit',
  hasar: 'Hasar/Tazminat', diger: 'Diğer'
};
const caseStatusLabel = {
  devam_ediyor: 'Devam Ediyor', kazanildi: 'Kazanıldı',
  kaybedildi: 'Kaybedildi', sulh: 'Sulh', bekleniyor: 'Bekliyor'
};
const caseStatusColor = {
  devam_ediyor: 'bg-blue-100 text-blue-700',
  kazanildi: 'bg-green-100 text-green-700',
  kaybedildi: 'bg-red-100 text-red-700',
  sulh: 'bg-yellow-100 text-yellow-700',
  bekleniyor: 'bg-gray-100 text-gray-600'
};

function LawyerForm({ onSuccess, onCancel }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (d) => api.post('/legal/lawyers', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lawyers'] }); reset(); onSuccess?.(); }
  });
  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="card space-y-3">
      <h2 className="font-semibold">Yeni Avukat</h2>
      <div>
        <label className="label">Ad Soyad *</label>
        <input className="input" {...register('name', { required: true })} />
        {errors.name && <span className="text-red-500 text-xs">Zorunlu alan</span>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Telefon</label>
          <input className="input" type="tel" {...register('phone')} />
        </div>
        <div>
          <label className="label">E-posta</label>
          <input className="input" type="email" {...register('email')} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Uzmanlık</label>
          <select className="input" {...register('specialty')}>
            <option value="">Seçin</option>
            <option value="gayrimenkul">Gayrimenkul</option>
            <option value="icra">İcra Hukuku</option>
            <option value="genel">Genel</option>
            <option value="diger">Diğer</option>
          </select>
        </div>
        <div>
          <label className="label">Baro Sicil No</label>
          <input className="input" {...register('bar_no')} />
        </div>
      </div>
      <div>
        <label className="label">Hukuk Bürosu</label>
        <input className="input" {...register('firm')} />
      </div>
      <div>
        <label className="label">Saatlik Ücret (₺)</label>
        <input className="input" type="number" step="0.01" {...register('hourly_rate')} />
      </div>
      <div>
        <label className="label">Notlar</label>
        <textarea className="input" rows={2} {...register('notes')} />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">
          {mutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">İptal</button>
      </div>
    </form>
  );
}

function CaseForm({ lawyers, properties, tenants, onSuccess, onCancel }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (d) => api.post('/legal/cases', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['legal-cases'] }); reset(); onSuccess?.(); }
  });
  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="card space-y-3">
      <h2 className="font-semibold">Yeni Dava / Takip</h2>
      <div>
        <label className="label">Başlık *</label>
        <input className="input" {...register('title', { required: true })} />
        {errors.title && <span className="text-red-500 text-xs">Zorunlu alan</span>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Dava Türü *</label>
          <select className="input" {...register('case_type', { required: true })}>
            {Object.entries(caseTypeLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Durum</label>
          <select className="input" {...register('status')}>
            {Object.entries(caseStatusLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Avukat</label>
        <select className="input" {...register('lawyer_id')}>
          <option value="">Seçin</option>
          {lawyers?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Mülk</label>
          <select className="input" {...register('property_id')}>
            <option value="">Seçin</option>
            {properties?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Kiracı</label>
          <select className="input" {...register('tenant_id')}>
            <option value="">Seçin</option>
            {tenants?.map((t) => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Mahkeme</label>
          <input className="input" {...register('court')} />
        </div>
        <div>
          <label className="label">Esas No</label>
          <input className="input" {...register('case_no')} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Dava Tarihi</label>
          <input className="input" type="date" {...register('filing_date')} />
        </div>
        <div>
          <label className="label">Sonraki Duruşma</label>
          <input className="input" type="date" {...register('next_hearing')} />
        </div>
      </div>
      <div>
        <label className="label">Avukatlık Ücreti (₺)</label>
        <input className="input" type="number" step="0.01" {...register('fee')} />
      </div>
      <div>
        <label className="label">Açıklama</label>
        <textarea className="input" rows={2} {...register('description')} />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">
          {mutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">İptal</button>
      </div>
    </form>
  );
}

export default function LawyerList() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('cases'); // 'cases' | 'lawyers'
  const [showLawyerForm, setShowLawyerForm] = useState(false);
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [expandedCase, setExpandedCase] = useState(null);

  const { data: lawyers } = useQuery({
    queryKey: ['lawyers'],
    queryFn: () => api.get('/legal/lawyers').then((r) => r.data)
  });
  const { data: cases, isLoading: casesLoading } = useQuery({
    queryKey: ['legal-cases'],
    queryFn: () => api.get('/legal/cases').then((r) => r.data)
  });
  const { data: properties } = useQuery({
    queryKey: ['properties-select'],
    queryFn: () => api.get('/properties', { params: { limit: 200 } }).then((r) => r.data)
  });
  const { data: tenants } = useQuery({
    queryKey: ['tenants-select'],
    queryFn: () => api.get('/tenants', { params: { limit: 200 } }).then((r) => r.data)
  });

  const deleteLawyer = useMutation({
    mutationFn: (id) => api.delete(`/legal/lawyers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lawyers'] })
  });
  const deleteCase = useMutation({
    mutationFn: (id) => api.delete(`/legal/cases/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['legal-cases'] })
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Avukat Takip</h1>
        <button
          onClick={() => tab === 'cases' ? setShowCaseForm(!showCaseForm) : setShowLawyerForm(!showLawyerForm)}
          className="btn-primary py-2 px-3 text-sm"
        >
          <Plus size={16} /> {tab === 'cases' ? 'Dava Ekle' : 'Avukat Ekle'}
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200">
        {[['cases', 'Davalar'], ['lawyers', 'Avukatlar']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setTab(key); setShowCaseForm(false); setShowLawyerForm(false); }}
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Forms */}
      {tab === 'cases' && showCaseForm && (
        <CaseForm
          lawyers={lawyers} properties={properties} tenants={tenants}
          onSuccess={() => setShowCaseForm(false)} onCancel={() => setShowCaseForm(false)}
        />
      )}
      {tab === 'lawyers' && showLawyerForm && (
        <LawyerForm onSuccess={() => setShowLawyerForm(false)} onCancel={() => setShowLawyerForm(false)} />
      )}

      {/* Cases list */}
      {tab === 'cases' && (
        casesLoading ? <div className="text-center py-8 text-gray-400">Yükleniyor...</div> : (
          <div className="space-y-2">
            {cases?.map((c) => (
              <div key={c.id} className="card space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{c.title}</div>
                    <div className="text-xs text-gray-500">{c.property_name || '-'} • {c.lawyer_name || 'Avukat atanmadı'}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`badge text-xs ${caseStatusColor[c.status]}`}>{caseStatusLabel[c.status]}</span>
                    <button onClick={() => setExpandedCase(expandedCase === c.id ? null : c.id)} className="p-1 text-gray-400">
                      {expandedCase === c.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button onClick={() => deleteCase.mutate(c.id)} className="p-1 text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {expandedCase === c.id && (
                  <div className="border-t border-gray-100 pt-2 space-y-1 text-xs text-gray-600">
                    <div><span className="font-medium">Tür:</span> {caseTypeLabel[c.case_type]}</div>
                    {c.court && <div><span className="font-medium">Mahkeme:</span> {c.court}</div>}
                    {c.case_no && <div><span className="font-medium">Esas No:</span> {c.case_no}</div>}
                    {c.filing_date && <div><span className="font-medium">Dava Tarihi:</span> {new Date(c.filing_date).toLocaleDateString('tr-TR')}</div>}
                    {c.next_hearing && <div><span className="font-medium">Sonraki Duruşma:</span> <span className="text-orange-600 font-semibold">{new Date(c.next_hearing).toLocaleDateString('tr-TR')}</span></div>}
                    {c.fee > 0 && <div><span className="font-medium">Avukatlık Ücreti:</span> ₺{Number(c.fee).toLocaleString('tr-TR')}</div>}
                    {c.description && <div><span className="font-medium">Açıklama:</span> {c.description}</div>}
                    {c.result && <div><span className="font-medium">Sonuç:</span> {c.result}</div>}
                  </div>
                )}
              </div>
            ))}
            {!cases?.length && <div className="text-center py-8 text-gray-400">Dava/takip bulunamadı</div>}
          </div>
        )
      )}

      {/* Lawyers list */}
      {tab === 'lawyers' && (
        <div className="space-y-2">
          {lawyers?.map((l) => (
            <div key={l.id} className="card flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Scale size={14} className="text-primary-600 shrink-0" />
                  <span className="font-semibold text-sm">{l.name}</span>
                  {l.specialty && <span className="badge bg-blue-50 text-blue-700 text-xs">{l.specialty}</span>}
                </div>
                {l.firm && <div className="text-xs text-gray-500 mt-0.5">{l.firm}</div>}
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  {l.phone && <span className="flex items-center gap-1"><Phone size={10}/>{l.phone}</span>}
                  {l.email && <span className="flex items-center gap-1"><Mail size={10}/>{l.email}</span>}
                </div>
                {l.hourly_rate && <div className="text-xs text-gray-500 mt-0.5">Saatlik: ₺{Number(l.hourly_rate).toLocaleString('tr-TR')}</div>}
              </div>
              <button onClick={() => deleteLawyer.mutate(l.id)} className="p-1 text-red-400 hover:text-red-600 shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {!lawyers?.length && <div className="text-center py-8 text-gray-400">Avukat bulunamadı</div>}
        </div>
      )}
    </div>
  );
}
