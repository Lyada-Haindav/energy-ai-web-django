import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent
LEGACY_SERVER_DIR = PROJECT_ROOT / "server"


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        os.environ.setdefault(key, value)


def env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def resolve_legacy_path(raw_value: str | None, fallback: Path, *, relative_to: Path | None = None) -> Path:
    if not raw_value:
        return fallback

    candidate = Path(raw_value).expanduser()
    if candidate.is_absolute():
        return candidate

    base = relative_to or PROJECT_ROOT
    return (base / candidate).resolve()


load_env_file(LEGACY_SERVER_DIR / ".env")
load_env_file(BASE_DIR / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "energy-ai-django-dev-secret-key")
DEBUG = env_bool("DJANGO_DEBUG", True)

ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost,0.0.0.0,testserver").split(",")
    if host.strip()
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "api",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "api.middleware.SimpleCorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "django_server.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [PROJECT_ROOT / "client" / "dist"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]

WSGI_APPLICATION = "django_server.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("APP_TIMEZONE") or os.getenv("TZ") or "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

APP_PORT = int(os.getenv("PORT", "8787"))
APP_BASE_URL = os.getenv("APP_BASE_URL", f"http://127.0.0.1:{APP_PORT}")
ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN", "http://localhost:5173")
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", "")
EMAIL_FROM_NAME = os.getenv("EMAIL_FROM_NAME", "Energy AI")
DEFAULT_FROM_EMAIL = EMAIL_FROM
ADMIN_EMAILS = {
    email.strip().lower()
    for email in os.getenv("ADMIN_EMAILS", "").split(",")
    if email.strip()
}

ENERGY_APP_DATA_DIR = resolve_legacy_path(
    os.getenv("APP_DATA_DIR"),
    PROJECT_ROOT / "server" / "data",
)
ENERGY_APP_DATA_FILE = resolve_legacy_path(
    os.getenv("APP_DATA_FILE"),
    ENERGY_APP_DATA_DIR / "app-data.json",
)
ENERGY_OWN_MODELS_DIR = resolve_legacy_path(
    os.getenv("OWN_MODELS_DIR"),
    PROJECT_ROOT / "training" / "checkpoints" / "own",
    relative_to=LEGACY_SERVER_DIR,
)
ENERGY_TRAINING_PUBLIC_DATA_PATH = resolve_legacy_path(
    os.getenv("PUBLIC_TRAIN_DATA_PATH"),
    PROJECT_ROOT / "training" / "data" / "public" / "merged_public_chat.jsonl",
)
ENERGY_TRAINING_APPROVED_PATH = resolve_legacy_path(
    os.getenv("USER_TRAIN_DATA_PATH"),
    PROJECT_ROOT / "training" / "data" / "local" / "user_live_pairs.jsonl",
)
ENERGY_TRAINING_CANDIDATE_PATH = resolve_legacy_path(
    os.getenv("USER_TRAIN_CANDIDATE_DATA_PATH"),
    PROJECT_ROOT / "training" / "data" / "local" / "user_live_candidates.jsonl",
)
ENERGY_TRAINING_REJECTED_PATH = resolve_legacy_path(
    os.getenv("USER_TRAIN_REJECTED_DATA_PATH"),
    PROJECT_ROOT / "training" / "data" / "local" / "user_rejected_pairs.jsonl",
)
ENERGY_TRAINING_STATE_PATH = resolve_legacy_path(
    os.getenv("AUTO_TRAIN_STATE_PATH"),
    PROJECT_ROOT / "training" / "data" / "local" / "auto_train_state.json",
)
ENERGY_EVALUATION_RUNS_PATH = resolve_legacy_path(
    os.getenv("EVALUATION_RUNS_PATH"),
    PROJECT_ROOT / "training" / "data" / "local" / "evaluation_runs.jsonl",
)
ENERGY_TRAIN_SCRIPT_PATH = resolve_legacy_path(
    os.getenv("AUTO_TRAIN_SCRIPT"),
    PROJECT_ROOT / "training" / "scripts" / "train_own_models.py",
)

ROUTER_PROVIDER = os.getenv("ROUTER_PROVIDER", "mock")
FAST_PROVIDER = os.getenv("FAST_PROVIDER", "mock")
DEEP_PROVIDER = os.getenv("DEEP_PROVIDER", "mock")
ROUTER_MODEL = os.getenv("ROUTER_MODEL", "energy-router-v1")
FAST_MODEL = os.getenv("FAST_MODEL", "energy-low-v1")
DEEP_MODEL = os.getenv("DEEP_MODEL", "energy-high-v1")

CHAT_STREAM_CHUNK_CHARS = int(os.getenv("CHAT_STREAM_CHUNK_CHARS", "220"))
AUTO_TRAIN_ENABLED = env_bool("AUTO_TRAIN_ENABLED", True)
AUTO_TRAIN_MIN_NEW_EXAMPLES = int(os.getenv("AUTO_TRAIN_MIN_NEW_EXAMPLES", "10"))
AUTO_TRAIN_COOLDOWN_MS = int(os.getenv("AUTO_TRAIN_COOLDOWN_MINUTES", "20")) * 60 * 1000
