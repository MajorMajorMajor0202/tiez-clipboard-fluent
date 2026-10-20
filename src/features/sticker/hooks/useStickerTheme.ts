import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { applyThemeClasses } from '../../../shared/config/themes';

export function useStickerTheme() {
  useEffect(() => {
    let disposed = false;
    let revision = 0;
    let settings: Record<string, string> = {};
    let settingsLoaded = false;
    let lastNativeAppearance = '';
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (systemDark = media.matches) => {
      if (disposed) return;
      const mode = settingsLoaded ? settings['app.sticker_backdrop_mode'] || 'sync' : localStorage.getItem('tiez_sticker_backdrop_mode') || 'sync';
      const mainTheme = settingsLoaded ? settings['app.theme'] || 'mica' : localStorage.getItem('tiez_theme') || 'mica';
      const theme = (mode === 'sync' ? mainTheme : mode) === 'acrylic' ? 'acrylic' : 'mica';
      const colorMode = settingsLoaded ? settings['app.color_mode'] || 'system' : localStorage.getItem('tiez_color_mode') || 'system';
      const dark = colorMode === 'dark' || (colorMode !== 'light' && systemDark);
      for (const target of [document.documentElement, document.body]) {
        target.classList.toggle('dark-mode', dark);
        target.classList.toggle('light-mode', !dark);
      }
      applyThemeClasses(theme, document.documentElement, document.body);
      const appearance = `${theme}:${dark}`;
      if (appearance === lastNativeAppearance) return;
      lastNativeAppearance = appearance;
      const currentRevision = ++revision;
      void invoke('set_sticker_backdrop', { theme, colorMode: dark ? 'dark' : 'light' }).then(() => {
        if (!disposed && currentRevision === revision) document.documentElement.dataset.stickerNativeBackdrop = 'true';
      }).catch(() => {
        if (!disposed && currentRevision === revision) { lastNativeAppearance = ''; delete document.documentElement.dataset.stickerNativeBackdrop; }
      });
    };
    let loadRevision = 0;
    const load = async () => {
      const requested = ++loadRevision;
      try {
        const result = await invoke<Record<string, string>>('get_settings');
        if (!disposed && requested === loadRevision) { settings = result; settingsLoaded = true; apply(); }
      } catch { if (!disposed && requested === loadRevision) apply(); }
    };
    apply();
    const subscriptions = [listen('settings-changed', load), listen<string>('system-theme-changed', event => apply(event.payload === 'dark'))];
    void Promise.all(subscriptions).then(load).catch(console.error);
    const update = () => apply();
    media.addEventListener('change', update);
    window.addEventListener('storage', load);
    return () => {
      disposed = true;
      media.removeEventListener('change', update);
      window.removeEventListener('storage', load);
      subscriptions.forEach(subscription => { void subscription.then(off => off()).catch(console.error); });
      delete document.documentElement.dataset.stickerNativeBackdrop;
    };
  }, []);
}
