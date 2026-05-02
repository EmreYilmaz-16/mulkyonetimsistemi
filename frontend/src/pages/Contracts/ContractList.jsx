import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, AlertTriangle, XCircle, ChevronDown, ChevronUp, Phone, Mail, TrendingUp, FileText, CalendarClock, Banknote } from 'lucide-react';
import api from '../../api/client';

const statusLabel = { active: 'Aktif', expired: 'Bitti', terminated: 'Feshedildi' };
const statusColor = { active: 'bg-green-100 text-green-700', expired: 'bg-gray-100 text-gray-500', terminated: 'bg-red-100 text-red-600' };

/** Sözleşme bitiş tarihine göre renk sınıfı döner
 *  - yeşil: 3 aydan fazla kaldı
 *  - turuncu: 1-3 ay kaldı (uyarı)
 *  - kırmızı: 1 aydan az kaldı veya geçmiş
 */
function contractEndColor(endDateStr, status) {
  if (status !== 'active') return '';
  const today = new Date();
  const end = new Date(endDateStr);
  const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
  if (diffDays > 90)  return 'border-l-4 border-green-400';
  if (diffDays > 30)  return 'border-l-4 border-orange-400';
  return 'border-l-4 border-red-400';
}

function EndDateBadge({ endDateStr, status }) {
  if (status !== 'active') return null;
  const today = new Date();
  const end = new Date(endDateStr);
  const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
  if (diffDays > 90) return null;
  if (diffDays > 30) return (
    <span className="flex items-center gap-0.5 text-xs text-orange-600 font-semibold">
      <AlertTriangle size={11} /> {diffDays} gün
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-xs text-red-600 font-semibold">
      <AlertTriangle size={11} /> {diffDays > 0 ? `${diffDays} gün` : 'SÜRESİ DOLDU'}
    </span>
  );
}

