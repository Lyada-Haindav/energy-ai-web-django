import json
import resource
import sys
import time
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, HttpResponse, JsonResponse, StreamingHttpResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt

from .auth import (
    authenticate_request,
    create_password_reset_token,
    create_verification_token,
    login_user,
    register_user,
    require_admin,
    reset_password,
    revoke_session,
    validate_email,
    validate_password,
    verify_email_token,
)
from .chat_engine import build_chat_result, describe_model_stack, describe_rate_limits
from .email_service import send_password_reset_email, send_verification_email
from .evaluation import get_evaluation_dashboard, list_recent_evaluation_runs, run_evaluation_suite
from .errors import AppError
from .storage import clone_sessions, describe_storage_backend, list_training_records, read_db, update_db
from .training import (
    get_auto_train_status,
    record_feedback_training_pair,
    record_user_training_pair,
    trigger_manual_auto_train,
)
from .workspace import describe_workspace_modes


PROCESS_STARTED_AT = time.time()


def read_json_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except Exception as exc:
        raise AppError("Invalid JSON body.", 400) from exc


def handle_api_error(error):
    status_code = getattr(error, "status_code", 500)
    message = str(error) if isinstance(error, Exception) else "Unexpected server error."
    return JsonResponse({"error": message}, status=status_code)


def api_view(view_func):
    @csrf_exempt
    def wrapped(request, *args, **kwargs):
        try:
            return view_func(request, *args, **kwargs)
        except AppError as error:
            return handle_api_error(error)
        except Exception as error:
            return handle_api_error(AppError(str(error) or "Unexpected server error.", 500))

    return wrapped


def json_field(body, key):
    return str(body.get(key) or "").strip()


def memory_payload():
    max_rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    rss_mb = round(max_rss / 1024 / 1024, 2) if max_rss > 1024 * 1024 else round(max_rss / 1024, 2)
    return {
        "rss": rss_mb,
        "heapUsed": rss_mb,
        "heapTotal": rss_mb,
    }


def summarize_chat_stats(db):
    chat_sessions = []
    for sessions in db.get("chats", {}).values():
        if isinstance(sessions, list):
            chat_sessions.extend(sessions)

    message_count = sum(len(session.get("messages") or []) for session in chat_sessions)
    now_ms = int(time.time() * 1000)
    active_chats_24h = sum(1 for session in chat_sessions if now_ms - int(session.get("updatedAt") or 0) < 24 * 60 * 60 * 1000)

    return {
        "users": len(db.get("users", [])),
        "verifiedUsers": sum(1 for user in db.get("users", []) if user.get("emailVerified")),
        "authSessions": len(db.get("sessions", [])),
        "chatSessions": len(chat_sessions),
        "messages": message_count,
        "activeChats24h": active_chats_24h,
        "avgMessagesPerChat": round(message_count / len(chat_sessions), 1) if chat_sessions else 0,
    }


