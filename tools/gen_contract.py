#!/usr/bin/env python3
"""A1 contract-v0.1 generator — projects contract/capabilities.json + contract/openapi.yaml
from the cookbook's 04-CAPABILITY-MATRIX.md. Mechanical; every inferred value is marked.
usage: gen_contract.py <path to 04-CAPABILITY-MATRIX.md> <cookbook sha> <out dir>
"""
import sys, re, json, yaml, hashlib, datetime

src, pin, out = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(src, encoding="utf-8").read()

CLASS = {"R": "read", "W": "write.reversible", "E": "write.effect", "D": "write.dangerous"}
TOOL = {"R": "read", "W": "write", "E": "danger", "D": "danger"}

# --- explicit inverse map for W rows (04 notes where stated; otherwise proposed, marked) ---
INVERSE = {
    "cap.workspace.archive": ("cap.workspace.unarchive", "04"),
    "cap.workspace.unarchive": ("cap.workspace.archive", "04"),
    "cap.project.archive": ("cap.project.unarchive", "04"),
    "cap.project.unarchive": ("cap.project.archive", "04"),
    "cap.assessment.archive": ("cap.assessment.unarchive", "04"),
    "cap.assessment.unarchive": ("cap.assessment.archive", "04"),
    "cap.survey.issue_link": ("cap.survey.revoke_link", "04 (true inverse while unsent)"),
    "cap.survey.issue_codes": ("cap.survey.revoke_code", "04 (while unredeemed)"),
    "cap.workspace.add_project": ("cap.workspace.remove_project", "proposed"),
    "cap.workspace.remove_project": ("cap.workspace.add_project", "proposed"),
    "cap.survey.select": ("cap.survey.deselect", "proposed (only while no responses)"),
    "cap.survey.deselect": ("cap.survey.select", "proposed (only while no responses; else archive-preserve, inverse none)"),
    "cap.workspace.create": ("cap.workspace.archive", "proposed (D5: create reverses to archive, never delete)"),
    "cap.project.create": ("cap.project.archive", "proposed (D5)"),
    "cap.assessment.create": ("cap.assessment.archive", "proposed (D5)"),
    "cap.workspace.update": ("self:restore-prior", "proposed (receipt carries prior values)"),
    "cap.project.update": ("self:restore-prior", "proposed"),
    "cap.assessment.update": ("self:restore-prior", "proposed"),
    "cap.assessment.notes.update": ("self:restore-prior", "proposed"),
    "cap.assessment.set_stage": ("self:reverse-step", "proposed (04-ACCEPTANCE row 16)"),
    "cap.support.unlock_participant": ("cap.survey.revoke_code", "proposed"),
}
NO_INVERSE = {  # W rows whose notes say undo=null or append-only; compensating control named
    "cap.survey.revoke_link": "re-issue (04: undo=null once sent)",
    "cap.survey.revoke_code": "re-issue",
    "cap.grant.revoke_invitation": "re-invite (04: does not unsend)",
    "cap.grant.revoke": "re-invite (04: what was seen stays seen)",
    "cap.response.submit": "amendment/retraction policy held under D6 (04)",
    "cap.response.assisted_next": "none needed — starts a distinct respondent (D6)",
    "cap.ops.feedback": "append-only",
    "cap.auth.consume_link": "cap.auth.logout (compensating)",
    "cap.auth.logout": "sign in again",
    "cap.participant.redeem_code": "token expiry (compensating)",
    "cap.participant.open_link": "token expiry (compensating)",
    "cap.request.create": "UNASSESSED — withdraw route not in 04",
    "cap.ops.undo": "n/a — this is the undo mechanism",
    "cap.report.build": "v2.1-oct — UNASSESSED",
    "cap.recommendation.propose": "v2.1-oct — UNASSESSED",
    "cap.recommendation.review": "v2.1-oct — UNASSESSED",
    "cap.import.batch": "v2.1-oct — UNASSESSED",
}
# public (no session) rows — 05 J14 @ 59be64c: three V reads + four "any" reads; plus ops.feedback (04-ACCEPTANCE row 33)
PUBLIC = {"cap.entry.intents", "cap.entry.example", "cap.ops.health", "cap.template.render",
          "cap.docs.get", "cap.docs.openapi", "cap.docs.capabilities", "cap.ops.feedback"}
COMPENSATE_RE = re.compile(r"compensate=(cap\.[a-z_.]+|[a-z ]+)")