export default function ContractList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tenantIdFilter = searchParams.get('tenant_id') || '';
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [expiryFilter, setExpiryFilter] = useState(searchParams.get('expiry_filter') || '');
  const [terminatingContract, setTerminatingContract] = useState(null); // { id, deposit_amount }
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState({ termination_type: 'terminated', deposit_return_amount: '', deposit_return_date: '', termination_notes: '' });

  useEffect(() => {
    setStatusFilter(searchParams.get('status') || '');
    setExpiryFilter(searchParams.get('expiry_filter') || '');
  }, [searchParams]);

  useEffect(() => {
    const nextParams = {};
    if (tenantIdFilter) nextParams.tenant_id = tenantIdFilter;
    if (statusFilter) nextParams.status = statusFilter;
    if (expiryFilter) nextParams.expiry_filter = expiryFilter;
    setSearchParams(nextParams, { replace: true });
  }, [tenantIdFilter, statusFilter, expiryFilter, setSearchParams]);

  const { data: tenant } = useQuery({
    queryKey: ['tenant', tenantIdFilter],
    queryFn: () => api.get(`/tenants/${tenantIdFilter}`).then((r) => r.data),
    enabled: Boolean(tenantIdFilter)
  });

  const { data, isLoading } = useQuery({
    queryKey: ['contracts', tenantIdFilter, statusFilter, expiryFilter],
    queryFn: () => api.get('/contracts', {
      params: {
        tenant_id: tenantIdFilter || undefined,
        status: statusFilter || undefined,
        expiry_filter: expiryFilter || undefined,
        limit: 50
      }
    }).then((r) => r.data)
  });

  // Seçili sözleşmenin detayını getir
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['contract-detail', expandedId],
    queryFn: () => api.get(`/contracts/${expandedId}`).then((r) => r.data),
    enabled: !!expandedId
  });

  const terminateMutation = useMutation({
    mutationFn: ({ id, body }) => api.post(`/contracts/${id}/terminate`, body).then((r) => r.data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setShowModal(false);
      setTerminatingContract(null);
      if (res.damage_amount > 0) {
        alert(res.message);
      }
    }
  });

  function openTerminate(e, contract) {
    e.stopPropagation();
    setTerminatingContract({ id: contract.id, deposit_amount: Number(contract.deposit_amount) || 0 });
    setForm({ termination_type: 'terminated', deposit_return_amount: String(contract.deposit_amount || ''), deposit_return_date: '', termination_notes: '' });
    setShowModal(true);
  }

  function toggleExpand(id) {
    setExpandedId(prev => prev === id ? null : id);
  }

  function handleTerminate() {
    terminateMutation.mutate({ id: terminatingContract.id, body: form });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Sözleşmeler</h1>
          {tenant && (
            <div className="text-sm text-gray-500 mt-1">
              {tenant.first_name} {tenant.last_name} icin listeleme
            </div>
          )}
        </div>
        <button onClick={() => navigate('/contracts/new')} className="btn-primary py-2 px-3 text-sm">
          <Plus size={16} /> Ekle
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Tüm durumlar</option>
          <option value="active">Aktif</option>
          <option value="expired">Bitti</option>
          <option value="terminated">Feshedildi</option>
        </select>
        <select className="input" value={expiryFilter} onChange={(e) => setExpiryFilter(e.target.value)}>
          <option value="">Tüm bitişler</option>
          <option value="expired">Sözleşmesi bitenler</option>
          <option value="expiring_3_months">3 ay veya daha az kalanlar</option>
        </select>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Yükleniyor...</div>
      ) : (
        <div className="space-y-2">
          {data?.map((c) => (
            <div key={c.id} className={`card space-y-1 ${contractEndColor(c.end_date, c.status)}`}>
              {/* Tıklanabilir özet satır */}
              <div className="cursor-pointer" onClick={() => toggleExpand(c.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm">{c.property_name}</div>
                    <div className="text-xs text-gray-600">{c.tenant_name}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`badge ${statusColor[c.status]}`}>{statusLabel[c.status]}</span>
                    <EndDateBadge endDateStr={c.end_date} status={c.status} />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                  <span>{new Date(c.start_date).toLocaleDateString('tr-TR')} – {new Date(c.end_date).toLocaleDateString('tr-TR')}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700">₺{Number(c.monthly_rent).toLocaleString('tr-TR')}/ay</span>
                    {expandedId === c.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                  </div>
                </div>
              </div>

              {/* Genişleyen detay paneli */}
              {expandedId === c.id && (
                <div className="border-t border-gray-100 pt-3 mt-2 space-y-3">
                  {detailLoading ? (
                    <div className="text-center text-xs text-gray-400 py-2">Yükleniyor...</div>
                  ) : detail ? (
                    <>
                      {/* Kiracı bilgileri */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Kiracı</p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <Phone size={13} className="text-gray-400" />
                            <a href={`tel:${detail.tenant_phone}`} className="text-blue-600">{detail.tenant_phone}</a>
                          </div>
                          {detail.tenant_email && (
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <Mail size={13} className="text-gray-400" />
                              <a href={`mailto:${detail.tenant_email}`} className="text-blue-600">{detail.tenant_email}</a>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Finansal detaylar */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Finansal</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-xs text-gray-500">Aylık Kira</p>
                            <p className="text-sm font-bold text-gray-800">₺{Number(detail.monthly_rent).toLocaleString('tr-TR')}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-xs text-gray-500">Depozito</p>
                            <p className="text-sm font-bold text-gray-800">₺{Number(detail.deposit_amount).toLocaleString('tr-TR')}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-xs text-gray-500">Ödeme Günü</p>
                            <p className="text-sm font-bold text-gray-800">Her ayın {detail.payment_day || 1}'i</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-xs text-gray-500">Artış Tipi</p>
                            <p className="text-sm font-semibold text-gray-800 capitalize">{detail.increase_type || '—'}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-xs text-gray-500">Artış Oranı</p>
                            <p className="text-sm font-semibold text-gray-800">{detail.increase_rate ? `%${detail.increase_rate}` : '—'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Depozito iade durumu */}
                      {detail.status !== 'active' && (
                        <div className="bg-gray-50 rounded-lg p-2 space-y-1">
                          <p className="text-xs text-gray-500 mb-1">Depozito İadesi</p>
                          {detail.deposit_returned ? (
                            <p className="text-xs text-green-600 font-semibold">
                              ✓ Tam iade {detail.deposit_return_date ? `— ${new Date(detail.deposit_return_date).toLocaleDateString('tr-TR')}` : ''}
                            </p>
                          ) : Number(detail.deposit_return_amount) > 0 ? (
                            <div>
                              <p className="text-xs text-yellow-600 font-semibold">
                                ↩ Kısmi iade — ₺{Number(detail.deposit_return_amount).toLocaleString('tr-TR')} iade edildi
                                {detail.deposit_return_date ? ` (${new Date(detail.deposit_return_date).toLocaleDateString('tr-TR')})` : ''}
                              </p>
                              <p className="text-xs text-red-500 font-semibold">
                                ⚠ ₺{(Number(detail.deposit_amount) - Number(detail.deposit_return_amount)).toLocaleString('tr-TR')} hasar tazminatı gelir kaydedildi
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-red-500 font-semibold">
                              ⚠ İade edilmedi — ₺{Number(detail.deposit_amount).toLocaleString('tr-TR')} hasar tazminatı gelir kaydedildi
                            </p>
                          )}
                        </div>
                      )}

                      {/* Özel şartlar */}
                      {detail.special_terms && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Özel Şartlar</p>
                          <p className="text-xs text-gray-700 bg-gray-50 rounded-lg p-2">{detail.special_terms}</p>
                        </div>
                      )}

                      {/* Tahliye tarihi */}
                      {detail.eviction_date && (
                        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg p-2">
                          <CalendarClock size={13} />
                          <span>Tahliye tarihi: {new Date(detail.eviction_date).toLocaleDateString('tr-TR')}</span>
                        </div>
                      )}

                      {/* Son ödemeler */}
                      {detail.payments?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Son Ödemeler</p>
                          <div className="space-y-1">
                            {detail.payments.slice(0, 4).map((p) => (
                              <div key={p.id} className="flex items-center justify-between text-xs">
                                <span className="text-gray-600">{new Date(p.due_date).toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' })}</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-700">₺{Number(p.amount).toLocaleString('tr-TR')}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${p.status === 'paid' ? 'bg-green-100 text-green-700' : p.status === 'overdue' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'}`}>
                                    {p.status === 'paid' ? 'Ödendi' : p.status === 'overdue' ? 'Gecikti' : 'Bekliyor'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sonlandırma notu */}
                      {detail.termination_notes && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Sonlandırma Notu</p>
                          <p className="text-xs text-gray-700 bg-gray-50 rounded-lg p-2">{detail.termination_notes}</p>
                        </div>
                      )}
                    </>
                  ) : null}

                  {/* Aksiyonlar */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => navigate(`/contracts/edit/${c.id}`)}
                      className="flex-1 text-xs border border-gray-300 rounded-lg py-2 text-gray-600 hover:bg-gray-50"
                    >
                      Düzenle
                    </button>
                    {c.status === 'active' && (
                      <button
                        onClick={(e) => openTerminate(e, c)}
                        className="flex-1 flex items-center justify-center gap-1 text-xs bg-red-50 border border-red-200 rounded-lg py-2 text-red-500"
                      >
                        <XCircle size={13} /> Sonlandır
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {!data?.length && <div className="text-center py-8 text-gray-400">Sözleşme bulunamadı</div>}
        </div>
      )}

      {/* Sonlandırma Modalı */}
      {showModal && terminatingContract && (() => {
        const totalDeposit = terminatingContract.deposit_amount;
        const returnVal    = form.deposit_return_amount === '' ? totalDeposit : Number(form.deposit_return_amount);
        const damageVal    = Math.max(0, totalDeposit - returnVal);
        return (
          <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setShowModal(false)}>
            <div className="bg-white w-full max-w-md rounded-t-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-base font-bold text-gray-800">Sözleşmeyi Sonlandır</h2>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Sonlandırma Türü</label>
                  <select
                    className="input text-sm w-full"
                    value={form.termination_type}
                    onChange={(e) => setForm({ ...form, termination_type: e.target.value })}
                  >
                    <option value="terminated">Fesih (erken)</option>
                    <option value="expired">Doğal Sona Erme</option>
                  </select>
                </div>

                {/* Depozito iade tutarı */}
                {totalDeposit > 0 && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">
                      İade Edilen Depozito <span className="text-gray-400">(toplam: ₺{totalDeposit.toLocaleString('tr-TR')})</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={totalDeposit}
                      step="0.01"
                      className="input text-sm w-full"
                      placeholder={`₺${totalDeposit.toLocaleString('tr-TR')} (tam iade)`}
                      value={form.deposit_return_amount}
                      onChange={(e) => setForm({ ...form, deposit_return_amount: e.target.value })}
                    />
                    {damageVal > 0 ? (
                      <p className="text-xs text-red-500 mt-1 font-semibold">
                        ⚠ Hasar/eksiklik tazminatı: ₺{damageVal.toLocaleString('tr-TR')} → gelir olarak kaydedilecek
                      </p>
                    ) : (
                      <p className="text-xs text-green-600 mt-1">✓ Tam iade — gelir kaydı oluşturulmayacak</p>
                    )}
                  </div>
                )}

                {/* İade tarihi — sadece tam veya kısmi iade varsa göster */}
                {totalDeposit > 0 && returnVal > 0 && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">İade Tarihi</label>
                    <input
                      type="date"
                      className="input text-sm w-full"
                      value={form.deposit_return_date}
                      onChange={(e) => setForm({ ...form, deposit_return_date: e.target.value })}
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Notlar</label>
                  <textarea
                    className="input text-sm w-full"
                    rows={2}
                    placeholder="İsteğe bağlı açıklama..."
                    value={form.termination_notes}
                    onChange={(e) => setForm({ ...form, termination_notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-600">
                  İptal
                </button>
                <button
                  onClick={handleTerminate}
                  disabled={terminateMutation.isPending}
                  className="flex-1 bg-red-500 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {terminateMutation.isPending ? 'İşleniyor...' : 'Sonlandır'}
                </button>
              </div>
              {terminateMutation.isError && (
                <p className="text-xs text-red-500 text-center">{terminateMutation.error?.message || 'Hata oluştu'}</p>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
