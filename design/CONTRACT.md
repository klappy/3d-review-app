# 3D Review — design contract (DRAFT, awaiting the captain's nod)

Status: **draft — not adopted.** This page becomes the app's design contract only when the captain approves it on its PR. Until then nothing here binds a screen; it is the proposal the design lens asks for before it can grade a rendered PR.

What it is for: every PR that changes a rendered screen names this file (path and sha) and the mockup for each screen it touches, then shows a screenshot pair at 390×844 and 1280×800 beside that mockup. A screen with no mockup listed below is a gap to fill here first, as its own PR, never a pass.

Written from the app as it is on `main` @dbfecf8 (release train 0.29.0). Lines marked **Proposal** are choices the captain has not made yet.

## 1. Sources and precedence

| Layer | Source | Status |
|---|---|---|
| Behaviour (how components act) | Generative Glass 1.0.0, `klappy/bt-design-system-generative-glass` @6aa9bc3 | house default |
| Values (colour, radius, blur, spacing) | `ui/design-system-v3/tokens.css`, copied from the 3D Review cookbook's v3 candidate @66d97f3 (header line 1 of that file) | in use; upstream calls it a candidate |
| Shipping layout and flow | the v3 facilitator-first candidate @66d97f3: sign in → Home → four setup steps → the review's home → Results → Next step; participants on a phone | in use |
| Next round (reference only) | the v4 glass redesign canvas @3654f1a, 19 artboards at 1440 and 390 (one of them, `CollectDark`, dark; one, `Foundations`, a token sheet) | proposed upstream, not adopted here |
| Concept frames | Bincy's 11 design-sprint screens (2026-09-22), cookbook @91824f8 | concept, not a spec |

Precedence: a conflict on a **value** goes to the token file; a conflict on **behaviour** goes to Generative Glass; something neither covers is an extension and waits for the captain.

## 2. Tokens actually in use

One token source for new work: `ui/design-system-v3/tokens.css` (123 distinct custom properties; light block `:root, [data-theme="light"]` at line 3, dark block `[data-theme="dark"]` at line 67, shared sizes in a second `:root` at line 118). Do not edit it in this repo; rebuild it from upstream.

| Group | Tokens (light values) |
|---|---|
| Ink and text | `--ink` #172e40 · `--secondary` #526779 · `--primary-ink` #ffffff |
| Surfaces | `--ground` #edf3f8 · `--paper` #f8fbff · `--glass` rgba(255,255,255,.68) · `--glass-edge` rgba(255,255,255,.9) · `--welcome-glass` · `--welcome-solid` #f6faff |
| Brand and action | `--green` #14685f (primary fill) · `--button-fill` rgba(255,255,255,.8) (secondary fill) · `--focus` #287f97 with `--focus-w` 3px |
| Aurora background | `--aurora-mint` #c3e7e0 · `--aurora-sky` #d2e5f6 · `--aurora-lilac` #d8d5f2 |
| Lines and states | `--line` #c9d8e5 · `--warning-ink` #65511c · band tokens `--band-strong`, `--band-growing`, `--band-needs-support`, `--band-urgent` (bands, never numbers) |
| Radii | `--r-panel` 20px · `--r-button` 12px · `--r-input` 11px · `--r-pill` 20px · `--r-page` 24px · `--r-stage` 28px |
| Glass effect | `--blur-panel` 24px · `--blur-top` 28px · `--sat-panel` 115% · `--shadow-panel` |
| Type | `--font-ui` system-ui stack · `--font-scripture-latin` Noto Serif · weights `--fw-regular` 400, `--fw-label` 550, `--fw-semibold` 600, `--fw-eyebrow` 650 · `.fs-h1` 31px/600, `.fs-h2` 20px/600 |
| Layout sizes | `--mobile-bp` 760px · `--phone-max-w` 430px · `--stage-max-w` 840px · `--wizard-max-w` 720px · `--h1-max-w` 650px · `--main-pad` 30px · `--panel-pad` 23px · `--button-min-h` 42px · `--gap-grid` 18px |

Two other places still define tokens on `ui/index.html` today, so drift is measured against the right file:

- the first inline `<style>` in `ui/index.html` sets `--ink --muted --green --line --glass --edge` on `:root` with raw values. It is legacy. `--muted` and `--edge` are defined only there; the other four are overridden by the files below.
- `ui/kit/tokens.css` ("glass 2", 119 custom properties, mostly the same names as v3).

