import hashlib
import hmac
import re
import secrets
from datetime import datetime, timezone
from urllib.parse import urlencode
from uuid import uuid4

from django.conf import settings

from .errors import AppError
from .storage import update_db


SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30
EMAIL_TOKEN_TTL_MS = 1000 * 60 * 60 * 24
RESET_TOKEN_TTL_MS = 1000 * 60 * 30
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def now_ms():
    return int(datetime.now(tz=timezone.utc).timestamp() * 1000)


def now_iso():
    return datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z")


def normalize_email(email):
    return str(email or "").strip().lower()


def validate_email(email):
    return bool(EMAIL_RE.match(normalize_email(email)))


def validate_password(password):
    return len(str(password or "")) >= 8


def hash_token(token):
    return hashlib.sha256(str(token or "").encode("utf-8")).hexdigest()


def hash_password(password):
    salt = secrets.token_hex(16)
    derived = hashlib.scrypt(
        str(password).encode("utf-8"),
        salt=salt.encode("utf-8"),
        n=16384,
        r=8,
        p=1,
        dklen=64,
    ).hex()
    return f"{salt}:{derived}"


def parse_password_hash(stored_hash):
    salt, _, expected_hex = str(stored_hash or "").partition(":")
    if not salt or not expected_hex or len(expected_hex) % 2 != 0:
        return None
    if not re.fullmatch(r"[0-9a-fA-F]+", expected_hex):
        return None
    return salt, expected_hex.lower()


def verify_password_hash(password, stored_hash):
    parsed = parse_password_hash(stored_hash)
    if not parsed:
        return False

    salt, expected_hex = parsed
    actual_hex = hashlib.scrypt(
        str(password).encode("utf-8"),
        salt=salt.encode("utf-8"),
        n=16384,
        r=8,
        p=1,
        dklen=64,
    ).hex()
    return hmac.compare_digest(actual_hex, expected_hex)


def verify_password(password, user):
    stored_hash = str(user.get("passwordHash") or "")
    if verify_password_hash(password, stored_hash):
        return {"matches": True, "upgraded": False}

    legacy_password = user.get("password") if isinstance(user.get("password"), str) else ""
    if legacy_password and password == legacy_password:
        return {
            "matches": True,
            "upgraded": True,
            "passwordHash": hash_password(password),
        }

    if stored_hash and not parse_password_hash(stored_hash) and password == stored_hash:
        return {
            "matches": True,
            "upgraded": True,
            "passwordHash": hash_password(password),
        }

    return {"matches": False, "upgraded": False}


def create_opaque_token():
    return secrets.token_hex(32)


def is_admin_email(email):
    normalized = normalize_email(email)
    return bool(normalized and normalized in settings.ADMIN_EMAILS)


def sanitize_user(user):
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "isAdmin": is_admin_email(user["email"]),
        "emailVerified": bool(user.get("emailVerified")),
        "createdAt": user["createdAt"],
        "updatedAt": user["updatedAt"],
    }


def prune_expired_sessions(db):
    current = now_ms()
    db["sessions"] = [session for session in db.get("sessions", []) if int(session.get("expiresAt") or 0) > current]


def find_user_by_email(db, email):
    normalized = normalize_email(email)
    return next((user for user in db.get("users", []) if user.get("email") == normalized), None)


def build_preview_delivery(kind, token, email):
    params = {"token": token}
    if email:
        params["email"] = email
    hash_path = "/#/verify-email" if kind == "verify" else "/#/reset-password"
    url = f"{settings.APP_BASE_URL.rstrip('/')}{hash_path}?{urlencode(params)}"
    return {
        "previewOnly": True,
        "previewUrl": url,
        "error": "Email delivery is disabled in the Django copy, so use this preview link.",
    }


def register_user(name, email, password):
    normalized_email = normalize_email(email)
    trimmed_name = str(name or "").strip()
    password_hash = hash_password(password)
    verification_token = create_opaque_token()
    session_token = create_opaque_token()
    created_at = now_iso()

    def mutator(db):
        if find_user_by_email(db, normalized_email):
            raise AppError("An account with that email already exists.", 409)

        prune_expired_sessions(db)
        user = {
            "id": str(uuid4()),
            "name": trimmed_name,
            "email": normalized_email,
            "passwordHash": password_hash,
            "emailVerified": False,
            "createdAt": created_at,
            "updatedAt": created_at,
            "verificationTokenHash": hash_token(verification_token),
            "verificationExpiresAt": now_ms() + EMAIL_TOKEN_TTL_MS,
            "resetTokenHash": None,
            "resetExpiresAt": None,
        }
        db["users"].append(user)
        db["sessions"].append(
            {
                "id": str(uuid4()),
                "userId": user["id"],
                "tokenHash": hash_token(session_token),
                "createdAt": created_at,
                "lastUsedAt": created_at,
                "expiresAt": now_ms() + SESSION_TTL_MS,
            }
        )
        return {
            "token": session_token,
            "user": sanitize_user(user),
            "verificationToken": verification_token,
        }

    return update_db(mutator)


