# My Workout - Project Documentation

## Purpose and product principles

My Workout is a mobile-first personal gym workout tracker delivered as a Progressive Web App (PWA). It is optimized for use during a real gym session: all exercises in a routine remain available, exercises can be completed in any order, and weights, reps, machines, notes, variants, and completion state can be edited directly.

The client intentionally remains a single `index.html` file containing its HTML, CSS, and JavaScript. Server-side concerns, deployment helpers, PWA files, and generated icons live in separate files. There is no client framework or package-manager build dependency.

Important design rules:

- Do not force a linear exercise sequence. Equipment may be occupied, so the user must be able to jump between exercises.
- Exercise and set editing is dense and spreadsheet-like rather than wizard-based.
- Completion is explicit: individual sets and whole exercises can be marked done or undone.
- A session with no completed sets is discarded when ended. A session with completed sets requires confirmation before being written to history.
- Active workout data is treated as valuable. It is saved periodically and when the page is backgrounded or closed.
- The app starts from local data immediately and performs network synchronization in the background.
- English and Hebrew are supported. Hebrew switches the document to RTL and uses translated labels and exercise names.

## Repository structure

| Path | Purpose |
|---|---|
| `index.html` | Entire client application: markup, styles, state, local persistence, UI logic, authentication client, synchronization client, migrations, reports, and PDF export. |
| `api/auth.js` | Vercel Edge Function for email/password registration and login, Google ID-token exchange, and long-lived session creation in Turso. |
| `api/sync.js` | Vercel Edge Function for authenticated loading and saving of the user's application data in Turso. |
| `api/img-proxy.js` | Restricted image proxy used by PDF export to fetch `fitnessprogramer.com` images without canvas CORS failures. |
| `build.js` | Vercel build script. Injects deployment/cache versions and generates the two PWA icons with Node.js only. |
| `sw.js` | Service worker for app-shell caching and cache refresh on every deployment. |
| `manifest.json` | PWA metadata, portrait standalone display, theme colors, and icons. |
| `icon-192.png`, `icon-512.png` | Generated install icons. |
| `vercel.json` | Runs `node build.js` and serves the repository root as the output directory. |
| `.gitignore` | Excludes `.vercel` and local environment files matching `.env*.local`. |

Local development can serve the repository root with any static HTTP server. Opening `index.html` directly is sufficient for much of the UI, but authentication, sync, image proxying, service worker behavior, and Vercel API routes require an HTTP/Vercel-like environment.

## Runtime architecture

The browser client is a vanilla HTML/CSS/JavaScript application. Screens are top-level `.screen` elements; navigation removes `active` from all screens and activates the requested screen. Most rendering uses template strings and direct DOM updates.

The runtime has three data layers:

1. In-memory UI state, primarily `S`, plus screen-specific state for the calendar, builder, progress editor, timer, and dialogs.
2. `localStorage`, which is the immediate working copy and offline cache.
3. Turso, accessed only through authenticated Vercel Edge Functions, which provides cross-device persistence.

The main boot path is intentionally local-first:

1. Validate or obtain an authentication session.
2. Load the active program and local settings.
3. Run isolated, one-time data migrations and repairs.
4. Render the home screen without waiting for the network.
5. Load remote Turso data in the background, merge eligible data, refresh the home screen if needed, and upload the resulting local state.

Each startup migration is wrapped independently so one malformed legacy record does not prevent the app from opening.

## Screens

| Screen ID | Purpose |
|---|---|
| `screen-auth` | Email/password sign-in or registration and Google sign-in. |
| `screen-home` | Current program summary, routines A/B, selected workout days, locker values, last-session information, time-based greeting, and entry points to the app. |
| `screen-workout` | Active or view-only routine, exercise cards, set entry, progress bar, exercise variants, rest controls, and session completion. |
| `screen-done` | Summary after a completed workout, including duration and completed work. |
| `screen-preview` | Generated progressive-overload report preview. |
| `screen-progress` | Exercise progress, history-derived charts, last increases, variant selection, retired exercises, and corrections/exclusions. |
| `screen-library` | Searchable exercise library with muscle filtering, body diagram, exercise details, and images. |
| `screen-history` | Calendar-based workout history, current-week summary, session details, editing, and deletion with Undo. |
| `screen-settings` | Language, rest-timer behavior, account information, sync/change-device controls, and update controls. |
| `screen-programs` | Active program, editable draft, archived programs, restore/delete actions, and PDF export. |
| `screen-builder` | Program/routine editor for exercise selection, ordering, set count, key-exercise flags, substitutions, and variants. |

