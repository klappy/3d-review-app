#!/usr/bin/env python3
"""Rebuild migration 0004 from the exact, pinned source commit.

Usage: python3 tools/build_pinned_instruments.py --source-repo /path/to/3d-quality-review
The source repo must contain the pinned commit. This script never edits that repo.
"""
import argparse
import csv
import hashlib
import io
import json
import subprocess
from collections import defaultdict
from pathlib import Path

SOURCE_SHA = "f042cde553761a6a7f24132cef7802f956378ee0"
FORM_IDS = {
    ("Translation Team", "Validation"): "tpl_validation",
    ("Translation Team", "Mid-Level"): "tpl_mid_level",
    ("Community", "Written"): "tpl_written",
    ("Community", "Audio"): "tpl_audio",
    ("Community", "Video-Sign"): "tpl_video_sign",
    ("Church", "Consultant"): "tpl_consultant",
    ("Church", "Involved-Pastor"): "tpl_involved_pastor",
    ("Church", "Community-Pastor"): "tpl_community_pastor",
    ("Church", "Denom-Leader"): "tpl_denom_leader",
}
TYPE_MAP = {
    "ordinal-scored": "single",
    "descriptive": "single",
    "multi-capability-scored": "multi",
    "multi-problem-scored": "multi",
    "open-text": "text",
}

def source_bytes(repo: str, name: str) -> bytes:
    return subprocess.check_output(["git", "-C", repo, "show", f"{SOURCE_SHA}:rubric_csv/{name}.csv"])

def rows(blob: bytes):
    return list(csv.DictReader(io.StringIO(blob.decode("utf-8-sig"))))

def quoted(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-repo", required=True)
    parser.add_argument("--output", default="migrations/0004_pinned_instruments.sql")
    args = parser.parse_args()
    item_blob, option_blob = source_bytes(args.source_repo, "Items"), source_bytes(args.source_repo, "Options")
    source_items, source_options = rows(item_blob), rows(option_blob)
    assert len(source_items) == 111, f"expected 111 items, got {len(source_items)}"
    assert len(source_options) == 498, f"expected 498 options, got {len(source_options)}"
    by_item = defaultdict(list)
    for option in source_options:
        by_item[option["item_id"]].append(option)
    assert set(by_item) == {item["item_id"] for item in source_items}
    by_form = defaultdict(list)
    for row in source_items:
        key = (row["lens"], row["form_variant"])
        if key not in FORM_IDS or row["item_type"] not in TYPE_MAP:
            raise ValueError(f"unknown pinned form/type: {key}, {row['item_type']}")
        kind = TYPE_MAP[row["item_type"]]
        # CSV has no required/branch/cardinality field. Permit omission of
        # open text/problem follow-ups as NULL while explicitly keeping their
        # requiredness and no-problems-vs-skipped semantics unresolved (FIX-T04).
        unresolved = row["item_type"] in {"open-text", "multi-problem-scored"}
        options = sorted(by_item[row["item_id"]], key=lambda o: int(o["option_order"]))
        item = {
            "id": row["item_id"], "group": row["sub_dimension"],
            "text": row["question_text"], "type": kind, "required": not unresolved,
            "requiredness": "unresolved" if unresolved else "working-required",
            "answer_semantics": "unresolved_no_problems_vs_skipped" if row["item_type"] == "multi-problem-scored" else None,
            "source_type": row["item_type"], "source_q_num": int(row["q_num"]),
            "source_score_max": float(row["score_max"]) if row["score_max"] else None,
            "source_weight_in_subdim": float(row["weight_in_subdim"]) if row["weight_in_subdim"] else None,
            "source_notes": row["notes"] or None,
            "source_cross_lens_construct": row["cross_lens_construct"] or None,
            "standalone_indicator": row["standalone_indicator"].strip().lower() in {"true", "1", "yes"},
        }
        if kind != "text":
            item["options"] = [{
                "code": o["option_code"], "text": o["option_text"],
                "source_order": int(o["option_order"]),
                "source_score": float(o["score (0-100)"]) if o["score (0-100)"] else None,
                "weight": float(o["weight"]) if o["weight"] else None,
                "flag": o["flag"] or None, "source_notes": o["notes"] or None,
            } for o in options]
        else:
            assert len(options) == 1 and options[0]["flag"] == "open", row["item_id"]
            # The source's single '[Free text]' option is provenance, not a
            # selectable choice; retain it without showing a fake radio button.
            item["source_open_option"] = options[0]
        by_form[key].append(item)
    assert len(by_form) == 9 and sum(len(v) for v in by_form.values()) == 111
    manifest = {
        "source": "klappy/3d-quality-review", "commit": SOURCE_SHA,
        "items_csv_sha256": hashlib.sha256(item_blob).hexdigest(),
        "options_csv_sha256": hashlib.sha256(option_blob).hexdigest(),
        "forms": 9, "items": 111, "options": 498,
        "mapping": "source question types to select/multi/text; no score calculation",
    }
    source_ref = f"klappy/3d-quality-review@{SOURCE_SHA}:rubric_csv/Items.csv+Options.csv"
    lines = [
        "-- Generated by tools/build_pinned_instruments.py from pinned source; do not hand-edit.",
        "-- Source commit: " + SOURCE_SHA,
        "-- 9 variants, 111 source items, 498 source options. Version 1 and its responses remain unchanged.",
        "-- Scoring and disclosure policy remain HELD; source scores/weights/flags are provenance only.",
        "-- Source manifest: " + json.dumps(manifest, sort_keys=True),
    ]
    for (lens, form), items in sorted(by_form.items()):
        template_id = FORM_IDS[(lens, form)]
        payload = json.dumps(items, ensure_ascii=False, separators=(",", ":"))
        scoring = json.dumps({"status": "held", "source_commit": SOURCE_SHA, "no_score_calculation": True}, separators=(",", ":"))
        lines.append(f"INSERT INTO survey_template (id, version, name, perspective, source_ref, items_json, scoring_json, rubric_ref, published_at) VALUES ({quoted(template_id)}, 2, {quoted(form)}, {quoted(lens)}, {quoted(source_ref)}, {quoted(payload)}, {quoted(scoring)}, {quoted(source_ref)}, strftime('%Y-%m-%dT%H:%M:%fZ','now'));")
    output = Path(args.output)
    output.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output), **manifest}, sort_keys=True))

if __name__ == "__main__":
    main()
