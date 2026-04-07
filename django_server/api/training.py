import errno
import json
import shutil
import subprocess
import sys
import threading
from pathlib import Path

from django.conf import settings

from .storage import (
    count_training_records,
    list_training_records,
    rewrite_training_records_file,
    store_training_record,
)


_TRAIN_LOCK = threading.Lock()
_training_in_progress = False
_last_train_started_at = 0
_last_train_completed_at = 0
_last_train_result = {
    "status": "idle",
    "startedAt": 0,
    "completedAt": 0,
    "detail": "",
}


def _now_ms():
    import time

    return int(time.time() * 1000)


def _iso_now():
    from datetime import datetime, timezone

    return datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z")


def _ensure_parent(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)


def _read_json_file(path: Path):
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _append_jsonl(path: Path, payload):
    _ensure_parent(path)
    try:
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload, ensure_ascii=False) + "\n")
    except OSError as exc:
        if exc.errno == errno.ENOSPC:
            return False
        raise
    return True


def _count_feedback_rows(kind):
    return count_training_records(kind)


def _recent_feedback_rows(kind, limit=4):
    rows = list_training_records(kind, limit=limit)
    return [
        {
            "prompt": str(row.get("prompt") or "")[:220],
            "completion": str(row.get("completion") or "")[:260],
            "source": str(row.get("source") or ""),
            "feedback": str(row.get("feedback") or ""),
            "routeReason": str(row.get("route_reason") or ""),
            "model": str(row.get("model") or ""),
            "createdAt": str(row.get("created_at") or ""),
        }
        for row in rows
    ]


def _read_auto_train_state():
    path = Path(settings.ENERGY_TRAINING_STATE_PATH)
    parsed = _read_json_file(path) or {}
    legacy_lines = int(parsed.get("last_trained_lines") or 0)
    return {
        "lastTrainedApprovedCount": int(parsed.get("lastTrainedApprovedCount") or legacy_lines),
        "lastTriggeredAt": int(parsed.get("lastTriggeredAt") or 0),
        "lastTrainStartedAt": int(parsed.get("lastTrainStartedAt") or 0),
        "lastTrainCompletedAt": int(parsed.get("lastTrainCompletedAt") or 0),
        "updatedAt": str(parsed.get("updatedAt") or ""),
    }


def _write_auto_train_state(payload):
    path = Path(settings.ENERGY_TRAINING_STATE_PATH)
    _ensure_parent(path)
    merged = {
        **_read_auto_train_state(),
        **payload,
        "updatedAt": _iso_now(),
    }
    path.write_text(json.dumps(merged, ensure_ascii=True, indent=2), encoding="utf-8")
    return merged


def _sync_training_corpus_from_storage():
    for kind in ("approved", "candidate", "rejected"):
        rows = list_training_records(kind, newest_first=False)
        rewrite_training_records_file(kind, rows)


def _training_inputs():
    root = Path(settings.PROJECT_ROOT)
    inputs = [
        root / "training" / "data" / "processed" / "advanced" / "raw_large_mix.jsonl",
        root / "training" / "data" / "advanced_webapp_seed.jsonl",
        root / "training" / "data" / "polyglot_coding_seed.jsonl",
        root / "training" / "data" / "coding_master_seed.jsonl",
        root / "training" / "data" / "coding_followup_seed.jsonl",
        root / "training" / "data" / "contest_alignment_seed.jsonl",
        root / "training" / "data" / "energy_alignment_seed.jsonl",
        root / "training" / "data" / "prompt_understanding_seed.jsonl",
        root / "training" / "data" / "chat_behavior_seed.jsonl",
        Path(settings.ENERGY_TRAINING_APPROVED_PATH),
        Path(settings.ENERGY_TRAINING_PUBLIC_DATA_PATH),
    ]
    unique = []
    seen = set()
    for path in inputs:
        resolved = Path(path)
        key = str(resolved.resolve()) if resolved.exists() else str(resolved)
        if key in seen or not resolved.exists():
            continue
        seen.add(key)
        unique.append(resolved)
    return unique


def _build_training_command():
    command = [
        sys.executable,
        str(settings.ENERGY_TRAIN_SCRIPT_PATH),
    ]
    for path in _training_inputs():
        command.extend(["--input", str(path)])
    command.extend(
        [
            "--out-dir",
            str(settings.ENERGY_OWN_MODELS_DIR),
            "--deep-threshold",
            "3",
            "--max-pairs",
            "30000",
            "--max-duplicate-prompts",
            "5",
            "--max-fast-to-deep-ratio",
            "4.0",
            "--seed",
            "42",
        ]
    )
    return command