Some dialogs and sheets, including exercise pickers, reports, image lightboxes, PDF options, and confirmations, are overlays rather than separate screens.

## Authentication

Authentication is required for normal application startup and supports:

- Email/password registration and login through `POST /api/auth`.
- Google Identity Services sign-in. The Google ID token is exchanged through `/api/auth` for the same long-lived server session format used by email/password accounts.

`api/auth.js` runs as a Vercel Edge Function and creates its Turso tables idempotently:

- `mw_users`: email/password users, salted PBKDF2-SHA-256 password hashes, and creation time.
- `mw_sessions`: opaque session tokens, user IDs, and expiry timestamps.

Passwords must be at least six characters. Email addresses are normalized to lowercase. Password hashes use a random salt, 100,000 PBKDF2 iterations, SHA-256, and a 256-bit result. Session tokens are random 32-byte hex strings and expire after one year.

Google users receive IDs prefixed with `g-`; email/password users receive IDs prefixed with `ep-`. The browser stores the current token in `mw_gtoken`, the displayed user record in `mw_guser`, and the user ID in `mwUserId`. Signing out removes the token and displayed user record. Authentication secrets and Turso credentials are not stored in the repository.

Required Vercel environment variables:

- `TURSO_URL`
- `TURSO_TOKEN`

The Google client ID is currently embedded in `index.html`; server-side Google token validation is performed against Google's token-info endpoint.

## Turso synchronization

`api/sync.js` stores one JSON document per authenticated user in the `user_data` table:

```text
user_data(user_id PRIMARY KEY, email, data, updated_at)
```

The synchronized document contains:

```javascript
{
  workouts:       get(),
  prefs:          getPrefs(),
  currentSession: loadCurrentSession(),
  program:        getProgramData(),
  archives:       getArchives()
}
```

Client writes are debounced by two seconds. Changes continue to work locally when sync is unavailable; network errors are caught and logged rather than blocking the workout UI.

Current background-load rules are deliberately conservative:

- A remote program is loaded only when no local program exists.
- Remote workout history replaces local history only when local history is empty or the remote history contains more sessions.
- Preferences are merged one object level deep, with local values winning conflicts.
- A remote current session is loaded only when no local current session exists.
- Remote archives are loaded only when the local archive list is empty.
- After the merge, the client uploads its current combined state.

These rules reduce accidental overwrites, but they are not a general conflict-resolution or per-record merge system. Changes made independently on multiple devices can still conflict.

`api/sync.js` also accepts legacy Google access tokens and Google JWTs, although current Google sign-in exchanges its ID token for an opaque application session.

## Local storage model

The main keys are:

| Key | Contents | Synced to Turso |
|---|---|---|
| `mwData3` | Completed workout history: `{ sessions: [...] }`. | Yes |
| `mwPrefs` | Routine UI preferences, language/settings, saved exercise-specific values, variants, days, lockers, and other persistent UI choices. | Yes |
| `mwCurrent` | Recoverable active or view-mode session snapshot: `{ rid, session, viewing }`. | Yes |
| `mwProgram` | Active named program and its A/B routine definitions. | Yes |
| `mwArchives` | Previously active programs saved when another program becomes active. | Yes |
| `mwDraft` | Program currently being designed before activation. | No |
| `mw_gtoken` | Authentication session token. | No |
| `mw_guser` | Local display information for the signed-in user. | No |
| `mwUserId` | Current application user ID or legacy sync identifier. | No |
| `mwRestEnd` | Absolute end timestamp for an active rest timer. | No |
| `mwProgOverrides` | Legacy/current progress corrections and exclusion metadata; corrections are migrated into session data where possible. | Not part of the sync payload |

Additional marker keys record completed one-time migrations and repairs. They are implementation details and may change.

### Workout session shape

A completed session is stored in `mwData3.sessions`. Representative fields are:

```javascript
{
  id: 1712345678901,          // start timestamp and stable session identifier
  routine: 'A',
  startTime: 1712345678901,
  endTime: 1712346278901,
  exercises: [
    {
      name: 'Leg Press',
      activeName: 'Leg Press', // actual selected variant when applicable
      machine: '',
      comment: '',
      variantIdx: 0,
      sets: [
        { w: '100', r: '10', done: true, note: '...' }
      ]
    }
  ]
}
```

