import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import api from '../../api/client';

const statusLabel = { available: 'Boş', rented: 'Kiralık', maintenance: 'Tadilatta', for_sale: 'Satılık' };
const statusColor = {
  available: 'bg-green-100 text-green-700',
  rented: 'bg-blue-100 text-blue-700',
  maintenance: 'bg-orange-100 text-orange-700',
  for_sale: 'bg-purple-100 text-purple-700'
};
const typeLabel = { residential: 'Konut', commercial: 'Ticari', parking: 'Otopark', other: 'Diğer' };
const badgeClassName = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:brightness-95';
const inactiveBadgeClassName = 'bg-slate-100 text-slate-700';

export default function PropertyList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || '';
  const type = searchParams.get('type') || '';
  const search = searchParams.get('search') || '';
  const siteName = searchParams.get('site_name') || '';

  const { data, isLoading } = useQuery({
    queryKey: ['properties', search, status, siteName, type],
    queryFn: () => api.get('/properties', {
      params: {
        search: search || undefined,
        status: status || undefined,
        site_name: siteName || undefined,
        type: type || undefined,
        limit: 50
      }
    }).then((r) => r.data)
  });

  const { data: summary } = useQuery({
    queryKey: ['property-summary-dashboard'],
    queryFn: () => api.get('/reports/dashboard').then((r) => r.data.properties)
  });

  const setPropertyFilters = (nextValues) => {
    const nextParams = new URLSearchParams(searchParams);

    Object.entries(nextValues).forEach(([key, value]) => {
      if (value) {
        nextParams.set(key, value);
      } else {
        nextParams.delete(key);
      }
    });

    setSearchParams(nextParams, { replace: true });
  };

  const toggleStatus = (nextStatus) => {
    setPropertyFilters({ status: status === nextStatus ? '' : nextStatus });
  };

  const toggleType = (nextType) => {
    setPropertyFilters({ type: type === nextType ? '' : nextType });
  };

  const clearSummaryFilters = () => setPropertyFilters({ status: '', type: '', search: '', site_name: '' });

  const activeFilterLabel = statusLabel[status] || typeLabel[type] || '';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Mülkler</h1>
        <button onClick={() => navigate('/properties/new')} className="btn-primary py-2 px-3 text-sm">
          <Plus size={16} /> Ekle
        </button>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs text-gray-500">Mülk Özeti</div>
            <div className="text-2xl font-bold text-gray-900">{summary?.total ?? 0}</div>
          </div>
          {(status || type || search || siteName) && (
            <button
              type="button"
              onClick={clearSummaryFilters}
              className="text-xs font-medium text-primary-600"
            >
              Temizle
            </button>
          )}
        </div>

        {activeFilterLabel && (
          <div className="text-xs text-gray-500">
            Aktif filtre: <span className="font-medium text-gray-800">{activeFilterLabel}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => toggleStatus('rented')} className={`${badgeClassName} justify-start ${status === 'rented' ? 'bg-green-100 text-green-700 ring-1 ring-green-300' : inactiveBadgeClassName}`}>
            {summary?.rented ?? 0} kiralık
          </button>
          <button type="button" onClick={() => toggleStatus('available')} className={`${badgeClassName} justify-start ${status === 'available' ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300' : inactiveBadgeClassName}`}>
            {summary?.available ?? 0} boş
          </button>
          <button type="button" onClick={() => toggleStatus('for_sale')} className={`${badgeClassName} justify-start ${status === 'for_sale' ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-300' : inactiveBadgeClassName}`}>
            {summary?.for_sale ?? 0} satılık
          </button>
          <button type="button" onClick={() => toggleStatus('maintenance')} className={`${badgeClassName} justify-start ${status === 'maintenance' ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-300' : inactiveBadgeClassName}`}>
            {summary?.maintenance ?? 0} tadilatta
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
          <button type="button" onClick={() => toggleType('residential')} className={`${badgeClassName} justify-start ${type === 'residential' ? 'bg-slate-800 text-white ring-1 ring-slate-500' : inactiveBadgeClassName}`}>
            {summary?.residential ?? 0} konut
          </button>
          <button type="button" onClick={() => toggleType('commercial')} className={`${badgeClassName} justify-start ${type === 'commercial' ? 'bg-slate-800 text-white ring-1 ring-slate-500' : inactiveBadgeClassName}`}>
            {summary?.commercial ?? 0} ticari
          </button>
          <button type="button" onClick={() => toggleType('parking')} className={`${badgeClassName} justify-start ${type === 'parking' ? 'bg-slate-800 text-white ring-1 ring-slate-500' : inactiveBadgeClassName}`}>
            {summary?.parking ?? 0} otopark
          </button>
          <button type="button" onClick={() => toggleType('other')} className={`${badgeClassName} justify-start ${type === 'other' ? 'bg-slate-800 text-white ring-1 ring-slate-500' : inactiveBadgeClassName}`}>
            {summary?.other ?? 0} diğer
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Yükleniyor...</div>
      ) : (
        <div className="space-y-2">
          {data?.map((p) => (
            <div
              key={p.id}
              className="card cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/properties/${p.id}/edit`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{p.name}</div>
                  {(p.site_name || p.city_name || p.district_name || p.building_name) && (
                    <div className="text-xs text-gray-500">
                      {[p.site_name, p.city_name, p.district_name, p.building_name].filter(Boolean).join(' / ')}
                    </div>
                  )}
                  {p.tenant_name && (
                    <div className="text-xs text-primary-600 mt-0.5">{p.tenant_name}</div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`badge ${statusColor[p.status]}`}>{statusLabel[p.status]}</span>
                  {p.monthly_rent && (
                    <span className="text-xs font-medium text-gray-700">
                      ₺{Number(p.monthly_rent).toLocaleString('tr-TR')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!data?.length && <div className="text-center py-8 text-gray-400">Mülk bulunamadı</div>}
        </div>
      )}
    </div>
  );
}