# --- HTTP path inference for rows where 04 elides the path ---
PATH_FIX = {
    "cap.project.update": ("PATCH", "/v2/projects/{id}"),
    "cap.project.delete": ("DELETE", "/v2/projects/{id}"),
    "cap.assessment.list": ("GET", "/v2/projects/{pid}/assessments"),
    "cap.assessment.get": ("GET", "/v2/assessments/{id}"),
    "cap.assessment.update": ("PATCH", "/v2/assessments/{id}"),
    "cap.assessment.delete": ("DELETE", "/v2/assessments/{id}"),
    "cap.grant.update_role": ("PATCH", "/v2/{scope}/{id}/grants/{gid}"),
    "cap.grant.revoke": ("DELETE", "/v2/{scope}/{id}/grants/{gid}"),
    "cap.response.purge": ("DELETE", "/v2/assessments/{aid}/responses"),
    "cap.report.get": ("GET", "/v2/reports/{id}"),
    "cap.report.list": ("GET", "/v2/assessments/{aid}/reports"),
    "cap.rollup.project": ("GET", "/v2/projects/{id}/rollup"),
    "cap.rollup.workspace": ("GET", "/v2/workspaces/{id}/rollup"),
    "cap.support.unlock_participant": ("POST", "/v2/support/unlock"),
}
# parents for "…/x" paths, by section prefix
PARENT = {
    "cap.workspace.": "/v2/workspaces/{id}",
    "cap.project.": "/v2/projects/{id}",
    "cap.assessment.": "/v2/assessments/{id}",
    "cap.survey.": "/v2/assessments/{aid}",
    "cap.template.": "/v2/templates/{id}@{ver}",
    "cap.grant.": "/v2/{scope}/{id}/grants",
    "cap.recommendation.": "/v2/assessments/{aid}",
}

rows = []
section = None
for line in text.splitlines():
    m = re.match(r"^## ([A-K])\. (.+)$", line)
    if m:
        section = f"{m.group(1)}. {m.group(2)}"
    if line.startswith("| cap."):
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        cid, cls, http, who, ui, notes, slc = (cells + [""] * 7)[:7]
        rows.append(dict(id=cid, cls=cls, http=http, who=who, ui=ui, notes=notes, slice=slc, section=section))

assert len(rows) == 79, len(rows)

def infer_http(r):
    cid, http = r["id"], r["http"].replace("**", "")
    inferred = False
    if cid in PATH_FIX:
        return PATH_FIX[cid][0], PATH_FIX[cid][1], True
    m = re.match(r"^(GET|POST|PATCH|DELETE)\s+(\S+)$", http)
    if not m:
        raise SystemExit(f"cannot parse http for {cid}: {http!r}")
    method, path = m.group(1), m.group(2)
    if path.startswith("…"):
        for pre, parent in PARENT.items():
            if cid.startswith(pre):
                tail = path[1:]
                if pre == "cap.survey." and not tail.startswith("/surveys"):
                    tail = "/surveys/{sid}" + tail   # …/links/{id}, …/codes/{id}
                if pre == "cap.grant." and tail.startswith("/transfer"):
                    parent = "/v2/{scope}/{id}"
                if pre == "cap.template." and tail.startswith("/render"):
                    parent = "/v2/templates/{id}@{ver}"
                path = parent + tail
                inferred = True
                break
        else:
            raise SystemExit(f"no parent for {cid}: {path}")
    path = path.split("?")[0]
    return method, path, inferred

caps = []
for r in rows:
    method, path, inferred = infer_http(r)
    cls = CLASS[r["cls"]]
    entry = {
        "id": r["id"],
        "class": cls,
        "tool": TOOL[r["cls"]],
        "http": {"method": method, "path": path, "path_inferred": inferred},
        "roles": r["who"],
        "slice": r["slice"],
        "section": r["section"],
        "ui_surface": r["ui"],
        "notes": r["notes"],
        "status": "RESERVED_NOT_BUILT" if r["slice"] == "v2.1-oct" else "target",
    }
    if r["cls"] == "R":
        entry["inverse"] = {"kind": "n/a"}
    elif r["cls"] == "W":
        if r["id"] in INVERSE:
            tgt, prov = INVERSE[r["id"]]
            entry["inverse"] = {"kind": "true", "via": tgt, "provenance": prov}
        elif r["id"] in NO_INVERSE:
            entry["inverse"] = {"kind": "none", "compensating_control": NO_INVERSE[r["id"]]}
        else:
            entry["inverse"] = {"kind": "UNASSESSED"}
        entry["undo_token"] = entry["inverse"]["kind"] == "true"
    else:  # E / D
        m = COMPENSATE_RE.search(r["notes"])
        entry["inverse"] = {"kind": "none", "compensating_control": (m.group(1) if m else "UNASSESSED — see 17-IRREVERSIBILITY")}
        entry["undo_token"] = False
        entry["danger"] = {"two_step": True, "modes": ["dry_run", "execute"], "twin_never_get": True,
                           "effect": "external" if r["cls"] == "E" else "destructive"}
        if method == "GET":
            raise SystemExit(f"E/D twin is GET: {r['id']}")
    # public rows (no session)
    entry["public"] = r["id"] in PUBLIC
    caps.append(entry)