Load order on `ui/index.html`: inline `<style>` → `stage-screens.css` → `kit/tokens.css` → `kit/components.css` → `kit/kit.css` → `design-system-v3/tokens.css` → `v3-shell.css`, then per-screen sheets such as `v3/home.css`. The selectors have equal weight, so **v3 wins by load order only**: where a name is in both, v3's value is what renders. A value check (rule 7 drift) compares against `design-system-v3/tokens.css`; a legacy-only name (`--muted`, `--edge`) has no v3 counterpart yet and should not be used in new work.

Rules for a rendered PR:
- Where a token of the same value exists, use it: no new raw hex, px radius or inline style.
- No new stylesheet without naming it in the PR and in this file.
- Glass where the mockup has glass (`.glass` / `dialog.panel`); with reduced transparency glass turns to `--paper` (already in `kit/components.css`).

## 3. Layout and width rules

| | Phone 390×844 | Laptop 1280×800 |
|---|---|---|
| Breakpoint | below `--mobile-bp` (760px) | at or above 760px |
| Side gutter | 14px (`v3-shell.css:4` mobile rule, `padding:20px 14px`) | `--main-pad` 30px inside the shell |
| Content width | full width minus gutters | stage up to `--stage-max-w` 840px; setup up to `--wizard-max-w` 720px |
| Page title | one H1, wraps; never truncated | one H1, up to `--h1-max-w` 650px |
| Primary action | one per screen, full width under the title or in the thumb zone | one per screen, top right of the page head, same row as the H1 |
| Scroll | no horizontal scroll (`scrollWidth` equals the viewport) | no horizontal scroll |
| Dialogs (today) | base `dialog` rule in the inline `<style>` of `ui/index.html`: `max-width:600px; width:calc(100% - 32px); border-radius:22px; background:#f4f9fb`; backdrop dims and blurs (5px). Only `dialog#feedback-dialog` (`ui/style.css:51`) uses `min(560px, calc(100% - 32px))` | same |
| Dialogs (**Proposal**) | one width for every dialog: `min(560px, 100% − 32px)`, centred, `--r-panel`, backdrop dims and blurs. Not in the code yet; a lens run grades today's rule until the captain adopts this | same |

Every screen: one primary action in a fixed place; plain words only (no data-model names, ids, roles in capitals or version strings on screen); help and teaching behind ? or outside the task flow.

## 4. Greeting — one style (Proposal)

**Proposal for the captain: greet once, on Home, as the page title — "Welcome, <name>".** The header shows who is signed in (the name, opening the account menu) but does not greet a second time; "Hi, <name>" goes away.

Why this one: the sprint's home frame makes the welcome the page title; the v4 canvas keeps the header to an identity chip; one greeting removes the "Hi" and "Welcome" pair that the first design-lens run flagged on #461.

Fallback when no name is saved: as ruled on 2026-10-02 (display name, email fallback) the title reads "Welcome, <email>". See § 9, question 2.

## 5. Name dialog and home welcome — placement

No upstream mockup draws either surface. Until one is drawn, these wireframes are the mockup the lens compares against.

### Name dialog

Shown once, after the first sign-in with no saved name; reopens from the account menu item "Your name…" with the saved value filled in.

```
┌──────────────── dialog.panel (glass, --r-panel) ───────────────┐
│ What should we call you?                          (.fs-h2)     │
│ We greet you by this name. You can change it any time           │
│ from the account menu.                            (--secondary)│
│                                                                │
│ Your name                                         (label)      │
│ [______________________________________________]  (--r-input)  │
│                                                                │
│ [ Save ]  [ Not now ]                                          │
│  primary   secondary (--button-fill)                           │
└────────────────────────────────────────────────────────────────┘
```

