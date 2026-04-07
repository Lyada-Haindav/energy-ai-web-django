#!/usr/bin/env python3
import argparse
import json
import random
from collections import Counter, defaultdict
from pathlib import Path

from data_utils import (
  assistant_fit_score,
  complexity_score,
  normalize,
  prompt_signature,
  read_jsonl,
  repeat_count_for_row,
  row_messages,
  should_skip_feedback_row,
  write_json,
  write_jsonl,
)


ROOT_DIR = Path(__file__).resolve().parent.parent


def glob_jsonl_files(directory: Path):
  return sorted(list(directory.glob("*.jsonl")) + list(directory.glob("*.jsonl.gz")))


DEFAULT_GROUPS = {
  "seed": [
    ROOT_DIR / "data" / "energy_alignment_seed.jsonl",
    ROOT_DIR / "data" / "contest_alignment_seed.jsonl",
    ROOT_DIR / "data" / "coding_master_seed.jsonl",
    ROOT_DIR / "data" / "coding_followup_seed.jsonl",
    ROOT_DIR / "data" / "advanced_webapp_seed.jsonl",
    ROOT_DIR / "data" / "polyglot_coding_seed.jsonl",
    ROOT_DIR / "data" / "prompt_understanding_seed.jsonl",
    ROOT_DIR / "data" / "chat_behavior_seed.jsonl",
  ],
  "local_feedback": [
    ROOT_DIR / "data" / "local" / "user_live_pairs.jsonl",
    ROOT_DIR / "data" / "local" / "user_live_candidates.jsonl",
  ],
  "public": glob_jsonl_files(ROOT_DIR / "data" / "public"),
  "public_coding": glob_jsonl_files(ROOT_DIR / "data" / "public_coding"),
  "synthetic": sorted((ROOT_DIR / "data" / "datasets").glob("*.jsonl")),
}


def iter_group_rows(paths):
  for path in paths:
    if not path.exists():
      continue
    for row in read_jsonl(path):
      yield path, row


def score_messages(messages):
  if len(messages) < 2:
    return None
  user_messages = [message for message in messages if message["role"] == "user"]
  assistant_messages = [message for message in messages if message["role"] == "assistant"]
  if not user_messages or not assistant_messages:
    return None
  prompt = user_messages[-1]["content"]
  completion = assistant_messages[-1]["content"]
  complexity = complexity_score(prompt)
  role = "deep" if complexity >= 4 else "fast"
  fit_score = assistant_fit_score(prompt, completion, role)
  return {
    "prompt": prompt,
    "completion": completion,
    "complexity": complexity,
    "fit_score": fit_score,
    "role": role,
    "signature": prompt_signature(prompt),
  }


def select_rows(paths, max_rows, group_name, max_duplicate_prompts, min_fit_score, seed):
  rng = random.Random(seed)
  accepted = []
  prompt_seen = Counter()
  source_counts = Counter()
  rejected = Counter()

  for path, row in iter_group_rows(paths):
    if should_skip_feedback_row(row):
      rejected["feedback_rejected"] += 1
      continue
    messages = row_messages(row)
    if not messages:
      rejected["unsupported_row"] += 1
      continue
    score = score_messages(messages)
    if not score:
      rejected["missing_pair"] += 1
      continue
    if score["fit_score"] < min_fit_score:
      rejected["low_fit_score"] += 1
      continue
    repeats = min(max(repeat_count_for_row(row), 1), 3)
    for _ in range(repeats):
      if prompt_seen[score["signature"]] >= max_duplicate_prompts:
        rejected["duplicate_prompt_cap"] += 1
        break
      prompt_seen[score["signature"]] += 1
      accepted.append(
        {
          "messages": messages,
          "dataset": row.get("dataset") or path.stem,
          "source_group": group_name,
          "source_file": path.name,
          "fit_score": score["fit_score"],
          "complexity": score["complexity"],
        }
      )
      source_counts[path.name] += 1

  rng.shuffle(accepted)
  if max_rows > 0:
    accepted = accepted[:max_rows]
  return accepted, dict(source_counts), dict(rejected)


def main():
  parser = argparse.ArgumentParser(description="Build a larger curated raw chat corpus for advanced Energy AI training.")
  parser.add_argument("--out", default=str(ROOT_DIR / "data" / "processed" / "advanced" / "raw_large_mix.jsonl"), help="Output raw JSONL path")
  parser.add_argument("--metadata-out", default=str(ROOT_DIR / "data" / "processed" / "advanced" / "raw_large_mix.metadata.json"), help="Metadata JSON path")
  parser.add_argument("--max-seed", type=int, default=5000, help="Max curated seed rows")
  parser.add_argument("--max-local-feedback", type=int, default=20000, help="Max local feedback rows")
  parser.add_argument("--max-public", type=int, default=120000, help="Max public rows")
  parser.add_argument("--max-public-coding", type=int, default=220000, help="Max public coding rows")
  parser.add_argument("--max-synthetic", type=int, default=180000, help="Max synthetic rows")
  parser.add_argument("--max-duplicate-prompts", type=int, default=2, help="Max repeated prompt signatures per group")
  parser.add_argument("--min-fit-score", type=int, default=2, help="Minimum fit score per row")
  parser.add_argument("--seed", type=int, default=42, help="Shuffle seed")
  args = parser.parse_args()

  rows_by_group = {}
  summary = {"groups": {}, "totals": {}}
  all_rows = []

  for group_name, paths in DEFAULT_GROUPS.items():
    group_max = {
      "seed": args.max_seed,
      "local_feedback": args.max_local_feedback,
      "public": args.max_public,
      "public_coding": args.max_public_coding,
      "synthetic": args.max_synthetic,
    }[group_name]
    rows, source_counts, rejected = select_rows(
      paths=paths,
      max_rows=group_max,
      group_name=group_name,
      max_duplicate_prompts=args.max_duplicate_prompts,
      min_fit_score=args.min_fit_score,
      seed=args.seed + len(all_rows),
    )
    rows_by_group[group_name] = rows
    all_rows.extend(rows)
    summary["groups"][group_name] = {
      "selected_rows": len(rows),
      "source_counts": source_counts,
      "rejected": rejected,
    }

  random.Random(args.seed).shuffle(all_rows)
  write_jsonl(Path(args.out), all_rows)
  summary["totals"] = {
    "selected_rows": len(all_rows),
    "seed_rows": len(rows_by_group["seed"]),
    "local_feedback_rows": len(rows_by_group["local_feedback"]),
    "public_rows": len(rows_by_group["public"]),
    "public_coding_rows": len(rows_by_group["public_coding"]),
    "synthetic_rows": len(rows_by_group["synthetic"]),
  }
  write_json(Path(args.metadata_out), summary)

  print(json.dumps({"out": str(args.out), "metadata_out": str(args.metadata_out), **summary["totals"]}, indent=2))


if __name__ == "__main__":
  main()