counts = {}
for c in caps:
    counts[c["class"]] = counts.get(c["class"], 0) + 1

manifest_caps = {
    "contract": "contract-v0.1",
    "status": "DRAFT — projected by Fable from cookbook 04 @ " + pin + "; Lane A (Astra/Otto) accepts, amends or replaces",
    "generated_at": datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
    "source": {"repo": "klappy/3d-review-cookbook", "path": "planning/2026-09-16-parity-build/04-CAPABILITY-MATRIX.md", "sha": pin},
    "counts": {"total": len(caps), **counts,
               "v2.0-bcs": sum(1 for c in caps if c["slice"] == "v2.0-bcs"),
               "v2.1-oct": sum(1 for c in caps if c["slice"] == "v2.1-oct"),
               "paths_inferred": sum(1 for c in caps if c["http"]["path_inferred"]),
               "inverse_unassessed": sum(1 for c in caps if c["inverse"]["kind"] == "UNASSESSED")},
    "tools": ["docs", "read", "write", "danger"],
    "errors": ["NOT_AUTHENTICATED", "NOT_AUTHORIZED_AT_SCOPE", "WRONG_TOOL_FOR_CLASS", "CONFIRM_REQUIRED", "CONFIRM_EXPIRED",
               "INVALID_PARAMS", "NOT_FOUND_OR_NOT_VISIBLE", "STAGE_CONFLICT", "RESERVED_NOT_BUILT", "NO_INVERSE"],
    "suppressed_is_success": True,
    "capabilities": caps,
}
open(f"{out}/capabilities.json", "w").write(json.dumps(manifest_caps, indent=2, ensure_ascii=False) + "\n")

