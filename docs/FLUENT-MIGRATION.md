# Fluent UI React migration, first batch

The pre-migration UI is committed and pushed as `5628aa6` on `origin/dev`.
Migration work is isolated on `codex/fluent-components`.

Further UI component migration is deferred at the user's request. Remaining
controls are a future task; current work focuses on local data reliability and
settings-window startup.

## Scope

- `TieZFluentProvider` bridges the existing light/dark classes and CSS variables to
  Fluent UI React v9 tokens in each window. Its root uses `display: contents` so it
  does not paint an opaque surface over native Mica/Acrylic. Existing direct-child
  stacking rules also cover the provider's children.
- `FluentDropdown` keeps its existing application API and compact visual classes;
  official Dropdown/Option components own selection, keyboard navigation, Escape,
  and portal positioning. Portals use a viewport-sized fixed layer with pointer
  passthrough to work with the desktop shell's clipped body. The old
  selected-row-over-trigger placement is replaced
  by Fluent's collision-aware popup placement. The popup keeps a short scale-in.
- `FluentTooltip` delegates hover/focus, ARIA description, Escape and positioning
  to the official Tooltip. A wrapper retains hover support for disabled buttons.
- `FluentSearchInput` uses the official Input with native input ref/events. The
  homepage retains its existing IME and tag suggestions. Its outer wrapper keeps
  the exact 250 ms `cubic-bezier(0.1, 0.9, 0.2, 1)` center-out underline; the
  official inner underline is suppressed to avoid two focus indicators.
- Reduced-motion preferences suppress the migrated popup/focus animations.

Other search fields, buttons, number boxes, dialogs, scrollbars, draggable tabs,
desktop note/sticker shells and native window operations remain as before.

## Validation

```powershell
npm run build
npx vitest run --pool=threads
npm run test:components
```

The browser checks use Playwright's Chromium by default. Where only installed
Edge is available:

```powershell
$env:PLAYWRIGHT_EXECUTABLE_PATH = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
npm run test:components
```

The browser runner starts and closes its own local Vite server. It covers native
ref forwarding, controlled search updates, IME events, focus underline easing,
mouse and keyboard dropdown selection, Escape, keyboard/disabled tooltips, dark
portal surfaces, narrow-window overflow and reduced motion. Fixtures are test
pages only and are not production build entry points. Screenshots are written to
the ignored `artifacts/fluent-components/` directory.

Native Tauri focus restoration, OS-level drag/drop, DPI changes, native material
compositing and multi-window memory still need desktop verification. Browser
checks do not establish these properties.

## Build comparison

The initial measured production JS grew from about 1,449.93 kB (gzip 432.86 kB)
to about 1,645.94 kB (gzip 492.48 kB) after adding the first primitives. These are bundle
sizes, not RAM measurements. The existing single main bundle and its large-chunk
warning remain; loading more components should be accompanied by an entry/chunk
strategy and real process-tree measurements.

Both repository lockfiles are updated. The previously stale npm lockfile also
now includes the Milkdown dependencies already present in package.json; pnpm was
used to install the migration. The existing React 19 peer warning from
`use-resize-observer` is unrelated to the new Fluent dependency.
