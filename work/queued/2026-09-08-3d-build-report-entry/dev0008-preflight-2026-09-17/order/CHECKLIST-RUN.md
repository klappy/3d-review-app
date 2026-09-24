# Operational checklist

- [x] Exact rollout plan ef7d1acc and independent review fe792f2e accepted; no semantic change in this order.
- [x] Coordinator read proposed order and readiness in full, verified all 12 preflight file hashes and independently recomputed exact request SQL hash.
- [x] Existing executor demonstrated fresh authenticated read-only DEV metadata/SQL access. Write permission is unproven until the actual authorized request; stop on refusal.
- [x] Source/version/build association and drained 22-build queue observed; parent metadata, absent report objects, clear FK check and 20 table counts recorded. These expire with state movement.
- [ ] Root records fresh schema custody/no competing writer and actual quiet acknowledgments. Silence or locked Mac is not an ACK.
- [ ] Root lands/readbacks this exact packet and issues scoped FIRE; no mutation START yet.
- [ ] Executor refreshes all prescribed window evidence immediately before the single request; coordinator independently checks result afterward.

Original read-only START 08:23:42Z is not the mutation clock. Initial failed compound SELECT was read-only and preserved; no blind reuse of old snapshot.
