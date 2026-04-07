import re


DEFAULT_WORKSPACE_MODE = "general"

WORKSPACE_MODES = {
    "general": {
        "label": "Auto Detect",
        "forceDeep": False,
        "instructions": "Infer the best coding workflow from the user's prompt and attachments before answering.",
    },
    "coding": {
        "label": "Coding",
        "forceDeep": True,
        "instructions": "Treat the request like a serious coding task. Prefer concrete implementation detail over generic advice.",
    },
    "bug-fix": {
        "label": "Bug Fix",
        "forceDeep": True,
        "instructions": "Prioritize root cause analysis, likely failure points, minimal safe fixes, and how to verify the fix.",
    },
    "code-review": {
        "label": "Code Review",
        "forceDeep": True,
        "instructions": "Review for bugs, regressions, risky patterns, missing tests, and maintainability problems. Findings first.",
    },
    "refactor": {
        "label": "Refactor",
        "forceDeep": True,
        "instructions": "Focus on safer structure, reducing duplication, and preserving behavior while improving readability.",
    },
    "tests": {
        "label": "Tests",
        "forceDeep": True,
        "instructions": "Focus on test strategy, edge cases, failure paths, and concrete unit or integration test coverage.",
    },
    "explain-code": {
        "label": "Explain Code",
        "forceDeep": True,
        "instructions": "Explain code step by step, including flow, inputs, outputs, side effects, and important tradeoffs.",
    },
    "error-log": {
        "label": "Error Log",
        "forceDeep": True,
        "instructions": "Analyze stack traces and logs, identify the probable root cause, and suggest the fastest verification path.",
    },
    "api-contract": {
        "label": "API Contract",
        "forceDeep": True,
        "instructions": "Focus on endpoints, request and response shape, auth boundaries, validation, and error handling.",
    },
    "a11y": {
        "label": "A11y",
        "forceDeep": True,
        "instructions": "Focus on accessibility: semantics, landmarks, labels, focus handling, contrast, and keyboard navigation.",
    },
    "performance": {
        "label": "Performance",
        "forceDeep": True,
        "instructions": "Focus on rendering cost, bundle size, network waste, repeated work, and practical performance wins.",
    },
    "security": {
        "label": "Security",
        "forceDeep": True,
        "instructions": "Focus on auth, validation, secrets, trust boundaries, injection risk, session handling, and abuse protection.",
    },
    "stack-detect": {
        "label": "Stack Detect",
        "forceDeep": True,
        "instructions": "Infer the likely tech stack, architecture, and supporting tools from the attached files or code.",
    },
    "lint": {
        "label": "Lint Hints",
        "forceDeep": True,
        "instructions": "Focus on formatting, consistency, naming, type safety, dead code, and idiomatic patterns.",
    },
}

MODE_PATTERNS = [
    ("code-review", re.compile(r"\b(code review|review this|audit|inspect|find issues?|find bugs?)\b", re.I)),
    ("performance", re.compile(r"\b(performance|slow|latency|optimi[sz]e|bundle size|memory leak)\b", re.I)),
    ("a11y", re.compile(r"\b(accessibility|accessible|a11y|screen reader|contrast|focus state)\b", re.I)),
    ("bug-fix", re.compile(r"\b(bug|fix|broken|issue|error|failing|not working|not loading)\b", re.I)),
    ("tests", re.compile(r"\b(test|tests|coverage|unit test|integration test)\b", re.I)),
    ("refactor", re.compile(r"\b(refactor|cleanup|clean up|restructure|simplify)\b", re.I)),
    ("explain-code", re.compile(r"\b(explain this code|walk me through|how this works|break this down)\b", re.I)),
    ("error-log", re.compile(r"\b(stack trace|traceback|error log|logs|exception)\b", re.I)),
    ("api-contract", re.compile(r"\b(api contract|request body|response body|endpoint|schema|status code)\b", re.I)),
    ("security", re.compile(r"\b(security|vulnerability|xss|csrf|injection|token leak)\b", re.I)),
    ("stack-detect", re.compile(r"\b(tech stack|which framework|what stack)\b", re.I)),
    ("lint", re.compile(r"\b(lint|eslint|prettier|format this|naming issue)\b", re.I)),
    ("coding", re.compile(r"\b(code|coding|implement|build|create|react|node|typescript|javascript|python|java|api)\b", re.I)),
]


def normalize_workspace_mode(value):
    key = str(value or DEFAULT_WORKSPACE_MODE).strip().lower()
    return key if key in WORKSPACE_MODES else DEFAULT_WORKSPACE_MODE


def workspace_mode_config(value):
    return WORKSPACE_MODES[normalize_workspace_mode(value)]


def workspace_mode_label(value):
    return workspace_mode_config(value)["label"]


def workspace_mode_requires_deep(value):
    return bool(workspace_mode_config(value)["forceDeep"])


def workspace_mode_instructions(value):
    return workspace_mode_config(value)["instructions"]


def describe_workspace_modes():
    return [
        {"id": mode_id, "label": config["label"], "forceDeep": config["forceDeep"]}
        for mode_id, config in WORKSPACE_MODES.items()
    ]


def infer_workspace_mode(text="", attachments=None, messages=None):
    normalized_text = str(text or "").strip()
    attachment_names = " ".join(
        str(item.get("name", ""))
        for item in (attachments or [])
        if isinstance(item, dict)
    )
    combined = f"{normalized_text} {attachment_names}".strip()

    for mode_id, pattern in MODE_PATTERNS:
        if pattern.search(combined):
            return mode_id

    if any(
        str(item.get("name", "")).lower().endswith((".py", ".js", ".ts", ".jsx", ".tsx", ".html", ".css", ".json", ".md"))
        for item in (attachments or [])
        if isinstance(item, dict)
    ):
        return "coding"

    return DEFAULT_WORKSPACE_MODE