def login_user(email, password):
    normalized_email = normalize_email(email)
    session_token = create_opaque_token()
    created_at = now_iso()

    def mutator(db):
        prune_expired_sessions(db)
        user = find_user_by_email(db, normalized_email)
        if not user:
            raise AppError("No account found for that email. Create an account first.", 404)

        verification = verify_password(password, user)
        if not verification["matches"]:
            raise AppError("Incorrect password.", 401)

        if verification.get("upgraded") and verification.get("passwordHash"):
            user["passwordHash"] = verification["passwordHash"]
            user.pop("password", None)
            user["updatedAt"] = now_iso()

        if not user.get("emailVerified"):
            raise AppError("Please verify your email before signing in.", 403)

        db["sessions"].append(
            {
                "id": str(uuid4()),
                "userId": user["id"],
                "tokenHash": hash_token(session_token),
                "createdAt": created_at,
                "lastUsedAt": created_at,
                "expiresAt": now_ms() + SESSION_TTL_MS,
            }
        )
        return {
            "token": session_token,
            "user": sanitize_user(user),
        }

    return update_db(mutator)


def authenticate_session(token):
    if not token:
        return None

    token_hash = hash_token(token)

    def mutator(db):
        prune_expired_sessions(db)
        session = next((item for item in db.get("sessions", []) if item.get("tokenHash") == token_hash), None)
        if not session:
            return None

        user = next((item for item in db.get("users", []) if item.get("id") == session.get("userId")), None)
        if not user:
            db["sessions"] = [item for item in db.get("sessions", []) if item.get("id") != session.get("id")]
            return None

        session["lastUsedAt"] = now_iso()
        session["expiresAt"] = now_ms() + SESSION_TTL_MS
        return {
            "user": sanitize_user(user),
            "sessionId": session["id"],
        }

    return update_db(mutator)


def revoke_session(token):
    if not token:
        return

    token_hash = hash_token(token)

    def mutator(db):
        db["sessions"] = [session for session in db.get("sessions", []) if session.get("tokenHash") != token_hash]

    update_db(mutator)


def create_verification_token(email):
    normalized_email = normalize_email(email)
    verification_token = create_opaque_token()

    def mutator(db):
        user = find_user_by_email(db, normalized_email)
        if not user:
            return None

        user["verificationTokenHash"] = hash_token(verification_token)
        user["verificationExpiresAt"] = now_ms() + EMAIL_TOKEN_TTL_MS
        user["updatedAt"] = now_iso()
        return {
            "user": sanitize_user(user),
            "verificationToken": verification_token,
        }

    return update_db(mutator)


def verify_email_token(token, email=""):
    token_hash = hash_token(token)
    normalized_email = normalize_email(email)

    def mutator(db):
        valid_user = next(
            (
                user
                for user in db.get("users", [])
                if user.get("verificationTokenHash") == token_hash and int(user.get("verificationExpiresAt") or 0) > now_ms()
            ),
            None,
        )
        if valid_user:
            valid_user["emailVerified"] = True
            valid_user["verificationTokenHash"] = None
            valid_user["verificationExpiresAt"] = None
            valid_user["updatedAt"] = now_iso()
            result = sanitize_user(valid_user)
            result["alreadyVerified"] = False
            return result

        if normalized_email:
            existing_user = find_user_by_email(db, normalized_email)
            if existing_user and existing_user.get("emailVerified"):
                result = sanitize_user(existing_user)
                result["alreadyVerified"] = True
                return result

        raise AppError("That verification link is invalid or has expired.", 400)

    return update_db(mutator)


def create_password_reset_token(email):
    normalized_email = normalize_email(email)
    reset_token = create_opaque_token()

    def mutator(db):
        user = find_user_by_email(db, normalized_email)
        if not user:
            return None

        user["resetTokenHash"] = hash_token(reset_token)
        user["resetExpiresAt"] = now_ms() + RESET_TOKEN_TTL_MS
        user["updatedAt"] = now_iso()
        return {
            "user": sanitize_user(user),
            "resetToken": reset_token,
        }

    return update_db(mutator)


def reset_password(token, password):
    token_hash = hash_token(token)
    new_password_hash = hash_password(password)

    def mutator(db):
        user = next(
            (
                item
                for item in db.get("users", [])
                if item.get("resetTokenHash") == token_hash and int(item.get("resetExpiresAt") or 0) > now_ms()
            ),
            None,
        )
        if not user:
            raise AppError("That reset link is invalid or has expired.", 400)

        user["passwordHash"] = new_password_hash
        user["resetTokenHash"] = None
        user["resetExpiresAt"] = None
        user["updatedAt"] = now_iso()
        db["sessions"] = [session for session in db.get("sessions", []) if session.get("userId") != user.get("id")]

    update_db(mutator)


def extract_bearer_token(header):
    match = re.match(r"^Bearer\s+(.+)$", str(header or ""), re.I)
    return match.group(1).strip() if match else ""


def authenticate_request(request, allow_unverified=False):
    token = extract_bearer_token(request.headers.get("Authorization"))
    auth = authenticate_session(token)
    if not auth:
        raise AppError("Authentication required.", 401)

    if not allow_unverified and not auth["user"].get("emailVerified"):
        raise AppError("Please verify your email before continuing.", 403)

    request.auth_token = token
    request.user_payload = auth["user"]
    request.session_id = auth["sessionId"]
    return auth


def require_admin(request):
    auth = authenticate_request(request)
    if not auth["user"].get("isAdmin"):
        raise AppError("Admin access required.", 403)
    return auth
