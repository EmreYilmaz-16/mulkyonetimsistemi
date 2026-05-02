import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  Wallet, Wrench, ReceiptText, BarChart3,
  TrendingUp, Scale, LineChart, FileCheck2, BadgeDollarSign, Building2
} from 'lucide-react';

const menuItems = [
  { to: '/payments',       icon: Wallet,         label: 'Kiralar',          bg: 'bg-blue-50',   text: 'text-blue-600' },
  { to: '/income',         icon: BadgeDollarSign, label: 'Gelirler',        bg: 'bg-emerald-50', text: 'text-emerald-600' },
  { to: '/maintenance',    icon: Wrench,       label: 'Bakım/Arıza',     bg: 'bg-orange-50', text: 'text-orange-600' },
  { to: '/expenses',       icon: ReceiptText,  label: 'Giderler',        bg: 'bg-red-50',    text: 'text-red-600' },
  { to: '/reports',        icon: BarChart3,    label: 'Raporlar',        bg: 'bg-purple-50', text: 'text-purple-600' },
  { to: '/monthly-report', icon: TrendingUp,   label: 'Gelir-Gider',     bg: 'bg-green-50',  text: 'text-green-600' },
  { to: '/lawyers',        icon: Scale,        label: 'Avukat Takip',    bg: 'bg-indigo-50', text: 'text-indigo-600' },
  { to: '/market-prices',  icon: LineChart,    label: 'Fiyat Takibi',    bg: 'bg-teal-50',   text: 'text-teal-600' },
  { to: '/taxes',          icon: FileCheck2,   label: 'Vergi/Beyanname', bg: 'bg-amber-50',  text: 'text-amber-600' },
];

export default function MoreMenu() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isOrganizationPageVisible = user?.role === 'admin' || user?.role === 'platform_admin';
  const visibleItems = isOrganizationPageVisible
    ? [
        ...menuItems,
        {
          to: user?.role === 'platform_admin' ? '/organizations' : '/organization',
          icon: Building2,
          label: user?.role === 'platform_admin' ? 'Organizasyonlar' : 'Organizasyonum',
          bg: 'bg-slate-50',
          text: 'text-slate-700'
        }
      ]
    : menuItems;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Daha Fazla</h1>
      <div className="grid grid-cols-2 gap-3">
        {visibleItems.map(({ to, icon: Icon, label, bg, text }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="card flex flex-col items-center justify-center gap-2 py-5 active:scale-95 transition-transform"
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${bg} ${text}`}>
              <Icon size={24} />
            </div>
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
