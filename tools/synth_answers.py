#!/usr/bin/env python3
"""Render Steve Watters' persona generator output into the app's synthetic answer sets.

Source of truth: captain fork klappy/3d-quality-review @ f042cde — survey-pipeline/synthetic/ (persona
definitions) rendered by run_synthetic_pipeline.py into an isolated synthetic_data/ tree. NOTHING under
survey-pipeline/data/raw (real Laos / Aushi exports, mock 'minnesota-nice') is read by this script.

usage: synth_answers.py <path to 3d-quality-review checkout> <out dir>
writes: answer-sets.json (one record per respondent submission, answers keyed by rubric item_id),
        manifest.json (counts + source pin), personas.json (respondent + project personas, for the demo cast)
"""
import csv, json, os, sys, glob, hashlib, re
src, out = sys.argv[1], sys.argv[2]
PIN = "f042cde553761a6a7f24132cef7802f956378ee0"
items = list(csv.DictReader(open(os.path.join(src, "rubric_csv/Items.csv"), encoding="utf-8-sig")))
opts = list(csv.DictReader(open(os.path.join(src, "rubric_csv/Options.csv"), encoding="utf-8-sig")))
by_form_q = {}
for it in items: by_form_q[(it["form_variant"], int(it["q_num"]))] = it
opt_by_item = {}
for o in opts: opt_by_item.setdefault(o["item_id"], []).append(o)
FORM_FILES = {  # rendered export filename stem → rubric form_variant
  "translators-validation": "Validation", "mid-level-quality-roles": "Mid-Level", "community-written": "Written",
  "community-audio": "Audio", "community-video-sign": "Video-Sign", "church-translation-consultant": "Consultant",
  "church-involved-pastor": "Involved-Pastor", "church-community-pastor": "Community-Pastor", "church-denominational-leader": "Denom-Leader",
}
sd = os.path.join(src, "survey-pipeline/synthetic_data/data")
ref = {n: list(csv.DictReader(open(os.path.join(sd, "reference", n + ".csv"), encoding="utf-8-sig"))) for n in ["projects", "languages", "assessments"]}
records, unmatched = [], {}
for path in sorted(glob.glob(os.path.join(sd, "raw", "*", "*", "*.csv"))):
    stem = os.path.basename(path)[:-4]
    form = next((v for k, v in FORM_FILES.items() if stem.endswith(k)), None)
    if not form: continue
    for row in csv.DictReader(open(path, encoding="utf-8-sig")):
        answers, meta = {}, {}
        for col, val in row.items():
            m = re.match(r"^Q(\d+[a-z]?) \| ", col)
            if not m:
                meta[col] = val; continue
            qn = int(re.sub(r"[a-z]$", "", m.group(1)))
            it = by_form_q.get((form, qn))
            if not it: unmatched[f"{form} Q{qn}"] = unmatched.get(f"{form} Q{qn}", 0) + 1; continue
            if val is None or val == "": continue
            chosen = [v.strip() for v in val.split(";")] if it["item_type"].startswith("multi") else [val.strip()]
            known = {o["option_text"] for o in opt_by_item.get(it["item_id"], [])} if opt_by_item.get(it["item_id"]) and "option_text" in opt_by_item[it["item_id"]][0] else None
            answers[it["item_id"]] = {"selected": chosen, **({"unknown_options": [c for c in chosen if c not in known]} if known and any(c not in known for c in chosen) else {})}
        aid = meta.get("assessment_id"); lang = aid.rsplit("-", 2)[0] if aid else None
        records.append({
            "submission_id": meta.get("submission_id"), "assessment_cycle": aid, "language_id": lang,
            "project_id": next((a["language_id"] for a in ref["assessments"] if a["assessment_id"] == aid), lang),
            "form_variant": form, "lens": by_form_q[(form, 1)]["lens"] if (form, 1) in by_form_q else None,
            "submitted_at": meta.get("submitted_at"), "respondent_persona": meta.get("respondent_identifier"),
            "synthetic": True, "answers": answers,
        })
os.makedirs(out, exist_ok=True)
json.dump(records, open(os.path.join(out, "answer-sets.json"), "w"), indent=1, ensure_ascii=False)
personas = {n: list(csv.DictReader(open(os.path.join(src, "survey-pipeline/synthetic/personas", n + ".csv"), encoding="utf-8-sig")))
            for n in ["ProjectPersonas", "RespondentPersonas", "TrajectoryPersonas"]}
json.dump(personas, open(os.path.join(out, "personas.json"), "w"), indent=1, ensure_ascii=False)
man = {"source": {"repo": "klappy/3d-quality-review", "pin": PIN, "generator": "survey-pipeline/run_synthetic_pipeline.py", "reads_real_exports": False},
       "rubric": {"items": len(items), "options": len(opts), "forms": sorted({i["form_variant"] for i in items})},
       "rendered": {"submissions": len(records), "assessment_cycles": len({r["assessment_cycle"] for r in records}), "projects": len({r["project_id"] for r in records}),
                    "by_form": {f: sum(1 for r in records if r["form_variant"] == f) for f in sorted({r["form_variant"] for r in records})},
                    "answers_total": sum(len(r["answers"]) for r in records)},
       "unmatched_columns": unmatched,
       "sha256": {n: hashlib.sha256(open(os.path.join(out, n), "rb").read()).hexdigest() for n in ["answer-sets.json", "personas.json"]}}
json.dump(man, open(os.path.join(out, "manifest.json"), "w"), indent=1)
print(json.dumps({k: man[k] for k in ["rubric", "rendered", "unmatched_columns"]}, indent=1))
