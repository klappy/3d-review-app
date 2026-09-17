# Workspace overview — integration handoff

New files only: `ui/workspace-overview.js`, `ui/workspace-overview.css`, `ui/workspace-overview.test.mjs`.
No existing file is edited by this branch except one line appended to `ui/.assetsignore` (the test).
The union author owns the three edits below.

## 1. Roots (`ui/index.html`)

Top of `#facilitator`, above the existing cards, in this order:

```html
<section id="overview" hidden><div id="overview-crumbs" hidden></div><div id="overview-all" hidden></div><div id="overview-project" hidden></div></section>
```

The module self-mounts only when all four ids exist. Nothing else in `index.html` changes: no
existing id, control or card is moved, renamed or re-parented.

## 2. Tags (`ui/index.html`)

- Stylesheet, after `/style.css`: `<link rel="stylesheet" href="/workspace-overview.css">`
- Script, **before** `/app.js`: `<script type="module" src="/workspace-overview.js"></script>`

Script order matters for the shared-route gate: the module reads `location.hash` before `app.js`
calls `stripFragment`. If it must run after `app.js`, the `currentNamespace(sessionStorage)` half of
the gate still holds, but put it first.

## 3. Local server (`ui/server.mjs`)

Add to the `files` allowlist, mirroring `report-cards.css`:

```js
'/workspace-overview.js': ['workspace-overview.js', 'text/javascript'],
'/workspace-overview.css': ['workspace-overview.css', 'text/css'],
```

## Events

Consumed (read-only observation, never mutated by the module):

| Source | How | Why |
|---|---|---|
| `#projects` `change` | listener | a project was chosen — repaint state B |
| `#assessments` `change` | listener | an assessment was chosen — collapse to crumbs + one line |
| `#projects` / `#assessments` option mutations | `MutationObserver({childList, subtree})` | `app.js` repopulates the selects asynchronously |
| `#identity` text | `MutationObserver({childList, characterData, subtree})` | sign-in / sign-out; `"Not signed in"` clears and hides |

Produced (the existing app paths, unchanged):

| Control | Effect |
|---|---|
| "Open project" | `#projects.value = id` then `dispatchEvent(new Event('change', {bubbles:true}))` → `chooseProject` |
| "Open →" (table row) | `#assessments.value = id` + `change` → `chooseAssessment` |
| Crumb clicks | the same select + `change` |
| "Create a project" | `#create-project.focus()`, only when that form is not `hidden` (S4 #11) |
| "Start an assessment" | `#create-assessment.focus()`, only when `#assessment-card` is not `hidden` (S4 #11) |

S4 #7: the value is set and verified. On a miss the module clicks `#load-projects` /
`#load-assessments` once and retries. It **never injects an option** — a scope the server did not
list is not selectable, and the click is silently refused.

## Requests

Three GETs, all read-only, all bypassing `api()` and therefore absent from `#events` (S4 #9):

- `GET /v2/projects` — state A cards and the project role
- `GET /v2/projects/{pid}` — project + languages (state B lead and the Languages section)
- `GET /v2/projects/{pid}/assessments` — the table rows (duplicates `chooseProject`'s fetch; accepted)

Bearer (S4 #8, blocking): `sessionStorage.facilitatorToken`, read per request and never cached, and
only when `parseEntryFragment(location.hash) === null && currentNamespace(sessionStorage) === null`
— `app.js`'s own shared-mode test, imported from `./shared-link.js`. On the shared route the module
issues no request and renders nothing. A generation counter is bumped on every change; a response
from an older generation is dropped without painting.

The module issues no `POST`/`PUT`/`DELETE` in any state.

## Containment (S4 #13)

The module writes only into `#overview-crumbs`, `#overview-all`, `#overview-project`, and toggles
`hidden` only on those three and `#overview`. It reads `#projects`, `#assessments`, `#identity`,
`#create-project`, `#create-assessment`, `#assessment-card`, `#load-projects`, `#load-assessments`
purely as the event sources and controls the map assigns to them — no other node is read, hidden,
moved or restyled, and none has its children, text or class changed. A test spies on a sibling
(`#project-card`) plus every touched control and asserts they are untouched across a full render and
both button paths.

With `#assessments.value` non-empty the overview keeps its crumbs, renders a one-line project row
into `#overview-project`, empties `#overview-all`, and **does not hide `#overview`** — the stage
composition owns the space beneath it.

## States

- **A (no project selected)** — `heading('All projects', 'Choose a project, or create one', 'Each project holds its own assessments. A project appears here only if you hold a grant on it.')`, an action row, and a `.three` grid of `.glass.panel` cards: name, `Archived` badge from `archived_at`, `organization · role`, "Open project". Per-card assessments are **not** fetched (that would be N calls), so no counts appear.
- **B (project selected)** — `.headrow` with `heading('Project', name, '{organization} · your role: {role}')`, "Start an assessment", a `.phases` level menu of **Assessments · Languages** only, and a `.table` of Assessment · Period · Language · Stage · Open →. Stage is the server's exact word (`prepare`/`collect`/`understand`/`improve`), not relabelled. The Surveys column is omitted (a call per row).
- **C (assessment selected)** — `.crumbs` `project › assessment` with `aria-current="location"` on the last and a `.badge` carrying the exact role of the deepest selected scope.

## CSS (S4 #10)

`workspace-overview.css` ships exactly `.rv .phases` and `.rv .table` — the only two classes the kit
uses that the app does not already have — built from `--r-button`, `--nav-active`, `--glass-edge`,
`--shadow-nav-active`. Every other class (`.glass .panel .eyebrow .three .crumbs .badge .muted .note
.nav .headrow .rv-btn`) is the app's existing definition, untouched.

**One thing for the union author to decide:** `design-system/components.css:113` hides `.rv .crumbs`
below 760px (it was written for the top-bar crumbs). `#overview-crumbs` inherits that, so on mobile
390 the crumbs are not shown. Re-showing them is a change to an existing class and therefore outside
this module's #10 budget — either accept the mobile behaviour or scope a narrow override in
`style.css` at union time.

## Copy

Kit copy is verbatim. Two departures, both required and both flagged:

- S4 #4: empty assessments reads **"No assessments you hold a grant on."**, never the kit's "No assessments yet." (the list is an exact-grant join — absence means no grant, not no data). The A-state variant `"No assessments you hold a grant on. Start an assessment →"` is exported as `COPY.noAssessmentsAll` but is currently unreachable: state A fetches no per-card assessments, so no card can be empty of them.
- `COPY.noProjects` (`"No projects you hold a grant on."`) and `COPY.noLanguages` are the only strings not in the kit — the kit's A state always has fixture projects, and an empty list must still say something. Same #4 phrasing family.

Omitted per the map, with no placeholder left behind: workspace crumb (#5), Request a project,
Organize projects in a workspace, `proposed()` chips, Archive/Delete menus, Details and
People & access tabs, the Project rollup reserved card, Surveys column, `sampleBadge`/`feedback` (#12).
