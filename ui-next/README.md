# ui-next — UI Next (v4) design tokens

**Status: provisional** (cookbook playbook rule 12). Reversible, not ratified; a human confirms or corrects it later.

## Purpose

UI Next is the v4 interface being built beside the current UI. This folder holds its design tokens: one source file, one generated stylesheet, and a lint that keeps UI Next code painting only from those tokens. Nothing here is served yet; `ui/`, `src/` and the served-file map are unchanged.

| File | Role |
|---|---|
| `tokens.source.json` | the one source: an ordered list of `{selector, note, decls}` blocks |
| `tokens.css` | generated from the source; never edited by hand |
| `../scripts/ui-next-tokens.mjs` | generator (Node stdlib only) |
| `../scripts/ui-next-lint.mjs` | conformance lint (Node stdlib only) |
| `../test/ui-next-tokens.test.ts` | vitest: tokens.css is current; lint passes here and fails on seeded violations |

Scopes in `tokens.css`: `.app` (light theme tokens), `.app[data-theme=dark]` (dark overrides of every theme token), `.app` (theme-independent radius, type, stage, size tokens), `.paper` (light values re-declared for print).

## Regenerate

Edit `tokens.source.json`, then:

```sh
node scripts/ui-next-tokens.mjs           # writes ui-next/tokens.css
node scripts/ui-next-tokens.mjs --check   # exit 1 if tokens.css is stale
```

## Lint

```sh
node scripts/ui-next-lint.mjs             # lints ui-next/ (exit 1 on any violation)
node scripts/ui-next-lint.mjs <dir>
```

The lint reads `.html .css .js .mjs .svg` files and fails on: an inline `font-size: Npx`; an inline `border-radius: Npx` other than 50; a raw hex colour outside `.paper`; a `.pt` coloured by class letter; the legacy `.status` class; more than one `btn-primary` in a file; a nested `<label>`; `[CONTACT` placeholder text. `tokens.css` is skipped because it is where the tokens are defined. `npm test` runs both checks.

## Sources (cookbook paths, klappy/3d-review-cookbook)

- Contract: `design/2026-10-15-glass-redesign/canvas/design-system.md` §1 (1.1 theme, 1.2 semantic, 1.3 paper). Where it differs from the canvas files, this folder follows the contract.
- What the canvas used: `design/2026-10-15-glass-redesign/generator/helmet.html` and the semantic and paper token block in `design/2026-10-15-glass-redesign/generator/gen.py`.
- Lint rules: `design/2026-10-15-glass-redesign/generator/lint.py`.
- Recipe: `design/2026-10-15-glass-redesign/canvas/playbook.md` (rule 11: a gap goes back through the canvas first; rule 12: provisional).
- Unit: `work/active/2026-10-15-glass-redesign-v4/TICKET.md`, acceptance item 1.

## Svelte 5 components and the `/next/` gallery (provisional)

Button, Stage pill and Lens dot are Svelte 5 components in `src/` (`Button.svelte`, `Pill.svelte`, `LensDot.svelte`): light DOM, the literal contract classes, the external `components/*.css` and `tokens.css` unchanged, text bound as text. No `<style>` blocks, no `customElement`, no shadow DOM, no inline styles; the lint enforces this.

```sh
npm run build:next   # builds ui-next/index.html into ui/next/ (gitignored); wrangler serves ./ui, so /next/ when deployed
```

`src/App.svelte` is a fixture gallery: every ported state, light and dark, with a theme toggle (`?theme=light|dark`). Tests: `test/ui-next-*.test.ts` run as the `ui-next` vitest project (@testing-library/svelte under jsdom). The Workers Builds build command does not run `build:next` yet (cookbook `work/queued/2026-10-16-ui-next-vite-build-step/`).
