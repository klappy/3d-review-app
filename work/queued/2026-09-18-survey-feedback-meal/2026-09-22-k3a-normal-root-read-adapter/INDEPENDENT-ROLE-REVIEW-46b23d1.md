# Independent role delta review — 46b23d1

AMEND narrow strict-role implementation at exact46b23d104d35fedd5d1d63eecfe8d124b67a384c, treef56a8c2c8e3dec1fd9ceff7ec56c39af9dadeb99, PR171. F1/F2 corrections remain unchanged from acceptedf52 source.

Independent exact checkout /tmp/k3a-independent-46b:8/8 app-adapter tests pass. Direct invocation confirms owner/member/viewer → Owner/Member/Viewer and admin → empty. However ui/kit/app-adapter.js roleLabel indexes an ordinary object: constructor returns Object's constructor function and __proto__ returns an object. Object.freeze does not remove inherited keys. These unknown roles do not yield the required empty string and can expose implementation text in labels. No backend permission escalation is claimed.

Required minimal correction: restrict lookup to own permitted keys (or null-prototype map/switch) and add both unknown-key regressions. Preserve exact known-role display. Reviewer made no product edits or browser actions. Full K3a browser/source-manifest/assets/reference acceptance remains pending; this is not a request for broader redesign or additional source custody.
