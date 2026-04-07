#!/usr/bin/env python3
import argparse
import json
import random
from collections import Counter
from pathlib import Path

from data_utils import (
  assistant_fit_score,
  complexity_score,
  extract_pairs_from_messages,
  normalize,
  prompt_signature,
  read_jsonl,
  repeat_count_for_row,
  row_messages,
  should_skip_feedback_row,
  write_json,
  write_jsonl,
)


def iter_input_paths(inputs, input_globs):
  paths = []
  for item in inputs:
    paths.append(Path(item))
  for pattern in input_globs:
    paths.extend(sorted(Path().glob(pattern)))
  deduped = []
  seen = set()
  for path in paths:
    resolved = path.resolve()
    if resolved in seen:
      continue
    seen.add(resolved)
    deduped.append(path)
  return deduped


def build_prompt_from_history(history, max_history_turns):
  recent = history[-max_history_turns:]
  return "\n".join(recent + ["ASSISTANT:"])


def build_examples_from_messages(messages, max_history_turns):
  history = []
  examples = []
  for message in messages:
    role = str(message.get("role", "")).strip().lower()
    content = normalize(message.get("content", ""))
    if not content:
      continue
    if role == "assistant":
      prompt = build_prompt_from_history(history, max_history_turns)
      if prompt.strip():
        examples.append({"prompt": prompt, "completion": content, "history_context": "\n".join(history[-max_history_turns:])})
    history.append(f"{role.upper()}: {content}")
  return examples


def collect_examples(paths, deep_threshold, max_history_turns, min_prompt_chars, min_completion_chars, min_fit_score, max_duplicate_prompts, seed):
  prompt_seen = Counter()
  fast_rows = []
  deep_rows = []
  router_rows = []
  source_counts = Counter()
  rejected = Counter()

  for path in paths:
    file_rows = 0
    for row in read_jsonl(path):
      if should_skip_feedback_row(row):
        rejected["feedback_rejected"] += 1
        continue

      repeat_count = repeat_count_for_row(row)
      messages = row_messages(row)
      if not messages:
        rejected["unsupported_row"] += 1
        continue

      pairs = extract_pairs_from_messages(messages)
      if not pairs:
        rejected["no_pairs"] += 1
        continue

      for example in build_examples_from_messages(messages, max_history_turns):
        prompt = example["prompt"]
        completion = example["completion"]
        if len(prompt) < min_prompt_chars:
          rejected["prompt_too_short"] += 1
          continue
        if len(completion) < min_completion_chars:
          rejected["completion_too_short"] += 1
          continue

        complexity = complexity_score(example["history_context"] or prompt)
        role = "deep" if complexity >= deep_threshold else "fast"
        fit_score = assistant_fit_score(prompt, completion, role)
        if fit_score < min_fit_score:
          rejected["low_fit_score"] += 1
          continue

        signature = prompt_signature(prompt)
        for _ in range(max(repeat_count, 1)):
          if prompt_seen[signature] >= max_duplicate_prompts:
            rejected["duplicate_prompt_cap"] += 1
            break
          prompt_seen[signature] += 1
          train_row = {
            "prompt": prompt,
            "completion": completion,
            "fit_score": fit_score,
            "complexity": complexity,
            "source_file": path.name,
          }
          if role == "deep":
            deep_rows.append(train_row)
            router_rows.append({"text": prompt, "label": "deep", "fit_score": fit_score, "source_file": path.name})
          else:
            fast_rows.append(train_row)
            router_rows.append({"text": prompt, "label": "fast", "fit_score": fit_score, "source_file": path.name})
          file_rows += 1
    source_counts[path.name] += file_rows

  rng = random.Random(seed)
  rng.shuffle(fast_rows)
  rng.shuffle(deep_rows)
  rng.shuffle(router_rows)

  return {
    "fast": fast_rows,
    "deep": deep_rows,
    "router": router_rows,
    "source_counts": dict(source_counts),
    "rejected": dict(rejected),
  }


def cap_fast_rows(fast_rows, deep_rows, max_fast_to_deep_ratio):
  if not deep_rows:
    return fast_rows
  max_fast = int(len(deep_rows) * max_fast_to_deep_ratio)
  if len(fast_rows) <= max_fast:
    return fast_rows
  return fast_rows[:max_fast]


