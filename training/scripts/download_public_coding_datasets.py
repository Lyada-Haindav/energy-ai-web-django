#!/usr/bin/env python3
import argparse
import ast
import gzip
import json
from collections import Counter
from pathlib import Path

from datasets import get_dataset_config_names, load_dataset

from data_utils import write_json


DEFAULT_COMMITPACK_LANGUAGES = [
  "python",
  "javascript",
  "typescript",
  "java",
  "go",
  "rust",
  "c++",
  "c#",
  "php",
  "ruby",
  "swift",
  "kotlin",
  "shell",
  "sql",
  "html",
  "css",
]
DEFAULT_CODESEARCHNET_LANGUAGES = ["python", "javascript", "java", "php", "ruby", "go"]
DEFAULT_HUMANEVALPACK_LANGUAGES = ["python", "js", "java", "go", "cpp", "rust"]


def normalize_space(text):
  return " ".join(str(text or "").strip().split())


def normalize_code(text):
  return str(text or "").replace("\r\n", "\n").strip()


def parse_languages(raw_value, default_values):
  raw = str(raw_value or "").strip()
  if not raw:
    return list(default_values)
  if raw.lower() == "all":
    return ["all"]
  return [item.strip() for item in raw.split(",") if item.strip()]


def canonical_language(name):
  lowered = str(name or "").strip().lower()
  normalized = "".join(ch for ch in lowered if ch.isalnum())
  mapping = {
    "cplusplus": "c++",
    "cpp": "c++",
    "csharp": "c#",
    "cs": "c#",
    "javascript": "javascript",
    "js": "javascript",
    "typescript": "typescript",
    "ts": "typescript",
    "py": "python",
    "shell": "shell",
    "sh": "shell",
    "bash": "shell",
    "golang": "go",
    "html": "html",
    "css": "css",
  }
  return mapping.get(normalized, lowered)


def code_fence_language(name):
  canon = canonical_language(name)
  mapping = {
    "c++": "cpp",
    "c#": "csharp",
    "javascript": "javascript",
    "typescript": "typescript",
    "shell": "bash",
  }
  return mapping.get(canon, canon)


def display_language(name):
  canon = canonical_language(name)
  mapping = {
    "c++": "C++",
    "c#": "C#",
    "javascript": "JavaScript",
    "typescript": "TypeScript",
    "go": "Go",
    "php": "PHP",
    "ruby": "Ruby",
    "java": "Java",
    "python": "Python",
    "rust": "Rust",
    "swift": "Swift",
    "kotlin": "Kotlin",
    "shell": "Shell",
    "sql": "SQL",
    "html": "HTML",
    "css": "CSS",
  }
  return mapping.get(canon, canon.title())


def fence_code(language, code):
  return f"```{code_fence_language(language)}\n{normalize_code(code)}\n```"


def parse_listish(value):
  if isinstance(value, list):
    return value
  if value is None:
    return []
  raw = str(value).strip()
  if not raw:
    return []
  for loader in (json.loads, ast.literal_eval):
    try:
      parsed = loader(raw)
      if isinstance(parsed, list):
        return parsed
    except Exception:
      continue
  return []


def choose_code_candidate(candidates, max_chars):
  cleaned = []
  for candidate in candidates:
    code = normalize_code(candidate)
    if len(code) < 24 or len(code) > max_chars:
      continue
    cleaned.append(code)
  if not cleaned:
    return ""
  return sorted(cleaned, key=len)[0]


class JsonlWriter:
  def __init__(self, path: Path):
    self.path = path
    self.path.parent.mkdir(parents=True, exist_ok=True)
    open_fn = gzip.open if path.suffix == ".gz" else path.open
    self.handle = open_fn(path, "wt", encoding="utf-8")

  def write(self, row):
    self.handle.write(json.dumps(row, ensure_ascii=True) + "\n")

  def close(self):
    self.handle.close()

  def __enter__(self):
    return self

  def __exit__(self, exc_type, exc, tb):
    self.close()