def _mirror_trained_artifacts():
    source_dir = Path(settings.ENERGY_OWN_MODELS_DIR)
    mirror_dir = Path(settings.PROJECT_ROOT) / "server" / "model-artifacts" / "own"
    if source_dir.resolve() == mirror_dir.resolve():
        return
    mirror_dir.mkdir(parents=True, exist_ok=True)
    for name in ("router.json", "fast.json", "deep.json", "metadata.json"):
        source_path = source_dir / name
        if source_path.exists():
            shutil.copy2(source_path, mirror_dir / name)


def _set_train_result(status, detail, started_at=0, completed_at=0):
    global _last_train_result
    _last_train_result = {
        "status": status,
        "startedAt": started_at,
        "completedAt": completed_at,
        "detail": str(detail or "")[:320],
    }


def _run_training_job(reason):
    global _training_in_progress, _last_train_started_at, _last_train_completed_at

    from .chat_engine import clear_own_artifact_cache

    try:
        _sync_training_corpus_from_storage()
        command = _build_training_command()
        _last_train_started_at = _now_ms()
        _set_train_result("running", reason, started_at=_last_train_started_at, completed_at=0)
        _write_auto_train_state({"lastTrainStartedAt": _last_train_started_at})

        result = subprocess.run(
            command,
            cwd=str(settings.PROJECT_ROOT),
            capture_output=True,
            text=True,
            check=False,
        )

        if result.returncode == 0:
            _mirror_trained_artifacts()
            clear_own_artifact_cache()
            _last_train_completed_at = _now_ms()
            approved_count = _count_feedback_rows("approved")
            _write_auto_train_state(
                {
                    "lastTrainedApprovedCount": approved_count,
                    "lastTrainCompletedAt": _last_train_completed_at,
                }
            )
            detail = "training completed successfully"
            output = (result.stdout or "").strip()
            if output:
                detail = output.splitlines()[-1][:320]
            _set_train_result("success", detail, started_at=_last_train_started_at, completed_at=_last_train_completed_at)
        else:
            completed_at = _now_ms()
            _last_train_completed_at = completed_at
            detail = (result.stderr or result.stdout or "training failed").strip()[:320]
            _write_auto_train_state({"lastTrainCompletedAt": completed_at})
            _set_train_result("failed", detail, started_at=_last_train_started_at, completed_at=completed_at)
    finally:
        with _TRAIN_LOCK:
            _training_in_progress = False


def _start_training_job(reason):
    global _training_in_progress
    with _TRAIN_LOCK:
        if _training_in_progress:
            return {"queued": False, "inProgress": True, "message": "Training is already running."}

        _training_in_progress = True
        thread = threading.Thread(target=_run_training_job, args=(reason,), daemon=True)
        thread.start()
        return {"queued": True, "inProgress": True, "message": reason}


def _maybe_trigger_auto_train():
    if not settings.AUTO_TRAIN_ENABLED:
        return {"queued": False, "inProgress": False, "message": "Auto-train is disabled."}

    state = _read_auto_train_state()
    approved_count = _count_feedback_rows("approved")
    pending = max(approved_count - int(state.get("lastTrainedApprovedCount") or 0), 0)
    if pending < settings.AUTO_TRAIN_MIN_NEW_EXAMPLES:
        return {
            "queued": False,
            "inProgress": _training_in_progress,
            "message": f"Waiting for {settings.AUTO_TRAIN_MIN_NEW_EXAMPLES - pending} more approved examples before auto-train.",
        }

    now_ms = _now_ms()
    last_gate = max(
        int(state.get("lastTriggeredAt") or 0),
        int(state.get("lastTrainCompletedAt") or 0),
        _last_train_completed_at,
    )
    if last_gate and now_ms - last_gate < settings.AUTO_TRAIN_COOLDOWN_MS:
        return {
            "queued": False,
            "inProgress": _training_in_progress,
            "message": "Auto-train is cooling down.",
        }

    started = _start_training_job("Feedback threshold reached. Auto-training started.")
    if started.get("queued"):
        _write_auto_train_state({"lastTriggeredAt": now_ms})
    return started


