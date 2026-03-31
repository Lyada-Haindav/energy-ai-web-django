#!/usr/bin/env python3
import argparse
import json
import math
import random
import re
from collections import Counter, defaultdict
from pathlib import Path

WORD_RE = re.compile(r"[A-Za-z0-9']+")
TOKEN_RE = re.compile(r"[A-Za-z0-9']+|[.,!?;:]")
LOW_QUALITY_DATA_PATTERNS = [
  re.compile(r"\bayy\s+lmao\b", re.IGNORECASE),
  re.compile(r"\bgrumpy cat\b", re.IGNORECASE),
  re.compile(r"\bbefore we wrap up\b", re.IGNORECASE),
  re.compile(r"\binterviewer\b", re.IGNORECASE),
  re.compile(r"\bepisode\b", re.IGNORECASE),
  re.compile(r"\bhost\b", re.IGNORECASE)
]
LOW_SIGNAL_PROMPT_PATTERNS = [
  re.compile(r"\b(caption|instagram|tweet|selfie|photo|image prompt)\b", re.IGNORECASE),
  re.compile(r"\b(generate|write|create)\b.*\b(story|poem|lyrics?)\b", re.IGNORECASE),
  re.compile(r"\bmake\s+\d+\s+more\b", re.IGNORECASE),
  re.compile(r"\b(roleplay|fanfic|character prompt)\b", re.IGNORECASE)
]
CONTEST_SIGNAL_PATTERNS = [
  re.compile(r"\b(leetcode|codeforces|codechef|hackerrank|contest|competitive programming)\b", re.IGNORECASE),
  re.compile(r"\b(input format|output format|constraints?)\b", re.IGNORECASE),
  re.compile(r"\b(subarray|substring|graph|tree|grid|matrix|intervals?|prefix sum|sliding window|two pointers|dynamic programming|dp|dijkstra|topological|union find|disjoint set|kadane|binary search on answer)\b", re.IGNORECASE),
  re.compile(r"(?:\b[nmk]\b|\brows\b|\bcols\b)\s*(?:<=|<)\s*\d+", re.IGNORECASE)
]
ASSISTANT_FIT_KEYWORDS = {
  "explain",
  "what",
  "how",
  "why",
  "compare",
  "build",
  "create",
  "design",
  "debug",
  "fix",
  "code",
  "function",
  "plan",
  "architecture",
  "api",
  "react",
  "python",
  "javascript",
  "typescript",
  "system",
  "contest",
  "algorithm",
  "array",
  "string",
  "graph",
  "tree",
  "subarray",
  "substring",
  "dynamic",
  "programming",
  "dp",
  "greedy",
  "heap",
  "stack",
  "queue",
  "binary",
  "search",
  "shortest",
  "path"
}


def read_jsonl(path: Path):
  with path.open("r", encoding="utf-8") as file:
    for line in file:
      raw = line.strip()
      if not raw:
        continue
      yield json.loads(raw)


def write_json(path: Path, payload):
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")


def normalize(text: str) -> str:
  return re.sub(r"\s+", " ", text).strip()


def quality_signal(row) -> str:
  return normalize(str(row.get("quality_signal", row.get("quality", "")))).lower()


def feedback_signal(row) -> str:
  return normalize(str(row.get("feedback", ""))).lower()


def should_skip_feedback_row(row) -> bool:
  quality = quality_signal(row)
  feedback = feedback_signal(row)
  return quality in {"rejected", "reject", "downvote", "negative"} or feedback in {"down", "downvote", "negative"}


def repeat_count_for_row(row) -> int:
  quality = quality_signal(row)
  feedback = feedback_signal(row)

  if quality in {"corrected", "correction"} or feedback == "correction":
    return 3
  if quality in {"approved", "positive"} or feedback in {"up", "upvote", "positive"}:
    return 2
  return 1


def tokenize_words(text: str):
  return WORD_RE.findall(text.lower())


def tokenize_generation(text: str):
  return TOKEN_RE.findall(text.lower())