def resolve_commitpack_configs(requested):
  configs = get_dataset_config_names("bigcode/commitpackft")
  if requested == ["all"]:
    return configs
  wanted = {canonical_language(language) for language in requested}
  selected = []
  for config in configs:
    if canonical_language(config) in wanted:
      selected.append(config)
  return selected


def resolve_humanevalpack_configs(requested):
  configs = get_dataset_config_names("bigcode/humanevalpack")
  if requested == ["all"]:
    return configs
  wanted = {canonical_language(language) for language in requested}
  selected = []
  for config in configs:
    if canonical_language(config) in wanted:
      selected.append(config)
  return selected


def iter_codesearchnet_configs(requested):
  if requested == ["all"]:
    return list(DEFAULT_CODESEARCHNET_LANGUAGES)
  wanted = {canonical_language(language) for language in requested}
  return [language for language in DEFAULT_CODESEARCHNET_LANGUAGES if canonical_language(language) in wanted]


def convert_apps(writer, merged_writer, max_rows, max_solution_chars, summary):
  dataset = load_dataset("codeparrot/apps", split="train", streaming=True, trust_remote_code=True)
  written = 0
  for item in dataset:
    if written >= max_rows:
      break
    question = normalize_space(item.get("question", ""))
    starter_code = normalize_code(item.get("starter_code", ""))
    solution = choose_code_candidate(parse_listish(item.get("solutions")), max_solution_chars)
    if not question or not solution:
      continue

    prompt_parts = [
      "Solve this programming problem in Python.",
      "",
      question,
    ]
    if starter_code:
      prompt_parts.extend(["", "Starter code:", fence_code("python", starter_code)])
    prompt_parts.extend(["", "Return a complete working Python solution."])

    row = {
      "dataset": "apps",
      "language": "python",
      "messages": [
        {"role": "user", "content": "\n".join(prompt_parts)},
        {"role": "assistant", "content": fence_code("python", solution)},
      ],
    }
    writer.write(row)
    merged_writer.write(row)
    summary["sources"]["apps"] += 1
    summary["languages"]["python"] += 1
    written += 1

  return written


def convert_humanevalpack(writer, merged_writer, languages, max_rows_per_language, max_solution_chars, summary):
  written = 0
  for config in resolve_humanevalpack_configs(languages):
    dataset = load_dataset("bigcode/humanevalpack", name=config, split="test", streaming=True)
    per_language = 0
    for item in dataset:
      if per_language >= max_rows_per_language:
        break

      prompt_prefix = normalize_code(item.get("prompt", ""))
      canonical_solution = normalize_code(item.get("canonical_solution", ""))
      import_block = normalize_code(item.get("import", ""))
      declaration = normalize_code(item.get("declaration", ""))
      instruction = normalize_space(item.get("instruction", ""))
      docstring = normalize_space(item.get("docstring", ""))
      example_test = normalize_code(item.get("example_test", ""))

      combined_code = prompt_prefix + canonical_solution
      if import_block and import_block not in combined_code:
        combined_code = f"{import_block}\n{combined_code}"
      combined_code = normalize_code(combined_code)

      if not combined_code or len(combined_code) > max_solution_chars:
        continue

      prompt_parts = []
      if instruction:
        prompt_parts.append(instruction)
      else:
        prompt_parts.append(f"Write a correct {display_language(config)} solution for this programming task.")
      if declaration:
        prompt_parts.extend(["", "Declaration:", fence_code(config, declaration)])
      if docstring:
        prompt_parts.extend(["", "Specification:", docstring])
      if example_test:
        prompt_parts.extend(["", "Example test:", fence_code(config, example_test)])
      prompt_parts.extend(["", "Return the final working code only."])

      row = {
        "dataset": f"humanevalpack:{config}",
        "language": canonical_language(config),
        "messages": [
          {"role": "user", "content": "\n".join(prompt_parts)},
          {"role": "assistant", "content": fence_code(config, combined_code)},
        ],
      }
      writer.write(row)
      merged_writer.write(row)
      summary["sources"][f"humanevalpack:{config}"] += 1
      summary["languages"][canonical_language(config)] += 1
      per_language += 1
      written += 1

  return written


