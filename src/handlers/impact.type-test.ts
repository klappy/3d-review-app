// Compile-time checks for the Impact union (types.ts), run by `npm run typecheck`; never imported at runtime.
// 0.35.17 (cookbook work/active/2026-10-18-3d-grant-noop-followups-2 DoD (b)): only a no-op impact may omit its effect.
import type { Impact } from "./types";

// @ts-expect-error a non-noop impact without effect does not typecheck
export const impactWithoutEffect: Impact = { affected: [], irreversible: false };
// @ts-expect-error a no-op impact names no effect
export const noopWithEffect: Impact = { affected: [], irreversible: false, noop: true, effect: "disclosure" };
export const noopImpact: Impact = { affected: [], irreversible: false, noop: true };
export const effectImpact: Impact = { affected: [], irreversible: true, effect: "disclosure" };
