#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

from datasets import load_dataset
from peft import LoraConfig
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
from trl import SFTTrainer


def load_config(path: Path):
  with path.open("r", encoding="utf-8") as file:
    return json.load(file)


def load_system_prompt():
  prompt_path = Path(__file__).resolve().parent.parent / "prompts" / "fast_system.txt"
  return prompt_path.read_text(encoding="utf-8").strip()


def format_example(system_prompt, row):
  return {
    "text": (
      f"<s>[SYSTEM] {system_prompt}\n"
      f"[USER_CONTEXT]\n{row['prompt']}\n"
      f"[ASSISTANT]\n{row['completion']}</s>"
    )
  }


def split_dataset(dataset, validation_split, seed):
  if validation_split and len(dataset) > 200:
    split = dataset.train_test_split(test_size=validation_split, seed=seed)
    return split["train"], split["test"]
  return dataset, None


def main():
  parser = argparse.ArgumentParser(description="Train the low-energy SFT model with stronger large-dataset defaults.")
  parser.add_argument("--config", required=True)
  parser.add_argument("--train-file", required=True)
  args = parser.parse_args()

  cfg = load_config(Path(args.config))
  system_prompt = load_system_prompt()

  tokenizer = AutoTokenizer.from_pretrained(cfg["base_model"], use_fast=True)
  tokenizer.pad_token = tokenizer.eos_token
  tokenizer.padding_side = "right"

  model = AutoModelForCausalLM.from_pretrained(
    cfg["base_model"],
    torch_dtype="auto",
    device_map="auto",
    trust_remote_code=cfg.get("trust_remote_code", False),
  )
  if cfg.get("gradient_checkpointing", True):
    model.gradient_checkpointing_enable()
    model.config.use_cache = False

  dataset = load_dataset("json", data_files={"train": args.train_file})["train"]
  dataset = dataset.map(lambda row: format_example(system_prompt, row), remove_columns=dataset.column_names)
  if cfg.get("max_train_samples", 0):
    dataset = dataset.select(range(min(len(dataset), int(cfg["max_train_samples"]))))
  train_dataset, eval_dataset = split_dataset(dataset, cfg.get("validation_split", 0.01), cfg.get("seed", 42))

  lora_config = LoraConfig(
    r=cfg["lora_r"],
    lora_alpha=cfg["lora_alpha"],
    lora_dropout=cfg["lora_dropout"],
    target_modules=cfg["target_modules"],
    bias=cfg.get("lora_bias", "none"),
    task_type="CAUSAL_LM",
  )

  training_args = TrainingArguments(
    output_dir=cfg["output_dir"],
    learning_rate=cfg["learning_rate"],
    num_train_epochs=cfg["num_train_epochs"],
    per_device_train_batch_size=cfg["per_device_train_batch_size"],
    per_device_eval_batch_size=cfg.get("per_device_eval_batch_size", cfg["per_device_train_batch_size"]),
    gradient_accumulation_steps=cfg["gradient_accumulation_steps"],
    logging_steps=cfg.get("logging_steps", 10),
    save_strategy="epoch" if eval_dataset is not None else "steps",
    evaluation_strategy="epoch" if eval_dataset is not None else "no",
    save_total_limit=cfg.get("save_total_limit", 2),
    bf16=cfg.get("bf16", True),
    fp16=cfg.get("fp16", False),
    warmup_ratio=cfg.get("warmup_ratio", 0.03),
    weight_decay=cfg.get("weight_decay", 0.01),
    lr_scheduler_type=cfg.get("lr_scheduler_type", "cosine"),
    report_to="none",
    optim=cfg.get("optim", "paged_adamw_8bit"),
    max_grad_norm=cfg.get("max_grad_norm", 1.0),
    gradient_checkpointing=cfg.get("gradient_checkpointing", True),
    dataloader_num_workers=cfg.get("dataloader_num_workers", 2),
    seed=cfg.get("seed", 42),
  )

  trainer = SFTTrainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
    peft_config=lora_config,
    tokenizer=tokenizer,
    dataset_text_field="text",
    max_seq_length=cfg["max_seq_length"],
    packing=cfg.get("packing", False),
  )

  trainer.train()
  metrics = trainer.evaluate() if eval_dataset is not None else {}
  trainer.save_model(cfg["output_dir"])
  tokenizer.save_pretrained(cfg["output_dir"])

  print(json.dumps({"saved_to": cfg["output_dir"], "train_samples": len(train_dataset), "eval_samples": len(eval_dataset) if eval_dataset is not None else 0, "metrics": metrics}, indent=2))


if __name__ == "__main__":
  main()