def convert_codesearchnet(writer, merged_writer, languages, max_rows_per_language, max_solution_chars, summary):
  written = 0
  for language in iter_codesearchnet_configs(languages):
    dataset = load_dataset("claudios/code_search_net", name=language, split="train", streaming=True)
    per_language = 0
    for item in dataset:
      if per_language >= max_rows_per_language:
        break

      documentation = normalize_space(item.get("func_documentation_string", ""))
      function_name = normalize_space(item.get("func_name", ""))
      code = normalize_code(item.get("whole_func_string") or item.get("func_code_string") or "")
      if not documentation or not code or len(code) > max_solution_chars:
        continue

      prompt_parts = [
        f"Implement the {display_language(language)} function described below.",
      ]
      if function_name:
        prompt_parts.append(f"Function name: {function_name}")
      prompt_parts.extend(["", "Documentation:", documentation, "", "Return a complete implementation."])

      row = {
        "dataset": f"codesearchnet:{language}",
        "language": canonical_language(language),
        "messages": [
          {"role": "user", "content": "\n".join(prompt_parts)},
          {"role": "assistant", "content": fence_code(language, code)},
        ],
      }
      writer.write(row)
      merged_writer.write(row)
      summary["sources"][f"codesearchnet:{language}"] += 1
      summary["languages"][canonical_language(language)] += 1
      per_language += 1
      written += 1

  return written


def convert_commitpack(writer, merged_writer, languages, max_rows_per_language, max_old_chars, max_new_chars, summary):
  written = 0
  for config in resolve_commitpack_configs(languages):
    dataset = load_dataset("bigcode/commitpackft", name=config, split="train", streaming=True)
    per_language = 0
    for item in dataset:
      if per_language >= max_rows_per_language:
        break

      old_contents = normalize_code(item.get("old_contents", ""))
      new_contents = normalize_code(item.get("new_contents", ""))
      subject = normalize_space(item.get("subject", ""))
      message = normalize_space(item.get("message", ""))
      old_file = normalize_space(item.get("old_file", ""))
      if not old_contents or not new_contents or old_contents == new_contents:
        continue
      if len(old_contents) > max_old_chars or len(new_contents) > max_new_chars:
        continue
      change_request = subject or message
      if len(change_request) < 8:
        continue

      prompt_parts = [
        f"Update this {display_language(config)} file according to the requested change.",
        "",
        f"Change request: {change_request}",
      ]
      if old_file:
        prompt_parts.append(f"Current file path: {old_file}")
      prompt_parts.extend(["", "Current file:", fence_code(config, old_contents), "", "Return only the updated file."])

      row = {
        "dataset": f"commitpackft:{config}",
        "language": canonical_language(config),
        "messages": [
          {"role": "user", "content": "\n".join(prompt_parts)},
          {"role": "assistant", "content": fence_code(config, new_contents)},
        ],
      }
      writer.write(row)
      merged_writer.write(row)
      summary["sources"][f"commitpackft:{config}"] += 1
      summary["languages"][canonical_language(config)] += 1
      per_language += 1
      written += 1

  return written


