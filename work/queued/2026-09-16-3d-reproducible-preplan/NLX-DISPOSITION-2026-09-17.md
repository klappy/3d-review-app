# Independent PR29 integration and NLX disposition receipt

PR29 integration independently verified; Grok’s twelve findings need differentiated dispositions, not twelve implementation orders.

Merge `bdb2b45f9c8afe0599f48094301ba509b36fbf1e` has first parent `5d9e26bf30ac747f177e97667d31d49eebdd4b86` and reviewed second parent `faaa8e7b272c90bf1845cd22dacf6e9c3ad95999`. All recursive trees were nontruncated. Only `18-I-testing.md` differs from the actual first parent; reviewed blob `572e0375e24906b670fff1efd2762737faf4b52a` is preserved exactly. The two concurrent NLX files are retained. **PASS-NARROW integration; no whole-plan acceptance.**

I paginated all issue14/15/17/19 comments: **185/69/23/41**. Read full Grok return [14c5708039148](https://github.com/klappy/3d-review-cookbook/issues/14#issuecomment-5708039148), linked report, scorecard, all eighteen cast files, current issue15 ownership, source code at app `10f5f444`, and B1/A5 tickets.

## Evidence qualifications

- C001–C003 contain some specific trace evidence. **C004–C018 are short scorecard-pointer stubs**, not replayable request/response records. Latest [17c5708037714](https://github.com/klappy/3d-review-cookbook/issues/17#issuecomment-5708037714) asserts twelve fresh probes but supplies no corresponding new traces/parameters.
- I independently reproduced **001 live**, read-only: query “how do I create an assessment” → `hits:[]`, trace `tr_OLwPDIqn5s6oPcFL`.
- Health `source_sha=0f44137` is explicitly the **cookbook capability-matrix source pin**. It neither identifies deployed app commit nor proves “no drift.” Source and observed health are consistent with app `10f5f444`; no deployment contradiction established.

## Twelve-item disposition

| ID | Classification and disposition | Existing owner / required next evidence |
|---|---|---|
| **001** | **Confirmed discovery defect.** Live empty natural-language search; source uses whole-query substring matching. | Fable **B1 docs corpus**, existing held PR21. Obtain current ACK and bounded correction plan; independent cold-agent replay must discover assessment setup from docs. |
| **002** | **Documentation/workflow mismatch; intentional effect boundary.** Email request is `write.effect` → `danger` in contract. Wrong-tool rejection is expected. | B1/B4 with existing Auth contract pen. Document/test correct anonymous-auth entry and confirmation semantics; do not reclassify send as reversible merely to avoid friction. |
| **003** | **Confirmed documentation incompleteness.** `pid` matches HTTP contract; general docs examples use empty `params:{}`. Rejecting `project_id` alone is not a bug. | B1/Fable: exact parameter/schema examples, fresh cold-agent journey. Alias proposal remains unaccepted and unnecessary to resolve discoverability. |
| **004** | **Positive journey unverified; negative isolation intentional.** Uninvited principal’s empty grants proves no unwanted access, not broken invitation. | Existing Fable grant/mail work, including app16. Grok must exercise correctly scoped owner invite → matching recipient acceptance → allowed reads and denied cross-scope reads. Do not seed grants merely to make it pass. |
| **005** | **Stage-policy/discovery tension; legacy reproduction.** Prepare→collect gate is intentional; code redemption is no longer participant acceptance. | B1/A5 plus existing Auth shared-link contract. Preserve collection closure; show correct next step and replay shared-link behavior. “Auto-open on select” is not an accepted fix. |
| **006** | **Source/schema behavior, with possible documentation/error gap.** Multi-select requires arrays; scalar rejection does not justify weakening source validation. | B1/B4, source owner retained. Obtain exact request/error receipt and source option/type match; test useful schema/hint and correct-array success. |
| **007** | **Intentional at current contract; not established defect.** `cap.ops.feedback` has `roles:"any"` and `public:true`. | Existing A7/Fable; preserve. OAuth transport changes in app15 must distinguish anonymous HTTP feedback from authenticated MCP. Abuse/privacy checks stay with existing Auth scope. |
| **008** | **Intentional danger boundary; documentation gap.** Invitation sends/discloses access and requires two-step confirmation. | B1/Fable, no new Auth worker. Supply exact scope plus dry-run/execute example and verify invited-user path. |
| **009** | **Documentation gap; security result unverified.** Missing `scope` correctly fails validation. The reported member→owner revoke never reached authorization, so proves no owner protection. | B1 + existing grant owner; Grok replay with valid scope and gid, assert owner/last-owner refusal and authorized positive revoke. |
| **010** | **Obsolete mandatory participant journey; retained legacy-handler question.** Batch code export cannot be counted as shared-link readiness or required participant setup. | Existing Auth contract reconciliation. Preserve historical evidence; classify legacy export separately. Subset/batch redesign is unaccepted, not a new automatic build order. |
| **011** | **Confirmed missing finished-app capability.** `support.acts_as` remains unimplemented; source explicitly leaves it 501, contract lists v2.0 capability. | Existing **A5/A3/A4**, coordinator/root ownership; D8 human-only provisioning/audit boundary preserved. Obtain bounded plan/active owner ACK. No “out-of-slice for demo” closure. |
| **012** | **Confirmed missing public result workflow plus intentional disclosure hold.** `results.summary` unconditionally returns held/null; private engine evidence does not make it callable. | Existing A5/report contract ownership: Astra bounded report pen, Fable other contract rows, coordinator dispatch. Source-faithful versioned output and existing D7 disposition required. No invented interim summary or privacy bypass. |

The new report’s suggestions to mark011 “out-of-slice” or ship012 an “interim summary for demo” are **unaccepted proposals**, conflicting with the completed-app goal if used as substitutes. Its “works” code sequence is historical legacy evidence, not shared-link acceptance.

## Ownership conclusion

I cannot honestly call these literally ownerless: B1 names Fable, A5 names Astra, report ownership is recorded. What is missing is an **active accountable claim and accepted next action**. The largest uncovered finished-app outcome is callable public results/reports; the clearest bounded independent blocker is **B1 discovery**, which affects001/002/003/005/006/008/009 simultaneously.

Minimal coordination: use existing issue15/B1 to request Fable/Auggie’s current claim, held-PR21 reconciliation and bounded plan; use existing issue14/A5/report record to obtain the public-results integration owner and next acceptance gate. Grok retains independent replay. Neither request should duplicate Auth/Design workers or fire broad implementation.

At original return no files, journals, comments or product state had changed. This local artifact is the subsequent root-requested record of that same substantive return, for root Git persistence; it grants no implementation or review authority.
