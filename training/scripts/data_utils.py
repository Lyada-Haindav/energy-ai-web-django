#!/usr/bin/env python3
import gzip
import json
import re
from collections import Counter
from pathlib import Path


WORD_RE = re.compile(r"[A-Za-z0-9']+")
LOW_QUALITY_DATA_PATTERNS = [
  re.compile(r"\bayy\s+lmao\b", re.IGNORECASE),
  re.compile(r"\bgrumpy cat\b", re.IGNORECASE),
  re.compile(r"\bbefore we wrap up\b", re.IGNORECASE),
  re.compile(r"\binterviewer\b", re.IGNORECASE),
  re.compile(r"\bepisode\b", re.IGNORECASE),
  re.compile(r"\bhost\b", re.IGNORECASE),
]
LOW_SIGNAL_PROMPT_PATTERNS = [
  re.compile(r"\b(caption|instagram|tweet|selfie|photo|image prompt)\b", re.IGNORECASE),
  re.compile(r"\b(generate|write|create)\b.*\b(story|poem|lyrics?)\b", re.IGNORECASE),
  re.compile(r"\bmake\s+\d+\s+more\b", re.IGNORECASE),
  re.compile(r"\b(roleplay|fanfic|character prompt)\b", re.IGNORECASE),
]
CONTEST_SIGNAL_PATTERNS = [
  re.compile(r"\b(leetcode|codeforces|codechef|hackerrank|contest|competitive programming)\b", re.IGNORECASE),
  re.compile(r"\b(input format|output format|constraints?)\b", re.IGNORECASE),
  re.compile(r"\b(subarray|substring|graph|tree|grid|matrix|intervals?|prefix sum|sliding window|two pointers|dynamic programming|dp|dijkstra|topological|union find|disjoint set|kadane|binary search on answer)\b", re.IGNORECASE),
  re.compile(r"(?:\b[nmk]\b|\brows\b|\bcols\b)\s*(?:<=|<)\s*\d+", re.IGNORECASE),
]
ASSISTANT_FIT_KEYWORDS = {
  "explain",
  "what",
  "how",
  "why",
  "bug",
  "review",
  "refactor",
  "test",
  "tests",
  "testing",
  "security",
  "secure",
  "auth",
  "authentication",
  "authorization",
  "session",
  "token",
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
  "frontend",
  "backend",
  "responsive",
  "accessibility",
  "a11y",
  "traceback",
  "exception",
  "stack",
  "error",
  "log",
  "logs",
  "performance",
  "latency",
  "react",
  "node",
  "python",
  "javascript",
  "typescript",
  "tsx",
  "jsx",
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
  "path",
}


def read_jsonl(path: Path):
  if path.suffix == ".gz":
    file_handle = gzip.open(path, "rt", encoding="utf-8")
  else:
    file_handle = path.open("r", encoding="utf-8")
  with file_handle as file:
    for line in file:
      raw = line.strip()
      if not raw:
        continue
      yield json.loads(raw)


def write_jsonl(path: Path, rows):
  path.parent.mkdir(parents=True, exist_ok=True)
  if path.suffix == ".gz":
    file_handle = gzip.open(path, "wt", encoding="utf-8")
  else:
    file_handle = path.open("w", encoding="utf-8")
  with file_handle as file:
    for row in rows:
      file.write(json.dumps(row, ensure_ascii=True) + "\n")


def write_json(path: Path, payload):
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")


def normalize(text: str) -> str:
  return re.sub(r"\s+", " ", str(text or "")).strip()


def tokenize_words(text: str):
  return WORD_RE.findall(str(text or "").lower())


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
  score = len(str(text or "").split()) // 40
  keywords = [
    "analyze",
    "architecture",
    "train",
    "debug",
    "compare",
    "design",
    "optimize",
    "review",
    "refactor",
    "test",
    "security",
    "authentication",
    "authorization",
    "session",
    "token",
    "jwt",
    "cookie",
    "cookies",
    "traceback",
    "exception",
    "logging",
    "log",
    "rate limit",
    "rate limiting",
    "backend",
    "observability",
    "monitoring",
    "responsive",
    "accessibility",
    "performance",
    "tradeoff",
    "code",
    "system",
    "reason",
    "scalable",
    "production",
    "deploy",
    "deployment",
    "mongodb",
    "mongo",
    "atlas",
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
    "constraints",
  ]
  lowered = str(text or "").lower()
  for token in keywords:
    if token in lowered:
      score += 1
  if "\n" in str(text or ""):
    score += 1
  if re.search(r"(?:\b[nmk]\b|\brows\b|\bcols\b)\s*(?:<=|<)\s*\d+", str(text or ""), re.IGNORECASE):
    score += 1
  if any(pattern.search(str(text or "")) for pattern in CONTEST_SIGNAL_PATTERNS):
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
  if prompt_norm.endswith("?") or prompt_lower.startswith(("what", "how", "why", "explain", "write", "build", "design", "debug", "compare", "create", "implement")):
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
  if any(token in completion_lower for token in ["o(", "complexity", "edge case", "sliding window", "prefix sum", "hash map", "priority queue", "dynamic programming"]):
    score += 2
  if any(token in completion_lower for token in ["root cause", "regression", "missing test", "validation", "authorization", "authentication", "session", "token", "xss", "csrf", "rate limit", "responsive", "accessibility"]):
    score += 2
  if "uncertain" in completion_lower or "sources" in completion_lower:
    score += 1

  prompt_complexity = complexity_score(prompt_norm)
  if role == "deep" and prompt_complexity >= 3:
    score += 1
  if role == "fast" and prompt_complexity <= 2:
    score += 1

  return score


def repeat_count_for_row(row) -> int:
  quality = normalize(str(row.get("quality_signal", row.get("quality", "")))).lower()
  feedback = normalize(str(row.get("feedback", ""))).lower()
  if quality in {"corrected", "correction"} or feedback == "correction":
    return 3
  if quality in {"approved", "positive"} or feedback in {"up", "upvote", "positive"}:
    return 2
  return 1


def should_skip_feedback_row(row) -> bool:
  quality = normalize(str(row.get("quality_signal", row.get("quality", "")))).lower()
  feedback = normalize(str(row.get("feedback", ""))).lower()
  return quality in {"rejected", "reject", "downvote", "negative"} or feedback in {"down", "downvote", "negative"}


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


def row_messages(row):
  if "messages" in row and isinstance(row["messages"], list):
    messages = []
    for message in row["messages"]:
      role = str(message.get("role", "")).strip().lower()
      content = normalize(str(message.get("content", "")))
      if role in {"user", "assistant"} and content:
        messages.append({"role": role, "content": content})
    return messages
  if "prompt" in row and "completion" in row:
    prompt = normalize(str(row["prompt"]))
    completion = normalize(str(row["completion"]))
    if prompt and completion:
      return [{"role": "user", "content": prompt}, {"role": "assistant", "content": completion}]
  return []


def prompt_signature(prompt: str) -> str:
  tokens = tokenize_words(prompt)[:48]
  return " ".join(tokens)


def dedupe_count(rows):
  counter = Counter()
  for row in rows:
    messages = row.get("messages") or []
    if not messages:
      continue
    counter[prompt_signature(messages[0].get("content", ""))] += 1
  return counter