def record_user_training_pair(prompt, completion):
    prompt_value = str(prompt or "").strip()
    completion_value = str(completion or "").strip()
    if len(prompt_value) < 3 or len(completion_value) < 8:
        return {"recorded": False}

    payload = {
        "prompt": prompt_value,
        "completion": completion_value,
        "source": "live_user_chat",
        "quality_signal": "candidate",
        "created_at": _iso_now(),
    }
    if not _append_jsonl(Path(settings.ENERGY_TRAINING_CANDIDATE_PATH), payload):
        return {"recorded": False, "reason": "storage-full"}
    store_training_record("candidate", payload)
    return {"recorded": True}


def record_feedback_training_pair(prompt, completion, feedback, replacement="", meta=None):
    metadata = meta if isinstance(meta, dict) else {}
    prompt_value = str(prompt or "").strip()
    completion_value = str(completion or "").strip()
    replacement_value = str(replacement or "").strip()
    feedback_value = str(feedback or "").strip().lower()
    if feedback_value not in {"up", "down"}:
        return {"recorded": False, "trained": False}

    records = []
    if feedback_value == "up":
        records.append(
            (
                "approved",
                {
                    "prompt": prompt_value,
                    "completion": replacement_value or completion_value,
                    "source": "user_feedback_correction" if replacement_value else "user_feedback_upvote",
                    "feedback": "replacement" if replacement_value else "upvote",
                    "quality_signal": "approved",
                    "model": metadata.get("model") or "",
                    "role": metadata.get("role") or "",
                    "energy_mode": metadata.get("energyMode") or "",
                    "route_reason": metadata.get("routeReason") or "",
                    "created_at": _iso_now(),
                },
            )
        )
    else:
        records.append(
            (
                "rejected",
                {
                    "prompt": prompt_value,
                    "completion": completion_value,
                    "source": "user_feedback_rejected",
                    "feedback": "downvote",
                    "quality_signal": "rejected",
                    "model": metadata.get("model") or "",
                    "role": metadata.get("role") or "",
                    "energy_mode": metadata.get("energyMode") or "",
                    "route_reason": metadata.get("routeReason") or "",
                    "created_at": _iso_now(),
                },
            )
        )
        if replacement_value:
            records.append(
                (
                    "approved",
                    {
                        "prompt": prompt_value,
                        "completion": replacement_value,
                        "source": "user_feedback_correction",
                        "feedback": "replacement",
                        "quality_signal": "approved",
                        "model": metadata.get("model") or "",
                        "role": metadata.get("role") or "",
                        "energy_mode": metadata.get("energyMode") or "",
                        "route_reason": metadata.get("routeReason") or "",
                        "created_at": _iso_now(),
                    },
                )
            )

    for kind, payload in records:
        if not _append_jsonl(training_file_path(kind), payload):
            return {"recorded": False, "trained": False, "reason": "storage-full"}
        store_training_record(kind, payload)

    auto_train = _maybe_trigger_auto_train() if any(kind == "approved" for kind, _ in records) else {"queued": False, "inProgress": _training_in_progress, "message": ""}
    return {"recorded": True, "trained": bool(auto_train.get("queued")), "autoTrain": auto_train}


def trigger_manual_auto_train():
    return _start_training_job("Manual retraining started.")


def get_auto_train_status():
    metadata = _read_json_file(Path(settings.ENERGY_OWN_MODELS_DIR) / "metadata.json") or {}
    state = _read_auto_train_state()
    approved_rows = _count_feedback_rows("approved")
    return {
        "enabled": settings.AUTO_TRAIN_ENABLED,
        "inProgress": _training_in_progress,
        "lastTrainStartedAt": _last_train_started_at or int(state.get("lastTrainStartedAt") or 0),
        "lastTrainCompletedAt": _last_train_completed_at or int(state.get("lastTrainCompletedAt") or 0),
        "lastTrainResult": _last_train_result,
        "minNewExamples": settings.AUTO_TRAIN_MIN_NEW_EXAMPLES,
        "cooldownMs": settings.AUTO_TRAIN_COOLDOWN_MS,
        "pendingApprovedExamples": max(approved_rows - int(state.get("lastTrainedApprovedCount") or 0), 0),
        "files": {
            "approved": approved_rows,
            "candidates": _count_feedback_rows("candidate"),
            "rejected": _count_feedback_rows("rejected"),
        },
        "recent": {
            "approved": _recent_feedback_rows("approved"),
            "candidates": _recent_feedback_rows("candidate"),
            "rejected": _recent_feedback_rows("rejected"),
        },
        "metadata": metadata,
    }
