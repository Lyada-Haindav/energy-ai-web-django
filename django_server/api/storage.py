import errno
import hashlib
import json
import os
import sys
import threading
from copy import deepcopy
from pathlib import Path
from urllib.parse import urlparse

from django.conf import settings

try:
    from pymongo import MongoClient
except Exception:
    MongoClient = None

from .errors import AppError


_DATA_LOCK = threading.Lock()
_MONGO_CLIENT = None
_MONGO_DB = None
_MONGO_COLLECTIONS = None
_MONGO_FALLBACK_LOGGED = False
_MONGO_PERMANENTLY_DISABLED = False
_MONGO_LAST_ERROR = ""
_MONGO_SEEDED_GROUPS = set()

_TRAINING_KIND_TO_COLLECTION = {
    "approved": "trainingApproved",
    "candidate": "trainingCandidates",
    "rejected": "trainingRejected",
}


def create_empty_db():
    return {
        "users": [],
        "sessions": [],
        "chats": {},
    }


def normalize_db_shape(parsed):
    return {
        "users": parsed.get("users") if isinstance(parsed.get("users"), list) else [],
        "sessions": parsed.get("sessions") if isinstance(parsed.get("sessions"), list) else [],
        "chats": parsed.get("chats") if isinstance(parsed.get("chats"), dict) else {},
    }


def data_file() -> Path:
    return Path(settings.ENERGY_APP_DATA_FILE)


def ensure_data_file():
    path = data_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text(json.dumps(create_empty_db(), separators=(",", ":")), encoding="utf-8")


def _read_jsonl_rows(path: Path):
    if not path.exists():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw:
            continue
        try:
            rows.append(json.loads(raw))
        except Exception:
            continue
    return rows


