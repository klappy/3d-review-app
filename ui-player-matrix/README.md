# DEV player comparison

This controlled diagnostic answers the user's requested two-way comparison. It does not replace the homepage or claim to fix Safari.

A0 and R0 are controls. A1–A5 add features cumulatively; R1–R5 remove features cumulatively. See `cases.js` for each exact change. A4 combines Svelte construction and explicit resource initialization, and is labeled as such. R5 versus A0 separates plain Svelte construction from literal parser-created HTML. A5/R0 import the actual product MediaCard. They reproduce the player and Watch button, not Live's auth/navigation shell. `ReducedCase.svelte` is an isolated diagnostic reduction, never a product import.

Each case is a fresh HTML document containing one video. No autoplay, parallel matrix loading, credential/telemetry collection, request-header probes or result storage. All cases use the same immutable same-origin MP4 route, controls, playsinline and metadata preload. Caption tracks remain default-off. Local observation prints only native numeric state and event names. Test native play first, then the Watch button separately where present. A working thumbnail or pause icon alone is not playback evidence.

`build-next-guarded.mjs` runs the dedicated build. On WORKERS_CI_BRANCH=production it removes both old and new generated diagnostic outputs, including stale DEV output. Source lives outside Wrangler's `ui` asset root. The production build regression asserts the absence of the diagnostic files/bundles and numeric homepage failure strings. No production promotion is authorized by this diagnostic.