def looks_low_quality(text: str) -> bool:
  compact = normalize(text)
  if len(compact) < 8:
    return True

  if compact.lower().startswith(("user:", "assistant:")):
    return True

  for pattern in LOW_QUALITY_DATA_PATTERNS:
    if pattern.search(compact):
      return True

  words = compact.lower().split()
  if len(words) >= 12:
    seen = set()
    for idx in range(0, len(words) - 3):
      phrase = " ".join(words[idx : idx + 4])
      if phrase in seen:
        return True
      seen.add(phrase)

  return False


def looks_low_quality_prompt(text: str) -> bool:
  compact = normalize(text)
  if len(compact) < 6:
    return True

  if compact.lower().startswith(("user:", "assistant:")):
    return True

  for pattern in LOW_SIGNAL_PROMPT_PATTERNS:
    if pattern.search(compact):
      return True

  return False


def complexity_score(text: str) -> int:
  score = len(text.split()) // 40
  keywords = [
    "analyze",
    "architecture",
    "train",
    "debug",
    "compare",
    "design",
    "optimize",
    "tradeoff",
    "code",
    "system",
    "reason",
    "scalable",
    "production",
    "subarray",
    "substring",
    "graph",
    "tree",
    "dynamic programming",
    "dp",
    "greedy",
    "dijkstra",
    "topological",
    "union find",
    "constraints"
  ]

  lowered = text.lower()
  for token in keywords:
    if token in lowered:
      score += 1

  if "\n" in text:
    score += 1
  if re.search(r"(?:\b[nmk]\b|\brows\b|\bcols\b)\s*(?:<=|<)\s*\d+", text, re.IGNORECASE):
    score += 1
  if any(pattern.search(text) for pattern in CONTEST_SIGNAL_PATTERNS):
    score += 1

  return score


def assistant_fit_score(prompt: str, completion: str, role: str) -> int:
  prompt_norm = normalize(prompt)
  completion_norm = normalize(completion)
  prompt_lower = prompt_norm.lower()
  completion_lower = completion_norm.lower()
  score = 0

  if looks_low_quality_prompt(prompt_norm):
    score -= 6
  if looks_low_quality(completion_norm):
    score -= 6

  prompt_words = len(prompt_norm.split())
  if 3 <= prompt_words <= 80:
    score += 2
  if prompt_norm.endswith("?") or prompt_lower.startswith(
    ("what", "how", "why", "explain", "write", "build", "design", "debug", "compare", "create", "implement")
  ):
    score += 2

  if any(keyword in prompt_lower for keyword in ASSISTANT_FIT_KEYWORDS):
    score += 2
  if any(pattern.search(prompt_norm) for pattern in LOW_SIGNAL_PROMPT_PATTERNS):
    score -= 4
  if any(pattern.search(prompt_norm) for pattern in CONTEST_SIGNAL_PATTERNS):
    score += 3

  if 60 <= len(completion_norm) <= 1600:
    score += 1
  if "```" in completion_norm or "\n1)" in completion_norm or "\n1." in completion_norm or "\n- " in completion_norm:
    score += 1
  if any(
    token in completion_lower
    for token in ["o(", "complexity", "edge case", "sliding window", "prefix sum", "hash map", "priority queue", "dynamic programming"]
  ):
    score += 2
  if "i am energy ai" in completion_lower or "uncertain" in completion_lower or "sources" in completion_lower:
    score += 1

  prompt_complexity = complexity_score(prompt_norm)
  if role == "deep" and prompt_complexity >= 3:
    score += 1
  if role == "fast" and prompt_complexity <= 2:
    score += 1

  return score


def extract_pairs_from_messages(messages):
  pairs = []
  latest_user = None

  for message in messages:
    role = str(message.get("role", "")).strip().lower()
    content = normalize(str(message.get("content", "")))

    if not content:
      continue

    if role == "user":
      latest_user = content
      continue

    if role == "assistant" and latest_user:
      pairs.append((latest_user, content))

  return pairs


