// UI Next (v4) actions lane: what every in-screen link carries. Status: provisional.
// Links are built with the shared ../href.js href(screen, extra); this gives it the w/theme a screen was routed with (its phone and
// theme props), so a link built where there is no location (vitest, a gallery mount) carries them too. In the app the props come
// from the same ?w= / ?theme= that href() would read, so the result is identical. Screen names stay literal href("<name>", ...)
// calls in the .svelte files, where test/ui-next-links.test.ts checks them against the registry.
export const carry = (phone, theme) => ({ w: phone ? "phone" : null, theme: theme === "dark" ? "dark" : null });