def _write_jsonl_rows(path: Path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    payload = "\n".join(json.dumps(row, ensure_ascii=False) for row in rows)
    if payload:
        payload += "\n"
    try:
        tmp_path.write_text(payload, encoding="utf-8")
        os.replace(tmp_path, path)
    except OSError as exc:
        try:
            if tmp_path.exists():
                tmp_path.unlink()
        except OSError:
            pass
        if exc.errno == errno.ENOSPC:
            raise AppError("Storage is almost full, so training history could not be saved right now.", 507) from exc
        raise


def _read_file_db_unlocked():
    ensure_data_file()
    path = data_file()
    try:
        return normalize_db_shape(json.loads(path.read_text(encoding="utf-8")))
    except Exception:
        return create_empty_db()


def _write_file_db_unlocked(db):
    ensure_data_file()
    path = data_file()
    tmp_path = path.with_suffix(".tmp")
    payload = json.dumps(normalize_db_shape(db), separators=(",", ":"), ensure_ascii=False)
    try:
        tmp_path.write_text(payload, encoding="utf-8")
        os.replace(tmp_path, path)
    except OSError as exc:
        try:
            if tmp_path.exists():
                tmp_path.unlink()
        except OSError:
            pass
        if exc.errno == errno.ENOSPC:
            raise AppError("Storage is almost full, so chat history could not be saved right now.", 507) from exc
        raise


def mongo_uri():
    return str(os.getenv("MONGODB_URI", "")).strip()


def env_bool(name, default):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def mongo_required():
    return env_bool("MONGODB_REQUIRED", bool(mongo_uri()))


def mongo_db_name():
    explicit = str(os.getenv("MONGODB_DB_NAME", "")).strip()
    if explicit:
        return explicit
    uri = mongo_uri()
    if not uri:
        return ""
    try:
        pathname = urlparse(uri).path.lstrip("/")
        return pathname or ""
    except Exception:
        return ""


def mongo_collection_name():
    return str(os.getenv("MONGODB_COLLECTION", "appData")).strip() or "appData"


def mongo_document_id():
    return str(os.getenv("MONGODB_DOCUMENT_ID", "energy-ai")).strip() or "energy-ai"


def mongo_collection_names():
    return {
        "legacy": mongo_collection_name(),
        "users": str(os.getenv("MONGODB_USERS_COLLECTION", "users")).strip() or "users",
        "sessions": str(os.getenv("MONGODB_SESSIONS_COLLECTION", "authSessions")).strip() or "authSessions",
        "chats": str(os.getenv("MONGODB_CHATS_COLLECTION", "chatSessions")).strip() or "chatSessions",
        "trainingApproved": str(os.getenv("MONGODB_TRAINING_APPROVED_COLLECTION", "trainingApproved")).strip() or "trainingApproved",
        "trainingCandidates": str(os.getenv("MONGODB_TRAINING_CANDIDATE_COLLECTION", "trainingCandidates")).strip() or "trainingCandidates",
        "trainingRejected": str(os.getenv("MONGODB_TRAINING_REJECTED_COLLECTION", "trainingRejected")).strip() or "trainingRejected",
        "evaluationRuns": str(os.getenv("MONGODB_EVALUATION_COLLECTION", "evaluationRuns")).strip() or "evaluationRuns",
    }


def training_file_path(kind):
    mapping = {
        "approved": Path(settings.ENERGY_TRAINING_APPROVED_PATH),
        "candidate": Path(settings.ENERGY_TRAINING_CANDIDATE_PATH),
        "rejected": Path(settings.ENERGY_TRAINING_REJECTED_PATH),
    }
    return mapping[kind]


def evaluation_runs_path():
    configured = getattr(settings, "ENERGY_EVALUATION_RUNS_PATH", None)
    if configured:
        return Path(configured)
    return Path(settings.PROJECT_ROOT) / "training" / "data" / "local" / "evaluation_runs.jsonl"


def use_mongo_store():
    return bool(mongo_uri()) and not _MONGO_PERMANENTLY_DISABLED and MongoClient is not None


def _mongo_unavailable_message():
    if not mongo_uri():
        detail = "MONGODB_URI is not set."
    elif MongoClient is None:
        detail = "The pymongo driver is not installed."
    elif _MONGO_LAST_ERROR:
        detail = _MONGO_LAST_ERROR
    else:
        detail = "MongoDB is not reachable."
    return f"MongoDB storage is required but unavailable. Fix MongoDB and restart the Django app. Details: {detail}"


def _disable_mongo_store(error):
    global _MONGO_CLIENT, _MONGO_DB, _MONGO_COLLECTIONS, _MONGO_PERMANENTLY_DISABLED, _MONGO_FALLBACK_LOGGED, _MONGO_LAST_ERROR
    _MONGO_PERMANENTLY_DISABLED = True
    _MONGO_CLIENT = None
    _MONGO_DB = None
    _MONGO_COLLECTIONS = None
    _MONGO_LAST_ERROR = str(error or "Unknown MongoDB error.")
    if not _MONGO_FALLBACK_LOGGED:
        prefix = (
            "MongoDB unavailable for required app storage"
            if mongo_required()
            else "MongoDB unavailable, falling back to file storage"
        )
        print(f"{prefix}: {_MONGO_LAST_ERROR}", file=sys.stderr)
        _MONGO_FALLBACK_LOGGED = True


def _get_mongo_database_unlocked():
    global _MONGO_CLIENT, _MONGO_DB

    if not use_mongo_store():
        return None

    if _MONGO_DB is not None:
        return _MONGO_DB

    db_name = mongo_db_name()
    if not db_name:
        raise RuntimeError("MONGODB_URI is set, but the database name is missing.")

    client = MongoClient(
        mongo_uri(),
        serverSelectionTimeoutMS=2000,
        connectTimeoutMS=2000,
        socketTimeoutMS=4000,
        retryWrites=True,
    )
    db = client[db_name]
    db.list_collection_names()
    _MONGO_CLIENT = client
    _MONGO_DB = db
    return db


def _get_mongo_collections_unlocked():
    global _MONGO_COLLECTIONS

    if not use_mongo_store():
        return {}

    if _MONGO_COLLECTIONS is None:
        db = _get_mongo_database_unlocked()
        names = mongo_collection_names()
        _MONGO_COLLECTIONS = {
            key: db[name]
            for key, name in names.items()
            if key != "legacy"
        }
    return _MONGO_COLLECTIONS


def _strip_mongo_id(document):
    clean = {key: value for key, value in document.items() if key != "_id"}
    return clean


def _normalize_user_document(user):
    doc = deepcopy(user or {})
    user_id = str(doc.get("id") or doc.get("_id") or "").strip()
    if not user_id:
        return None
    doc["id"] = user_id
    doc["_id"] = user_id
    return doc


def _normalize_session_document(session):
    doc = deepcopy(session or {})
    session_id = str(doc.get("id") or doc.get("_id") or "").strip()
    if not session_id:
        return None
    doc["id"] = session_id
    doc["_id"] = session_id
    return doc


def _normalize_chat_document(session, user_id):
    doc = deepcopy(session or {})
    session_id = str(doc.get("id") or doc.get("_id") or "").strip()
    if not session_id:
        return None
    doc["id"] = session_id
    doc["_id"] = session_id
    doc["userId"] = str(user_id or doc.get("userId") or "").strip()
    if not doc["userId"]:
        return None
    doc["messages"] = doc.get("messages") if isinstance(doc.get("messages"), list) else []
    return doc


def _record_fingerprint(prefix, payload):
    raw = json.dumps(payload, ensure_ascii=True, sort_keys=True)
    return hashlib.sha1(f"{prefix}:{raw}".encode("utf-8")).hexdigest()


def _normalize_aux_document(prefix, payload):
    doc = deepcopy(payload or {})
    record_id = str(doc.get("id") or "").strip() or _record_fingerprint(prefix, doc)
    doc["id"] = record_id
    doc["_id"] = record_id
    return doc


def _dedupe_documents_by_id(documents):
    unique = {}
    for document in documents:
        if not document:
            continue
        document_id = str(document.get("_id") or document.get("id") or "").strip()
        if not document_id:
            continue
        unique[document_id] = document
    return list(unique.values())


def _upsert_documents(collection, documents):
    for document in _dedupe_documents_by_id(documents):
        collection.replace_one({"_id": document["_id"]}, document, upsert=True)


def _seed_main_collections_unlocked():
    seed_key = "main"
    if seed_key in _MONGO_SEEDED_GROUPS:
        return

    db = _get_mongo_database_unlocked()
    collections = _get_mongo_collections_unlocked()
    has_main_data = any(collections[key].count_documents({}, limit=1) > 0 for key in ("users", "sessions", "chats"))
    if has_main_data:
        _MONGO_SEEDED_GROUPS.add(seed_key)
        return

    legacy = db[mongo_collection_names()["legacy"]].find_one({"_id": mongo_document_id()})
    seed = normalize_db_shape(legacy or _read_file_db_unlocked())
    _write_main_collections_from_db_unlocked(seed, collections)
    _MONGO_SEEDED_GROUPS.add(seed_key)


def _seed_aux_collection_unlocked(kind):
    seed_key = f"aux:{kind}"
    if seed_key in _MONGO_SEEDED_GROUPS:
        return

    collections = _get_mongo_collections_unlocked()
    collection = collections[_TRAINING_KIND_TO_COLLECTION[kind]]
    if collection.count_documents({}, limit=1) > 0:
        _MONGO_SEEDED_GROUPS.add(seed_key)
        return

    rows = _read_jsonl_rows(training_file_path(kind))
    if rows:
        _upsert_documents(collection, [_normalize_aux_document(kind, row) for row in rows])
    _MONGO_SEEDED_GROUPS.add(seed_key)


def _seed_evaluation_runs_unlocked():
    seed_key = "aux:evaluations"
    if seed_key in _MONGO_SEEDED_GROUPS:
        return

    collections = _get_mongo_collections_unlocked()
    collection = collections["evaluationRuns"]
    if collection.count_documents({}, limit=1) > 0:
        _MONGO_SEEDED_GROUPS.add(seed_key)
        return

    rows = _read_jsonl_rows(evaluation_runs_path())
    if rows:
        _upsert_documents(collection, [_normalize_aux_document("evaluation", row) for row in rows])
    _MONGO_SEEDED_GROUPS.add(seed_key)


def _write_main_collections_from_db_unlocked(db, collections):
    normalized = normalize_db_shape(db)
    users = [_normalize_user_document(user) for user in normalized["users"]]
    sessions = [_normalize_session_document(session) for session in normalized["sessions"]]
    chats = []
    for user_id, user_sessions in normalized["chats"].items():
        if not isinstance(user_sessions, list):
            continue
        for session in user_sessions:
            document = _normalize_chat_document(session, user_id)
            if document:
                chats.append(document)

    collections["users"].delete_many({})
    collections["sessions"].delete_many({})
    collections["chats"].delete_many({})
    deduped_users = _dedupe_documents_by_id(users)
    deduped_sessions = _dedupe_documents_by_id(sessions)
    deduped_chats = _dedupe_documents_by_id(chats)
    if deduped_users:
        collections["users"].insert_many(deduped_users, ordered=False)
    if deduped_sessions:
        collections["sessions"].insert_many(deduped_sessions, ordered=False)
    if deduped_chats:
        collections["chats"].insert_many(deduped_chats, ordered=False)


def _read_mongo_db_unlocked():
    _seed_main_collections_unlocked()
    collections = _get_mongo_collections_unlocked()
    users = [_strip_mongo_id(document) for document in collections["users"].find({})]
    sessions = [_strip_mongo_id(document) for document in collections["sessions"].find({})]
    chat_map = {}
    for document in collections["chats"].find({}).sort("updatedAt", -1):
        clean = _strip_mongo_id(document)
        user_id = str(clean.get("userId") or "").strip()
        if not user_id:
            continue
        chat_map.setdefault(user_id, []).append(clean)
    return normalize_db_shape({"users": users, "sessions": sessions, "chats": chat_map})


def _write_mongo_db_unlocked(db):
    _seed_main_collections_unlocked()
    collections = _get_mongo_collections_unlocked()
    _write_main_collections_from_db_unlocked(db, collections)


def _read_db_unlocked():
    if use_mongo_store():
        try:
            return _read_mongo_db_unlocked()
        except Exception as exc:
            _disable_mongo_store(exc)
            if mongo_required():
                raise AppError(_mongo_unavailable_message(), 503) from exc
    elif mongo_required():
        raise AppError(_mongo_unavailable_message(), 503)
    return _read_file_db_unlocked()


def _write_db_unlocked(db):
    if use_mongo_store():
        try:
            _write_mongo_db_unlocked(db)
            return
        except Exception as exc:
            _disable_mongo_store(exc)
            if mongo_required():
                raise AppError(_mongo_unavailable_message(), 503) from exc
    elif mongo_required():
        raise AppError(_mongo_unavailable_message(), 503)
    _write_file_db_unlocked(db)


def read_db():
    with _DATA_LOCK:
        return deepcopy(_read_db_unlocked())


def update_db(mutator):
    with _DATA_LOCK:
        db = _read_db_unlocked()
        result = mutator(db)
        _write_db_unlocked(db)
        return result


def store_training_record(kind, payload):
    if kind not in _TRAINING_KIND_TO_COLLECTION:
        raise ValueError(f"Unsupported training record kind: {kind}")
    with _DATA_LOCK:
        if use_mongo_store():
            try:
                _seed_aux_collection_unlocked(kind)
                collection = _get_mongo_collections_unlocked()[_TRAINING_KIND_TO_COLLECTION[kind]]
                document = _normalize_aux_document(kind, payload)
                collection.replace_one({"_id": document["_id"]}, document, upsert=True)
                return {"stored": True, "mode": "mongo", "id": document["id"]}
            except Exception as exc:
                _disable_mongo_store(exc)
                if mongo_required():
                    raise AppError(_mongo_unavailable_message(), 503) from exc
        return {"stored": False, "mode": "file", "id": ""}


def list_training_records(kind, limit=0, newest_first=True):
    if kind not in _TRAINING_KIND_TO_COLLECTION:
        raise ValueError(f"Unsupported training record kind: {kind}")
    with _DATA_LOCK:
        if use_mongo_store():
            try:
                _seed_aux_collection_unlocked(kind)
                collection = _get_mongo_collections_unlocked()[_TRAINING_KIND_TO_COLLECTION[kind]]
                cursor = collection.find({})
                cursor = cursor.sort("created_at", -1 if newest_first else 1)
                if limit:
                    cursor = cursor.limit(limit)
                return [_strip_mongo_id(document) for document in cursor]
            except Exception as exc:
                _disable_mongo_store(exc)
                if mongo_required():
                    raise AppError(_mongo_unavailable_message(), 503) from exc
        rows = _read_jsonl_rows(training_file_path(kind))
        rows.sort(key=lambda item: str(item.get("created_at") or ""), reverse=newest_first)
        return rows[:limit] if limit else rows


def count_training_records(kind):
    if kind not in _TRAINING_KIND_TO_COLLECTION:
        raise ValueError(f"Unsupported training record kind: {kind}")
    with _DATA_LOCK:
        if use_mongo_store():
            try:
                _seed_aux_collection_unlocked(kind)
                return int(_get_mongo_collections_unlocked()[_TRAINING_KIND_TO_COLLECTION[kind]].count_documents({}))
            except Exception as exc:
                _disable_mongo_store(exc)
                if mongo_required():
                    raise AppError(_mongo_unavailable_message(), 503) from exc
        return len(_read_jsonl_rows(training_file_path(kind)))


def rewrite_training_records_file(kind, rows):
    if kind not in _TRAINING_KIND_TO_COLLECTION:
        raise ValueError(f"Unsupported training record kind: {kind}")
    with _DATA_LOCK:
        _write_jsonl_rows(training_file_path(kind), rows)


def store_evaluation_run(payload):
    with _DATA_LOCK:
        if use_mongo_store():
            try:
                _seed_evaluation_runs_unlocked()
                collection = _get_mongo_collections_unlocked()["evaluationRuns"]
                document = _normalize_aux_document("evaluation", payload)
                collection.replace_one({"_id": document["_id"]}, document, upsert=True)
                return {"stored": True, "mode": "mongo", "id": document["id"]}
            except Exception as exc:
                _disable_mongo_store(exc)
                if mongo_required():
                    raise AppError(_mongo_unavailable_message(), 503) from exc
        rows = _read_jsonl_rows(evaluation_runs_path())
        rows.append(payload)
        _write_jsonl_rows(evaluation_runs_path(), rows)
        return {"stored": True, "mode": "file", "id": ""}


def list_evaluation_runs(limit=0):
    with _DATA_LOCK:
        if use_mongo_store():
            try:
                _seed_evaluation_runs_unlocked()
                cursor = _get_mongo_collections_unlocked()["evaluationRuns"].find({}).sort("startedAt", -1)
                if limit:
                    cursor = cursor.limit(limit)
                return [_strip_mongo_id(document) for document in cursor]
            except Exception as exc:
                _disable_mongo_store(exc)
                if mongo_required():
                    raise AppError(_mongo_unavailable_message(), 503) from exc
        rows = _read_jsonl_rows(evaluation_runs_path())
        rows.sort(key=lambda item: int(item.get("startedAt") or 0), reverse=True)
        return rows[:limit] if limit else rows


def latest_evaluation_run():
    runs = list_evaluation_runs(limit=1)
    return runs[0] if runs else None


def clone_sessions(sessions):
    safe_sessions = sessions if isinstance(sessions, list) else []
    return deepcopy(safe_sessions)


def describe_storage_backend():
    path = data_file()
    names = mongo_collection_names() if mongo_uri() else {}
    return {
        "mode": "mongo" if use_mongo_store() or mongo_required() else "file",
        "mongoConfigured": bool(mongo_uri()),
        "mongoRequired": mongo_required(),
        "mongoReady": use_mongo_store(),
        "mongoFallbackLogged": _MONGO_FALLBACK_LOGGED,
        "mongoPermanentlyDisabled": _MONGO_PERMANENTLY_DISABLED or MongoClient is None,
        "mongoLastError": _MONGO_LAST_ERROR,
        "dataDir": str(path.parent),
        "dataFile": str(path),
        "mongoDbName": mongo_db_name() if mongo_uri() else "",
        "mongoCollection": names.get("legacy", "") if names else "",
        "mongoDocumentId": mongo_document_id() if mongo_uri() else "",
        "mongoCollections": names,
    }