def summarize_quality():
    approved_rows = list_training_records("approved")
    rejected_rows = list_training_records("rejected")
    candidate_rows = list_training_records("candidate")

    approved_feedback = sum(1 for row in approved_rows if row.get("source") == "user_feedback_upvote")
    corrected_feedback = sum(1 for row in approved_rows if row.get("source") == "user_feedback_correction")
    rejected_feedback = len(rejected_rows)
    total_reviewed = approved_feedback + corrected_feedback + rejected_feedback
    approval_rate = round(((approved_feedback + corrected_feedback) / total_reviewed) * 100, 1) if total_reviewed else 0

    route_counts = {}
    prompt_failures = {}
    energy_counts = {"low": {"approved": 0, "rejected": 0}, "high": {"approved": 0, "rejected": 0}}

    for row in approved_rows:
        energy_mode = str(row.get("energy_mode") or "").lower()
        if energy_mode in energy_counts:
            energy_counts[energy_mode]["approved"] += 1

    for row in rejected_rows:
        route = str(row.get("route_reason") or "unknown route")
        prompt = str(row.get("prompt") or "").strip()
        energy_mode = str(row.get("energy_mode") or "").lower()
        route_counts[route] = route_counts.get(route, 0) + 1
        if prompt:
            prompt_failures[prompt] = prompt_failures.get(prompt, 0) + 1
        if energy_mode in energy_counts:
            energy_counts[energy_mode]["rejected"] += 1

    def top_entries(mapping, limit=5):
        return [
            {"label": label, "count": count}
            for label, count in sorted(mapping.items(), key=lambda item: item[1], reverse=True)[:limit]
        ]

    return {
        "approvedFeedback": approved_feedback,
        "correctedFeedback": corrected_feedback,
        "rejectedFeedback": rejected_feedback,
        "candidateRows": len(candidate_rows),
        "approvalRate": approval_rate,
        "worstPrompts": top_entries(prompt_failures),
        "routeHotspots": top_entries(route_counts),
        "energyScorecard": [
            {
                "mode": mode,
                "approved": counts["approved"],
                "rejected": counts["rejected"],
                "accuracy": round((counts["approved"] / (counts["approved"] + counts["rejected"])) * 100, 1)
                if counts["approved"] + counts["rejected"]
                else 0,
            }
            for mode, counts in energy_counts.items()
        ],
    }


def summarize_user_analytics(sessions):
    assistant_messages = []
    for session in sessions:
        for message in session.get("messages") or []:
            if message.get("role") == "assistant":
                assistant_messages.append(message)

    model_counts = {}
    route_counts = {}
    source_backed = 0
    low_energy = 0
    high_energy = 0
    latencies = []
    for message in assistant_messages:
        meta = message.get("meta") if isinstance(message.get("meta"), dict) else {}
        model = str(meta.get("model") or "unknown")
        route = str(meta.get("routeReason") or "unknown")
        model_counts[model] = model_counts.get(model, 0) + 1
        route_counts[route] = route_counts.get(route, 0) + 1
        if isinstance(meta.get("sources"), list) and meta.get("sources"):
            source_backed += 1
        energy_mode = str(meta.get("energyMode") or "").lower()
        if energy_mode == "low":
            low_energy += 1
        elif energy_mode == "high":
            high_energy += 1
        latency = int(meta.get("latencyMs") or 0)
        if latency > 0:
            latencies.append(latency)

    def top_entries(mapping, limit=4):
        return [
            {"label": label, "count": count}
            for label, count in sorted(mapping.items(), key=lambda item: item[1], reverse=True)[:limit]
        ]

    return {
        "chatSessions": len(sessions),
        "assistantResponses": len(assistant_messages),
        "sourceBackedResponses": source_backed,
        "lowEnergyResponses": low_energy,
        "highEnergyResponses": high_energy,
        "averageLatencyMs": round(sum(latencies) / len(latencies), 1) if latencies else 0,
        "topModels": top_entries(model_counts),
        "topRoutes": top_entries(route_counts),
    }


@api_view
def health_view(_request):
    return JsonResponse(
        {
            "ok": True,
            "service": "energy-ai-django",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "uptimeSeconds": round(time.time() - PROCESS_STARTED_AT),
            "memoryMb": memory_payload(),
            "storage": describe_storage_backend(),
            "models": describe_model_stack(),
            "rateLimits": describe_rate_limits(),
        }
    )


@api_view
def register_view(request):
    body = read_json_body(request)
    name = json_field(body, "name")
    email = json_field(body, "email")
    password = str(body.get("password") or "")
    if len(name) < 2:
        raise AppError("Name must be at least 2 characters.", 400)
    if not validate_email(email):
        raise AppError("Enter a valid email address.", 400)
    if not validate_password(password):
        raise AppError("Password must be at least 8 characters.", 400)

    result = register_user(name, email, password)
    email_delivery = send_verification_email(
        user=result["user"],
        token=result["verificationToken"],
        request=request,
    )
    return JsonResponse(
        {
            "token": result["token"],
            "user": result["user"],
            "emailDelivery": email_delivery,
        },
        status=201,
    )