- 1280×800: centred, 520–560px wide, page behind dimmed and blurred.
- 390×844: centred, full width minus 16px each side (the base `dialog` rule's `calc(100% - 32px)`); buttons stay on one row, Save first.
- One primary (Save). Escape and the backdrop mean "Not now". Focus starts in the field; Enter saves.
- Words: the three lines above only. No "display name", no "profile", no account id.

### Home welcome

```
1280×800                                                     390×844
┌──────────────────────────────────────────────────────┐     ┌──────────────────────┐
│ [3D] Review                         Ana Lucía ▾      │     │ [3D] Review  Ana ▾   │
├──────────────────────────────────────────────────────┤     ├──────────────────────┤
│ Welcome, Ana Lucía            [+ Start a new 3D Review]│   │ Welcome, Ana Lucía   │
│ Your 3D Reviews, newest first.                        │    │ Your 3D Reviews,     │
│                                                       │    │ newest first.        │
│ ┌ review card ┐ ┌ review card ┐                       │    │ [+ Start a new 3D   ]│
│ └─────────────┘ └─────────────┘                       │    │ [  Review           ]│
└──────────────────────────────────────────────────────┘     │ ┌ review card ──────┐│
                                                              └──────────────────────┘
```

- The welcome **is** the H1 (`.fs-h1`), replacing the separate "Projects" title and the small welcome line under it.
- The subline keeps the existing words "Your 3D Reviews, newest first." in `--secondary`.
- 1280: the primary sits on the H1's row at the right edge; it does not drift beside the welcome text.
- 390: the primary is full width under the subline.
- The header carries the person's name as the account-menu trigger, truncated with an ellipsis if it would wrap; on phones it may show initials instead (§ 9, question 3).

## 6. Dark mode — none today

The token file carries a `[data-theme="dark"]` block, but nothing in the app sets `data-theme` and no app stylesheet answers `prefers-color-scheme` (only the MCP panel does). A dark-preference phone renders the light theme unchanged. So: **dark mode is off, by state, not by decision.** Until the captain rules on it, lens pairs are light only. Turning it on would be its own unit with dark pairs for every screen.

## 7. Mockup per screen

All three sources live in the 3D Review cookbook at the sha shown.

- "v3" = facilitator-first candidate @66d97f3. Its artboards are **not committed files**: `design-system-v3/scripts/build-artboards.mjs` @66d97f3 generates them (`<id>.dc.html`) from `design-system-v3/prototype/` (also viewable as `prototype/standalone.html`). The v3 column uses that script's artboard ids and F-numbers. Desktop artboards render at 1280×900 (`build-artboards.mjs:17`), phone at 390×844; the lens pair is 1280×800, so the bottom 100px of a desktop artboard falls below its fold.
- "v4" = glass redesign canvas @3654f1a, `design/2026-09-28-glass-redesign/canvas/<Name>.dc.html` (reference only).
- "Bincy" = sprint frames @91824f8.

| Screen | Primary mockup | Also consult |
|---|---|---|
| Sign in (email, then code) | v3 `Main` (F1 Sign in), `SignInCode` (F1b), `PhoneSignIn` | Bincy 01 sign in · v4 SignInCheck |
| Home (your reviews) | v3 `Home` (F2 Home), `PhoneHome` | Bincy 02 home dashboard (welcome as title) · v4 Home, HomePhone |
| Name dialog | **this file § 5** (none upstream) | — |
| Account menu | none upstream — gap | — |
| Setup step 1 · Details | v3 `Setup1Details` (F3) | Bincy 03 assessment details · v4 Setup1 |
| Setup step 2 · Who will participate? | v3 `Setup2Participants` (F4), `PhoneSetup2` | Bincy 04 participant groups · v4 Setup2 |
| Setup step 3 · Participant information | v3 `Setup3Information` (F5) | Bincy 05 participant information · v4 Setup3 |
| Setup step 4 · Ready to launch | v3 `Setup4Review` (F6), `PhoneSetup4` | Bincy 06 review and launch · v4 Setup4 |
| Review home · Collect / Share | v3 `Collect` (F7), `Share` (F7 Share), `PhoneCollect`, `PhoneShare` | Bincy 07 collect responses · v4 Main, Collect, CollectPhone, Share |
| Participant welcome | v3 `PWelcome` (F8, phone) | Bincy 08 survey welcome · v4 PWelcome |
| Participant questions | v3 `PQuestion` (F9, phone) | Bincy 09 survey questions · v4 PQuestion |
| Participant review and receipt | v3 `PReview` (F9c), `PReceipt` (F9f) | v4 PReview, PReceipt |
| Results | v3 `Results` (F10), `PhoneResults` | Bincy 10 results dashboard · v4 Results |
| Next step | v3 `NextStep` (F11) | Bincy 11 next steps · v4 NextStep |

## 8. Versioning

This file carries no version number of its own until adopted. Once adopted: a rule or token-source change is a new section in a PR with the captain's nod; adding a screen's mockup reference is a plain PR.

## 9. Open questions for the captain

These are the choices this draft leaves open. A nod on the PR without an answer keeps the default named in each.

1. **Adopt?** Nod this draft as the 3D Review design contract, or send edits back.
2. **Greeting with no saved name** (§ 4). Use the email fallback ruled on 2026-10-02 ("Welcome, <email>"), or show a plain "Welcome" so no account id appears on screen? Default: the email fallback, as ruled.
3. **Phone header** (§ 5). Show the full name truncated with an ellipsis, or initials as the v4 canvas does? Default: full name, truncated.
4. **Dark mode** (§ 6). Keep it off, or open a unit to turn on the existing dark tokens with dark lens pairs for every screen? Default: off.
5. **Where this file lives.** The design lens expects the contract in the 3D Review cookbook; this draft lives in the app repo beside the code it governs. Keep it here and register this path and sha with the lens, or move it? Default: keep it here and register it.
