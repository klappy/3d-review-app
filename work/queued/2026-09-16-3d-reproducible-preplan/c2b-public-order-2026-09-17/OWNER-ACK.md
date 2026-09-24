# Actual C2a interface owner ACK

Received from a8_inert_author with actual C2a START 2026-09-17 07:41:08 UTC under root FIRE2dd5e730/k0236. No C2b FIRE inferred.

`observeBuildEligibility(ctx,assessmentId): Promise<{ok:true;marker:{assessment_id:string;eligible:boolean;policy_version:string}}|{ok:false;reason:'NOT_VISIBLE'|'UNAVAILABLE'}>`.

Authorized ineligible preview returns ok:true with marker.eligible:false, never HELD. Operational build/read/list HELD includes marker eligible:false; invisible/operational errors carry no marker. Existing actual read export is readMaterialized. C2a implementation is now running; this is an ACK of the interface, not proof the new code exists or passes.
