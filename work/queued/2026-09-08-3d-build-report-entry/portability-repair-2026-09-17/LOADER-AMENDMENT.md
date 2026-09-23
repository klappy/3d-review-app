# Bounded loader amendment — September17

The author independently proved the original-reader RED, then candidate collection failed: Vite5.4.14 as used by Vitest2.1.9 does not classify node:sqlite as a builtin and resolves it as sqlite. This is test-loader incompatibility, not failed Node runtime capability. Exact evidence: /tmp/3d-attestation-portability-evidence/targeted-green.log.

Amend only how the existing planned public Node builtin is loaded inside tools/build-synthetic-attestation.ts: import createRequire from node:module and obtain DatabaseSync using createRequire(import.meta.url)('node:sqlite'). No dynamic package fallback, SQL change, type suppression, dependency/config edit or third path. Same in-memory database, default foreign keys, fixed SELECT, plain-object normalization and finally-close. All original tests, literal oracle, fault control and exact artifact bytes remain required. The same two-file custody and original budget continue without reset.

Driver-seat delta: future reviewer now sees native module loading explicitly through Node's require path so Vite's outdated builtin table cannot rewrite it. Use an explicit literal node:sqlite target, not computed resolution or fallback. Rejected: Vite config/NodeTypes/package upgrade because they enlarge scope; bypassing Vitest would erase the acceptance condition. This is a loader adaptation within the public built-in API, not a new database design.

The original static import variant is superseded only on this loader point. Independent challenge and root amendment disposition remain required before author resumes affected edit.
