import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Shield, Users, Home, Pencil, Power, Trash2, CalendarClock, Activity, BarChart3, TrendingUp, Search, ArrowUpDown, ListFilter, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import { useAuthStore } from '../../store/authStore';

const planOptions = [
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' }
];

const planPresets = {
  starter: { max_users: 3, max_properties: 25, trial_days: 14, description: 'Küçük portföyler için başlangıç paketi' },
  pro: { max_users: 10, max_properties: 150, trial_days: 30, description: 'Büyüyen ekipler için dengeli paket' },
  enterprise: { max_users: 50, max_properties: 1000, trial_days: 0, description: 'Çoklu ekip ve yüksek hacim için' }
};

const packagePrices = {
  starter: 1499,
  pro: 3999,
  enterprise: 9999
};

const toDateTimeLocal = (date) => {
  const current = new Date(date);
  const shifted = new Date(current.getTime() - current.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
};

const buildTrialDate = (days) => {
  if (!days) {
    return '';
  }

  const next = new Date();
  next.setDate(next.getDate() + days);
  return toDateTimeLocal(next);
};

const formatMonthLabel = (monthStart) => new Date(monthStart).toLocaleDateString('tr-TR', {
  month: 'short',
  year: 'numeric'
});

const formatCurrency = (value) => `₺${Number(value || 0).toLocaleString('tr-TR')}`;

const getPackagePrice = (plan) => packagePrices[plan] || 0;

const getInvoiceStatusMeta = (status) => {
  if (status === 'paid') {
    return { label: 'Ödendi', className: 'bg-emerald-100 text-emerald-700' };
  }

  if (status === 'overdue') {
    return { label: 'Gecikmiş', className: 'bg-rose-100 text-rose-700' };
  }

  return { label: 'Ödenmedi', className: 'bg-amber-100 text-amber-700' };
};

const chartSeriesConfig = [
  { key: 'users_added', label: 'Kullanıcı', color: 'bg-sky-500' },
  { key: 'properties_added', label: 'Mülk', color: 'bg-emerald-500' },
  { key: 'contracts_started', label: 'Sözleşme', color: 'bg-amber-500' }
];

const auditEventOptions = [
  { value: '', label: 'Tüm Eventler' },
  { value: 'organization_bootstrapped', label: 'Organizasyon Başlatıldı' },
  { value: 'organization_created', label: 'Organizasyon Oluşturuldu' },
  { value: 'organization_updated', label: 'Organizasyon Güncellendi' },
  { value: 'organization_plan_change_requested', label: 'Paket Değişikliği Talebi' },
  { value: 'invoice_created', label: 'Fatura Oluşturuldu' },
  { value: 'invoice_status_updated', label: 'Fatura Durumu Güncellendi' },
  { value: 'organization_activated', label: 'Organizasyon Aktifleştirildi' },
  { value: 'organization_deactivated', label: 'Organizasyon Pasife Alındı' },
  { value: 'user_created', label: 'Kullanıcı Oluşturuldu' },
  { value: 'property_created', label: 'Mülk Oluşturuldu' },
  { value: 'tenant_created', label: 'Kiracı Oluşturuldu' },
  { value: 'contract_created', label: 'Sözleşme Oluşturuldu' },
  { value: 'payment_recorded', label: 'Ödeme Kaydedildi' },
  { value: 'expense_created', label: 'Gider Oluşturuldu' },
  { value: 'document_uploaded', label: 'Belge Yüklendi' }
];

const auditEntityOptions = [
  { value: '', label: 'Tüm Varlıklar' },
  { value: 'organization', label: 'Organizasyon' },
  { value: 'invoice', label: 'Fatura' },
  { value: 'user', label: 'Kullanıcı' },
  { value: 'property', label: 'Mülk' },
  { value: 'tenant', label: 'Kiracı' },
  { value: 'contract', label: 'Sözleşme' },
  { value: 'payment', label: 'Ödeme' },
  { value: 'expense', label: 'Gider' },
  { value: 'document', label: 'Belge' }
];

const graphRangeOptions = [
  { value: 3, label: 'Son 3 Ay' },
  { value: 6, label: 'Son 6 Ay' }
];

const planRequestStatusOptions = [
  { value: 'all', label: 'Tüm Durumlar' },
  { value: 'pending', label: 'Bekleyen' },
  { value: 'approved', label: 'Onaylanan' },
  { value: 'rejected', label: 'Reddedilen' }
];

const planRequestSortOptions = [
  { value: 'newest', label: 'En Yeni' },
  { value: 'oldest', label: 'En Eski' },
  { value: 'organization', label: 'Organizasyona Göre' },
  { value: 'status', label: 'Duruma Göre' }
];

const formatDateTime = (value) => value ? new Date(value).toLocaleString('tr-TR') : '-';

const createAuditFilterState = () => ({
  event_type: '',
  entity_type: '',
  from_date: '',
  to_date: ''
});

const auditPresets = [
  { key: 'all', label: 'Tümü', filters: createAuditFilterState() },
  { key: 'properties', label: 'Mülk Akışı', filters: { event_type: 'property_created', entity_type: 'property', from_date: '', to_date: '' } },
  { key: 'contracts', label: 'Sözleşmeler', filters: { event_type: 'contract_created', entity_type: 'contract', from_date: '', to_date: '' } },
  { key: 'payments', label: 'Tahsilat', filters: { event_type: 'payment_recorded', entity_type: 'payment', from_date: '', to_date: '' } },
  { key: 'users', label: 'Kullanıcılar', filters: { event_type: 'user_created', entity_type: 'user', from_date: '', to_date: '' } }
];

const auditPresetMap = Object.fromEntries(auditPresets.map((preset) => [preset.key, preset]));

const readAuditFilterState = (searchParams) => ({
  ...(auditPresetMap[searchParams.get('ap')]?.filters || {}),
  event_type: searchParams.get('auditEvent') || '',
  entity_type: searchParams.get('auditEntity') || '',
  from_date: searchParams.get('auditFrom') || '',
  to_date: searchParams.get('auditTo') || ''
});

const isSameAuditFilterState = (left, right) => left.event_type === right.event_type
  && left.entity_type === right.entity_type
  && left.from_date === right.from_date
  && left.to_date === right.to_date;

const formatActorLabel = (entry) => {
  if (entry.actor_name && entry.actor_email) {
    return `${entry.actor_name} • ${entry.actor_email}`;
  }

  if (entry.actor_name) {
    return entry.actor_name;
  }

  if (entry.actor_email) {
    return entry.actor_email;
  }

  return entry.origin_label || 'Sistem';
};

function UsageHistoryChart({ data }) {
  const maxValue = Math.max(1, ...data.flatMap((entry) => chartSeriesConfig.map((series) => Number(entry[series.key] || 0))));

  return (
    <div className="rounded-2xl bg-gray-50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
        <TrendingUp size={16} className="text-primary-600" /> Büyüme Grafiği
      </div>
      <div className="mt-3 flex items-end gap-3 overflow-x-auto pb-2">
        {data.slice().reverse().map((entry) => (
          <div key={entry.month_start} className="min-w-[86px] flex-1">
            <div className="flex h-44 items-end gap-1 rounded-xl border border-gray-200 bg-white px-2 py-3">
              {chartSeriesConfig.map((series) => {
                const value = Number(entry[series.key] || 0);
                const height = `${Math.max((value / maxValue) * 100, value ? 10 : 2)}%`;
                return (
                  <div key={series.key} className="flex flex-1 flex-col items-center justify-end gap-2">
                    <div className="text-[10px] text-gray-500">{value}</div>
                    <div className={`w-full rounded-t-md ${series.color}`} style={{ height }} />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-center text-xs text-gray-500">{formatMonthLabel(entry.month_start)}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
        {chartSeriesConfig.map((series) => (
          <div key={series.key} className="flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${series.color}`} />
            {series.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlatformTrendChart({ data }) {
  const analytics = useMemo(() => {
    const normalized = data.map((entry) => ({
      ...entry,
      organizations_created: Number(entry.organizations_created || 0),
      plan_requests: Number(entry.plan_requests || 0),
      plan_approvals: Number(entry.plan_approvals || 0),
      deactivations: Number(entry.deactivations || 0),
      activations: Number(entry.activations || 0)
    }));

    const totals = normalized.reduce((accumulator, entry) => ({
      organizations_created: accumulator.organizations_created + entry.organizations_created,
      plan_requests: accumulator.plan_requests + entry.plan_requests,
      plan_approvals: accumulator.plan_approvals + entry.plan_approvals,
      deactivations: accumulator.deactivations + entry.deactivations,
      activations: accumulator.activations + entry.activations
    }), {
      organizations_created: 0,
      plan_requests: 0,
      plan_approvals: 0,
      deactivations: 0,
      activations: 0
    });

    const enriched = normalized.map((entry) => ({
      ...entry,
      net_flow: entry.activations - entry.deactivations,
      approval_rate: entry.plan_requests ? Math.round((entry.plan_approvals / entry.plan_requests) * 100) : 0
    }));

    const peakRequestMonth = enriched.reduce((best, entry) => (entry.plan_requests > best.plan_requests ? entry : best), enriched[0] || null);
    const strongestAcquisitionMonth = enriched.reduce((best, entry) => (entry.organizations_created > best.organizations_created ? entry : best), enriched[0] || null);
    const maxBarValue = Math.max(1, ...enriched.flatMap((entry) => [entry.organizations_created, entry.plan_requests, entry.plan_approvals]));

    return {
      rows: enriched,
      totals,
      peakRequestMonth,
      strongestAcquisitionMonth,
      maxBarValue,
      approvalRate: totals.plan_requests ? Math.round((totals.plan_approvals / totals.plan_requests) * 100) : 0,
      netActivation: totals.activations - totals.deactivations
    };
  }, [data]);

  return (
    <div className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <TrendingUp size={16} className="text-primary-600" /> Platform Trend Analizi
          </div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">Organizasyon büyümesi, talep baskısı ve karar hızı aynı panelde.</div>
          <div className="mt-1 text-sm leading-6 text-gray-500">Aşağıdaki tablo desktop kullanım için yoğunlaştırıldı; her ayı acquisition, request pressure ve approval conversion açısından birlikte gösterir.</div>
        </div>
        <div className="rounded-2xl bg-slate-900 px-4 py-3 text-right text-white">
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Net Hareket</div>
          <div className="mt-2 text-3xl font-bold">{analytics.netActivation >= 0 ? '+' : ''}{analytics.netActivation}</div>
          <div className="text-xs text-slate-300">Aktivasyon eksi pasife alınanlar</div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-4">
        <PlatformMetricCard label="Yeni Org" value={analytics.totals.organizations_created} tone="sky" detail="Seçili trend aralığı toplamı" />
        <PlatformMetricCard label="Paket Talebi" value={analytics.totals.plan_requests} tone="amber" detail={`${analytics.totals.plan_approvals} onay kaydı`} />
        <PlatformMetricCard label="Onay Oranı" value={`%${analytics.approvalRate}`} tone="emerald" detail="Talep -> onay dönüşümü" />
        <PlatformMetricCard label="Pasife Alınan" value={analytics.totals.deactivations} tone="rose" detail={`${analytics.totals.activations} aktivasyon`} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid grid-cols-[110px_1fr_84px] gap-3 border-b border-slate-200 px-2 pb-3 text-[11px] uppercase tracking-[0.2em] text-slate-500">
            <div>Ay</div>
            <div>Akış</div>
            <div className="text-right">Karar</div>
          </div>

          <div className="mt-3 space-y-3">
            {analytics.rows.map((entry) => (
              <div key={entry.month_start} className="grid grid-cols-[110px_1fr_84px] gap-3 rounded-2xl border border-white bg-white p-3 shadow-sm">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{formatMonthLabel(entry.month_start)}</div>
                  <div className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${entry.net_flow >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    Net {entry.net_flow >= 0 ? '+' : ''}{entry.net_flow}
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    { label: 'Yeni Org', value: entry.organizations_created, color: 'bg-sky-500' },
                    { label: 'Talep', value: entry.plan_requests, color: 'bg-amber-500' },
                    { label: 'Onay', value: entry.plan_approvals, color: 'bg-emerald-500' }
                  ].map((item) => (
                    <div key={item.label} className="grid grid-cols-[70px_1fr_32px] items-center gap-2 text-xs text-slate-600">
                      <div>{item.label}</div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.max((item.value / analytics.maxBarValue) * 100, item.value ? 8 : 2)}%` }} />
                      </div>
                      <div className="text-right font-semibold text-slate-900">{item.value}</div>
                    </div>
                  ))}
                </div>

                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Approval</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">%{entry.approval_rate}</div>
                  <div className="mt-2 text-xs text-slate-500">{entry.activations} akt. • {entry.deactivations} pasif</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 self-start">
          <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,_#0f172a_0%,_#111827_100%)] p-5 text-white shadow-sm">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Pressure Point</div>
            <div className="mt-3 text-lg font-semibold">{analytics.peakRequestMonth ? formatMonthLabel(analytics.peakRequestMonth.month_start) : '-'}</div>
            <div className="mt-2 text-sm text-slate-300">En yüksek paket talebi bu ayda oluştu.</div>
            <div className="mt-4 text-3xl font-bold text-amber-300">{analytics.peakRequestMonth?.plan_requests || 0}</div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Acquisition Peak</div>
            <div className="mt-3 text-lg font-semibold text-slate-900">{analytics.strongestAcquisitionMonth ? formatMonthLabel(analytics.strongestAcquisitionMonth.month_start) : '-'}</div>
            <div className="mt-2 text-sm text-slate-500">En güçlü organizasyon kazanımı.</div>
            <div className="mt-4 text-3xl font-bold text-sky-600">{analytics.strongestAcquisitionMonth?.organizations_created || 0}</div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <BarChart3 size={16} className="text-primary-600" /> Yorum
            </div>
            <div className="mt-3 text-sm leading-6 text-slate-600">
              {analytics.approvalRate >= 70
                ? 'Talep kuyruğu sağlıklı ilerliyor; karar dönüşüm oranı yüksek.'
                : analytics.totals.plan_requests === 0
                  ? 'Seçili aralıkta paket talebi oluşmamış.'
                  : 'Talep hacmi mevcut ama karar dönüşümü baskı altında; kuyruk filtresiyle bekleyenleri öne almak faydalı.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlatformMetricCard({ label, value, tone = 'slate', detail }) {
  const toneStyles = {
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
    sky: 'border-sky-200 bg-sky-50 text-sky-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900'
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneStyles[tone] || toneStyles.slate}`}>
      <div className="text-[11px] uppercase tracking-[0.24em] opacity-70">{label}</div>
      <div className="mt-3 text-3xl font-bold leading-none">{value}</div>
      {detail && <div className="mt-3 text-xs opacity-75">{detail}</div>}
    </div>
  );
}

const emptyForm = {
  name: '',
  slug: '',
  contact_email: '',
  contact_phone: '',
  subscription_plan: 'starter',
  max_users: 3,
  max_properties: 25,
  trial_ends_at: '',
  is_active: true,
  admin_name: '',
  admin_email: '',
  admin_password: '',
  admin_phone: ''
};

function OrganizationForm({ initialValues, onCancel, onSuccess }) {
  const qc = useQueryClient();
  const isEdit = Boolean(initialValues?.id);
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    defaultValues: initialValues || emptyForm
  });
  const selectedPlan = watch('subscription_plan');

  const mutation = useMutation({
    mutationFn: (payload) => isEdit
      ? api.put(`/organizations/${initialValues.id}`, payload)
      : api.post('/organizations', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations'] });
      reset(emptyForm);
      onSuccess?.();
    }
  });

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate({
        ...values,
        max_users: Number(values.max_users),
        max_properties: Number(values.max_properties),
        admin_password: values.admin_password || undefined
      }))}
      className="card space-y-3"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{isEdit ? 'Organizasyonu Düzenle' : 'Yeni Organizasyon'}</h2>
        <button type="button" onClick={onCancel} className="text-sm text-gray-500">Kapat</button>
      </div>

      <div>
        <label className="label">Organizasyon Adı *</label>
        <input className="input" {...register('name', { required: true })} />
        {errors.name && <span className="text-xs text-red-500">Zorunlu alan</span>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Kısa Ad / Slug</label>
          <input className="input" {...register('slug')} placeholder="ornek-firma" />
        </div>
        <div>
          <label className="label">Paket</label>
          <select
            className="input"
            {...register('subscription_plan', {
              onChange: (event) => {
                if (isEdit) {
                  return;
                }

                const preset = planPresets[event.target.value];
                setValue('max_users', preset.max_users);
                setValue('max_properties', preset.max_properties);
                if (!watch('trial_ends_at')) {
                  setValue('trial_ends_at', buildTrialDate(preset.trial_days));
                }
              }
            })}
          >
            {planOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">{planPresets[selectedPlan]?.description}</p>
        </div>
      </div>

      {!isEdit && (
        <div className="grid gap-2 sm:grid-cols-3">
          {planOptions.map((option) => {
            const preset = planPresets[option.value];
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setValue('subscription_plan', option.value);
                  setValue('max_users', preset.max_users);
                  setValue('max_properties', preset.max_properties);
                  setValue('trial_ends_at', buildTrialDate(preset.trial_days));
                }}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-left"
              >
                <div className="text-sm font-semibold text-gray-800">{option.label}</div>
                <div className="mt-1 text-xs text-gray-500">{preset.max_users} kullanıcı • {preset.max_properties} mülk</div>
                <div className="mt-1 text-xs text-gray-500">Deneme: {preset.trial_days ? `${preset.trial_days} gün` : 'Yok'}</div>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">İletişim E-postası</label>
          <input className="input" type="email" {...register('contact_email')} />
        </div>
        <div>
          <label className="label">İletişim Telefonu</label>
          <input className="input" {...register('contact_phone')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Maks. Kullanıcı</label>
          <input className="input" type="number" min="1" {...register('max_users', { required: true, min: 1 })} />
        </div>
        <div>
          <label className="label">Maks. Mülk</label>
          <input className="input" type="number" min="1" {...register('max_properties', { required: true, min: 1 })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Deneme Bitişi</label>
          <input className="input" type="datetime-local" {...register('trial_ends_at')} />
          {!isEdit && (
            <div className="mt-2 flex flex-wrap gap-2">
              {[14, 30, 60].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setValue('trial_ends_at', buildTrialDate(days))}
                  className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600"
                >
                  +{days} gün
                </button>
              ))}
              <button
                type="button"
                onClick={() => setValue('trial_ends_at', '')}
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600"
              >
                Deneme yok
              </button>
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mt-7">
          <input type="checkbox" {...register('is_active')} />
          Aktif organizasyon
        </label>
      </div>

      {!isEdit && (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">İlk Admin Kullanıcısı</h3>
            <p className="text-xs text-gray-500">Organizasyon oluşturulurken ilk admin hesabı da açılır.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Admin Adı *</label>
              <input className="input" {...register('admin_name', { required: !isEdit })} />
              {errors.admin_name && <span className="text-xs text-red-500">Zorunlu alan</span>}
            </div>
            <div>
              <label className="label">Admin Telefonu</label>
              <input className="input" {...register('admin_phone')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Admin E-postası *</label>
              <input className="input" type="email" {...register('admin_email', { required: !isEdit })} />
              {errors.admin_email && <span className="text-xs text-red-500">Zorunlu alan</span>}
            </div>
            <div>
              <label className="label">Admin Şifresi *</label>
              <input className="input" type="password" {...register('admin_password', { required: !isEdit, minLength: 8 })} />
              {errors.admin_password && <span className="text-xs text-red-500">En az 8 karakter gerekli</span>}
            </div>
          </div>
        </div>
      )}

      {mutation.error?.message && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {mutation.error.message}
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1 py-2">
          {mutation.isPending ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Oluştur'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 py-2">İptal</button>
      </div>
    </form>
  );
}

export default function OrganizationManagement() {
  const currentUser = useAuthStore((state) => state.user);
  const isPlatformAdmin = currentUser?.role === 'platform_admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const initialExpandedOrgId = searchParams.get('org') || null;
  const initialAuditPage = Math.max(Number(searchParams.get('auditPage') || 1), 1);
  const [editingOrg, setEditingOrg] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedOrgId, setExpandedOrgId] = useState(initialExpandedOrgId);
  const [graphRange, setGraphRange] = useState(6);
  const [visibleSeries, setVisibleSeries] = useState(() => chartSeriesConfig.map((series) => series.key));
  const [auditFilters, setAuditFilters] = useState(() => readAuditFilterState(searchParams));
  const [auditPage, setAuditPage] = useState(initialAuditPage);
  const [planRequestStatusFilter, setPlanRequestStatusFilter] = useState('all');
  const [planRequestSort, setPlanRequestSort] = useState('newest');
  const [planRequestSearch, setPlanRequestSearch] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.get('/organizations').then((response) => response.data)
  });
  const { data: planRequestsData } = useQuery({
    queryKey: ['organization-plan-requests'],
    enabled: isPlatformAdmin,
    queryFn: () => api.get('/organizations/plan-requests', { params: { limit: 8 } }).then((response) => response)
  });
  const { data: platformMetricsData } = useQuery({
    queryKey: ['platform-metrics'],
    enabled: isPlatformAdmin,
    queryFn: () => api.get('/organizations/platform-metrics', { params: { months: 6 } }).then((response) => response)
  });
  const qc = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: ({ id, is_active }) => api.patch(`/organizations/${id}/status`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/organizations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] })
  });
  const planRequestDecisionMutation = useMutation({
    mutationFn: ({ requestId, action, note }) => api.patch(`/organizations/plan-requests/${requestId}`, { action, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations'] });
      qc.invalidateQueries({ queryKey: ['organization-plan-requests'] });
      qc.invalidateQueries({ queryKey: ['platform-metrics'] });
    }
  });

  const { data: activityData, isFetching: isActivityLoading } = useQuery({
    queryKey: ['organization-activity', expandedOrgId],
    enabled: Boolean(expandedOrgId),
    queryFn: () => api.get(`/organizations/${expandedOrgId}/activity`).then((response) => response.data)
  });

  const { data: auditData, isFetching: isAuditLoading } = useQuery({
    queryKey: ['organization-audit', expandedOrgId, auditFilters, auditPage],
    enabled: Boolean(expandedOrgId),
    queryFn: () => api.get(`/organizations/${expandedOrgId}/audit`, { params: { ...auditFilters, page: auditPage, limit: 10 } }).then((response) => response)
  });

  const { data: invoiceData, isFetching: isInvoiceLoading } = useQuery({
    queryKey: ['organization-invoices', expandedOrgId],
    enabled: Boolean(expandedOrgId && isPlatformAdmin),
    queryFn: () => api.get(`/organizations/${expandedOrgId}/invoices`, { params: { limit: 6 } }).then((response) => response)
  });

  const invoiceStatusMutation = useMutation({
    mutationFn: ({ invoiceId, status }) => api.patch(`/organizations/invoices/${invoiceId}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organization-invoices', expandedOrgId] });
      qc.invalidateQueries({ queryKey: ['organization-audit', expandedOrgId] });
      qc.invalidateQueries({ queryKey: ['organization-activity', expandedOrgId] });
    }
  });

  const organizations = data || [];
  const selectedOrganization = useMemo(
    () => organizations.find((organization) => organization.id === expandedOrgId) || null,
    [expandedOrgId, organizations]
  );
  const planRequests = planRequestsData?.data || [];
  const planRequestSummary = planRequestsData?.summary || { total: 0, organizations: 0 };
  const platformTrends = platformMetricsData?.data || [];
  const platformMetricsSummary = platformMetricsData?.summary || { estimated_mrr: 0, active_trials: 0, active_paid_subscriptions: 0 };
  const planRequestSummaryCounts = useMemo(() => planRequests.reduce((accumulator, entry) => {
    accumulator[entry.status] = (accumulator[entry.status] || 0) + 1;
    return accumulator;
  }, { pending: 0, approved: 0, rejected: 0 }), [planRequests]);
  const filteredPlanRequests = useMemo(() => {
    const normalizedQuery = planRequestSearch.trim().toLowerCase();
    const statusRank = { pending: 0, approved: 1, rejected: 2 };

    return [...planRequests]
      .filter((entry) => (planRequestStatusFilter === 'all' ? true : entry.status === planRequestStatusFilter))
      .filter((entry) => {
        if (!normalizedQuery) {
          return true;
        }

        return [
          entry.organization_name,
          entry.metadata?.note,
          entry.description,
          entry.actor_name,
          entry.actor_email,
          entry.metadata?.current_plan,
          entry.metadata?.requested_plan
        ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
      })
      .sort((left, right) => {
        if (planRequestSort === 'oldest') {
          return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
        }

        if (planRequestSort === 'organization') {
          return left.organization_name.localeCompare(right.organization_name, 'tr');
        }

        if (planRequestSort === 'status') {
          const statusDiff = (statusRank[left.status] ?? 9) - (statusRank[right.status] ?? 9);
          if (statusDiff !== 0) {
            return statusDiff;
          }
        }

        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      });
  }, [planRequests, planRequestSearch, planRequestSort, planRequestStatusFilter]);
  const platformSummary = useMemo(() => {
    const total = organizations.length;
    const active = organizations.filter((organization) => organization.is_active).length;
    const inactive = total - active;
    const nearingLimits = organizations.filter((organization) => {
      const userRatio = Number(organization.max_users) ? Number(organization.user_count) / Number(organization.max_users) : 0;
      const propertyRatio = Number(organization.max_properties) ? Number(organization.property_count) / Number(organization.max_properties) : 0;
      return userRatio >= 0.8 || propertyRatio >= 0.8;
    }).length;
    const trialEndingSoon = organizations.filter((organization) => {
      if (!organization.trial_ends_at) {
        return false;
      }
      const diff = new Date(organization.trial_ends_at).getTime() - Date.now();
      return diff >= 0 && diff <= (1000 * 60 * 60 * 24 * 14);
    }).length;

    return {
      total,
      active,
      inactive,
      nearingLimits,
      trialEndingSoon,
      plans: ['starter', 'pro', 'enterprise'].map((plan) => ({
        plan,
        count: organizations.filter((organization) => organization.subscription_plan === plan).length
      }))
    };
  }, [organizations]);
  const activeUsageHistory = useMemo(() => activityData?.usage_history || [], [activityData]);
  const filteredUsageHistory = useMemo(() => activeUsageHistory.slice(0, graphRange).map((entry) => {
    const nextEntry = { ...entry };
    chartSeriesConfig.forEach((series) => {
      if (!visibleSeries.includes(series.key)) {
        nextEntry[series.key] = 0;
      }
    });
    return nextEntry;
  }), [activeUsageHistory, graphRange, visibleSeries]);
  const activeRecentActivity = useMemo(() => activityData?.recent_activity || [], [activityData]);
  const activeUsage = activityData?.usage || null;
  const auditRows = auditData?.data || [];
  const auditMeta = auditData?.meta || { total: 0, page: 1, limit: 10, total_pages: 1 };
  const auditSummary = auditData?.summary || { total: 0, event_type_count: 0, entity_type_count: 0, last_event_at: null };
  const invoiceRows = invoiceData?.data || [];
  const invoiceSummary = invoiceData?.summary || { total: 0, paid_count: 0, unpaid_count: 0, overdue_count: 0, open_amount: 0, overdue_amount: 0, paid_amount: 0 };
  const activeAuditPresetKey = useMemo(() => {
    const matchedPreset = auditPresets.find((preset) => isSameAuditFilterState(preset.filters, auditFilters));
    return matchedPreset?.key || null;
  }, [auditFilters]);
  const selectedOrganizationSnapshot = useMemo(() => {
    if (!selectedOrganization) {
      return null;
    }

    const remainingUsers = Math.max(Number(selectedOrganization.max_users || 0) - Number(selectedOrganization.user_count || 0), 0);
    const remainingProperties = Math.max(Number(selectedOrganization.max_properties || 0) - Number(selectedOrganization.property_count || 0), 0);

    return {
      remainingUsers,
      remainingProperties,
      packagePrice: getPackagePrice(selectedOrganization.subscription_plan)
    };
  }, [selectedOrganization]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);

    if (expandedOrgId) nextParams.set('org', String(expandedOrgId));
    else nextParams.delete('org');

    if (activeAuditPresetKey && activeAuditPresetKey !== 'all') {
      nextParams.set('ap', activeAuditPresetKey);
      nextParams.delete('auditEvent');
      nextParams.delete('auditEntity');
    } else {
      nextParams.delete('ap');
      if (auditFilters.event_type) nextParams.set('auditEvent', auditFilters.event_type);
      else nextParams.delete('auditEvent');

      if (auditFilters.entity_type) nextParams.set('auditEntity', auditFilters.entity_type);
      else nextParams.delete('auditEntity');
    }

    if (auditFilters.from_date) nextParams.set('auditFrom', auditFilters.from_date);
    else nextParams.delete('auditFrom');

    if (auditFilters.to_date) nextParams.set('auditTo', auditFilters.to_date);
    else nextParams.delete('auditTo');

    if (expandedOrgId && auditPage > 1) nextParams.set('auditPage', String(auditPage));
    else nextParams.delete('auditPage');

    const current = searchParams.toString();
    const next = nextParams.toString();
    if (current !== next) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [activeAuditPresetKey, auditFilters, auditPage, expandedOrgId, searchParams, setSearchParams]);

  const updateAuditFilter = (key, value) => {
    setAuditPage(1);
    setAuditFilters((current) => ({ ...current, [key]: value }));
  };

  const applyAuditPreset = (filters) => {
    setAuditPage(1);
    setAuditFilters(filters);
  };

  const downloadAuditCsv = async () => {
    const token = useAuthStore.getState().token;
    const params = new URLSearchParams({
      ...(auditFilters.event_type ? { event_type: auditFilters.event_type } : {}),
      ...(auditFilters.entity_type ? { entity_type: auditFilters.entity_type } : {}),
      ...(auditFilters.from_date ? { from_date: auditFilters.from_date } : {}),
      ...(auditFilters.to_date ? { to_date: auditFilters.to_date } : {})
    });
    const response = await fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/organizations/${expandedOrgId}/audit/export?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!response.ok) {
      throw new Error('Audit export alınamadı');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `organization-audit-${expandedOrgId}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const openOrganizationDrawer = (organizationId) => {
    setAuditFilters(createAuditFilterState());
    setAuditPage(1);
    setGraphRange(6);
    setVisibleSeries(chartSeriesConfig.map((series) => series.key));
    setExpandedOrgId(organizationId);
  };

  const closeOrganizationDrawer = () => {
    setExpandedOrgId(null);
    setAuditFilters(createAuditFilterState());
    setAuditPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{isPlatformAdmin ? 'Organizasyon Yönetimi' : 'Organizasyon Bilgilerim'}</h1>
          <p className="text-sm text-gray-500">
            {isPlatformAdmin
              ? 'Paket, limit ve durum ayarlarını tek ekrandan yönetin.'
              : 'Sadece kendi organizasyon bilginizi ve aktivite kayitlarinizi goruntuleyebilirsiniz.'}
          </p>
        </div>
        {isPlatformAdmin && (
          <button
            onClick={() => {
              setEditingOrg(null);
              setShowForm((value) => !value);
            }}
            className="btn-primary px-3 py-2 text-sm"
          >
            <Plus size={16} /> Organizasyon Ekle
          </button>
        )}
      </div>

      {isPlatformAdmin && !isLoading && (
        <div className="space-y-5">
          <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(135deg,_#0f172a_0%,_#111827_58%,_#1f2937_100%)] p-8 text-white shadow-2xl">
            <div className="grid gap-8 xl:grid-cols-[1.3fr_0.7fr]">
              <div>
                <div className="text-[11px] uppercase tracking-[0.35em] text-sky-200/80">Super Admin Control Deck</div>
                <div className="mt-4 max-w-3xl text-4xl font-bold leading-tight">Kiralanan organizasyonları, gelir ritmini ve yükseltme baskısını tek bakışta yönetin.</div>
                <div className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">Bu alan desktop kullanım önceliğiyle düzenlendi. Karar vermeyi hızlandıran yoğun ama okunabilir bir operasyon görünümü sunar.</div>
                <div className="mt-8 grid gap-3 xl:grid-cols-4">
                  <PlatformMetricCard label="Toplam Organizasyon" value={platformSummary.total} tone="sky" detail={`${platformSummary.active} aktif • ${platformSummary.inactive} pasif`} />
                  <PlatformMetricCard label="Tahmini MRR" value={`₺${Number(platformMetricsSummary.estimated_mrr || 0).toLocaleString('tr-TR')}`} tone="emerald" detail={`${platformMetricsSummary.active_paid_subscriptions} ücretli abonelik`} />
                  <PlatformMetricCard label="Limit Baskısı" value={platformSummary.nearingLimits} tone="amber" detail="Kullanıcı veya mülk limiti %80 üzeri" />
                  <PlatformMetricCard label="Trial Alarmı" value={platformSummary.trialEndingSoon} tone="rose" detail={`${platformMetricsSummary.active_trials} aktif trial`} />
                </div>
              </div>

              <div className="grid gap-3 self-start">
                <div className="rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-300">Paket Dağılımı</div>
                  <div className="mt-4 space-y-3">
                    {platformSummary.plans.map((item) => {
                      const percentage = platformSummary.total ? Math.round((item.count / platformSummary.total) * 100) : 0;
                      return (
                        <div key={item.plan}>
                          <div className="flex items-center justify-between text-sm text-slate-200">
                            <span className="uppercase">{item.plan}</span>
                            <span>{item.count} org • %{percentage}</span>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-300" style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/15 p-5 backdrop-blur-sm">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-300">Operasyon Özeti</div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-200">
                    <div className="rounded-2xl bg-white/5 p-4">
                      <div className="text-xs text-slate-400">Açık Talep</div>
                      <div className="mt-2 text-2xl font-semibold">{planRequests.filter((entry) => entry.status === 'pending').length}</div>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-4">
                      <div className="text-xs text-slate-400">Talep Gönderen Org</div>
                      <div className="mt-2 text-2xl font-semibold">{planRequestSummary.organizations}</div>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-4">
                      <div className="text-xs text-slate-400">Aktif Trial</div>
                      <div className="mt-2 text-2xl font-semibold">{platformMetricsSummary.active_trials}</div>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-4">
                      <div className="text-xs text-slate-400">Pasif Org</div>
                      <div className="mt-2 text-2xl font-semibold">{platformSummary.inactive}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-gray-400">Talep Kuyruğu</div>
                  <div className="mt-2 text-2xl font-semibold text-gray-900">Paket Değişikliği Talepleri</div>
                  <div className="mt-1 text-sm text-gray-500">{filteredPlanRequests.length} gösteriliyor • {planRequestSummary.total} toplam talep • {planRequestSummary.organizations} organizasyon</div>
                </div>
                <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">Bekleyen: {planRequests.filter((entry) => entry.status === 'pending').length}</div>
              </div>

              <div className="mt-5 grid gap-3 xl:grid-cols-[1fr_auto_auto]">
                <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  <Search size={16} className="text-gray-400" />
                  <input
                    value={planRequestSearch}
                    onChange={(event) => setPlanRequestSearch(event.target.value)}
                    placeholder="Organizasyon, not veya paket ara"
                    className="w-full bg-transparent outline-none placeholder:text-gray-400"
                  />
                </label>

                <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-600">
                  <ListFilter size={16} className="text-gray-400" />
                  <select value={planRequestStatusFilter} onChange={(event) => setPlanRequestStatusFilter(event.target.value)} className="bg-transparent pr-6 outline-none">
                    {planRequestStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>

                <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-600">
                  <ArrowUpDown size={16} className="text-gray-400" />
                  <select value={planRequestSort} onChange={(event) => setPlanRequestSort(event.target.value)} className="bg-transparent pr-6 outline-none">
                    {planRequestSortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-3">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-amber-700">Bekleyen</div>
                  <div className="mt-2 text-2xl font-semibold text-amber-900">{planRequestSummaryCounts.pending}</div>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-emerald-700">Onaylanan</div>
                  <div className="mt-2 text-2xl font-semibold text-emerald-900">{planRequestSummaryCounts.approved}</div>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-rose-700">Reddedilen</div>
                  <div className="mt-2 text-2xl font-semibold text-rose-900">{planRequestSummaryCounts.rejected}</div>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {filteredPlanRequests.length ? filteredPlanRequests.map((request) => (
                  <div key={request.id} className="rounded-3xl border border-gray-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-base font-semibold text-gray-900">{request.organization_name}</div>
                        <div className="mt-2 inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700">{request.metadata?.current_plan} {'->'} {request.metadata?.requested_plan}</div>
                      </div>
                      <div className={`rounded-full px-3 py-1 text-xs font-semibold ${request.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : request.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                        {request.status === 'approved' ? 'Onaylandı' : request.status === 'rejected' ? 'Reddedildi' : 'Bekliyor'}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 xl:grid-cols-[0.78fr_0.22fr]">
                      <div>
                        <div className="text-xs text-gray-500">{formatActorLabel(request)} • {formatDateTime(request.created_at)}</div>
                        <div className="mt-3 text-sm leading-6 text-gray-700">{request.metadata?.note || request.description}</div>
                        {request.decision && (
                          <div className="mt-3 rounded-2xl border border-gray-200 bg-white px-3 py-3 text-xs leading-5 text-gray-600">
                            {request.decision.event_label} • {request.decision.actor_name || request.decision.actor_email || 'Super Admin'} • {formatDateTime(request.decision.created_at)}
                            {request.decision.note ? ` • ${request.decision.note}` : ''}
                          </div>
                        )}
                      </div>

                      {request.status === 'pending' && (
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const note = window.prompt('Onay notu (opsiyonel)') || '';
                              planRequestDecisionMutation.mutate({ requestId: request.id, action: 'approve', note });
                            }}
                            disabled={planRequestDecisionMutation.isPending}
                            className="rounded-2xl bg-emerald-600 px-3 py-3 text-sm font-medium text-white disabled:opacity-50"
                          >
                            Onayla
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const note = window.prompt('Red nedeni (opsiyonel)') || '';
                              planRequestDecisionMutation.mutate({ requestId: request.id, action: 'reject', note });
                            }}
                            disabled={planRequestDecisionMutation.isPending}
                            className="rounded-2xl bg-rose-600 px-3 py-3 text-sm font-medium text-white disabled:opacity-50"
                          >
                            Reddet
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">Seçili filtrelerle eşleşen paket değişikliği talebi yok.</div>
                )}
              </div>
            </div>

            {!!platformTrends.length && <PlatformTrendChart data={platformTrends} />}
          </section>
        </div>
      )}

      {isPlatformAdmin && showForm && (
        <OrganizationForm
          initialValues={editingOrg || emptyForm}
          onCancel={() => {
            setShowForm(false);
            setEditingOrg(null);
          }}
          onSuccess={() => {
            setShowForm(false);
            setEditingOrg(null);
          }}
        />
      )}

      {isLoading ? (
        <div className="card text-center text-sm text-gray-500">Yükleniyor...</div>
      ) : (
        <div className="space-y-3">
          {organizations.map((organization) => (
            <div key={organization.id} className="card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 size={18} className="text-primary-600" />
                    <h2 className="font-semibold">{organization.name}</h2>
                    <span className={`badge ${organization.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {organization.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-gray-500">{organization.slug}</div>
                </div>
                {isPlatformAdmin && (
                  <button
                    onClick={() => {
                      setEditingOrg({
                        ...organization,
                        trial_ends_at: organization.trial_ends_at ? new Date(organization.trial_ends_at).toISOString().slice(0, 16) : '',
                        is_active: organization.is_active
                      });
                      setShowForm(true);
                    }}
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                    aria-label="Organizasyonu düzenle"
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openOrganizationDrawer(organization.id)}
                  className="btn-secondary px-3 py-2 text-sm"
                >
                  <BarChart3 size={14} /> Detay Drawer
                </button>

                {isPlatformAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const nextStatus = !organization.is_active;
                        const confirmMessage = nextStatus
                          ? `${organization.name} organizasyonunu tekrar aktif yapmak istiyor musunuz?`
                          : `${organization.name} organizasyonunu pasife almak istiyor musunuz?`;

                        if (window.confirm(confirmMessage)) {
                          statusMutation.mutate({ id: organization.id, is_active: nextStatus });
                        }
                      }}
                      disabled={statusMutation.isPending || currentUser?.organization_id === organization.id}
                      className="btn-secondary px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Power size={14} />
                      {organization.is_active ? 'Pasife Al' : 'Aktifleştir'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`${organization.name} organizasyonunu kalıcı olarak silmek istiyor musunuz?`)) {
                          deleteMutation.mutate(organization.id);
                        }
                      }}
                      disabled={deleteMutation.isPending || currentUser?.organization_id === organization.id}
                      className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={14} /> Sil
                    </button>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500"><Shield size={14} /> Paket</div>
                  <div className="mt-1 text-sm font-semibold uppercase">{organization.subscription_plan}</div>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <div className="text-xs text-emerald-700">Aylık Paket Bedeli</div>
                  <div className="mt-1 text-sm font-semibold text-emerald-900">{formatCurrency(getPackagePrice(organization.subscription_plan))}</div>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500"><Users size={14} /> Kullanıcı</div>
                  <div className="mt-1 text-sm font-semibold">{organization.user_count} / {organization.max_users}</div>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500"><Home size={14} /> Mülk</div>
                  <div className="mt-1 text-sm font-semibold">{organization.property_count} / {organization.max_properties}</div>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="text-xs text-gray-500">Aktif Sözleşme</div>
                  <div className="mt-1 text-sm font-semibold">{organization.active_contract_count}</div>
                </div>
              </div>

              <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                <div>E-posta: {organization.contact_email || '-'}</div>
                <div>Telefon: {organization.contact_phone || '-'}</div>
                <div>Deneme Bitişi: {organization.trial_ends_at ? new Date(organization.trial_ends_at).toLocaleString('tr-TR') : '-'}</div>
                <div>Oluşturulma: {organization.created_at ? new Date(organization.created_at).toLocaleDateString('tr-TR') : '-'}</div>
              </div>

              {(statusMutation.error?.message || deleteMutation.error?.message) && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {statusMutation.error?.message || deleteMutation.error?.message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isPlatformAdmin && selectedOrganization && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[2px]">
          <div className="h-full w-full max-w-[860px] overflow-y-auto border-l border-slate-200 bg-slate-50 shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Organization Detail Drawer</div>
                  <div className="mt-2 flex items-center gap-3">
                    <h2 className="text-2xl font-semibold text-slate-900">{selectedOrganization.name}</h2>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedOrganization.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {selectedOrganization.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-slate-500">{selectedOrganization.slug} • {selectedOrganization.contact_email || 'E-posta yok'} • {selectedOrganization.contact_phone || 'Telefon yok'}</div>
                </div>
                <button type="button" onClick={closeOrganizationDrawer} className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500 hover:bg-slate-100">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-5 p-6">
              <div className="grid gap-3 xl:grid-cols-6">
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Paket</div>
                  <div className="mt-2 text-2xl font-semibold uppercase text-slate-900">{selectedOrganization.subscription_plan}</div>
                  <div className="mt-2 text-xs text-slate-500">Deneme bitişi: {selectedOrganization.trial_ends_at ? new Date(selectedOrganization.trial_ends_at).toLocaleString('tr-TR') : '-'}</div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Aylık Paket Bedeli</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(selectedOrganizationSnapshot?.packagePrice)}</div>
                  <div className="mt-2 text-xs text-slate-500">Kodlanan sabit paket fiyatı</div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Kalan Kullanıcı Hakkı</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{selectedOrganizationSnapshot?.remainingUsers ?? 0}</div>
                  <div className="mt-2 text-xs text-slate-500">Toplam limit {selectedOrganization.max_users} • kullanım {selectedOrganization.user_count}</div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Kalan Mülk Hakkı</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{selectedOrganizationSnapshot?.remainingProperties ?? 0}</div>
                  <div className="mt-2 text-xs text-slate-500">Toplam limit {selectedOrganization.max_properties} • kullanım {selectedOrganization.property_count}</div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Kullanıcı Doluluğu</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{selectedOrganization.user_count} / {selectedOrganization.max_users}</div>
                  <div className="mt-2 text-xs text-slate-500">%{selectedOrganization.max_users ? Math.round((selectedOrganization.user_count / selectedOrganization.max_users) * 100) : 0} kullanım</div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Mülk Doluluğu</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{selectedOrganization.property_count} / {selectedOrganization.max_properties}</div>
                  <div className="mt-2 text-xs text-slate-500">%{selectedOrganization.max_properties ? Math.round((selectedOrganization.property_count / selectedOrganization.max_properties) * 100) : 0} kullanım</div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Aktif Sözleşme</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{selectedOrganization.active_contract_count}</div>
                  <div className="mt-2 text-xs text-slate-500">Oluşturulma: {selectedOrganization.created_at ? new Date(selectedOrganization.created_at).toLocaleDateString('tr-TR') : '-'}</div>
                </div>
              </div>

              {isActivityLoading ? (
                <div className="rounded-3xl border border-slate-200 bg-white px-5 py-12 text-sm text-slate-500 shadow-sm">Organizasyon aktivitesi yükleniyor...</div>
              ) : (
                <>
                  <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <CalendarClock size={16} className="text-primary-600" /> Kullanım Geçmişi
                      </div>
                      <div className="mt-4 space-y-3">
                        {activeUsageHistory.map((entry) => (
                          <div key={entry.month_start} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                            <div className="font-medium text-slate-800">{formatMonthLabel(entry.month_start)}</div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                              <div>Kullanıcı: {entry.users_added}</div>
                              <div>Mülk: {entry.properties_added}</div>
                              <div>Sözleşme: {entry.contracts_started}</div>
                              <div>Ödeme Kaydı: {entry.payments_created}</div>
                              <div className="col-span-2 sm:col-span-1">Tahsilat: ₺{Number(entry.paid_amount_total || 0).toLocaleString('tr-TR')}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <Activity size={16} className="text-primary-600" /> Son Aktiviteler
                      </div>
                      <div className="mt-4 space-y-3">
                        {activeRecentActivity.map((entry) => (
                          <div key={`${entry.type}-${entry.id}-${entry.occurred_at}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-medium text-slate-800">{entry.title}</div>
                              <div className="text-xs text-slate-500">{formatDateTime(entry.occurred_at)}</div>
                            </div>
                            <div className="mt-1 text-xs uppercase tracking-wide text-primary-600">{entry.event_label || entry.type}</div>
                            <div className="mt-1 text-xs text-slate-500">{formatActorLabel(entry)}</div>
                            <div className="mt-2 text-sm text-slate-600">{entry.description}</div>
                          </div>
                        ))}
                        {!activeRecentActivity.length && <div className="text-sm text-slate-500">Henüz aktivite yok.</div>}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                          <CalendarClock size={16} className="text-primary-600" /> Gerçek Ödeme / Fatura Durumu
                        </div>
                        <div className="mt-1 text-sm text-slate-500">`paid / unpaid / overdue` durumları organization invoice tablosundan okunur.</div>
                      </div>
                      <div className="rounded-2xl bg-slate-900 px-4 py-3 text-right text-white">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Açık Tahsilat</div>
                        <div className="mt-2 text-2xl font-semibold">{formatCurrency(invoiceSummary.open_amount)}</div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="text-xs text-emerald-700">Ödenen Fatura</div>
                        <div className="mt-2 text-2xl font-semibold text-emerald-900">{invoiceSummary.paid_count}</div>
                        <div className="mt-1 text-xs text-emerald-700">{formatCurrency(invoiceSummary.paid_amount)}</div>
                      </div>
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <div className="text-xs text-amber-700">Ödenmeyen</div>
                        <div className="mt-2 text-2xl font-semibold text-amber-900">{invoiceSummary.unpaid_count}</div>
                        <div className="mt-1 text-xs text-amber-700">Tahsilat bekliyor</div>
                      </div>
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                        <div className="text-xs text-rose-700">Gecikmiş</div>
                        <div className="mt-2 text-2xl font-semibold text-rose-900">{invoiceSummary.overdue_count}</div>
                        <div className="mt-1 text-xs text-rose-700">{formatCurrency(invoiceSummary.overdue_amount)}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs text-slate-500">Toplam Fatura</div>
                        <div className="mt-2 text-2xl font-semibold text-slate-900">{invoiceSummary.total}</div>
                        <div className="mt-1 text-xs text-slate-500">Aylık plan akışı</div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {isInvoiceLoading ? (
                        <div className="text-sm text-slate-500">Faturalar yükleniyor...</div>
                      ) : invoiceRows.length ? invoiceRows.map((invoice) => {
                        const statusMeta = getInvoiceStatusMeta(invoice.status);
                        return (
                          <div key={invoice.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-slate-900">{invoice.invoice_number}</div>
                                <div className="mt-1 text-xs text-slate-500">{formatDateTime(invoice.issued_at)} • Vade: {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('tr-TR') : '-'}</div>
                                <div className="mt-2 text-sm text-slate-600">{formatMonthLabel(invoice.billing_period_start)} dönemi • {formatCurrency(invoice.amount)} • {invoice.note || 'Aylık paket faturası'}</div>
                                <div className="mt-1 text-xs text-slate-500">Plan: {invoice.subscription_plan.toUpperCase()} • Son işlem: {invoice.actor_name || invoice.actor_email || 'Sistem'}</div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>{statusMeta.label}</span>
                                <div className="flex flex-wrap justify-end gap-2">
                                  {invoice.status !== 'paid' && (
                                    <button
                                      type="button"
                                      onClick={() => invoiceStatusMutation.mutate({ invoiceId: invoice.id, status: 'paid' })}
                                      disabled={invoiceStatusMutation.isPending}
                                      className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                                    >
                                      Ödendi İşaretle
                                    </button>
                                  )}
                                  {invoice.status === 'paid' && (
                                    <button
                                      type="button"
                                      onClick={() => invoiceStatusMutation.mutate({ invoiceId: invoice.id, status: 'unpaid' })}
                                      disabled={invoiceStatusMutation.isPending}
                                      className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-700 disabled:opacity-50"
                                    >
                                      Açık Faturaya Çevir
                                    </button>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500">Ödeme tarihi: {invoice.paid_at ? new Date(invoice.paid_at).toLocaleString('tr-TR') : '-'}</div>
                              </div>
                            </div>
                          </div>
                        );
                      }) : <div className="text-sm text-slate-500">Henüz fatura kaydı yok.</div>}
                    </div>

                    {invoiceStatusMutation.error?.message && (
                      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {invoiceStatusMutation.error.message}
                      </div>
                    )}
                  </div>

                  {!!filteredUsageHistory.length && (
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {graphRangeOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setGraphRange(option.value)}
                              className={`rounded-lg px-3 py-1.5 text-xs ${graphRange === option.value ? 'bg-primary-600 text-white' : 'border border-gray-200 text-gray-600'}`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {chartSeriesConfig.map((series) => {
                            const active = visibleSeries.includes(series.key);
                            return (
                              <button
                                key={series.key}
                                type="button"
                                onClick={() => setVisibleSeries((current) => active ? current.filter((item) => item !== series.key) : [...current, series.key])}
                                className={`rounded-lg px-3 py-1.5 text-xs ${active ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-500'}`}
                              >
                                {series.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="mt-4">
                        <UsageHistoryChart data={filteredUsageHistory} />
                      </div>
                    </div>
                  )}

                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <Activity size={16} className="text-primary-600" /> Audit Kayıtları
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setAuditFilters(createAuditFilterState()); setAuditPage(1); }} className="btn-secondary px-3 py-2 text-sm">Filtreyi Temizle</button>
                        <button type="button" onClick={downloadAuditCsv} className="btn-secondary px-3 py-2 text-sm">CSV Dışa Aktar</button>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl border border-gray-200 bg-slate-50 p-3 text-sm text-gray-600">
                        <div className="text-xs text-gray-500">Toplam Kayıt</div>
                        <div className="mt-1 text-lg font-semibold text-gray-900">{auditSummary.total}</div>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-slate-50 p-3 text-sm text-gray-600">
                        <div className="text-xs text-gray-500">Event Tipi</div>
                        <div className="mt-1 text-lg font-semibold text-gray-900">{auditSummary.event_type_count}</div>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-slate-50 p-3 text-sm text-gray-600">
                        <div className="text-xs text-gray-500">Varlık Tipi</div>
                        <div className="mt-1 text-lg font-semibold text-gray-900">{auditSummary.entity_type_count}</div>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-slate-50 p-3 text-sm text-gray-600">
                        <div className="text-xs text-gray-500">Son Audit</div>
                        <div className="mt-1 text-sm font-semibold text-gray-900">{formatDateTime(auditSummary.last_event_at)}</div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {auditPresets.map((preset) => (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => applyAuditPreset(preset.filters)}
                          className={`rounded-lg px-3 py-1.5 text-xs ${activeAuditPresetKey === preset.key ? 'bg-primary-600 text-white' : 'border border-gray-200 text-gray-600'}`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <select className="input" value={auditFilters.event_type} onChange={(event) => updateAuditFilter('event_type', event.target.value)}>
                        {auditEventOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                      <select className="input" value={auditFilters.entity_type} onChange={(event) => updateAuditFilter('entity_type', event.target.value)}>
                        {auditEntityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                      <input className="input" type="datetime-local" value={auditFilters.from_date} onChange={(event) => updateAuditFilter('from_date', event.target.value)} />
                      <input className="input" type="datetime-local" value={auditFilters.to_date} onChange={(event) => updateAuditFilter('to_date', event.target.value)} />
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">Organizasyon bazlı audit, kullanıcı ve mülk akışını tek yerden izleyin.</div>
                    </div>
                    <div className="mt-4 space-y-2">
                      {isAuditLoading ? (
                        <div className="text-sm text-slate-500">Audit kayıtları yükleniyor...</div>
                      ) : auditRows.length ? auditRows.map((entry) => (
                        <div key={entry.id} className="rounded-xl border border-gray-200 bg-slate-50 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-medium text-gray-800">{entry.title}</div>
                            <div className="text-xs text-gray-500">{formatDateTime(entry.created_at)}</div>
                          </div>
                          <div className="mt-1 text-xs uppercase tracking-wide text-primary-600">{entry.event_label || entry.event_type}</div>
                          <div className="mt-1 text-xs text-gray-500">{formatActorLabel(entry)}</div>
                          <div className="mt-2 text-sm text-gray-600">{entry.description}</div>
                        </div>
                      )) : <div className="text-sm text-slate-500">Filtreye uygun audit kaydı yok.</div>}
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-200 pt-3 text-sm text-gray-500">
                      <div>Sayfa {auditMeta.page} / {auditMeta.total_pages} • Toplam {auditMeta.total} kayıt</div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setAuditPage((current) => Math.max(current - 1, 1))} disabled={auditMeta.page <= 1 || isAuditLoading} className="btn-secondary px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">Önceki</button>
                        <button type="button" onClick={() => setAuditPage((current) => Math.min(current + 1, auditMeta.total_pages || 1))} disabled={auditMeta.page >= auditMeta.total_pages || isAuditLoading} className="btn-secondary px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">Sonraki</button>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-xl bg-white p-3 text-sm text-gray-600 shadow-sm">
                      <div className="text-xs text-gray-500">Toplam Kullanıcı</div>
                      <div className="mt-1 font-semibold text-gray-900">{activeUsage?.users ?? selectedOrganization.user_count}</div>
                    </div>
                    <div className="rounded-xl bg-white p-3 text-sm text-gray-600 shadow-sm">
                      <div className="text-xs text-gray-500">Toplam Mülk</div>
                      <div className="mt-1 font-semibold text-gray-900">{activeUsage?.properties ?? selectedOrganization.property_count}</div>
                    </div>
                    <div className="rounded-xl bg-white p-3 text-sm text-gray-600 shadow-sm">
                      <div className="text-xs text-gray-500">Toplam Sözleşme</div>
                      <div className="mt-1 font-semibold text-gray-900">{activeUsage?.contracts ?? selectedOrganization.active_contract_count}</div>
                    </div>
                    <div className="rounded-xl bg-white p-3 text-sm text-gray-600 shadow-sm">
                      <div className="text-xs text-gray-500">Toplam Ödeme</div>
                      <div className="mt-1 font-semibold text-gray-900">{activeUsage?.payments ?? 0}</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}