# DELTA — A8 corrective plan, September 16, 2026

Amendment version: 1.0.0. Author: Astra, available coordination writer after Auggie's explicit pen release. This is a revised order and planning receipt, not infrastructure implementation or a worker fire. Sources: existing A8 TICKET appendix at a6b4e250; app PR3 reviews5707212630 and5707471852; observed app baseline10f5f444; current HYGIENE, LIFECYCLE and FIRE-CHECK rules.

## Future operator's use and actual revision

Imagine the operator following the correction PR into the current DEV branch, then opening main/staging. The first merge already activates a Git deployment hook. A plan that labels it preparation while promising an unchanged DEV deployment hides a consequential transition from that operator.

The actual TICKET amendment now inserts a separately gated DEV integration: exact candidate review/checks/disposition; provider and data-preservation snapshots; Git-only correction delivery; build/version/bindings readback; reviewed compatible rollback. It then records the resulting DEV baseline that later main/staging delivery must preserve. A failed DEV checkpoint halts the later main work. The desired default-main/staging and separately promoted production topology is unchanged.

The revision also corrects the excluded runtime path to src/index.ts and sends any runtime/version-display hunk to its real owner. A generic stamp task cannot quietly acquire auth or contract code. It names actual Worker tag/repository/build-token associations as provider evidence to establish without exposing secrets.

## Alternatives considered and rejected

- Calling the correction merge nondeploy: contradicted by the current phase-0 trigger and ordinary push-build behavior.
- Silently disabling DEV's trigger: introduces an unreviewed control-plane sequence, hides delivery behavior and changes the agreed preservation boundary.
- Requiring every unrelated product PR to merge first: does not repair this deployment transition and creates an unnecessary dependency.
- Reusing current DEV state for staging, resetting databases, replaying seeds or manually uploading a Worker: violates isolation/data-preservation or Git-hook-only requirements.

## Falsifiers and pending gates

An unexpected target Worker, state binding, queued production build, migration/seed command, mismatched commit/version or undeclared runtime hunk falsifies readiness. Provider schemas alone do not prove trigger creation is inert or an undeployed Worker's secret lifecycle works.

This receipt satisfies the presence of an actual revised lens artifact. Post-lens challenge and independent review are separate receipts; executor ACK/budget and FIRE-CHECK remain pending. No retroactive gate compliance or product readiness is asserted.

## Narrow preparation lens revision — worker ACK2026-09-17T02:42:19.387Z

Future operator could mistake a request example for permission to apply it. Revise initial cargo to inert local documentation and prose DO-NOT-APPLY request descriptions outside active Wrangler; no runnable requests, fake resource IDs or active runtime/config edits. The worker evaluated waiting for resources versus guessing IDs: local nonexecuting preparation can proceed after its own gates while resource/provider execution remains separately blocked. Exact scope, six-B and actual narrower challenge02:43:04.947Z with responses are appended in TICKET.md under Astra/Otto binding. Original DELTA and broader independently accepted plan remain. This is not a fresh full-A8 fire or readiness claim.
