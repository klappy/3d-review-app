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
# Options are copied onto Q1 from the same instrument's recorded Q2 row; there is no Q1 row upstream.
Q2_ITEMS = ("TR-Q2", "ML-Q2")
Q1_FROM_Q2 = {"TR-Q1": "TR-Q2", "ML-Q1": "ML-Q2"}
# Identity pins: amendment options plus church findings that must match exact source_ref/item bytes.
QUESTION_PINS = [
    ("tpl_validation", "TR-Q2"),
    ("tpl_mid_level", "ML-Q2"),
    ("tpl_validation", "TR-Q1"),
    ("tpl_mid_level", "ML-Q1"),
    ("tpl_involved_pastor", "CHIP-Q1"),
    ("tpl_community_pastor", "CHCP-Q1"),
    ("tpl_denom_leader", "CHDL-Q1"),
]
parser = argparse.ArgumentParser()
parser.add_argument("--source-repo", required=True)
parser.add_argument("--check", action="store_true")
args = parser.parse_args()
blob = subprocess.check_output(["git", "-C", args.source_repo, "show", f"{PIN}:rubric_csv/Options.csv"])
rows = list(csv.DictReader(io.StringIO(blob.decode("utf-8-sig"))))
options = {}
for item in Q2_ITEMS:
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
for template_id, item_id in QUESTION_PINS:
    source_ref, items = db.execute('SELECT source_ref,items_json FROM survey_template WHERE id=? AND version=2',(template_id,)).fetchone()
    canonical[item_id] = {'source_ref':source_ref,'item':next(i for i in json.loads(items) if i['id']==item_id)}
# Q1 wording is the same instrument's recorded Q2 option; insert before Other using Q1's Other order.
for q1, q2 in Q1_FROM_Q2.items():
    donor = options[q2]
    other = next(o for o in canonical[q1]['item']['options'] if o['code'] == 'other')
    options[q1] = {**donor, "source_order": int(other["source_order"])}
payload['options'] = options
payload['canonical_questions'] = canonical
db.close()
out = Path(__file__).resolve().parents[1] / "src/translation-brief-amendment.json"
content = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
if args.check:
    assert out.read_text() == content, "translation-brief amendment differs from pinned source"
else:
    out.write_text(content)
