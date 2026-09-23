# CHECKPOINT 1 — Fable PR174 isolated corrections (worker 2a237323, under Auggie)
2026-09-22. FIRE read: SOURCE-FIRE-ISOLATED-CORRECTIONS-2026-09-22.md @ kitchen 002621c0. Status: FIRST TESTED CORRECTION CANDIDATE PUSHED / REVIEW PR OPEN (draft) / NOT MERGED / browser proof pending.

## START readback
- 16:45:14Z oddkit_time. PR174 refreshed: open, head still 907bd5d2b8056e669e7e3972db395b704612f748. Branch absence recheck: 404.
- 16:45:45Z (date -u) branch `design-batch/fable-174-isolated-corrections-20260922` pushed from exact 907bd5d; API readback: name + commit 907bd5d2b8… (START observed).
- Repository-scoped GitAuth token: contents:write + pull_requests:write on 3d-review-app and kitchen only. No denial.

## Candidate
- Head **f69ac5c3cadcd848fdf3537d57867df2f81c9a6e** (one commit on 907bd5d), API readback matches. Draft review PR **#175** https://github.com/klappy/3d-review-app/pull/175 (base main, head f69ac5c). PR174 / release branch untouched.
- `git diff --name-only 907bd5d..f69ac5c` = exactly the four paths. 4 files, +206 −14. Patch: evidence/four-path-diff-907bd5d..f69ac5c.patch.
- File sha256 @ f69ac5c: scope.js 4e572734…, assess.js 8affc08d…, scope.test.mjs b7baef47…, kit-root.integration.test.mjs aeac0baf… (full hashes in this session log).

## Finding → fix → test map
1. **4073693743 titles** — scope.js `pageHead(ctx, r)`: renders `<p class="eyebrow">` + `<h1>` unless `ctx.shellOwnsTitle === true`; used by all four page renderers (kitHead for workspace/project; inline for workspaces/projects). assess.js `ctxFor` sets `shellOwnsTitle: !!kit` — only a mounted kit root claims the title. Absent/false/non-boolean → page owns heading. Tests: scope.test.mjs 25 (four pages × three absent/false contexts, exactly one h1 + eyebrow), 26 (kit host → zero page h1, read head retained), 27 (boolean contract), 28 (re-render follows current model), 29 (failure states single heading both hosts); kit-root 16 (REAL `/assess/index.html`, no `#rv`, `kit === null`, four routes each one h1 with page title, `#who` unchanged, business controls present), 17 (REAL `ui/index.html`, four routes exactly one h1 = shell title, crumbs/controls intact).
2. **4073693755 demo disclosure** — assess.js `placeDemoNotice()`: single module-owned `#demo-notice` node built once (same markup, same sample links), placed `app.before()` at boot and after every `syncShell()`; a controller `MutationObserver` on `kitRoot` re-places the same node when a kit-internal paint (expansion/search/context toggle — paths that never call the controller) detaches it. Content element, mounted view, inputs, listeners untouched; kit modules unchanged; demo `api()` path unchanged. Tests: kit-root 18 (real controller `?demo=1` boot: one disclosure immediately before content, N sample links = `sampleResponses.length`, no data reads), 19 (route change ×3, tree search, expand/collapse, assessment repaint: same node, one disclosure, read region and shell input preserved), 20 (existing create form submit → `Not allowed here.` via existing write() path, no navigation, no request; demo viewer pages have no action region; demoApi rejects POST).
3. **4073693771 dual retry** — scope.js `bindRetry`: binds every `[data-act="retry"]`, one shared `pending` guard disables all controls during the reload and ignores re-clicks; reload goes through existing `swap()` so `ctx.isCurrent` currentness is unchanged. Tests: scope.test.mjs 30 (both reads fail → two controls; each independently reloads, 3 reads, page re-rendered), 31 (failure remains failure, rebinds both), 32 (second click on either button while pending issues no read; both disabled), 33 (completion after view stopped being current does not paint).

## Actual commands (clean clone of pushed f69ac5c, sandbox)
- `npm run stamp` → `0.16.0+f69ac5c (release_source 20d5144)`; `node --test ui/assess/scope.test.mjs test/kit-root.integration.test.mjs` → **53 pass / 0 fail** (33 + 20); `npm run typecheck` → clean. Tree clean before and after.
- Parent disconfirmer (907bd5d scope.js + assess.js with candidate tests): scope.test.mjs **27/33, 6 fail** (25, 27, 28, 30, 32, 33); kit-root **16/20, 4 fail** (16 non-kit h1 count 0; 18 disclosure count 0 at boot — lost by the first shell sync, actual repaint path; 19; 20). Files: evidence/parent-907bd5d-*.txt, evidence/candidate-f69ac5c-tests.txt.
- Preservation guards that pass on BOTH parent and candidate (by design): scope 26, 29, 31; kit-root 17 and all 15 pre-existing tests.

## Not done / next
- Browser proof (root + non-kit entry, 1440×900 and 390×844, synthetic session, fail-closed transport, screenshots + console) — increment 2. Sandbox has no display; will attempt the isolated in-app browser against a loopback static serve of f69ac5c; if unreachable, I return the exact gap for root/reviewer proof per FIRE.
- Cloud Autofix delta comparison / one-successor selection: coordinator disposition; PR174 head unchanged at every read (16:34Z, 16:45Z).
- Canonical provenance reconciliation, Bugbot SUCCESS, DEV/production proofs: outside this dish; not claimed.

## Process notes (truthful)
- Mounted worktree cannot unlink `.git/index.lock`; commits/pushes were made from a sandbox-local clone of the pushed branch with the four files copied byte-for-byte from the mounted working tree (diff identical: 206/14). One stray debug test file created during test authoring was moved to `worker-release-corrections/scratch-untracked/` (never staged, never pushed).
- Time observed via oddkit_time 16:45:14Z; START 16:45:45Z; candidate verified 16:53:39Z (date -u in sandbox).
