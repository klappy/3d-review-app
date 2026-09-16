#!/usr/bin/env python3
"""Project the exact pinned Steve rubric rollup maps into code-native JSON.

No participant rows are read. This does not resolve formula or D7 policy.
"""
import argparse
import csv
import hashlib
import io
import json
import subprocess
from pathlib import Path

SOURCE_SHA = "f042cde553761a6a7f24132cef7802f956378ee0"


def source_bytes(repo: str, name: str) -> bytes:
    return subprocess.check_output(["git", "-C", repo, "show", f"{SOURCE_SHA}:rubric_csv/{name}.csv"])


def rows(blob: bytes):
    return list(csv.DictReader(io.StringIO(blob.decode("utf-8-sig"))))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-repo", required=True)
    parser.add_argument("--output", default="src/pinned-report-model.json")
    args = parser.parse_args()
    item_blob = source_bytes(args.source_repo, "Items")
    sub_blob = source_bytes(args.source_repo, "SubDimensions")
    cross_blob = source_bytes(args.source_repo, "CrossLens")
    item_ids = {row["item_id"] for row in rows(item_blob)}
    assert len(item_ids) == 111
    subdimensions = [{
        "lens": row["lens"], "sub_dimension": row["sub_dimension"],
        "included_in_lens_score": row["included_in_lens_score"].strip().lower() == "yes",
    } for row in rows(sub_blob)]
    assert len(subdimensions) == 17
    assert len({(r["lens"], r["sub_dimension"]) for r in subdimensions}) == 17
    constructs = [{
        "code": row["construct_code"],
        "item_ids": [x.strip() for x in row["contributing_items"].split(",") if x.strip()],
        "categorical": row["construct_code"] == "translation-type-agreement",
    } for row in rows(cross_blob)]
    assert len(constructs) == 8
    assert len({r["code"] for r in constructs}) == 8
    for construct in constructs:
        assert set(construct["item_ids"]) <= item_ids, construct["code"]
    model = {
        "source": "klappy/3d-quality-review", "commit": SOURCE_SHA,
        "algorithm_reference": "survey-pipeline/pipeline/04_aggregate.py",
        "items_csv_sha256": hashlib.sha256(item_blob).hexdigest(),
        "subdimensions_csv_sha256": hashlib.sha256(sub_blob).hexdigest(),
        "crosslens_csv_sha256": hashlib.sha256(cross_blob).hexdigest(),
        "subdimensions": subdimensions, "constructs": constructs,
    }
    Path(args.output).write_text(json.dumps(model, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": args.output, "source": SOURCE_SHA, "subdimensions": 17, "constructs": 8}, sort_keys=True))


if __name__ == "__main__":
    main()
