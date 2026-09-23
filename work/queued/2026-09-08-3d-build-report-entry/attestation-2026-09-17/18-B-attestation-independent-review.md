# Independent attestation design review — CHANGES REQUIRED

Reviewed /tmp/3d-attestation-dish.md; planning only, no implementation or fire authorization.

## Concrete corrections before binding

1. Gold corpus contradiction: independent iteration over all 425 source-derived tuples found 301 omitted answers whose app items have required=true. Examples resp_syn_4f62b92d561dc1857fc4 / CHIP-Q2 and resp_syn_3f7366688ec3563c3d22 / TR-Q11. The proposed missing-required abort rejects existing gold inputs. Bind the actual generator mapping: omitted required answers remain absent; missing optional answers become null where the generator does so. Preserve missing vs null vs empty exactly; questionnaire requiredness is not permission to invent an answer or reject pinned gold. Add acceptance evidence for these 301 omissions.
2. Trust anchor: explicitly bind runtime to a compiled/reviewed expected index root and source/input/version pins, independently of the candidate index's self-reported root. A caller-supplied index with recomputed digests otherwise proves only internal consistency. Define the narrow test injection seam separately from production construction; reject modified index plus recomputed root. No signature is required for a fixed source artifact.
3. Exact hash contract: freeze the JSON preimage schemas and field names for entry/index/capture; name capture hash domain (not currently among four listed domains), sorting comparator and tie rejection. Clarify the index-root preimage excludes its own root. Fixed cross-implementation vectors must cover these full preimages, not merely a two-key JSON object.
4. Bound parser work before ordinary parse: specify maximum raw bytes, nesting depth, collection/string size and capture count from observed pinned corpus with documented headroom; over-limit yields bounded refusal. Startup/index budgets do not bound hostile stored JSON traversal. Typed ingress must define plain data objects and reject accessors/non-JSON prototypes rather than invoke getters/toJSON. Reject lone surrogates in keys as well as values.

## Actual prior-art search and reuse disposition

GitHub code searches actually executed for canonicalize user:klappy, 8785 user:klappy, and duplicate key user:klappy (limits 40). This is accessible house-wide search, not proof every private repository was visible. Oddkit search returned generic canon references, no matching implementation. Cartographer execute docs request returned INVALID_ARGUMENT; that schema-discovery failure is not repository access proof.

Read actual pinned source:
- klappy/ptxprint-mcp src/payload.ts @732c14624d0030cf39e40f48c7c94f33a9dce4c8
- klappy/appbuilder-mcp src/payload.ts @4e02dc49baf972de4b0cb05fc89123dfd13ff4cd (declares verbatim reuse of ptxprint).

Both implement sorted-key canonicalization and WebCrypto SHA256, but silently omit undefined object fields and do not enforce raw duplicate-key refusal, lone-surrogate rejection, safe-integer rejection, cycles or plain-object input. Therefore reuse the established UTF16 sorting/WebCrypto pattern and provenance, not either function as a security-complete drop-in. Scope any dependency selection to its own license/runtime/lockfile and independent vectors. Search hits in kitchen validation artifacts are not evidence of a ready canonical parser.

## Risk classification

Fetched live kitchen cookbook/tickets/TEMPLATE.md v1.2.0 and FIRE-CHECK.md v1.3.0 this review. TEMPLATE names ALLERGY for kitchen law, secrets, PII, captain voice, revenue or irreversibles. This scoped synthetic-only, non-wired, reversible utility has no observed matching ingredient; future possible disclosure alone does not establish a present allergen. Recommend STANDARD for this dish while preserving independent security review and classifying later disclosure integration on its actual inputs/actions. This is a scoped recommendation, not waiver of any genuine allergen or promotion hold.

## Preserved positives and remaining boundaries

Pinned source hashes, all-425 exact comparison, ambiguous-option and collision rejection, deduplicated template dictionary, old-known-subset semantics, exact-association metadata, no public identifiers/errors, bounded cost ceilings and separate query completeness/authorization are coherent. No change to Fable ownership, current-assessment policy, source scoring, narrative policy or public routes is proposed. Original negative controls remain intact. Oddkit CHALLENGED is not approval. Coordinator must amend/review then run applicable ticket/preflight/fire gates; this review does not fire work.

DOLCHEOT: observed design + corpus + pinned prior art; learned missing-required contradiction; challenged trust/preimage/resource boundaries; outcome changes required; handoff Otto for amendment/root persistence. This local review is not a landed journal row.

## Fresh revised-design review — scoped PASS

Observed 2026-09-16T21:07:34.036773-04:00; exact design SHA256 738c6e9f58efcd24f8b21cc705c3a47ecb28dc633ab61c6eb39e566c43ec4ffc. Full revised file reread; this supersedes the four open design findings above, preserving their historical evidence.

1. Missingness resolved: explicitly preserves all 301 required-item omissions and optional nulls, with refusal tests for absent-to-null/empty substitution. This matches the independently observed source mapping rather than questionnaire requiredness.
2. Trust resolved: separate compiled trust file binds root, source pin, four raw input digests and versions; no caller override; recomputed forged-index negative explicitly required. Test trust injection is separated from production construction.
3. Preimages resolved: exact template/entry/index/capture schemas, five domain prefixes, UTF16 comparator, duplicate-ID rejection and exclusion of root from its own preimage are specified. Full-preimage independent vectors are required; they are not yet produced or validated.
4. Resource boundary resolved: pre-parse byte limits, lexical depth/string/member limits, capture count, surrogate keys/values, typed-object restrictions and explicit raw-only production ingress are stated. Observed maxima are author measurements in this revision, not measurements rerun in this review; implementation must prove both gold acceptance and each over-limit refusal.

STANDARD classification and inspected prior-art reuse disposition are coherent for this isolated utility. Scoped PASS means the revised design resolves this review, not that a parser, trust artifact, budgets or attestation implementation exists or passes. No fire, public integration, source-policy change or promotion authorized. Applicable coordinator ticket, preflight, challenge and fire records remain separate.