def balance_router_examples(router_examples, max_fast_to_deep_ratio, seed):
  fast = [row for row in router_examples if row[1] == "fast"]
  deep = [row for row in router_examples if row[1] == "deep"]

  if not deep:
    return router_examples

  max_fast = int(len(deep) * max_fast_to_deep_ratio)
  if len(fast) <= max_fast:
    return router_examples

  rng = random.Random(seed)
  rng.shuffle(fast)
  return fast[:max_fast] + deep


def collect_examples(input_paths, deep_threshold, max_duplicate_prompts, max_fast_to_deep_ratio, seed):
  fast_examples = []
  deep_examples = []
  router_examples = []
  prompt_seen = Counter()

  for input_path in input_paths:
    for row in read_jsonl(input_path):
      if "messages" in row and isinstance(row["messages"], list):
        pairs = extract_pairs_from_messages(row["messages"])
        repeats = 1
      elif "prompt" in row and "completion" in row:
        if should_skip_feedback_row(row):
          continue
        pairs = [(normalize(str(row["prompt"])), normalize(str(row["completion"])))]
        repeats = repeat_count_for_row(row)
      else:
        continue

      for prompt, completion in pairs:
        if not prompt or not completion:
          continue
        if looks_low_quality_prompt(prompt):
          continue
        if looks_low_quality(completion):
          continue

        prompt_key = normalize(prompt).lower()

        for _ in range(max(repeats, 1)):
          if prompt_seen[prompt_key] >= max_duplicate_prompts:
            break
          prompt_seen[prompt_key] += 1

          score = complexity_score(prompt)
          if score >= deep_threshold:
            deep_examples.append((prompt, completion))
            router_examples.append((prompt, "deep"))
          else:
            fast_examples.append((prompt, completion))
            router_examples.append((prompt, "fast"))

  rng = random.Random(seed)
  rng.shuffle(fast_examples)
  rng.shuffle(deep_examples)
  rng.shuffle(router_examples)

  if deep_examples:
    max_fast = int(len(deep_examples) * max_fast_to_deep_ratio)
    if len(fast_examples) > max_fast:
      fast_examples = fast_examples[:max_fast]

  router_examples = balance_router_examples(router_examples, max_fast_to_deep_ratio, seed)
  rng.shuffle(router_examples)

  return fast_examples, deep_examples, router_examples


def build_router_model(examples):
  labels = ["fast", "deep"]
  label_counts = Counter()
  token_counts = {"fast": Counter(), "deep": Counter()}
  vocab = set()

  for text, label in examples:
    if label not in labels:
      continue

    tokens = tokenize_words(text)
    if not tokens:
      continue

    label_counts[label] += 1
    token_counts[label].update(tokens)
    vocab.update(tokens)

  total_docs = max(sum(label_counts.values()), 1)
  vocab_size = max(len(vocab), 1)

  model = {
    "name": "energy-router-own-v1",
    "type": "naive_bayes",
    "labels": labels,
    "label_counts": {label: int(label_counts[label]) for label in labels},
    "priors": {},
    "default_log_prob": {},
    "token_log_probs": {}
  }

  for label in labels:
    prior = (label_counts[label] + 1) / (total_docs + len(labels))
    model["priors"][label] = math.log(prior)

    label_total_tokens = sum(token_counts[label].values())
    denominator = label_total_tokens + vocab_size
    model["default_log_prob"][label] = math.log(1 / denominator)

    model["token_log_probs"][label] = {
      token: math.log((count + 1) / denominator)
      for token, count in token_counts[label].items()
    }

  return model


