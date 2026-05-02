import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Building2, CalendarClock, CreditCard, Home, KeyRound, Pencil, Plus, Power, Search, Shield, Users } from 'lucide-react';
import api from '../../api/client';
import { useAuthStore } from '../../store/authStore';

const planPrices = {
  starter: 1499,
  pro: 3999,
  enterprise: 9999
};

const planOptions = [
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' }
];

const roleOptions = [
  { value: 'owner', label: 'Owner' },
  { value: 'accountant', label: 'Muhasebe' },
  { value: 'agent', label: 'Saha Personeli' },
  { value: 'admin', label: 'Admin' }
];

const createUserFormState = () => ({ name: '', email: '', password: '', phone: '', role: 'owner' });

const createManagedUserFormState = (entry) => ({
  name: entry?.name || '',
  email: entry?.email || '',
  phone: entry?.phone || '',
  role: entry?.role || 'owner',
  newPassword: ''
});

const formatDateTime = (value) => (value ? new Date(value).toLocaleString('tr-TR') : '-');

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

const subscriptionStatusLabels = {
  trial: 'Trial',
  active: 'Aktif',
  pending: 'Bekliyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  cancelled: 'İptal'
};

const getUsagePercent = (current, limit) => {
  if (!limit) {
    return 0;
  }

  return Math.min(100, Math.round((Number(current || 0) / Number(limit || 1)) * 100));
};

