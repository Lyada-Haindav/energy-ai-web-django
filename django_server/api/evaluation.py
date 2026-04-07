import time
from collections import defaultdict

from .chat_engine import build_chat_result
from .storage import latest_evaluation_run, list_evaluation_runs, store_evaluation_run


EVALUATION_SUITE_VERSION = "2026-04-07-full-stack-v1"
EVALUATION_CASES = [
    {
        "id": "web-ai-definition",
        "title": "Web-grounded definition",
        "category": "web",
        "prompt": "what is artificial intelligence",
        "expectedRole": "fast",
        "expectsSources": True,
        "keywords": ["intelligence", "learning", "reasoning"],
        "minChars": 120,
    },
    {
        "id": "web-builder-recommendation",
        "title": "Builder recommendation",
        "category": "web",
        "prompt": "best ai builders for a full stack web app",
        "expectedRole": "fast",
        "expectsSources": True,
        "keywords": ["builder", "app", "pricing", "source"],
        "minChars": 180,
    },
    {
        "id": "backend-auth-compare",
        "title": "Auth architecture compare",
        "category": "backend",
        "prompt": "compare session authentication and jwt cookies for a web app",
        "expectedRole": "deep",
        "keywords": ["session", "jwt", "cookie", "csrf", "auth"],
        "minChars": 220,
    },
    {
        "id": "backend-observability",
        "title": "Backend observability",
        "category": "backend",
        "prompt": "how should i structure rate limiting and logging for a production backend",
        "expectedRole": "deep",
        "keywords": ["rate", "logging", "redis", "request", "latency"],
        "minChars": 220,
    },
    {
        "id": "coding-django-login-api",
        "title": "Django auth API",
        "category": "coding",
        "prompt": "create django login api with token auth",
        "expectedRole": "deep",
        "expectsCode": True,
        "keywords": ["django", "token", "authenticate", "api"],
        "minChars": 260,
    },
    {
        "id": "coding-fibonacci-csharp",
        "title": "Polyglot C# code",
        "category": "coding",
        "prompt": "write fibonacci in c# with full code",
        "expectedRole": "deep",
        "expectsCode": True,
        "keywords": ["c#", "fibonacci", "return", "main"],
        "minChars": 180,
    },
]


def _now_ms():
    return int(time.time() * 1000)


def _safe_text(value):
    return str(value or "").strip()


def _keyword_score(text, keywords):
    lowered = _safe_text(text).lower()
    items = [keyword.lower() for keyword in (keywords or []) if keyword]
    if not items:
        return 1.0, []
    hits = [keyword for keyword in items if keyword in lowered]
    return len(hits) / max(len(items), 1), hits


def _has_code_block(text):
    lowered = _safe_text(text)
    if "```" in lowered:
        return True
    return any(token in lowered for token in ("def ", "function ", "public class", "fn ", "func ", "class ", "return "))


def _length_score(text, min_chars):
    required = max(int(min_chars or 0), 1)
    actual = len(_safe_text(text))
    if actual >= required:
        return 1.0
    return round(actual / required, 3)


def _category_summary(cases):
    grouped = defaultdict(list)
    for case in cases:
        grouped[case["category"]].append(case)
    summary = []
    for category, rows in sorted(grouped.items()):
        passed = sum(1 for row in rows if row["passed"])
        avg_score = sum(row["score"] for row in rows) / max(len(rows), 1)
        avg_latency = sum(row["latencyMs"] for row in rows) / max(len(rows), 1)
        summary.append(
            {
                "category": category,
                "passed": passed,
                "total": len(rows),
                "passRate": round((passed / len(rows)) * 100, 1) if rows else 0,
                "averageScore": round(avg_score * 100, 1),
                "averageLatencyMs": round(avg_latency, 1),
            }
        )
    return summary


def evaluate_case(case):
    started_at = _now_ms()
    perf_start = time.perf_counter()
    result = build_chat_result([{"role": "user", "content": case["prompt"]}], mode="auto", workspace_mode="general")
    final = next((event for event in reversed(result["events"]) if event.get("type") == "final"), {})
    text = _safe_text(result.get("text"))
    sources = final.get("sources") if isinstance(final.get("sources"), list) else []
    keyword_score, keyword_hits = _keyword_score(text, case.get("keywords"))
    route_score = 1.0 if str(final.get("role") or "") == str(case.get("expectedRole") or "") else 0.0
    code_score = 1.0 if (not case.get("expectsCode")) or _has_code_block(text) else 0.0
    source_score = 1.0 if (not case.get("expectsSources")) or bool(sources) else 0.0
    length_score = _length_score(text, case.get("minChars"))
    overall = (route_score * 0.2) + (keyword_score * 0.35) + (code_score * 0.2) + (source_score * 0.15) + (length_score * 0.1)
    latency_ms = int((time.perf_counter() - perf_start) * 1000)
    completed_at = _now_ms()
    return {
        "id": case["id"],
        "title": case["title"],
        "category": case["category"],
        "prompt": case["prompt"],
        "role": str(final.get("role") or ""),
        "model": str(final.get("model") or ""),
        "routeReason": str(final.get("routeReason") or ""),
        "latencyMs": latency_ms,
        "startedAt": started_at,
        "completedAt": completed_at,
        "sources": len(sources),
        "keywordHits": keyword_hits,
        "score": round(overall, 3),
        "passed": overall >= 0.68,
        "preview": text[:420],
    }


def summarize_evaluation(cases):
    total = len(cases)
    passed = sum(1 for case in cases if case["passed"])
    average_score = sum(case["score"] for case in cases) / max(total, 1)
    average_latency = sum(case["latencyMs"] for case in cases) / max(total, 1)
    weakest_cases = sorted(cases, key=lambda case: case["score"])[:3]
    return {
        "suiteVersion": EVALUATION_SUITE_VERSION,
        "passed": passed,
        "total": total,
        "passRate": round((passed / total) * 100, 1) if total else 0,
        "averageScore": round(average_score * 100, 1),
        "averageLatencyMs": round(average_latency, 1),
        "categories": _category_summary(cases),
        "weakestCases": [
            {
                "id": case["id"],
                "title": case["title"],
                "score": round(case["score"] * 100, 1),
                "preview": case["preview"],
            }
            for case in weakest_cases
        ],
    }


def run_evaluation_suite(trigger="manual"):
    started_at = _now_ms()
    cases = [evaluate_case(case) for case in EVALUATION_CASES]
    completed_at = _now_ms()
    summary = summarize_evaluation(cases)
    payload = {
        "id": f"eval-{completed_at}",
        "trigger": trigger,
        "startedAt": started_at,
        "completedAt": completed_at,
        "summary": summary,
        "cases": cases,
    }
    store_evaluation_run(payload)
    return payload


def get_evaluation_dashboard():
    latest = latest_evaluation_run()
    if latest:
        return latest
    return {
        "id": "",
        "trigger": "",
        "startedAt": 0,
        "completedAt": 0,
        "summary": {
            "suiteVersion": EVALUATION_SUITE_VERSION,
            "passed": 0,
            "total": len(EVALUATION_CASES),
            "passRate": 0,
            "averageScore": 0,
            "averageLatencyMs": 0,
            "categories": [],
            "weakestCases": [],
        },
        "cases": [],
    }


def list_recent_evaluation_runs(limit=5):
    return list_evaluation_runs(limit=limit)