@api_view
def login_view(request):
    body = read_json_body(request)
    email = json_field(body, "email")
    password = str(body.get("password") or "")
    if not validate_email(email) or not password:
        raise AppError("Email and password are required.", 400)
    return JsonResponse(login_user(email, password))


@api_view
def me_view(request):
    auth = authenticate_request(request)
    return JsonResponse({"user": auth["user"]})


@api_view
def logout_view(request):
    authenticate_request(request, allow_unverified=True)
    revoke_session(getattr(request, "auth_token", ""))
    return JsonResponse({"ok": True})


@api_view
def verify_email_view(request):
    body = read_json_body(request)
    token = json_field(body, "token")
    email = json_field(body, "email")
    if not token:
        raise AppError("Verification token is required.", 400)

    result = verify_email_token(token, email)
    return JsonResponse(
        {
            "ok": True,
            "user": {
                "id": result["id"],
                "name": result["name"],
                "email": result["email"],
                "emailVerified": result["emailVerified"],
                "createdAt": result["createdAt"],
                "updatedAt": result["updatedAt"],
            },
            "alreadyVerified": bool(result.get("alreadyVerified")),
        }
    )


@api_view
def resend_verification_view(request):
    body = read_json_body(request)
    email = json_field(body, "email")
    if not validate_email(email):
        raise AppError("Enter a valid email address.", 400)

    result = create_verification_token(email)
    if not result:
        raise AppError("No account found for that email. Create an account first.", 404)

    email_delivery = send_verification_email(
        user=result["user"],
        token=result["verificationToken"],
        request=request,
    )
    return JsonResponse(
        {
            "ok": True,
            "message": "Verification email sent.",
            "emailDelivery": email_delivery,
        }
    )


@api_view
def forgot_password_view(request):
    body = read_json_body(request)
    email = json_field(body, "email")
    if not validate_email(email):
        raise AppError("Enter a valid email address.", 400)

    result = create_password_reset_token(email)
    if not result:
        raise AppError("No account found for that email. Create an account first.", 404)

    email_delivery = send_password_reset_email(
        user=result["user"],
        token=result["resetToken"],
        request=request,
    )
    return JsonResponse(
        {
            "ok": True,
            "message": "Password reset email sent.",
            "emailDelivery": email_delivery,
        }
    )


@api_view
def reset_password_view(request):
    body = read_json_body(request)
    token = json_field(body, "token")
    password = str(body.get("password") or "")
    if not token:
        raise AppError("Reset token is required.", 400)
    if not validate_password(password):
        raise AppError("Password must be at least 8 characters.", 400)

    reset_password(token, password)
    return JsonResponse({"ok": True, "message": "Password updated. Sign in with your new password."})


def sanitize_message(message):
    meta = message.get("meta") if isinstance(message.get("meta"), dict) else None
    if meta and not meta.get("attachments"):
        meta = {key: value for key, value in meta.items() if key != "attachments"}
    return {
        "id": str(message.get("id") or ""),
        "role": str(message.get("role") or "assistant"),
        "content": str(message.get("content") or ""),
        "meta": meta,
    }


def sanitize_session(session):
    messages = session.get("messages") if isinstance(session.get("messages"), list) else []
    return {
        "id": str(session.get("id") or ""),
        "title": str(session.get("title") or "Untitled Session"),
        "createdAt": int(session.get("createdAt") or int(time.time() * 1000)),
        "updatedAt": int(session.get("updatedAt") or int(time.time() * 1000)),
        "messages": [sanitize_message(message) for message in messages],
    }


@api_view
def chats_view(request):
    auth = authenticate_request(request)
    if request.method == "GET":
        db = read_db()
        sessions = clone_sessions(db.get("chats", {}).get(auth["user"]["id"], []))
        return JsonResponse({"sessions": sessions})

    if request.method != "PUT":
        raise AppError("Method not allowed.", 405)

    body = read_json_body(request)
    incoming = body.get("sessions")
    if not isinstance(incoming, list):
        raise AppError("`sessions` must be an array.", 400)
    sessions = [sanitize_session(session) for session in incoming if str(session.get("id") or "").strip()]

    def mutator(db):
        db.setdefault("chats", {})[auth["user"]["id"]] = sessions

    update_db(mutator)
    return JsonResponse({"ok": True, "sessions": sessions})


