// 0.35.18: the typed error moved to src/errors.ts so non-handler layers (receipt.ts) need not import from handlers/.
// Handlers keep importing from here.
export * from "../errors";
