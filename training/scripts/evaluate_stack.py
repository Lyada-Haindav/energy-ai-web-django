#!/usr/bin/env python3
import argparse
import json
import os
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DJANGO_ROOT = PROJECT_ROOT / "django_server"
if str(DJANGO_ROOT) not in sys.path:
  sys.path.insert(0, str(DJANGO_ROOT))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "django_server.settings")

import django

django.setup()

from api.evaluation import EVALUATION_CASES, EVALUATION_SUITE_VERSION, evaluate_case, summarize_evaluation


def main():
  parser = argparse.ArgumentParser(description="Evaluate Energy AI routing, web grounding, and coding quality.")
  parser.add_argument("--write-json", default="", help="Optional output path for the evaluation summary JSON")
  args = parser.parse_args()

  rows = [evaluate_case(case) for case in EVALUATION_CASES]
  summary = summarize_evaluation(rows)
  summary = {
    "suiteVersion": EVALUATION_SUITE_VERSION,
    "summary": summary,
    "cases": rows,
  }
  if args.write_json:
    output_path = Path(args.write_json)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

  print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
  main()
