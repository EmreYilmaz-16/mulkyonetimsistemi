import { useAuthStore } from '../../store/authStore';
import { LogOut, Building2 } from 'lucide-react';

export default function TopBar() {
  const { user, logout } = useAuthStore();
  return (
    <header className="bg-primary-700 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow">
      <div className="flex items-center gap-2">
        <Building2 size={22} />
        <span className="font-bold text-base">Mulk Yonetim Sistemi</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs opacity-80 hidden sm:inline">{user?.name}</span>
        <button
          onClick={logout}
          className="p-1.5 rounded-lg hover:bg-primary-600 transition-colors"
          aria-label="Çıkış"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
