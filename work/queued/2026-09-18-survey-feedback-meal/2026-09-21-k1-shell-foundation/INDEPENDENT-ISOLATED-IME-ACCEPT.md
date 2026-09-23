# Independent K1 isolated IME acceptance

ACCEPT bounded exact PR165 headcd3fd21fc581238147620fbf29bc5e559274c76c, tree0fe8e364a156df914839b8dbfbf1a4fef148bb42, parent1b0ae83a9c79b17f2154317d29c035422e769fce. Exactly tree.js/shell.test.mjs delta independently inspected. This closes the prior composition-input destruction finding at this candidate, not original cloud PR162 or later integration heads.

Independent13/13 shell tests pass in isolated /tmp/3d-k1-independent-cd3, assembled from exact1b0ae83 archive plus both Git-fetched candidate files. Initial local archive attempt lacked candidate object; no tests ran until exact Git files were supplied. Composition retains the active input while composing, commits filter on compositionend and preserves selection range/direction, focus and mounted content. Captured element/current-generation checks and listener cleanup prevent detached composition/input events after model replacement or destroy from restoring old data. Normal search and canceled composition covered. No scope/role authority or controller change.

Author browser synthetic composition observations remain author-attributed; native OS IME is explicitly untested. No request to claim native-device proof from dispatched synthetic events. Prior shell visual/source acceptance remains applicable except this now-corrected input lifecycle; no new full-app visual pass claimed.

Before integration: fresh original-cloud-head comparison and meaningful delta preservation, terminal required checks, accepted K2 lineage/interface refresh and coordinator integration disposition. Timeout does not prove stopped cloud worker. No cloud branch edit, merge or deployment by reviewer.