def build_language_model(examples, role, max_pairs, seed):
  bigram = defaultdict(Counter)
  unigram = Counter()

  rng = random.Random(seed)
  pool = examples[:]
  rng.shuffle(pool)

  scored_pool = []
  for prompt, completion in pool:
    score = assistant_fit_score(prompt, completion, role)
    if score < 1:
      continue
    scored_pool.append((score, prompt, completion))

  if not scored_pool:
    scored_pool = [(assistant_fit_score(prompt, completion, role), prompt, completion) for prompt, completion in pool]

  scored_pool.sort(key=lambda item: (item[0], len(item[2])), reverse=True)

  pairs = []
  for _, prompt, completion in scored_pool[:max_pairs]:
    pairs.append(
      {
        "prompt": prompt,
        "completion": completion,
        "prompt_tokens": tokenize_words(prompt)[:80]
      }
    )

    tokens = tokenize_generation(completion)
    if not tokens:
      continue

    sequence = ["<s>", *tokens, "</s>"]
    for left, right in zip(sequence, sequence[1:]):
      bigram[left][right] += 1
      unigram[right] += 1

  model = {
    "name": "energy-low-own-v1" if role == "fast" else "energy-high-own-v1",
    "role": role,
    "type": "retrieval_bigram",
    "pairs": pairs[:max_pairs],
    "bigram": {token: dict(next_counts) for token, next_counts in bigram.items()},
    "unigram": dict(unigram)
  }

  return model


def main():
  parser = argparse.ArgumentParser(description="Train fully local own models (router + fast + deep).")
  parser.add_argument(
    "--input",
    action="append",
    required=True,
    help="Input JSONL with messages or prompt/completion pairs. Use multiple --input for multi-dataset training."
  )
  parser.add_argument(
    "--out-dir",
    default="training/checkpoints/own",
    help="Output directory for model artifacts"
  )
  parser.add_argument("--deep-threshold", type=int, default=3, help="Complexity threshold for deep class")
  parser.add_argument("--max-pairs", type=int, default=12000, help="Max retrieval pairs stored per role")
  parser.add_argument("--max-duplicate-prompts", type=int, default=6, help="Max times same prompt can appear")
  parser.add_argument("--max-fast-to-deep-ratio", type=float, default=6.0, help="Cap fast examples relative to deep examples")
  parser.add_argument("--seed", type=int, default=42, help="Random seed")
  args = parser.parse_args()

  input_paths = [Path(item) for item in args.input]
  output_dir = Path(args.out_dir)

  for input_path in input_paths:
    if not input_path.exists():
      raise SystemExit(f"Input file not found: {input_path}")

  fast_examples, deep_examples, router_examples = collect_examples(
    input_paths,
    deep_threshold=args.deep_threshold,
    max_duplicate_prompts=args.max_duplicate_prompts,
    max_fast_to_deep_ratio=args.max_fast_to_deep_ratio,
    seed=args.seed
  )

  if not fast_examples and not deep_examples:
    raise SystemExit("No trainable prompt/completion examples were found in input files.")

  if not fast_examples:
    fast_examples = deep_examples[:]
  if not deep_examples:
    deep_examples = fast_examples[:]

  router_model = build_router_model(router_examples)
  fast_model = build_language_model(fast_examples, role="fast", max_pairs=args.max_pairs, seed=args.seed)
  deep_model = build_language_model(deep_examples, role="deep", max_pairs=args.max_pairs, seed=args.seed)

  write_json(output_dir / "router.json", router_model)
  write_json(output_dir / "fast.json", fast_model)
  write_json(output_dir / "deep.json", deep_model)
  write_json(
    output_dir / "metadata.json",
    {
      "inputs": [str(path) for path in input_paths],
      "output_dir": str(output_dir),
      "deep_threshold": args.deep_threshold,
      "max_pairs": args.max_pairs,
      "max_duplicate_prompts": args.max_duplicate_prompts,
      "max_fast_to_deep_ratio": args.max_fast_to_deep_ratio,
      "model_names": {
        "router": "energy-router-own-v1",
        "fast": "energy-low-own-v1",
        "deep": "energy-high-own-v1"
      },
      "router_examples": len(router_examples),
      "fast_examples": len(fast_examples),
      "deep_examples": len(deep_examples)
    }
  )

  print(
    json.dumps(
      {
        "status": "ok",
        "output_dir": str(output_dir),
        "router_examples": len(router_examples),
        "fast_examples": len(fast_examples),
        "deep_examples": len(deep_examples)
      },
      indent=2
    )
  )


if __name__ == "__main__":
  main()
