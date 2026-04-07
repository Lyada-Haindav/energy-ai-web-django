#!/usr/bin/env python3
import argparse
import subprocess
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = ROOT_DIR / "scripts"
CONFIG_DIR = ROOT_DIR / "config"


def run(command):
  print("[run]", " ".join(command))
  subprocess.run(command, check=True)


def main():
  parser = argparse.ArgumentParser(description="Build a larger corpus and train the advanced router/fast/deep stack.")
  parser.add_argument("--raw-out", default=str(ROOT_DIR / "data" / "processed" / "advanced" / "raw_large_mix.jsonl"))
  parser.add_argument("--processed-dir", default=str(ROOT_DIR / "data" / "processed" / "advanced"))
  parser.add_argument("--skip-build", action="store_true", help="Skip building the large raw corpus")
  parser.add_argument("--skip-prepare", action="store_true", help="Skip preparing fast/deep/router JSONL files")
  parser.add_argument("--skip-router", action="store_true", help="Skip router training")
  parser.add_argument("--skip-fast", action="store_true", help="Skip fast model training")
  parser.add_argument("--skip-deep", action="store_true", help="Skip deep model training")
  args = parser.parse_args()

  processed_dir = Path(args.processed_dir)
  raw_out = Path(args.raw_out)

  if not args.skip_build:
    run([sys.executable, str(SCRIPTS_DIR / "build_advanced_dataset.py"), "--out", str(raw_out), "--metadata-out", str(processed_dir / "raw_large_mix.metadata.json")])

  if not args.skip_prepare:
    run(
      [
        sys.executable,
        str(SCRIPTS_DIR / "prepare_data.py"),
        "--input",
        str(raw_out),
        "--out-dir",
        str(processed_dir),
        "--deep-threshold",
        "4",
        "--max-history-turns",
        "6",
        "--min-fit-score",
        "0",
        "--max-duplicate-prompts",
        "3",
        "--max-fast-to-deep-ratio",
        "3.5",
        "--max-fast-examples",
        "160000",
        "--max-deep-examples",
        "120000",
        "--max-router-examples",
        "180000",
      ]
    )

  if not args.skip_router:
    run([sys.executable, str(SCRIPTS_DIR / "train_router_model.py"), "--config", str(CONFIG_DIR / "router_model_large.json"), "--train-file", str(processed_dir / "router_train.jsonl")])

  if not args.skip_fast:
    run([sys.executable, str(SCRIPTS_DIR / "train_fast_model.py"), "--config", str(CONFIG_DIR / "fast_model_large.json"), "--train-file", str(processed_dir / "fast_sft.jsonl")])

  if not args.skip_deep:
    run([sys.executable, str(SCRIPTS_DIR / "train_deep_model.py"), "--config", str(CONFIG_DIR / "deep_model_large.json"), "--train-file", str(processed_dir / "deep_sft.jsonl")])


if __name__ == "__main__":
  main()
