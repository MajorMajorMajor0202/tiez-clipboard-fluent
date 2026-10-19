# Fluent UI React migration

The pre-migration UI is committed and pushed as `5628aa6` on `origin/dev`.
Migration work is isolated on `codex/fluent-components`.

Component migration resumed on 2026-10-19. Local data fixes remain in their
separate commit `594e82d`.

## Scope

- `TieZFluentProvider` bridges the existing light/dark classes and CSS variables to
  Fluent UI React v9 tokens in each window. Its root uses `display: contents` so it
  does not paint an opaque surface over native Mica/Acrylic. Existing direct-child
  stacking rules also cover the provider's children.
- `FluentDropdown` keeps its existing application API and compact visual classes;
  official Dropdown/Option components own selection, keyboard navigation, Escape,
  and portal positioning. Portals use a viewport-sized fixed layer with pointer
  passthrough to work with the desktop shell's clipped body. Selected rows align
  over their trigger, matching Tag Manager's sort flyout; official positioning
  shifts the popup inside the viewport when alignment would overflow.
- `FluentTooltip` delegates hover/focus, ARIA description, Escape and positioning
  to the official Tooltip. A wrapper retains hover support for disabled buttons.
- `FluentSearchInput` uses the official Input with native input ref/events. The
  homepage retains its existing IME and tag suggestions. Its outer wrapper keeps
  the exact 250 ms `cubic-bezier(0.1, 0.9, 0.2, 1)` center-out underline; the
  official inner underline is suppressed to avoid two focus indicators.
- Reduced-motion preferences suppress the migrated popup/focus animations.

## Second batch

- 39 switch call sites (including AI and per-app settings), five sliders and the
  settings checkbox use official Switch/Slider/Checkbox primitives. Controls link
  to visible card titles, keep native change events and use the current accent.
- Shared buttons use official Button, preserve variants/loading/disabled state,
  and register restore-focus targets for dialogs opened without DialogTrigger.
  Standard settings action buttons use this adapter too.
- Shared FluentModal/ConfirmDialog use Dialog/DialogSurface/DialogTitle. Fluent
  owns focus trapping, Escape and backdrop dismissal. Existing per-dialog close
  policies, layout and animations remain. Nested native blur guards are counted;
  settings dialogs focus their own window instead of activating the main window.
- NumberBox uses SpinButton for draft editing, commit/clamping, arrows and repeat
  buttons. It keeps compact sizing and a center-out focus underline.
- 19 settings expander templates use controlled Accordion primitives, including
  global/per-app cleanup policies. Row switches/actions sit outside the heading
  button, so disabling expansion never disables the switch that enables it.
- Dropdown styling/32px rows/neutral selected background/accent bar match the
  existing Tag Manager sort flyout. It retains the selected-row-over-trigger
  placement and adds viewport fitting; official keyboard selection remains.
- History keyboard capture and native navigation events yield to focused
  interactive controls. Focusing a control exits history navigation mode.
- Removed obsolete hand-written switch, range and NumberBox CSS.

Specialized hotkey capture/app-picker/update dialog shells, app-search pickers,
other text fields, scrollbars, draggable tabs and desktop note/sticker shells
retain their custom behavior. Migrating their special interactions is separate
from replacing the shared primitives.

## Accent and settings startup follow-up

The blue hover came from fixed `--accent-hover` values in Mica/Acrylic, Acrylic
redeclaring accent variables on body, and unbridged Fluent brand interaction
tokens. Hover/pressed/tinted brand states now derive from the current accent;
neutral contrast and forced-color behavior remain. Theme card/scrollbar/shadow
accent effects also use the accent RGB variable instead of a fixed blue.

Settings HTML supplies an opaque light/dark background before React loads. That
fallback overrides the settings layers' explicit transparent styles. The window
shows after initialization, retains the fallback through a 150ms DWM settling
period, reapplies material while visible, then releases the fallback after paint.
Settings material errors propagate from Rust and keep the usable solid fallback.
The original center-out search underline remains unchanged.

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
portal surfaces, selected-row alignment, narrow-window overflow, reduced motion,
switch Space/labels/non-blue hover in both modes, slider pointer/keys, SpinButton
bounds, accordion keys/disabled row actions, loading buttons, dialog Tab trapping,
nested Escape, focus restoration, close policies and pre-React opaque settings
paint (also after the real transparent theme styles are applied). Fixtures are test
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

The second batch measured JS at about 1,793.68 kB (gzip 530.88 kB), versus
1,649.22 kB (gzip 493.91 kB) after the local-data fixes. These are build sizes;
no claim about native resident RAM follows from them. Windows DWM first-frame
behavior and native focus still require desktop verification.

## Dropdown positioning follow-up

The popup's scale-in keyframes and Fluent's default transform-based positioning
were both writing `transform`, leaving visible animation frames near (0, 0).
Positioning now uses top/left and the popup remains hidden until positioning ends.
Closing/selection clears readiness, and late positioning callbacks cannot reveal
a closed popup. Stable positioning options avoid unnecessary manager resets.

Triggers default to a fixed 160px (explicit caller widths still work); flyouts
use trigger width plus 8px for the surrounding frame, bounded by the viewport.
Option labels truncate with ellipsis instead of changing either width. Browser
regression tests sample every visible frame during opening/selection/closing,
and compare trigger/flyout dimensions before and after choosing a long label.