def cap_total_rows(rows, max_examples):
  if max_examples <= 0 or len(rows) <= max_examples:
    return rows
  return rows[:max_examples]


def main():
  parser = argparse.ArgumentParser(description="Prepare larger SFT and router datasets from multiple raw chat corpora.")
  parser.add_argument("--input", action="append", default=[], help="Input JSONL file. Repeat for multiple sources.")
  parser.add_argument("--input-glob", action="append", default=[], help="Glob pattern for input JSONL files.")
  parser.add_argument("--out-dir", required=True, help="Output directory")
  parser.add_argument("--deep-threshold", type=int, default=4, help="Complexity threshold for deep samples")
  parser.add_argument("--max-history-turns", type=int, default=6, help="Max prior turns kept in prompt context")
  parser.add_argument("--min-prompt-chars", type=int, default=12, help="Minimum prompt length")
  parser.add_argument("--min-completion-chars", type=int, default=24, help="Minimum completion length")
  parser.add_argument("--min-fit-score", type=int, default=0, help="Minimum assistant-fit score")
  parser.add_argument("--max-duplicate-prompts", type=int, default=3, help="Max repeated prompt signatures")
  parser.add_argument("--max-fast-to-deep-ratio", type=float, default=3.5, help="Cap fast rows relative to deep rows")
  parser.add_argument("--max-fast-examples", type=int, default=0, help="Optional hard cap for fast rows")
  parser.add_argument("--max-deep-examples", type=int, default=0, help="Optional hard cap for deep rows")
  parser.add_argument("--max-router-examples", type=int, default=0, help="Optional hard cap for router rows")
  parser.add_argument("--seed", type=int, default=42, help="Shuffle seed")
  args = parser.parse_args()

  paths = iter_input_paths(args.input, args.input_glob)
  if not paths:
    raise SystemExit("Provide at least one --input or --input-glob.")
  for path in paths:
    if not path.exists():
      raise SystemExit(f"Input file not found: {path}")

  out_dir = Path(args.out_dir)
  collected = collect_examples(
    paths,
    deep_threshold=args.deep_threshold,
    max_history_turns=args.max_history_turns,
    min_prompt_chars=args.min_prompt_chars,
    min_completion_chars=args.min_completion_chars,
    min_fit_score=args.min_fit_score,
    max_duplicate_prompts=args.max_duplicate_prompts,
    seed=args.seed,
  )

  fast_rows = cap_fast_rows(collected["fast"], collected["deep"], args.max_fast_to_deep_ratio)
  deep_rows = collected["deep"]
  router_rows = [row for row in collected["router"] if row["label"] == "deep"] + [row for row in collected["router"] if row["label"] == "fast"][: int(len(deep_rows) * args.max_fast_to_deep_ratio) or len(collected["router"])]

  fast_rows = cap_total_rows(fast_rows, args.max_fast_examples)
  deep_rows = cap_total_rows(deep_rows, args.max_deep_examples)
  router_rows = cap_total_rows(router_rows, args.max_router_examples)

  write_jsonl(out_dir / "fast_sft.jsonl", fast_rows)
  write_jsonl(out_dir / "deep_sft.jsonl", deep_rows)
  write_jsonl(out_dir / "router_train.jsonl", router_rows)
  write_json(
    out_dir / "summary.json",
    {
      "inputs": [str(path) for path in paths],
      "out_dir": str(out_dir),
      "deep_threshold": args.deep_threshold,
      "max_history_turns": args.max_history_turns,
      "min_fit_score": args.min_fit_score,
      "max_duplicate_prompts": args.max_duplicate_prompts,
      "max_fast_to_deep_ratio": args.max_fast_to_deep_ratio,
      "fast_examples": len(fast_rows),
      "deep_examples": len(deep_rows),
      "router_examples": len(router_rows),
      "source_counts": collected["source_counts"],
      "rejected": collected["rejected"],
    },
  )

  print(
    json.dumps(
      {
        "out_dir": str(out_dir),
        "fast_examples": len(fast_rows),
        "deep_examples": len(deep_rows),
        "router_examples": len(router_rows),
        "source_counts": collected["source_counts"],
        "rejected": collected["rejected"],
      },
      indent=2,
    )
  )


if __name__ == "__main__":
  main()
