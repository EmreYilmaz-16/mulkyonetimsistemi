import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Building2, Users, FileText, Wallet, Grid3X3 } from 'lucide-react';

const items = [
  { to: '/',           icon: LayoutDashboard, label: 'Ana Sayfa' },
  { to: '/properties', icon: Building2,       label: 'Mülkler' },
  { to: '/tenants',    icon: Users,           label: 'Kiracılar' },
  { to: '/contracts',  icon: FileText,        label: 'Sözleşme' },
  { to: '/payments',   icon: Wallet,          label: 'Kiralar' },
  { to: '/more',       icon: Grid3X3,         label: 'Daha Fazla' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-pb">
      <div className="grid grid-cols-6 max-w-2xl mx-auto">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center py-2 px-1 text-xs transition-colors gap-0.5 ${
                isActive ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'
              }`
            }
          >
            <Icon size={20} strokeWidth={isActive => (isActive ? 2.5 : 1.8)} />
            <span className="leading-none">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
