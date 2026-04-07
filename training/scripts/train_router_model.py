#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

import evaluate
from datasets import load_dataset
from transformers import AutoModelForSequenceClassification, AutoTokenizer, DataCollatorWithPadding, Trainer, TrainingArguments


LABEL2ID = {"fast": 0, "deep": 1}
ID2LABEL = {0: "fast", 1: "deep"}


def load_config(path: Path):
  with path.open("r", encoding="utf-8") as file:
    return json.load(file)


def tokenize_batch(batch, tokenizer, max_length):
  return tokenizer(batch["text"], truncation=True, max_length=max_length)


def main():
  parser = argparse.ArgumentParser(description="Train the fast-vs-deep router classifier with stronger defaults.")
  parser.add_argument("--config", required=True)
  parser.add_argument("--train-file", required=True)
  args = parser.parse_args()

  cfg = load_config(Path(args.config))
  dataset = load_dataset("json", data_files={"train": args.train_file})["train"]
  if cfg.get("max_train_samples", 0):
    dataset = dataset.select(range(min(len(dataset), int(cfg["max_train_samples"]))))
  dataset = dataset.map(lambda row: {"label": LABEL2ID[row["label"]]})
  split = dataset.train_test_split(test_size=cfg.get("validation_split", 0.1), seed=cfg.get("seed", 42))

  tokenizer = AutoTokenizer.from_pretrained(cfg["base_model"], use_fast=True)
  tokenized_train = split["train"].map(lambda rows: tokenize_batch(rows, tokenizer, cfg["max_length"]), batched=True)
  tokenized_eval = split["test"].map(lambda rows: tokenize_batch(rows, tokenizer, cfg["max_length"]), batched=True)

  model = AutoModelForSequenceClassification.from_pretrained(
    cfg["base_model"],
    num_labels=2,
    id2label=ID2LABEL,
    label2id=LABEL2ID,
    trust_remote_code=cfg.get("trust_remote_code", False),
  )

  accuracy = evaluate.load("accuracy")

  def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = logits.argmax(axis=-1)
    return accuracy.compute(predictions=preds, references=labels)

  training_args = TrainingArguments(
    output_dir=cfg["output_dir"],
    learning_rate=cfg["learning_rate"],
    num_train_epochs=cfg["num_train_epochs"],
    per_device_train_batch_size=cfg["per_device_train_batch_size"],
    per_device_eval_batch_size=cfg["per_device_eval_batch_size"],
    gradient_accumulation_steps=cfg.get("gradient_accumulation_steps", 1),
    weight_decay=cfg.get("weight_decay", 0.01),
    warmup_ratio=cfg.get("warmup_ratio", 0.06),
    lr_scheduler_type=cfg.get("lr_scheduler_type", "cosine"),
    evaluation_strategy="epoch",
    save_strategy="epoch",
    save_total_limit=cfg.get("save_total_limit", 2),
    logging_steps=cfg.get("logging_steps", 20),
    load_best_model_at_end=True,
    metric_for_best_model="accuracy",
    greater_is_better=True,
    report_to="none",
    seed=cfg.get("seed", 42),
  )

  trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_train,
    eval_dataset=tokenized_eval,
    tokenizer=tokenizer,
    data_collator=DataCollatorWithPadding(tokenizer=tokenizer),
    compute_metrics=compute_metrics,
  )

  trainer.train()
  metrics = trainer.evaluate()
  trainer.save_model(cfg["output_dir"])
  tokenizer.save_pretrained(cfg["output_dir"])

  print(json.dumps({"saved_to": cfg["output_dir"], "train_samples": len(tokenized_train), "eval_samples": len(tokenized_eval), "metrics": metrics}, indent=2))


if __name__ == "__main__":
  main()