Weights and reps are kept as strings because the UI supports values such as body weight (`BW` or `.`) and split-machine notation such as `35/72.5`. Pending DOM input buffers use temporary `_pw` and `_pr` fields while rendering; these are not meaningful saved workout values.

### Preferences

`mwPrefs` is intentionally extensible. Current code uses nested data including:

- `A` / `B`: locker values and selected days.
- `settings`: language and rest-timer settings.
- `exNames`: custom display-name overlays keyed by the original exercise name.
- `variants`: last selected variant for variant groups.
- `lastWeights`: latest entered weights by exercise.
- `machines`: saved machine/location values by exercise.
- `machineLabels`: labels for multiple machine slots.
- `comments`: exercise-level comments by exercise.
- `setNotes`: per-exercise, per-set notes.
- `rest`: exercise-specific rest duration selections.

Exercise identity matters for historical matching. Custom names are display overlays and should not casually replace stable exercise keys. Variant-aware history uses `activeName` and `variantIdx`, plus compatibility fallbacks and migrations for older records.

## Programs, routines, and exercises

The built-in fallback program contains two routines:

- Routine A: `Legs, Back & Abs`, currently 10 exercises.
- Routine B: `Chest, Shoulders & Arms`, currently 9 exercises.

The fallback definitions in `index.html` are used when `mwProgram` is absent. An active saved program can replace those definitions at runtime.

Each routine exercise can contain:

```javascript
{
  name: 'Lat Pulldown / Pull Up',
  variants: ['Lat Pulldown', 'Pull Up'],
  key: true,
  machine: '',
  muscles: ['upper-back', 'lat', 'bicep'],
  img: 'optional URL',
  sets: [{ n: 'instruction', w: '', r: '6-8' }]
}
```

The program manager supports:

- Renaming and editing the active program.
- Copying the active program into a draft.
- Building a new draft without changing the active program.
- Adding, removing, reordering, and substituting exercises.
- Changing set counts and marking key exercises.
- Adding, removing, and swapping two-exercise variants.
- Promoting a draft to active. The previous active program is archived automatically.
- Restoring or deleting archived programs.
- Exporting active, draft, or archived programs as PDF, with configurable image inclusion.

Variant order is semantically significant. Swapping variants updates compatible historical records so `variantIdx` continues to refer to the exercise actually performed. The progress screen and workout input history keep variants separate to prevent weight history leaking between different movements.

## Exercise library and media

`EXERCISE_LIBRARY` is a built-in catalog containing names, target muscles, and image URLs. The library and builder picker support text search, muscle filters, interactive front/back body diagrams, and exercise details.

Current exercise GIFs primarily come from `fitnessprogramer.com`. `EX_IMGS` provides explicit mappings and compatibility aliases, while library entries provide fallbacks. Some mappings may be representative rather than a perfect equipment match; movement identity and historical keys should not be changed merely to improve an image.

The PDF exporter cannot safely draw those cross-origin images directly to a canvas. It therefore uses `/api/img-proxy`, which only accepts URLs whose hostname ends with `fitnessprogramer.com`, returns the upstream content type, and caches successful responses for one day. The host restriction prevents the endpoint from becoming an open proxy.

## Workout flow and persistence

Starting a workout creates a session from the current routine. The session is reconciled with later program edits so an in-progress workout can retain entered work while reflecting compatible exercise changes.

During a workout:

- All exercise cards remain accessible in arbitrary order.
- Exercise cards can be expanded independently.
- Weight, reps, set notes, exercise comments, machine/location, and machine labels are editable.
- A weight can be copied to other sets.
- Sets can be completed individually, and an exercise can be completed or undone as a whole.
- Variant exercises can be switched without sharing their exercise-specific weights, comments, machines, and notes incorrectly.
- Previous completed weights and reps prefill or inform current entries.
- Exercise animations can be enlarged, and a YouTube search link can be generated from the exercise name.

The active session is written to `mwCurrent` every five seconds and on `visibilitychange`, `pagehide`, and `beforeunload`. The emergency save also flushes pending DOM inputs and exercise-specific preferences. Pausing a workout keeps `mwCurrent` so it can be resumed. Finishing a workout writes it to `mwData3`, clears the current-session snapshot, stops the rest timer, and opens the done screen.

The app distinguishes active workout mode from view/edit mode. Leaving view mode preserves its snapshot so reopening the routine can restore typed values without creating a completed history record.

## Rest timer

