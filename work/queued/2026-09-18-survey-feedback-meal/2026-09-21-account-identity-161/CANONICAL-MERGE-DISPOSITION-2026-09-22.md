# Canonical 0.14.5 merge disposition — 2026-09-22

Observed 2026-09-22 04:53 UTC. Candidate cookbook PR101 head c04e816918cb7d06d79c24cb1b6ed3974ca631a1. Independent canonical ACCEPT 5f120cd41941a4dc8962ed4550f617291d62ace8.

Coordinator authorizes ordinary expected-head merge only after literal current Cursor Bugbot SUCCESS and all attached checks terminal, with immediate head refresh. STOP on changed head. Preserve the source branch; no deletion or overwrite and no assertion that an old cloud task terminated. Later cloud commits require separate disposition.

Current check106619500613 completed NEUTRAL: no new issues, one previously reported unresolved issue. Frontmatter106619495395 and106619485975 completed SUCCESS. Merge remains blocked; no override or merge performed.

## Factual disposition

Finding4068171475 alleged an ASCII apostrophe mutation in historical0.13.1. Base index blob5c999103b919975654d1f646a662c083d0414bba encodes JSON \\u2019; current index blobc381466dfc0054473c5bd648809b6294a5531b88 encodes literal U+2019. Both parse to code point8217. All prior version objects compare deep-equal. Exact PR diff contains only the new0.14.5 record, current/new entry and this equivalent raw escape normalization. Reply4068539418 records this evidence in the existing review thread and was read back. The factual disposition is not a successful service check.

## Policy and limits

Cookbook AGENTS blob127ef3d87d1c363aa5631bf1af891cd8f09412af binds kitchen HYGIENE §3, current blob7214e2c3fc4e1b0a613271dfca27ccc274cb5139. Literal BugbotSUCCESS applies. Comment-only promotion rule targets shared-head promotions such as main→production; PR101 is an isolated candidate branch→main, so no extra service-OFF requirement is inferred here. Cookbook .cursor/BUGBOT.md was not found at current main.

Historical Autofix106601937142 completed NEUTRAL timeout explicitly saying its task may still run. This is not termination evidence. Ordinary guarded merge authority above does not authorize source takeover. App shared-head production promotion separately requires actual service-setting evidence under app .cursor/BUGBOT.md; no verified OFF receipt exists. Candidate canonical commit is not a merged pin. App metadata draft preparation may proceed without claiming it is landed.

## Resolution and fresh review request

Coordinator explicitly authorized resolving only the evidenced false-positive thread and requesting the normal service rerun, not overriding a check. Thread PRRT_kwDOUGabQ86klox- resolved successfully; API returned is_resolved:true. Standard top-level `bugbot run` comment5771393423 submitted, supported by Cursor official documentation https://prod.cursor.com/docs/bugbot . Source unchanged. Await actual current-head service result before merge; resolution alone is not acceptance. If the service cannot rerun successfully, an isolated equivalent raw-escape restoration may be proposed under separately authorized fallback, with independent review and unchanged original cloud branch.
