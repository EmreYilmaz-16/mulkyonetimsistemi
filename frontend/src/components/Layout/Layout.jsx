import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import TopBar from './TopBar';
import InstallPrompt from './InstallPrompt';

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen">
      <TopBar />
      <InstallPrompt />
      <main className="flex-1 pb-20 px-4 pt-4 max-w-2xl mx-auto w-full">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
