# Serial K5 test exclusion — staff owner

The existing staff owner may append exactly `kit/legacy-adapter.test.mjs` to ui/.assetsignore, retaining every prior entry, on its own branch. This is the sixth path already specified in accepted K5 ticket30e88; K5 owner must not edit this shared file concurrently. Keep the one-line change in a separate commit and return its full SHA for once-only participant-style cargo integration to K5. No broad branch merge or whole-file replacement.

Coordinator will authorize K5 to carry that exact committed line. Any context conflict is resolved by preserving the receiving branch's existing entries and adding only this missing entry with original commit provenance. The assembled K5 head must prove `/kit/legacy-adapter.test.mjs`404 and `/kit/legacy-adapter.js`200 byte-equal, along with prior exclusions. Restamp after final commit. This is asset safety work, not source completion or a release authorization.
