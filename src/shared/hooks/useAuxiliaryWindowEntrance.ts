import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import '../../styles/components/auxiliary-window-entrance.css';

// Windows are created hidden, then shown once content (or a readable error) is ready.
export function useAuxiliaryWindowEntrance(ready: boolean) {
  const [phase, setPhase] = useState<'pending' | 'entering' | 'ready'>('pending');
  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void getCurrentWindow().show().then(() => {
      if (disposed) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPhase('ready');
      else { setPhase('entering'); timer = setTimeout(() => setPhase('ready'), 180); }
      void getCurrentWindow().setFocus().catch(console.error);
    }).catch(error => { console.error('Failed to show auxiliary window', error); if (!disposed) setPhase('ready'); });
    return () => { disposed = true; clearTimeout(timer); };
  }, [ready]);
  return phase;
}
