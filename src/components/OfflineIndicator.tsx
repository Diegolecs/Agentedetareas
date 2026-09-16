import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-50 flex items-center gap-2.5 rounded-xl bg-amber-500/95 text-slate-950 px-4 py-2.5 text-xs font-semibold shadow-xl border border-amber-400/50 backdrop-blur-md animate-bounce">
      <WifiOff className="w-4 h-4 shrink-0 text-slate-900" />
      <span>Modo sin conexión — Los datos locales están activos.</span>
    </div>
  );
};