The optional rest countdown can start after a set is completed. Settings control whether countdown is enabled, whether an alarm sounds, and the available duration options. Exercises can remember a selected rest duration.

The timer uses an absolute end timestamp stored in `mwRestEnd`, not only an in-memory decrementing counter. On foreground return it recalculates remaining time. If it expires while the page is hidden, the visible alert is deferred until the page becomes visible. The UI includes a floating timer bar, jump-to-active-exercise behavior, skip control, visual flash, and optional sound.

Browser and iOS background restrictions still apply: minimized-app JavaScript execution, sound, and visual alerts are not guaranteed to occur at the exact expiry moment.

## History and progress

History is rendered as a calendar with routine markers, selectable day details, and a current-week section. Completed session details show exercise sets, split-machine summaries, duration, and routine information.

History operations include:

- Editing completed-set weight and reps.
- Editing session duration.
- Deleting a session with a five-second Undo window.
- Delaying the remote delete sync until the Undo window closes.
- Updating current-week day markers when the last matching session is permanently deleted.

Progress is derived from completed historical sets rather than a separate canonical progress database. It supports per-exercise history, mini charts, last-increase information, split weights, body-weight notation, variant-specific views, retired exercises, corrections, and exclusion of unsuitable points. History edits are written back to session data so progress recalculates from the corrected source.

The app also generates progressive-overload and workout reports. Reports can be previewed and copied as text or CSV for use in Excel or Google Sheets.

## Settings and localization

Current settings include:

- English or Hebrew language.
- Rest countdown enablement.
- Rest alarm enablement.
- Configurable rest-duration options.
- Account display and sign-out.
- Sync/change-device controls retained for compatibility.
- Force update, which clears `mwCurrent`, browser caches, and service-worker registrations, then reloads the current deployment with a cache-busting URL. Do not use it while relying on an unfinished session snapshot.

Translations are held in `TRANSLATIONS`, with separate mappings for Hebrew exercise, routine, day, and muscle names. New user-visible features should add both English and Hebrew labels and should be checked in LTR and RTL modes.

## PWA, service worker, and deployment

`manifest.json` configures a portrait, standalone PWA named My Workout with dark theme/background colors and maskable 192px and 512px icons.

`sw.js` caches only the app shell:

- `/`
- `/index.html`
- `/manifest.json`

It does not intercept non-GET requests, `/api/*`, or cross-origin requests. API, authentication, Turso, Google, and external-media traffic therefore remain network requests. The app shell uses cache-first delivery with a background refresh.

On every Vercel deployment, `build.js`:

1. Replaces `__BUILD_DATE__` in `index.html` with the deployment timestamp.
2. Replaces `__CACHE_VER__` in `sw.js` with a unique cache version.
3. Generates `icon-192.png` and `icon-512.png` without external packages.

The changing cache version removes old service-worker caches on activation and prevents a deployment from remaining stuck behind a stale app shell.

Production deployment is driven by GitHub `main` to Vercel. The application expects the Vercel environment to provide the Edge Functions and Turso credentials.

## Development and verification guidance

- Treat `index.html` as the primary client file, but inspect the API, build, and PWA files before changing authentication, persistence, deployment, or offline behavior.
- Preserve local-first startup and failure isolation. A sync or migration failure should not leave the app stuck on a blank/auth-loading screen when usable local data exists.
- Before deploying JavaScript changes, perform at least a syntax check or browser smoke test. A duplicate declaration or startup exception can prevent the entire single-file client from loading.
- When changing stored shapes or exercise identity, add a guarded migration and test old local data. Existing migration marker keys show the established pattern.
- Keep active-session recovery intact when editing workout render or navigation code.
- Test both English/LTR and Hebrew/RTL after UI changes.
- Test service-worker changes through an actual HTTP deployment or local server; direct file opening cannot validate PWA behavior.
- Do not commit `.env*.local`, `.vercel`, credentials, session tokens, or personal local-tool configuration.

## Known constraints

- The client is large and concentrated in one HTML file. This improves portability but increases the blast radius of JavaScript syntax/startup errors.
- Turso synchronization stores a whole user document and uses conservative heuristics, not transactional per-record conflict resolution.
- Offline app-shell loading does not make external exercise images, authentication, or sync available offline.
- Browser background execution limitations affect rest-timer alerts.
- Exercise names and variant identity participate in history/progress matching. Renaming or regrouping exercises requires care and often a migration.
- Some older localStorage keys and compatibility paths remain to support previously stored data.
