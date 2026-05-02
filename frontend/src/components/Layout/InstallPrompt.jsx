import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShowBanner(false);
    setDeferredPrompt(null);
  };

  if (!showBanner) return null;

  return (
    <div className="bg-primary-800 text-white px-4 py-2 flex items-center justify-between gap-2 text-sm">
      <span className="flex-1">Uygulamayı cihazına yükle</span>
      <button
        onClick={handleInstall}
        className="flex items-center gap-1.5 bg-white text-primary-700 font-semibold px-3 py-1 rounded-lg text-xs"
      >
        <Download size={14} />
        Yükle
      </button>
      <button onClick={() => setShowBanner(false)} className="p-1 opacity-70 hover:opacity-100">
        <X size={16} />
      </button>
    </div>
  );
}
