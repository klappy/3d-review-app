# Planning recipe: retrieve the needed source lines

Status: live-schema-verified usage recipe, 2026-09-17. The private cookbook repository-map attempt returned access_denied; this full mapped sequence has NOT been demonstrated end to end in this session. Direct authorized file read succeeded. Do not confuse those capabilities.

Each planning/worker brief should give: repository, pinned commit, exact path(s), question/decision, relevant heading or search phrase, known source range if available, and refresh condition. Do not add a new approval gate or a mandatory whole-corpus reading list.

## Existing map: smallest useful path

Use Cartographer docs {capability:NAME} once to fetch a capability's actual schema; reuse it. execute calls below use actual returned IDs, never these placeholders.

1. If you already have the correct authorized repo_corpus pinned to the required SHA, reuse it. Otherwise execute consult_repo with {owner:"klappy",repo:"3d-review-cookbook",sha:"<verified full commit>"}. A ref follows a branch and may resolve a new commit; sha stays pinned. Record returned repo_corpus/resolved identity. Do not request a broad continent or every document body.
2. Known file: execute zoom with {repo_corpus:"<returned repo map ID>",path:"<exact repo path>",body:false}. Read the heading/line skeleton; retain returned document corpus ID. body:true returns the whole document and is usually the wrong choice.
3. If the heading already locates the needed lines, skip search. Otherwise execute locate with {corpus:"<returned document corpus ID>",query:"<specific phrase or question>",k:2}. exact:true additionally asks for literal substring matching. Search results are navigation, not acceptance evidence.
4. Execute open with {corpus:"<same document corpus ID>",range:"L120-L160"}, using the actual discovered range, not this example. Alternative parameters are start:120,end:160. Read enough surrounding lines to preserve conditions/exceptions. Cite repository+commit+path+range with the claim.
5. Expand only when the opened passage leaves a relevant question unanswered. Preserve pointers/hashes and the conclusion so peers do not repeatedly load unchanged documents. Refresh changed refs and applicable rules honestly; do not reuse stale acceptance across a changed head.

Unknown file: fetch docs {capability:"find"} then use repo search with bounded query/prefix; do not dump the entire repository merely to locate one source. The schema must be consulted before first use.

## Capability gaps and fallback

The current read_repo_file schema has owner/repo/ref-or-sha/path only. It returns the COMPLETE file, up to8MiB, and creates no document corpus. It does not accept range/start/end and is not the ranged reader. Do not invent those parameters.

If consult_repo or zoom is access_denied, state that precise missing capability and use authorized Git retrieval filtered in the tool runtime before output reaches the model. For example, fetch the pinned raw source into a local file, then use rg -n to locate an exact phrase and sed -n '120,160p' for the discovered range. Keep the original file and pin for review. Select semantic regions, not an arbitrary truncation that may omit the answer. No credential values in calls or logs.

Do not feed private source into consult with visibility:public as a workaround. consult's inline/URL ingestion explicitly requires public classification. No permission expansion is implied by a read failure.

Repository mapping parses source server-side; zero model-token mapping work does not mean zero response tokens or zero latency. Cold-map preparation may be slow. Budget the response and use an existing pinned map where available. Safe public telemetry is currently unavailable; do not invent token savings or total session costs.

The method belongs inside ordinary planning as a small source-extraction plan. It is not a separate planning sprint or tooling implementation. Product work continues while later direct-file range/compact PR projection improvements are recorded in LEARNING-2026-09-17-FOCUSED-RETRIEVAL.md.