# ---------------- openapi.yaml ----------------
def op(c):
    o = {
        "operationId": c["id"],
        "summary": f"{c['id']} — {c['class']} — roles: {c['roles']}",
        "x-capability": c["id"], "x-class": c["class"], "x-tool": c["tool"], "x-slice": c["slice"],
        "x-inverse": c["inverse"], "x-roles": c["roles"], "x-path-inferred": c["http"]["path_inferred"],
        "tags": [c["section"]],
        "responses": {
            "200": {"description": "ok envelope", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Envelope"}}}},
            "4XX": {"description": "error envelope", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/ErrorEnvelope"}}}},
        },
    }
    if c["status"] == "RESERVED_NOT_BUILT":
        o["responses"] = {"501": {"description": "RESERVED_NOT_BUILT — documented, docs pointer; v2.1-oct",
                                  "content": {"application/json": {"schema": {"$ref": "#/components/schemas/ErrorEnvelope"}}}}}
        o["x-status"] = "RESERVED_NOT_BUILT"
    if not c["public"]:
        o["security"] = [{"session": []}, {"bearer": []}, {"participant": []}]
    else:
        o["security"] = []
    if c["class"] in ("write.effect", "write.dangerous"):
        o["requestBody"] = {"required": True, "content": {"application/json": {"schema": {"$ref": "#/components/schemas/DangerBody"}}}}
        o["responses"]["200"]["description"] = "dry_run → Impact + confirm_token; execute → receipt (inverse none)"
    elif c["class"] == "write.reversible" and c["http"]["method"] in ("POST", "PATCH"):
        o["requestBody"] = {"required": False, "content": {"application/json": {"schema": {"type": "object", "additionalProperties": True,
                              "description": "params — shape owed per capability (A1 open item)"}}}}
    params = re.findall(r"\{(\w+)\}", c["http"]["path"])
    if params:
        o["parameters"] = [{"name": p, "in": "path", "required": True, "schema": {"type": "string"}} for p in params]
    return o

paths = {}
for c in caps:
    paths.setdefault(c["http"]["path"], {})[c["http"]["method"].lower()] = op(c)

openapi = {
    "openapi": "3.1.0",
    "info": {"title": "3D Review API — contract-v0.1 (DRAFT)", "version": "0.1.0-draft",
             "description": f"Projected from cookbook 04 @ {pin} by Fable. 79 capabilities; every capability is also reachable via MCP docs/read/write/danger over the same handlers (prd/18-D). Paths marked x-path-inferred were elided in 04 and need Lane A confirmation. SUPPRESSED is ok:true. Danger twins are never GET."},
    "servers": [{"url": "https://{host}/", "variables": {"host": {"default": "TBD-OF-2"}}}],
    "components": {
        "securitySchemes": {
            "session": {"type": "apiKey", "in": "cookie", "name": "session", "description": "Cloudflare email-code login → HttpOnly cookie (18-C)"},
            "bearer": {"type": "http", "scheme": "bearer", "description": "delegated agent bearer — acts as a user, never as a role (18-C / MCP-REQ-007)"},
            "participant": {"type": "http", "scheme": "bearer", "description": "participant token from redeem_code / open_link, bound to one assessment survey"},
        },
        "schemas": {
            "Receipt": {"type": "object", "required": ["id", "actor", "scope", "class", "trace_id", "at"],
                        "properties": {"id": {"type": "string"}, "actor": {"type": "string"},
                                       "scope": {"type": "object", "properties": {"type": {"type": "string", "enum": ["workspace", "project", "assessment", "survey", "platform"]}, "id": {"type": "string"}}},
                                       "class": {"type": "string", "enum": ["read", "write.reversible", "write.effect", "write.dangerous"]},
                                       "undo_token": {"type": "string", "description": "present only when the row declares a true inverse"},
                                       "inverse": {"type": "string", "description": "capability id or 'none'"},
                                       "compensating_control": {"type": "string"},
                                       "trace_id": {"type": "string"}, "at": {"type": "string", "format": "date-time"}}},
            "Envelope": {"type": "object", "required": ["ok", "capability", "result"],
                         "properties": {"ok": {"const": True}, "capability": {"type": "string"},
                                        "result": {"type": "object", "additionalProperties": True,
                                                   "properties": {"suppressed": {"type": "boolean", "description": "small-cell suppression applied; this is a success state"}}},
                                        "receipt": {"$ref": "#/components/schemas/Receipt"}}},
            "ErrorEnvelope": {"type": "object", "required": ["ok", "error"],
                              "properties": {"ok": {"const": False},
                                             "error": {"type": "object", "required": ["code", "message"],
                                                       "properties": {"code": {"type": "string", "enum": manifest_caps["errors"]},
                                                                      "message": {"type": "string"}, "hint": {"type": "string"},
                                                                      "docs": {"type": "string", "description": "capability id or topic"}}}}},
            "Impact": {"type": "object", "required": ["affected", "irreversible", "effect"],
                       "properties": {"affected": {"type": "array", "items": {"type": "object"}}, "irreversible": {"type": "boolean"},
                                      "effect": {"type": "string", "enum": ["external", "disclosure", "destructive"]}, "retention": {"type": "string"},
                                      "compensating_control": {"type": "string"}}},
            "DangerBody": {"type": "object", "required": ["mode"],
                           "properties": {"mode": {"type": "string", "enum": ["dry_run", "execute"]},
                                          "confirm_token": {"type": "string", "description": "required for execute; bound to intent; TTL per 18-C"},
                                          "params": {"type": "object", "additionalProperties": True}}},
            "DryRunResult": {"type": "object", "properties": {"impact": {"$ref": "#/components/schemas/Impact"}, "confirm_token": {"type": "string"}, "expires_in": {"type": "integer"}}},
        },
    },
    "paths": paths,
    "x-contract": {"name": "contract-v0.1", "status": "DRAFT", "source_sha": pin, "tools": manifest_caps["tools"],
                   "parity_rule": "for every capability, HTTP twin and MCP tool return receipts equal after normalizing id/trace_id/at (MCP-REQ-013)"},
}
open(f"{out}/openapi.yaml", "w").write(yaml.safe_dump(openapi, sort_keys=False, allow_unicode=True, width=120))

# ---------------- contract-manifest.json (bundle freeze state) ----------------
bundles = {}
for c in caps:
    b = c["section"].split(".")[0]
    bundles.setdefault(b, {"section": c["section"], "capabilities": [], "state": "open", "frozen_sha": None, "open_items": []})
    bundles[b]["capabilities"].append(c["id"])
    if c["http"]["path_inferred"]:
        bundles[b]["open_items"].append(f"{c['id']}: path inferred, confirm")
    if c["inverse"]["kind"] == "UNASSESSED":
        bundles[b]["open_items"].append(f"{c['id']}: inverse UNASSESSED")
    if c["class"] != "read" and c["class"] != "write.effect" and c["class"] != "write.dangerous":
        pass
manifest = {"contract": "contract-v0.1", "status": "DRAFT — no bundle frozen", "source_sha": pin,
            "rule": "a bundle freezes when Lane A marks it frozen_sha; one open bundle does not hold frozen ones (MASTER §per-bundle)",
            "params_schemas": "OWED — per-capability input/output schemas are the next A1 increment; this draft fixes ids, classes, tools, twins, roles, inverses and the shared envelope",
            "bundles": bundles}
open(f"{out}/contract-manifest.json", "w").write(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
print(json.dumps(manifest_caps["counts"]))