def main():
  parser = argparse.ArgumentParser(description="Download and convert large public coding datasets into Energy AI JSONL format.")
  parser.add_argument("--out-dir", default="training/data/public_coding", help="Output folder for converted coding corpora")
  parser.add_argument("--compress", action="store_true", help="Write .jsonl.gz files instead of plain .jsonl")
  parser.add_argument("--max-apps", type=int, default=6000, help="Maximum APPS rows")
  parser.add_argument("--max-humanevalpack-per-language", type=int, default=500, help="Maximum HumanevalPack rows per language")
  parser.add_argument("--max-codesearchnet-per-language", type=int, default=12000, help="Maximum CodeSearchNet rows per language")
  parser.add_argument("--max-commitpack-per-language", type=int, default=5000, help="Maximum CommitPackFT rows per language")
  parser.add_argument("--commitpack-languages", default=",".join(DEFAULT_COMMITPACK_LANGUAGES), help="CommitPackFT languages, comma-separated or all")
  parser.add_argument("--codesearchnet-languages", default=",".join(DEFAULT_CODESEARCHNET_LANGUAGES), help="CodeSearchNet languages, comma-separated or all")
  parser.add_argument("--humanevalpack-languages", default=",".join(DEFAULT_HUMANEVALPACK_LANGUAGES), help="HumanEvalPack languages, comma-separated or all")
  parser.add_argument("--max-apps-solution-chars", type=int, default=12000, help="Skip APPS solutions longer than this")
  parser.add_argument("--max-humaneval-solution-chars", type=int, default=12000, help="Skip HumanevalPack solutions longer than this")
  parser.add_argument("--max-codesearchnet-solution-chars", type=int, default=6000, help="Skip CodeSearchNet implementations longer than this")
  parser.add_argument("--max-commitpack-old-chars", type=int, default=2800, help="Skip CommitPackFT old file contents longer than this")
  parser.add_argument("--max-commitpack-new-chars", type=int, default=3200, help="Skip CommitPackFT new file contents longer than this")
  args = parser.parse_args()

  suffix = ".jsonl.gz" if args.compress else ".jsonl"
  out_dir = Path(args.out_dir)
  out_dir.mkdir(parents=True, exist_ok=True)
  summary = {
    "out_dir": str(out_dir),
    "compress": bool(args.compress),
    "sources": Counter(),
    "languages": Counter(),
    "files": {},
  }

  file_paths = {
    "apps": out_dir / f"apps_python{suffix}",
    "humanevalpack": out_dir / f"humanevalpack_polyglot{suffix}",
    "codesearchnet": out_dir / f"codesearchnet_polyglot{suffix}",
    "commitpackft": out_dir / f"commitpackft_polyglot{suffix}",
    "merged": out_dir / f"merged_public_coding{suffix}",
  }

  with JsonlWriter(file_paths["merged"]) as merged_writer:
    with JsonlWriter(file_paths["apps"]) as apps_writer:
      summary["files"]["apps_rows"] = convert_apps(
        apps_writer,
        merged_writer,
        max_rows=args.max_apps,
        max_solution_chars=args.max_apps_solution_chars,
        summary=summary,
      )

    with JsonlWriter(file_paths["humanevalpack"]) as humaneval_writer:
      summary["files"]["humanevalpack_rows"] = convert_humanevalpack(
        humaneval_writer,
        merged_writer,
        languages=parse_languages(args.humanevalpack_languages, DEFAULT_HUMANEVALPACK_LANGUAGES),
        max_rows_per_language=args.max_humanevalpack_per_language,
        max_solution_chars=args.max_humaneval_solution_chars,
        summary=summary,
      )

    with JsonlWriter(file_paths["codesearchnet"]) as codesearchnet_writer:
      summary["files"]["codesearchnet_rows"] = convert_codesearchnet(
        codesearchnet_writer,
        merged_writer,
        languages=parse_languages(args.codesearchnet_languages, DEFAULT_CODESEARCHNET_LANGUAGES),
        max_rows_per_language=args.max_codesearchnet_per_language,
        max_solution_chars=args.max_codesearchnet_solution_chars,
        summary=summary,
      )

    with JsonlWriter(file_paths["commitpackft"]) as commitpack_writer:
      summary["files"]["commitpackft_rows"] = convert_commitpack(
        commitpack_writer,
        merged_writer,
        languages=parse_languages(args.commitpack_languages, DEFAULT_COMMITPACK_LANGUAGES),
        max_rows_per_language=args.max_commitpack_per_language,
        max_old_chars=args.max_commitpack_old_chars,
        max_new_chars=args.max_commitpack_new_chars,
        summary=summary,
      )

  summary["files"]["merged_rows"] = sum(
    value
    for key, value in summary["files"].items()
    if key.endswith("_rows") and key != "merged_rows"
  )
  summary["sources"] = dict(summary["sources"])
  summary["languages"] = dict(summary["languages"])
  write_json(out_dir / "metadata.json", summary)
  print(json.dumps(summary, indent=2))


if __name__ == "__main__":
  main()
