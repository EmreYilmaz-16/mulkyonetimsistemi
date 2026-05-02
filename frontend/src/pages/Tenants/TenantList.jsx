import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Phone } from 'lucide-react';
import { useState } from 'react';
import api from '../../api/client';

export default function TenantList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['tenants', search],
    queryFn: () => api.get('/tenants', { params: { search: search || undefined, limit: 50 } }).then((r) => r.data)
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Kiracılar</h1>
        <button onClick={() => navigate('/tenants/new')} className="btn-primary py-2 px-3 text-sm">
          <Plus size={16} /> Ekle
        </button>
      </div>

      <input
        className="input"
        placeholder="İsim, telefon veya e-posta ara..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Yükleniyor...</div>
      ) : (
        <div className="space-y-2">
          {data?.map((t) => (
            <div
              key={t.id}
              className="card flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/tenants/${t.id}/edit`)}
            >
              <div>
                <div className="font-semibold text-sm">{t.first_name} {t.last_name}</div>
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                  <Phone size={11} /> {t.phone}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`badge ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {t.is_active ? 'Aktif' : 'Pasif'}
                </span>
                <span className={`badge ${Number(t.active_contract_count) > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                  {Number(t.active_contract_count) || 0} Sözleşme
                </span>
              </div>
            </div>
          ))}
          {!data?.length && <div className="text-center py-8 text-gray-400">Kiracı bulunamadı</div>}
        </div>
      )}
    </div>
  );
}
