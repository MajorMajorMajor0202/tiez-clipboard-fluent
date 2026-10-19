export interface SettingsWindowPresentation {
  applyTheme: () => Promise<unknown>;
  paint: () => Promise<void>;
  show: () => Promise<void>;
  focus: () => Promise<void>;
  hideMain: () => Promise<unknown>;
  cancelled?: () => boolean;
}

export async function presentSettingsWindow(steps: SettingsWindowPresentation) {
  await steps.applyTheme();
  await steps.paint();
  if (steps.cancelled?.()) return;
  await steps.show();
  await steps.hideMain();
  await steps.focus();
}

export function waitForSettingsPaint(): Promise<void> {
  // Hidden WebViews may suspend animation frames. Do not wait on rAF forever.
  return new Promise((resolve) => {
    let frame = 0;
    const finish = () => { clearTimeout(timeout); cancelAnimationFrame(frame); resolve(); };
    const timeout = setTimeout(finish, 100);
    frame = requestAnimationFrame(() => { frame = requestAnimationFrame(finish); });
  });
}
