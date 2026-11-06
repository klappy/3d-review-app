#!/usr/bin/env python3
"""Project Decision 25 from its exact upstream pin; never rewrite historical instruments."""
import argparse
import csv
import hashlib
import io
import json
import subprocess
import sqlite3
from pathlib import Path

PIN = "605edb47d2280568f0f5860f7b1921c12a814222"
parser = argparse.ArgumentParser()
parser.add_argument("--source-repo", required=True)
parser.add_argument("--check", action="store_true")
args = parser.parse_args()
blob = subprocess.check_output(["git", "-C", args.source_repo, "show", f"{PIN}:rubric_csv/Options.csv"])
rows = list(csv.DictReader(io.StringIO(blob.decode("utf-8-sig"))))
options = {}
for item in ("TR-Q2", "ML-Q2"):
    selected = [r for r in rows if r["item_id"] == item and r["option_code"] == "no-brief"]
    assert len(selected) == 1
    r = selected[0]
    assert r["flag"] == "descriptive" and not r["score (0-100)"] and not r["weight"]
    options[item] = {"code": r["option_code"], "text": r["option_text"], "source_order": int(r["option_order"]),
                     "source_score": None, "weight": None, "flag": r["flag"], "source_notes": r["notes"]}
payload = {"source": "klappy/3d-quality-review", "commit": PIN, "decision": 25,
           "options_csv_sha256": hashlib.sha256(blob).hexdigest(), "options": options}
root = Path(__file__).resolve().parents[1]
db = sqlite3.connect(':memory:')
for name in ['0001_init.sql','0002_code_escrow.sql','0003_language_archive.sql','0004_pinned_instruments.sql']:
    db.executescript((root/'migrations'/name).read_text())
canonical = {}
for template_id, item_id in [('tpl_validation','TR-Q2'),('tpl_mid_level','ML-Q2')]:
    source_ref, items = db.execute('SELECT source_ref,items_json FROM survey_template WHERE id=? AND version=2',(template_id,)).fetchone()
    canonical[item_id] = {'source_ref':source_ref,'item':next(i for i in json.loads(items) if i['id']==item_id)}
payload['canonical_questions'] = canonical
db.close()
out = Path(__file__).resolve().parents[1] / "src/translation-brief-amendment.json"
content = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
if args.check:
    assert out.read_text() == content, "translation-brief amendment differs from pinned source"
else:
    out.write_text(content)