@api_view
def chat_feedback_view(request):
    authenticate_request(request)
    body = read_json_body(request)
    prompt = json_field(body, "prompt")
    completion = json_field(body, "completion")
    replacement = json_field(body, "replacement")
    feedback = json_field(body, "feedback").lower()
    meta = body.get("meta") if isinstance(body.get("meta"), dict) else {}
    if not prompt or not completion:
        raise AppError("`prompt` and `completion` are required.", 400)
    if feedback not in {"up", "down"}:
        raise AppError("`feedback` must be either `up` or `down`.", 400)
    result = record_feedback_training_pair(prompt, completion, feedback, replacement, meta)
    return JsonResponse(
        {
            "ok": True,
            "recorded": result["recorded"],
            "trained": result["trained"],
            "autoTrain": result.get("autoTrain") or {},
        }
    )


@api_view
def chat_view(request):
    authenticate_request(request)
    body = read_json_body(request)
    messages = body.get("messages")
    mode = json_field(body, "mode") or "auto"
    workspace_mode = json_field(body, "workspaceMode") or "general"
    if not isinstance(messages, list) or not messages:
        raise AppError("`messages` must be a non-empty array.", 400)

    result = build_chat_result(messages, mode=mode, workspace_mode=workspace_mode)
    try:
        record_user_training_pair(result["trainingPrompt"], result["text"])
    except Exception:
        pass

    def stream():
        for event in result["events"]:
            yield json.dumps(event) + "\n"

    response = StreamingHttpResponse(stream(), content_type="application/x-ndjson; charset=utf-8")
    response["Cache-Control"] = "no-cache, no-transform"
    return response


@api_view
def admin_overview_view(request):
    require_admin(request)
    db = read_db()
    return JsonResponse(
        {
            "ok": True,
            "stats": summarize_chat_stats(db),
            "training": get_auto_train_status(),
            "quality": summarize_quality(),
            "evaluations": {
                "latest": get_evaluation_dashboard(),
                "recentRuns": list_recent_evaluation_runs(limit=5),
            },
            "health": {
                "uptimeSeconds": round(time.time() - PROCESS_STARTED_AT),
                "memoryMb": memory_payload(),
                "storage": describe_storage_backend(),
                "models": describe_model_stack(),
                "rateLimits": describe_rate_limits(),
                "nodeVersion": f"Python {sys.version.split()[0]}",
            },
            "controls": {"workspaceModes": describe_workspace_modes()},
        }
    )


@api_view
def admin_retrain_view(request):
    require_admin(request)
    result = trigger_manual_auto_train()
    return JsonResponse({"ok": True, **result})


@api_view
def admin_run_evaluations_view(request):
    require_admin(request)
    result = run_evaluation_suite(trigger="admin")
    return JsonResponse({"ok": True, "evaluation": result})


@api_view
def analytics_overview_view(request):
    auth = authenticate_request(request)
    db = read_db()
    sessions = clone_sessions(db.get("chats", {}).get(auth["user"]["id"], []))
    return JsonResponse(
        {
            "ok": True,
            "stats": summarize_user_analytics(sessions),
            "quality": summarize_quality(),
            "evaluations": get_evaluation_dashboard(),
            "health": {
                "models": describe_model_stack(),
                "storage": describe_storage_backend(),
                "rateLimits": describe_rate_limits(),
            },
        }
    )


def spa_view(request):
    client_dist = settings.PROJECT_ROOT / "client" / "dist"
    requested = request.path.lstrip("/")
    if requested and requested != "index.html":
        candidate = (client_dist / requested).resolve()
        if candidate.exists() and candidate.is_file() and str(candidate).startswith(str(client_dist.resolve())):
            return FileResponse(candidate.open("rb"))

    return render(
        request,
        "api/app.html",
        {
            "initial_path": request.path,
        },
    )
