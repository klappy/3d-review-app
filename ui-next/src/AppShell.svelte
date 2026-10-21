<!-- UI Next (v4) AppShell. Status: provisional. Light DOM, literal contract classes (design-system.md section 8.1), no <style>, no inline style.
     Owns theme and the full-height column (.app > .layer.l-shell); phone sets data-w=phone (gutter 16, pages 100%). Never owns content width.
     Optional top (TopBar or PhoneHeader) and bar (PhoneBar) snippets: the shell level owns its chrome (section 8.4). -->
<script>
  let { phone = false, theme, screen = false, top, bar, children } = $props();
  if (theme !== undefined && theme !== "light" && theme !== "dark") throw new TypeError(`AppShell: theme must be light or dark, got ${String(theme)}`);
</script>

<div class={screen ? "app l-screen" : "app"} data-theme={theme} data-w={phone ? "phone" : undefined}><div class="layer l-shell">{@render top?.()}<main class={phone ? "l-page l-phone" : "l-main"}>{@render children?.()}</main>{@render bar?.()}</div></div>
