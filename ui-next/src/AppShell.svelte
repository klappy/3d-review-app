<!-- UI Next (v4) AppShell. Status: provisional. Light DOM, literal contract classes (design-system.md section 8.1), no <style>, no inline style.
     Owns theme and the full-height column (.app > .layer.l-shell); phone sets data-w=phone (gutter 16, pages 100%). Never owns content width.
     rhythm (design-system.md 8.2): marketing = --sp-8 72 page top padding (Landing), read = --sp-7 48 (About); report = the §8.3 report frame (paper sheets --sp-6 apart); desktop only.
     data-theme: the viewer's theme choice (./theme.svelte.js: Light or Dark override; System keeps this screen's theme).
     data-imagery: the one shared imagery state (./imagery.svelte.js), read by every Level skin under this .app.
     Optional top (TopBar or PhoneHeader) and bar (PhoneBar) snippets: the shell level owns its chrome (section 8.4).
     A phone screen is the board's bounded frame (design-system.md §9 Phone frame; Codex P2 4383334410): main.l-page.l-phone.phone-main
     scrolls inside the viewport (base.css .phone-main, phone.css bounds the frame), so the header stays and the fixed bar keeps
     .l-phone's 120px clearance. A non-screen phone shell (the Layouts gallery) keeps its natural height. -->
<script>
  import { imagery } from "./imagery.svelte.js";
  import { themeOf } from "./theme.svelte.js";
  let { phone = false, theme, screen = false, rhythm, top, bar, children } = $props();
  if (rhythm !== undefined && !["marketing", "read", "center", "report"].includes(rhythm)) throw new TypeError(`AppShell: rhythm must be marketing, read, center or report, got ${String(rhythm)}`);
  if (theme !== undefined && theme !== "light" && theme !== "dark") throw new TypeError(`AppShell: theme must be light or dark, got ${String(theme)}`);
</script>

<div class={screen ? "app l-screen" : "app"} data-theme={themeOf(theme)} data-w={phone ? "phone" : undefined} data-imagery={imagery.skin}><div class="aurora" aria-hidden="true"><i></i><i></i><i></i></div><div class="layer l-shell">{@render top?.()}<main class={phone ? (screen ? "l-page l-phone phone-main" : "l-page l-phone") : "l-main"} data-rhythm={phone ? undefined : rhythm}>{@render children?.()}</main>{@render bar?.()}</div></div>
