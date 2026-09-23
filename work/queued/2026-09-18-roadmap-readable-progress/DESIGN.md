# Roadmap: Past → Now → Next

**Default to Now.** Show what people are working on, why it matters, what is stopping it and the next action. Past sits to the left; Next sits to the right. These are workflow positions, not dates and not confidence scores.

```text
                    PAST  ←  [ NOW · selected ]  →  NEXT
                  Completed     In progress        Queued

 Now · 2 items                                  Show all Now
 ┌──────────────────────────────────────────────────────────┐
 │ Human feature name                                      │
 │ One sentence: the problem and intended improvement      │
 │ Planned | Built | Reviewed | DEV | Production           │
 │ Each cell: reported state + separate verification badge │
 │ Happening now: actual published work                    │
 │ Blocker: specific published cause, or not reported       │
 │ Next action: concrete owner-published action              │
 │ Reviewed context / evidence / history (secondary)       │
 └──────────────────────────────────────────────────────────┘
```

This is a layout illustration, not live data or a claim there are two current items.

## Classification is explicit

The existing permissioned summary publication gains a structured workflow position: `past`, `now`, or `next`, plus nullable clearing. It is independently public-suitability reviewed alongside the title and operational summary. The same public HTTP/MCP projection serves the browser. No additional publication authority is granted.

| Published workflow position | Window | Meaning |
| --- | --- | --- |
| `now` | Now | Work has actively started. An active blocker stays here with its cause and next recovery action. |
| `next` | Next | Proposed or queued future work, including parked work awaiting its turn. Explicit queue rank may order it; unranked work stays labeled unranked. |
| `past` | Past | Owner reports the work closed/completed. Show completion rationale and available delivery/user-outcome evidence; this classification does not itself verify success. |
| missing / cleared | Unclassified | Workflow placement not yet published. Keep a visible count and review list; never silently place these items in Now. |

Neither timestamps, missing attestations, all-Pending verifier stages, issue closure alone, nor a production claim automatically choose the window. An item can be **Past · reported complete · not independently verified**. An item can be **Now · production verified for an earlier release · follow-up in progress**. Classification and trust answer different questions.

## Navigation and default content

Desktop opens on the central Now window, with adjacent Past/Next navigation and visible counts. Selecting a neighbor changes the window, not the meaning of statuses. Keep the five lifecycle columns and current action/blocker/next action visible without disclosure clicks. A short human scope line appears under the feature title. Issue number is secondary.

Mobile keeps the same center-first order and labeled Previous/Next buttons; swipe is optional, never the only navigation. Cards retain the five stages in a compact matrix and stack the three operational lines below. No data is hidden solely behind hover. Empty Now says no active work is currently published and offers Next/Past; it does not claim nothing is happening.

Within Now, use explicit published priority/order if supplied, otherwise a stable ordering labeled as unordered; do not infer priority from edit recency. Within Next, use only explicit queue rank, with unranked items separate. Past can be ordered by its published completion context when available; otherwise stable ordering without invented completion dates. Stream receipt time is not completion time.

## Trust and freshness stay visible but secondary

Each stage separates **Reported** from **Verified**, retaining links to public evidence. Missing verification reads Not verified, never unstarted. Where no report exists, say Not reported. The page shows data freshness and stale/error notices in a compact line; protocol cursor, polling intervals and connection diagnostics live in a collapsed details panel.

Reviewed operational fields provide real `happening_now`, `blocker`, `next_action` and explicit queue context. Null clears stale context. A timestamp identifies when the operational summary was reviewed; it must not imply it is still current. Unknown action or blocker stays unknown. Delivery success does not imply user satisfaction.

## Fixed acceptance

1. Initial load centers Now and contains only explicitly active items; all-Pending/unclassified fixtures are not counted as active.
2. Past left and Next right work by keyboard and touch/visible controls, including empty windows, with meaningful labels and counts.
3. Without opening details, a newcomer can identify each feature, reported/verified five-stage state, current action, blocker and next action.
4. Past reported-only completion, Now blocked work and Next ranked/unranked work remain truthful under contradictory or missing attestations; no invented dates or queue positions.
5. Existing freshness/disconnect/redaction behavior and public-safe shared HTTP/MCP data remain intact; the original five newcomer and five creator tasks are re-run on the rendered candidate.

These are agent task checks, not a human satisfaction study. The creator baseline remains 0/5; the independent newcomer baseline remains not tested due browser timeouts. Actual human outcome is unmeasured.

## Scope and checkpoint

Separate issue140 / draft PR141, compatible MINOR0.14.0, after report-first PATCH0.13.1. Existing checkpoint8940c84 contains separate reported stages and reviewed operational fields, but its active/delivered grouping predates this explicit workflow design and is **not accepted as the final classification**. Stop implementing against that old inference and adapt only after this design checkpoint. No governance/voting, calendar planning, new feedback backend, auto-attestation or authorization changes.