function LimitCard({ icon: Icon, label, current, limit, accent }) {
  const percent = getUsagePercent(current, limit);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
        <Icon size={16} className={accent} /> {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{current} <span className="text-sm font-medium text-gray-500">/ {limit}</span></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${accent.replace('text', 'bg')}`} style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-2 text-xs text-gray-500">Kullanım oranı: %{percent}</div>
    </div>
  );
}

export default function OrganizationOverview() {
  const qc = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const organizationId = user?.organization_id;
  const [requestedPlan, setRequestedPlan] = useState('pro');
  const [requestNote, setRequestNote] = useState('');
  const [userForm, setUserForm] = useState(createUserFormState);
  const [managedUserId, setManagedUserId] = useState(null);
  const [managedUserForm, setManagedUserForm] = useState(createManagedUserFormState(null));
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  const { data: organization, isLoading: isOrganizationLoading } = useQuery({
    queryKey: ['organization-overview', organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => api.get(`/organizations/${organizationId}`).then((response) => response.data)
  });

  const { data: activityData, isLoading: isActivityLoading } = useQuery({
    queryKey: ['organization-overview-activity', organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => api.get(`/organizations/${organizationId}/activity`).then((response) => response.data)
  });

  const { data: subscriptionHistoryData, isLoading: isSubscriptionHistoryLoading } = useQuery({
    queryKey: ['organization-subscription-history', organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => api.get(`/organizations/${organizationId}/subscription-history`, { params: { limit: 8 } }).then((response) => response.data)
  });

  const { data: organizationUsersData, isLoading: isUsersLoading } = useQuery({
    queryKey: ['organization-users', organizationId],
    enabled: Boolean(organizationId) && user?.role === 'admin',
    queryFn: () => api.get('/auth/users')
  });

  const usage = activityData?.usage || {};
  const usageHistory = activityData?.usage_history || [];
  const currentMonth = usageHistory[0] || null;
  const subscriptionHistory = subscriptionHistoryData || [];
  const estimatedMonthlyPrice = planPrices[organization?.subscription_plan] || 0;
  const renewalDate = organization?.trial_ends_at || organization?.created_at;
  const organizationUsers = organizationUsersData?.data || [];
  const filteredOrganizationUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    return organizationUsers.filter((entry) => {
      const matchesRole = userRoleFilter === 'all' ? true : entry.role === userRoleFilter;
      const matchesQuery = query
        ? [entry.name, entry.email, entry.phone, entry.role].some((value) => String(value || '').toLowerCase().includes(query))
        : true;
      return matchesRole && matchesQuery;
    });
  }, [organizationUsers, userRoleFilter, userSearch]);
  const usersSummary = organizationUsersData?.summary || {
    user_count: usage.users ?? organization?.user_count ?? 0,
    max_users: organization?.max_users ?? 0,
    remaining_slots: Math.max((organization?.max_users ?? 0) - (usage.users ?? organization?.user_count ?? 0), 0)
  };
  const managedUser = useMemo(
    () => organizationUsers.find((entry) => entry.id === managedUserId) || null,
    [managedUserId, organizationUsers]
  );

  const planRequestMutation = useMutation({
    mutationFn: (payload) => api.post(`/organizations/${organizationId}/plan-request`, payload),
    onSuccess: () => {
      setRequestNote('');
      qc.invalidateQueries({ queryKey: ['organization-subscription-history', organizationId] });
    }
  });

  const userCreateMutation = useMutation({
    mutationFn: (payload) => api.post('/auth/register', payload),
    onSuccess: () => {
      setUserForm(createUserFormState());
      qc.invalidateQueries({ queryKey: ['organization-users', organizationId] });
      qc.invalidateQueries({ queryKey: ['organization-overview', organizationId] });
    }
  });

  const userUpdateMutation = useMutation({
    mutationFn: ({ userId, payload }) => api.put(`/auth/users/${userId}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organization-users', organizationId] });
    }
  });

  const userStatusMutation = useMutation({
    mutationFn: ({ userId, is_active }) => api.patch(`/auth/users/${userId}/status`, { is_active }),
    onSuccess: (_, variables) => {
      if (variables.is_active === false && variables.userId === managedUserId) {
        setManagedUserId(null);
        setManagedUserForm(createManagedUserFormState(null));
      }
      qc.invalidateQueries({ queryKey: ['organization-users', organizationId] });
    }
  });

  const userResetPasswordMutation = useMutation({
    mutationFn: ({ userId, newPassword }) => api.put(`/auth/users/${userId}/reset-password`, { newPassword }),
    onSuccess: () => {
      setManagedUserForm((current) => ({ ...current, newPassword: '' }));
    }
  });

  const startManageUser = (entry) => {
    setManagedUserId(entry.id);
    setManagedUserForm(createManagedUserFormState(entry));
  };

  const resetManagePanel = () => {
    setManagedUserId(null);
    setManagedUserForm(createManagedUserFormState(null));
  };

  if (isOrganizationLoading) {
    return <div className="card text-center text-sm text-gray-500">Organizasyon bilgileri yükleniyor...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-primary-700 via-primary-600 to-sky-700 p-5 text-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-primary-100">
              <Building2 size={16} /> Organizasyon Bilgilerim
            </div>
            <h1 className="mt-2 text-2xl font-bold">{organization?.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-primary-100">
              <span className="rounded-full bg-white/10 px-3 py-1">Slug: {organization?.slug}</span>
              <span className="rounded-full bg-white/10 px-3 py-1">Paket: {organization?.subscription_plan}</span>
              <span className={`rounded-full px-3 py-1 ${organization?.is_active ? 'bg-emerald-500/20 text-emerald-100' : 'bg-red-500/20 text-red-100'}`}>
                {organization?.is_active ? 'Aktif' : 'Pasif'}
              </span>
            </div>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 text-sm backdrop-blur-sm">
            <div className="text-primary-100">Hesap Yöneticisi</div>
            <div className="mt-1 font-semibold">{user?.name}</div>
            <div className="text-primary-100">{user?.email}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <LimitCard icon={Users} label="Kullanıcı Limiti" current={usage.users ?? organization?.user_count ?? 0} limit={organization?.max_users ?? 0} accent="text-sky-600" />
        <LimitCard icon={Home} label="Mülk Limiti" current={usage.properties ?? organization?.property_count ?? 0} limit={organization?.max_properties ?? 0} accent="text-emerald-600" />
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600"><Shield size={16} className="text-amber-600" /> Aktif Sözleşme</div>
          <div className="mt-2 text-2xl font-bold text-gray-900">{usage.contracts ?? organization?.active_contract_count ?? 0}</div>
          <div className="mt-2 text-xs text-gray-500">Portföyünüzde şu anda aktif olan sözleşme sayısı</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600"><CreditCard size={16} className="text-violet-600" /> Bu Ay Tahsilat</div>
          <div className="mt-2 text-2xl font-bold text-gray-900">₺{Number(currentMonth?.paid_amount_total || 0).toLocaleString('tr-TR')}</div>
          <div className="mt-2 text-xs text-gray-500">{currentMonth ? formatDateTime(currentMonth.month_start) : 'Henüz veri yok'}</div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800"><BadgeCheck size={16} className="text-primary-600" /> Paket ve İletişim</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-gray-50 p-3">
              <div className="text-xs text-gray-500">İletişim E-postası</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{organization?.contact_email || '-'}</div>
            </div>
            <div className="rounded-2xl bg-gray-50 p-3">
              <div className="text-xs text-gray-500">İletişim Telefonu</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{organization?.contact_phone || '-'}</div>
            </div>
            <div className="rounded-2xl bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Deneme / Paket Bitişi</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{formatDateTime(organization?.trial_ends_at)}</div>
            </div>
            <div className="rounded-2xl bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Oluşturulma Tarihi</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{formatDateTime(organization?.created_at)}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800"><CalendarClock size={16} className="text-primary-600" /> Son Kullanım Hareketi</div>
          {isActivityLoading ? (
            <div className="mt-4 text-sm text-gray-500">Kullanım geçmişi yükleniyor...</div>
          ) : currentMonth ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-gray-50 p-4">
                <div className="text-xs text-gray-500">Dönem</div>
                <div className="mt-1 text-lg font-semibold text-gray-900">{new Date(currentMonth.month_start).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-sky-50 p-3 text-sky-900">Yeni kullanıcı: {currentMonth.users_added}</div>
                <div className="rounded-xl bg-emerald-50 p-3 text-emerald-900">Yeni mülk: {currentMonth.properties_added}</div>
                <div className="rounded-xl bg-amber-50 p-3 text-amber-900">Yeni sözleşme: {currentMonth.contracts_started}</div>
                <div className="rounded-xl bg-violet-50 p-3 text-violet-900">Ödeme kaydı: {currentMonth.payments_created}</div>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-gray-500">Henüz kullanım hareketi yok.</div>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        {user?.role === 'admin' && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800"><Users size={16} className="text-primary-600" /> Organizasyon Kullanıcıları</div>
                <div className="mt-1 text-xs text-gray-500">{usersSummary.user_count} / {usersSummary.max_users} slot kullanılıyor • Kalan {usersSummary.remaining_slots}</div>
              </div>
              <div className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700">Paket kullanıcı kotası aktif</div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
                    <Search size={16} className="text-gray-400" />
                    <input
                      className="w-full bg-transparent outline-none placeholder:text-gray-400"
                      placeholder="Ad, e-posta, telefon veya rol ara"
                      value={userSearch}
                      onChange={(event) => setUserSearch(event.target.value)}
                    />
                  </label>
                  <select className="input" value={userRoleFilter} onChange={(event) => setUserRoleFilter(event.target.value)}>
                    <option value="all">Tüm Roller</option>
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                {isUsersLoading ? (
                  <div className="text-sm text-gray-500">Kullanıcılar yükleniyor...</div>
                ) : filteredOrganizationUsers.length ? (
                  filteredOrganizationUsers.map((entry) => (
                    <div key={entry.id} className={`rounded-2xl border p-3 ${managedUserId === entry.id ? 'border-primary-300 bg-primary-50/40' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                            <span>{entry.name}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${entry.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                              {entry.is_active ? 'Aktif' : 'Pasif'}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-gray-500">{entry.email}</div>
                        </div>
                        <div className="rounded-full bg-white px-2 py-1 text-xs font-medium text-gray-600">{entry.role}</div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">{entry.phone || '-'} • {formatDateTime(entry.created_at)}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startManageUser(entry)}
                          className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700"
                        >
                          <Pencil size={13} /> Düzenle
                        </button>
                        <button
                          type="button"
                          onClick={() => userStatusMutation.mutate({ userId: entry.id, is_active: !entry.is_active })}
                          disabled={userStatusMutation.isPending || entry.id === user?.id}
                          className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Power size={13} /> {entry.is_active ? 'Pasife Al' : 'Aktifleştir'}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-500">Arama veya rol filtresiyle eşleşen kullanıcı bulunamadı.</div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{managedUser ? 'Kullanıcıyı Yönet' : 'Yeni Kullanıcı Ekle'}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {managedUser ? 'Ad, rol ve şifre yönetimini buradan yapın.' : 'Kota dolduğunda backend yeni kullanıcı açılmasına izin vermez.'}
                    </div>
                  </div>
                  {managedUser ? (
                    <button type="button" onClick={resetManagePanel} className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700">
                      <Plus size={13} className="rotate-45" /> Yeni Mod
                    </button>
                  ) : null}
                </div>

                {managedUser ? (
                  <div className="mt-4 space-y-3">
                    <input className="input" placeholder="Ad Soyad" value={managedUserForm.name} onChange={(event) => setManagedUserForm((current) => ({ ...current, name: event.target.value }))} />
                    <input className="input" type="email" placeholder="E-posta" value={managedUserForm.email} onChange={(event) => setManagedUserForm((current) => ({ ...current, email: event.target.value }))} />
                    <input className="input" placeholder="Telefon" value={managedUserForm.phone} onChange={(event) => setManagedUserForm((current) => ({ ...current, phone: event.target.value }))} />
                    <select className="input" value={managedUserForm.role} onChange={(event) => setManagedUserForm((current) => ({ ...current, role: event.target.value }))}>
                      {roleOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <div className="rounded-2xl border border-gray-200 bg-white p-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500"><KeyRound size={14} /> Şifre Sıfırla</div>
                      <input className="input mt-3" type="password" placeholder="Yeni geçici şifre" value={managedUserForm.newPassword} onChange={(event) => setManagedUserForm((current) => ({ ...current, newPassword: event.target.value }))} />
                      <button
                        type="button"
                        disabled={userResetPasswordMutation.isPending || managedUserForm.newPassword.length < 8}
                        onClick={() => userResetPasswordMutation.mutate({ userId: managedUser.id, newPassword: managedUserForm.newPassword })}
                        className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {userResetPasswordMutation.isPending ? 'Şifre sıfırlanıyor...' : 'Şifreyi Sıfırla'}
                      </button>
                    </div>
                    {userUpdateMutation.error?.message && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{userUpdateMutation.error.message}</div>
                    )}
                    {userResetPasswordMutation.error?.message && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{userResetPasswordMutation.error.message}</div>
                    )}
                    {userUpdateMutation.isSuccess && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Kullanıcı bilgileri güncellendi.</div>
                    )}
                    {userResetPasswordMutation.isSuccess && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Şifre sıfırlandı.</div>
                    )}
                    <button
                      type="button"
                      disabled={userUpdateMutation.isPending || !managedUserForm.name || !managedUserForm.email}
                      onClick={() => userUpdateMutation.mutate({ userId: managedUser.id, payload: { name: managedUserForm.name, email: managedUserForm.email, phone: managedUserForm.phone, role: managedUserForm.role } })}
                      className="btn-primary w-full py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {userUpdateMutation.isPending ? 'Kullanıcı güncelleniyor...' : 'Değişiklikleri Kaydet'}
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <input className="input" placeholder="Ad Soyad" value={userForm.name} onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))} />
                    <input className="input" type="email" placeholder="E-posta" value={userForm.email} onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))} />
                    <input className="input" type="password" placeholder="Şifre" value={userForm.password} onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))} />
                    <input className="input" placeholder="Telefon" value={userForm.phone} onChange={(event) => setUserForm((current) => ({ ...current, phone: event.target.value }))} />
                    <select className="input" value={userForm.role} onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value }))}>
                      {roleOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    {userCreateMutation.error?.message && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {userCreateMutation.error.message}
                      </div>
                    )}
                    {userCreateMutation.isSuccess && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                        Kullanıcı oluşturuldu.
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={userCreateMutation.isPending || usersSummary.remaining_slots <= 0 || !userForm.name || !userForm.email || userForm.password.length < 8}
                      onClick={() => userCreateMutation.mutate(userForm)}
                      className="btn-primary w-full py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {userCreateMutation.isPending ? 'Kullanıcı oluşturuluyor...' : usersSummary.remaining_slots <= 0 ? 'Kullanıcı Limiti Dolu' : 'Kullanıcı Oluştur'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800"><CreditCard size={16} className="text-primary-600" /> Abonelik ve Yükseltme</div>
          <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
            <div>Mevcut paket: <span className="font-semibold uppercase text-gray-900">{organization?.subscription_plan}</span></div>
            <div className="mt-2 text-xs text-gray-500">Paket yükseltme talebiniz yönetim onayına gönderilir ve sonuç size bu ekran üzerinden yansır.</div>
          </div>
          <div className="mt-4 space-y-3">
            <div>
              <label className="label">Talep edilen paket</label>
              <select className="input" value={requestedPlan} onChange={(event) => setRequestedPlan(event.target.value)}>
                {planOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Not</label>
              <textarea
                className="input min-h-[110px]"
                value={requestNote}
                onChange={(event) => setRequestNote(event.target.value)}
                placeholder="Örn: 3 yeni kullanıcı açılacak, pro pakete geçmek istiyoruz."
              />
            </div>
            {planRequestMutation.error?.message && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {planRequestMutation.error.message}
              </div>
            )}
            {planRequestMutation.isSuccess && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Paket değişikliği talebiniz iletildi.
              </div>
            )}
            <button
              type="button"
              onClick={() => planRequestMutation.mutate({ target_plan: requestedPlan, note: requestNote })}
              disabled={planRequestMutation.isPending || requestedPlan === organization?.subscription_plan}
              className="btn-primary w-full py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {planRequestMutation.isPending ? 'Talep gönderiliyor...' : 'Paket Değişikliği Talebi Gönder'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800"><Shield size={16} className="text-primary-600" /> Abonelik Özeti</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-sky-50 p-4 text-sky-900">
              <div className="text-xs uppercase tracking-wide text-sky-700">Kullanıcı kullanımınız</div>
              <div className="mt-2 text-xl font-bold">{usage.users ?? organization?.user_count ?? 0} / {organization?.max_users ?? 0}</div>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-900">
              <div className="text-xs uppercase tracking-wide text-emerald-700">Mülk kullanımınız</div>
              <div className="mt-2 text-xl font-bold">{usage.properties ?? organization?.property_count ?? 0} / {organization?.max_properties ?? 0}</div>
            </div>
            <div className="rounded-2xl bg-amber-50 p-4 text-amber-900 sm:col-span-2">
              <div className="text-xs uppercase tracking-wide text-amber-700">Paket önerisi</div>
              <div className="mt-2 text-sm font-medium">
                {(usage.users ?? organization?.user_count ?? 0) >= (organization?.max_users ?? 0) || (usage.properties ?? organization?.property_count ?? 0) >= (organization?.max_properties ?? 0)
                  ? 'Mevcut limitleriniz sınırda. Daha yüksek paket için talep açmanız önerilir.'
                  : 'Mevcut paketiniz aktif kullanımınıza uygun görünüyor.'}
              </div>
            </div>
            <div className="rounded-2xl bg-violet-50 p-4 text-violet-900">
              <div className="text-xs uppercase tracking-wide text-violet-700">Tahmini Aylık Tutar</div>
              <div className="mt-2 text-xl font-bold">₺{estimatedMonthlyPrice.toLocaleString('tr-TR')}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-slate-900">
              <div className="text-xs uppercase tracking-wide text-slate-700">Sonraki Yenileme / Trial Sonu</div>
              <div className="mt-2 text-sm font-bold">{formatDateTime(renewalDate)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800"><CreditCard size={16} className="text-primary-600" /> Abonelik ve Fatura Geçmişi</div>
        <div className="mt-1 text-xs text-gray-500">Bu alan artık kalıcı abonelik ledger kayıtlarından besleniyor.</div>
        {isSubscriptionHistoryLoading ? (
          <div className="mt-4 text-sm text-gray-500">Geçmiş yükleniyor...</div>
        ) : (
          <div className="mt-4 space-y-3">
            {subscriptionHistory.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{entry.title || entry.event_label || entry.event_type}</div>
                    <div className="mt-1 text-xs text-gray-500">{formatActorLabel(entry)}</div>
                  </div>
                  <div className="text-xs text-gray-500">{formatDateTime(entry.created_at)}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                  <span className="rounded-full bg-white px-2 py-1">Durum: {subscriptionStatusLabels[entry.status] || entry.status || '-'}</span>
                  <span className="rounded-full bg-white px-2 py-1">Paket: {entry.subscription_plan}</span>
                  <span className="rounded-full bg-white px-2 py-1">Tutar: ₺{Number(entry.amount || 0).toLocaleString('tr-TR')}</span>
                </div>
                <div className="mt-2 text-sm text-gray-700">{entry.description}</div>
                <div className="mt-2 text-xs text-gray-500">Yenileme: {formatDateTime(entry.renewal_at)}</div>
              </div>
            ))}
            {!subscriptionHistory.length && <div className="text-sm text-gray-500">Henüz abonelik geçmişi bulunmuyor.</div>}
          </div>
        )}
      </div>

    </div>
  );
}