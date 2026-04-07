import gzip
import json
import re
import time
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from django.conf import settings

from .coding_templates import coding_response_for_messages
from .knowledge import (
    build_knowledge_query,
    fetch_knowledge_context,
    infer_search_profile,
    is_explicit_search_request,
    render_knowledge_response,
    should_fetch_knowledge,
)
from .workspace import (
    infer_workspace_mode,
    normalize_workspace_mode,
    workspace_mode_label,
    workspace_mode_requires_deep,
)


_OWN_ARTIFACT_CACHE = {}

STOPWORDS = {
    "a",
    "an",
    "the",
    "is",
    "are",
    "to",
    "for",
    "of",
    "and",
    "or",
    "in",
    "on",
    "with",
    "how",
    "what",
    "why",
    "when",
    "where",
    "which",
    "me",
    "my",
    "your",
    "you",
    "it",
    "this",
    "that",
}

CASUAL_PATTERN = re.compile(
    r"^(hi|hello|hey|yo|hi there|hello there|good morning|good evening|good afternoon|how are you|how are u|thanks|thank you|ok|okay|cool|nice|good|bye|goodbye|see you|see ya|later)\b",
    re.I,
)
IDENTITY_PATTERN = re.compile(r"^(what(?:'s| is)\s+your\s+name|who\s+are\s+you|what\s+model\s+are\s+you)\??$", re.I)
DATE_TIME_PATTERN = re.compile(
    r"^(?:(?:can\s+i\s+know|tell\s+me|do\s+you\s+know|can\s+you\s+tell\s+me|could\s+you\s+tell\s+me|please\s+tell\s+me)\s+)?(?:(?:what(?:'s| is)?|which)\s+)?(?:the\s+)?(?:(?:today'?s?|current|now|right\s+now)\s+)?(date|time|day)(?:\s+(?:today|now|right\s+now|it\s+is|is\s+it))?\??$",
    re.I,
)
YEAR_PATTERN = re.compile(
    r"^(?:(?:can\s+i\s+know|tell\s+me|do\s+you\s+know|can\s+you\s+tell\s+me|could\s+you\s+tell\s+me|please\s+tell\s+me)\s+)?(?:(?:what(?:'s| is)?|which)\s+)?(?:the\s+)?(?:(?:current|this|now|right\s+now)\s+)?year(?:\s+(?:now|it\s+is|is\s+it))?\??$|^(?:which|what)\s+year\s+is\s+(?:this|it)\??$",
    re.I,
)
DEFINITION_PATTERN = re.compile(
    r"^(?:(?:can\s+i\s+know|do\s+you\s+know|tell\s+me|can\s+you\s+tell\s+me|could\s+you\s+tell\s+me|please\s+tell\s+me)\s+)?(?:(?:what|who)\s+(?:is|are)\s+|define\s+|meaning of\s+)(.+?)\??$",
    re.I,
)
STANDALONE_DEFINITION_PATTERN = re.compile(
    r"^(ai|llm|rag|ml|dl|nlp|cv|iot|api|ui|ux|cpu|gpu|ram|rom|dns|tcp|udp|sql|jwt|dbms|os|oops?|oop|coa|toc|se|dsa|daa|computer\s+networks?|artificial\s+intelligence)\??$",
    re.I,
)
CODING_PATTERN = re.compile(r"\b(code|coding|debug|bug|fix|refactor|algorithm|api|react|node|javascript|typescript|python|java|sql|django)\b", re.I)
DEEP_PATTERN = re.compile(r"\b(architecture|design|implement|build|create|deploy|project|full[-\s]?stack|detailed|step by step|compare|trade[-\s]?off|production)\b", re.I)
SHORT_CODE_FOLLOWUP_PATTERN = re.compile(r"^(?:code|show code|give(?:\s+me)? code|send code)(?:\s+please)?\s*$", re.I)
ADD_TWO_NUMBERS_PATTERN = re.compile(
    r"\b(?:add(?:ing)?|sum|addition)\b.*\b(?:two|2)\b.*\b(?:numbers?|bumbers?)\b|\b(?:sum|addition)\s+of\s+(?:two|2)\s+numbers?\b|\b(?:two|2)\s+numbers?\b.*\b(?:sum|add(?:ing)?|addition)\b",
    re.I,
)
LOW_QUALITY_PATTERNS = [
    re.compile(r"thequickbrownfox", re.I),
    re.compile(r"\bayy\s+lmao\b", re.I),
    re.compile(r"\bgrumpy cat\b", re.I),
    re.compile(r"\banal douching\b", re.I),
    re.compile(r"\bcartoon character\b", re.I),
]
GENERIC_ASSISTANT_PATTERNS = [
    re.compile(r"^i can help with that\b", re.I),
    re.compile(r"^i can cover many topics\b", re.I),
    re.compile(r"\bask (?:any|your) question\b", re.I),
    re.compile(r"\btell me your next question\b", re.I),
]
LANGUAGE_HINT_PATTERN = re.compile(r"\b(python|javascript|js|typescript|ts|java|c\+\+|cpp|c|go|golang|rust)\b", re.I)

QUERY_ALIASES = {
    "ai": "artificial intelligence",
    "artificial inteligence": "artificial intelligence",
    "artificial intelegence": "artificial intelligence",
    "artifical intelligence": "artificial intelligence",
    "computer networks": "computer network",
    "cn": "computer network",
    "dbms": "database management system",
    "os": "operating system",
    "oops": "object-oriented programming",
    "oop": "object-oriented programming",
    "api": "application programming interface",
    "dsa": "data structures and algorithms",
    "daa": "design and analysis of algorithms",
}

KNOWN_DEFINITIONS = {
    "ai": "AI is software that performs tasks that usually need human-like learning, reasoning, pattern recognition, or language understanding.",
    "artificial intelligence": "Artificial intelligence is the capability of computer systems to perform tasks that normally require human intelligence, such as learning, reasoning, problem-solving, and language understanding.",
    "machine learning": "Machine learning is a method where models learn patterns from data instead of relying only on fixed hand-written rules.",
    "deep learning": "Deep learning is a type of machine learning that uses multi-layer neural networks to model complex patterns.",
    "natural language processing": "Natural language processing is a field of AI focused on helping computers understand, analyze, and generate human language.",
    "computer network": "A computer network is a group of connected computers and devices that communicate and share data, resources, and services over wired or wireless links.",
    "application programming interface": "An API, or application programming interface, is a defined way for software systems to communicate and exchange data.",
    "database management system": "A DBMS is software that stores, organizes, retrieves, and manages data efficiently.",
    "operating system": "An operating system is core system software that manages hardware, memory, files, and processes and provides services to applications.",
    "object-oriented programming": "Object-oriented programming is a programming style based on objects that combine data and behavior through classes and instances.",
    "data structures and algorithms": "Data structures and algorithms is the study of organizing data and solving problems efficiently with correct step-by-step procedures.",
    "design and analysis of algorithms": "Design and Analysis of Algorithms is the study of building correct algorithms and evaluating their time and space complexity.",
}

DOMAIN_KEYWORD_GROUPS = {
    "auth": {"auth", "authentication", "authorization", "jwt", "session", "cookie", "cookies", "csrf", "login", "token"},
    "backend": {"backend", "api", "server", "django", "flask", "fastapi", "express", "spring"},
    "storage": {"mongodb", "mongo", "atlas", "database", "db", "redis", "sql", "postgres", "mysql"},
    "observability": {"logging", "logs", "monitoring", "metrics", "latency", "tracing", "requestid", "rate", "limit"},
    "frontend": {"frontend", "ui", "ux", "browser", "scroll", "render", "lag", "animation"},
    "algorithm": {"algorithm", "array", "string", "graph", "tree", "dp", "dynamic", "binary", "search", "subarray", "substring"},
}
LANGUAGE_PATTERN = re.compile(r"\b(python|javascript|js|typescript|ts|java|c\+\+|cpp|c#|csharp|c|go|golang|rust|kotlin|php|ruby|swift)\b", re.I)


def tokenize_words(text):
    return re.findall(r"[a-z0-9']+", str(text or "").lower())


def filter_tokens(tokens):
    return [token for token in tokens if token not in STOPWORDS]


def extract_phrases(tokens, min_size=2, max_size=3):
    phrases = set()
    filtered = filter_tokens(tokens)
    for size in range(min_size, max_size + 1):
        if len(filtered) < size:
            continue
        for index in range(0, len(filtered) - size + 1):
            phrases.add(" ".join(filtered[index : index + size]))
    return phrases


def normalize_language_hint(text):
    match = LANGUAGE_PATTERN.search(str(text or ""))
    if not match:
        return ""
    language = match.group(1).lower()
    aliases = {
        "js": "javascript",
        "ts": "typescript",
        "cpp": "c++",
        "csharp": "c#",
        "golang": "go",
    }
    return aliases.get(language, language)


def detect_domain_tags(text):
    lowered = compact_text(text).lower()
    tags = set()
    for label, keywords in DOMAIN_KEYWORD_GROUPS.items():
        if any(keyword in lowered for keyword in keywords):
            tags.add(label)
    return tags


def build_query_features(text):
    normalized = compact_text(text).lower()
    tokens = tokenize_words(normalized)
    return {
        "text": normalized,
        "tokens": tokens,
        "filteredTokens": filter_tokens(tokens),
        "phrases": extract_phrases(tokens),
        "language": normalize_language_hint(normalized),
        "domains": detect_domain_tags(normalized),
        "wantsCode": bool(CODING_PATTERN.search(normalized) or re.search(r"\b(code|function|program|script|api)\b", normalized)),
    }


def score_retrieval(query_tokens, candidate_tokens):
    query = filter_tokens(query_tokens)
    candidate = filter_tokens(candidate_tokens)
    if not query or not candidate:
        return 0.0

    query_set = set(query)
    candidate_set = set(candidate)
    overlap = len(query_set & candidate_set)
    if overlap == 0:
        return 0.0
    if len(query_set) >= 3 and overlap < 2:
        return 0.0

    precision = overlap / max(len(candidate_set), 1)
    recall = overlap / max(len(query_set), 1)
    f1 = (2 * precision * recall) / max(precision + recall, 1e-9)
    coverage = overlap / max(min(len(query_set), 8), 1)
    return f1 * 0.8 + coverage * 0.2


def score_match(query_features, pair, role):
    candidate_tokens = pair.get("_promptTokens") or pair.get("prompt_tokens") or tokenize_words(pair.get("prompt", ""))
    base = score_retrieval(query_features["tokens"], candidate_tokens)
    prompt_text = pair.get("_promptText") or compact_text(pair.get("prompt", "")).lower()
    phrase_hits = sum(1 for phrase in query_features["phrases"] if phrase and phrase in prompt_text)
    domain_hits = len(set(pair.get("_domains") or []) & set(query_features["domains"]))
    exact_prompt_hit = 1 if query_features["text"] and query_features["text"] in prompt_text else 0
    language_match = 1 if query_features["language"] and query_features["language"] == pair.get("_language") else 0
    code_match = 1 if query_features["wantsCode"] and pair.get("_hasCode") else 0
    structure_bonus = 1 if role == "deep" and pair.get("_hasStructure") else 0
    return (
        base
        + min(phrase_hits * 0.12, 0.36)
        + min(domain_hits * 0.14, 0.42)
        + (0.26 if exact_prompt_hit else 0)
        + (0.18 if language_match else 0)
        + (0.16 if code_match else 0)
        + (0.06 if structure_bonus else 0)
    )


def completion_sentences(text, limit=4):
    sentences = []
    for sentence in re.split(r"(?<=[.!?])\s+", compact_text(text)):
        cleaned = sentence.strip()
        if not cleaned:
            continue
        sentences.append(cleaned)
        if len(sentences) >= limit:
            break
    return sentences


def _artifact_path(role):
    configured_dir = Path(settings.ENERGY_OWN_MODELS_DIR)
    project_root = Path(getattr(settings, "PROJECT_ROOT", Path(settings.BASE_DIR).parent))
    candidates = [
        configured_dir,
        project_root / "server" / "model-artifacts" / "own",
        project_root / "training" / "checkpoints" / "own",
    ]
    seen = set()
    fallback = None
    for directory in candidates:
        resolved = directory.resolve()
        key = str(resolved)
        if key in seen:
            continue
        seen.add(key)
        plain = resolved / f"{role}.json"
        compressed = resolved / f"{role}.json.gz"
        if fallback is None:
            fallback = (plain, compressed)
        if plain.exists() or compressed.exists():
            return plain, compressed
    return fallback or (configured_dir / f"{role}.json", configured_dir / f"{role}.json.gz")


def load_own_artifact(role):
    cache_key = str(Path(settings.ENERGY_OWN_MODELS_DIR) / role)
    if cache_key in _OWN_ARTIFACT_CACHE:
        return _OWN_ARTIFACT_CACHE[cache_key]

    plain, compressed = _artifact_path(role)
    if plain.exists():
        parsed = json.loads(plain.read_text(encoding="utf-8"))
    elif compressed.exists():
        parsed = json.loads(gzip.decompress(compressed.read_bytes()).decode("utf-8"))
    else:
        parsed = {"name": f"missing-{role}-artifact", "pairs": []}

    if isinstance(parsed.get("pairs"), list):
        retrieval_index = {}
        domain_index = {}
        language_index = {}
        for index, pair in enumerate(parsed["pairs"]):
            prompt_tokens = pair.get("prompt_tokens") if isinstance(pair.get("prompt_tokens"), list) else tokenize_words(pair.get("prompt", ""))
            pair["_promptTokens"] = list(dict.fromkeys(filter_tokens(prompt_tokens)))
            pair["_promptText"] = compact_text(pair.get("prompt", "")).lower()
            pair["_domains"] = sorted(detect_domain_tags(f"{pair.get('prompt', '')} {pair.get('completion', '')}"))
            pair["_language"] = normalize_language_hint(f"{pair.get('prompt', '')} {pair.get('completion', '')}")
            pair["_hasCode"] = bool("```" in str(pair.get("completion") or "") or re.search(r"\b(def|class|return|function|public\s+class|fn\s+|func\s+)\b", str(pair.get("completion") or "")))
            pair["_hasStructure"] = bool("\n- " in str(pair.get("completion") or "") or "\n1." in str(pair.get("completion") or "") or "\n1)" in str(pair.get("completion") or ""))
            for token in pair["_promptTokens"]:
                retrieval_index.setdefault(token, []).append(index)
            for domain in pair["_domains"]:
                domain_index.setdefault(domain, []).append(index)
            if pair["_language"]:
                language_index.setdefault(pair["_language"], []).append(index)
        parsed["__retrievalIndex"] = retrieval_index
        parsed["__domainIndex"] = domain_index
        parsed["__languageIndex"] = language_index

    _OWN_ARTIFACT_CACHE[cache_key] = parsed
    return parsed


def clear_own_artifact_cache():
    _OWN_ARTIFACT_CACHE.clear()


def provider_for(role):
    if role == "fast":
        return settings.FAST_PROVIDER
    if role == "deep":
        return settings.DEEP_PROVIDER
    return settings.ROUTER_PROVIDER


def model_for(role):
    if role == "fast":
        return settings.FAST_MODEL
    if role == "deep":
        return settings.DEEP_MODEL
    return settings.ROUTER_MODEL


def describe_model_stack():
    return {
        "fast": {"provider": provider_for("fast"), "model": model_for("fast")},
        "deep": {"provider": provider_for("deep"), "model": model_for("deep")},
        "router": {"provider": provider_for("router"), "model": model_for("router")},
    }


def describe_rate_limits():
    return {
        "auth": {"windowMs": 60000, "max": 20},
        "chat": {"windowMs": 60000, "max": 24},
    }


def sanitize_attachments(value):
    if not isinstance(value, list):
        return []

    sanitized = []
    for attachment in value[:4]:
        content = str(attachment.get("content") or "").replace("\r\n", "\n")[:12000]
        if not content.strip():
            continue
        sanitized.append(
            {
                "id": str(attachment.get("id") or ""),
                "name": str(attachment.get("name") or "attachment.txt")[:120],
                "mimeType": str(attachment.get("mimeType") or "text/plain")[:80],
                "size": int(attachment.get("size") or len(content)),
                "language": str(attachment.get("language") or "text")[:32],
                "truncated": bool(attachment.get("truncated") or len(content) >= 12000),
                "content": content,
            }
        )
    return sanitized


def extract_message_attachments(message):
    meta = message.get("meta") if isinstance(message.get("meta"), dict) else {}
    return sanitize_attachments(meta.get("attachments"))


def normalize_message(message):
    meta = deepcopy(message.get("meta")) if isinstance(message.get("meta"), dict) else None
    attachments = sanitize_attachments(meta.get("attachments") if meta else None)
    if meta is not None:
        if attachments:
            meta["attachments"] = attachments
        else:
            meta.pop("attachments", None)
    return {
        "id": str(message.get("id") or ""),
        "role": str(message.get("role") or "assistant"),
        "content": str(message.get("content") or ""),
        "meta": meta,
    }


def extract_latest_user_message(messages):
    for message in reversed(messages):
        if message.get("role") == "user":
            return message
    return None


def latest_user_text(messages):
    latest = extract_latest_user_message(messages)
    return str(latest.get("content") or "").strip() if latest else ""


def previous_user_text(messages):
    user_messages = [message for message in (messages or []) if message.get("role") == "user"]
    if len(user_messages) < 2:
        return ""
    return str(user_messages[-2].get("content") or "").strip()


def _response_now():
    timezone_name = str(getattr(settings, "TIME_ZONE", "") or "").strip()
    try:
        return datetime.now(ZoneInfo(timezone_name)) if timezone_name else datetime.now()
    except Exception:
        return datetime.now()


def canonicalize_definition_topic(text):
    normalized = re.sub(r"\s+", " ", str(text or "").strip().strip("?.!,")).strip().lower()
    match = DEFINITION_PATTERN.match(normalized)
    topic = match.group(1).strip() if match else normalized
    topic = QUERY_ALIASES.get(topic, topic)
    if topic.endswith("s") and topic[:-1] in KNOWN_DEFINITIONS:
        topic = topic[:-1]
    return topic


def detect_requested_language(text, previous_text=""):
    combined = " ".join(part for part in [str(text or ""), str(previous_text or "")] if part).lower()
    match = LANGUAGE_HINT_PATTERN.search(combined)
    if not match:
        return "python"
    language = match.group(1).lower()
    aliases = {
        "js": "javascript",
        "ts": "typescript",
        "cpp": "c++",
        "golang": "go",
    }
    return aliases.get(language, language)


def simple_code_topic(text, previous_text=""):
    candidate = compact_text(text).lower()
    if SHORT_CODE_FOLLOWUP_PATTERN.search(candidate) and previous_text:
        candidate = compact_text(previous_text).lower()
    if (
        "sum of two numbers" in candidate
        or "sum of 2 numbers" in candidate
        or "add two numbers" in candidate
        or "adding two numbers" in candidate
        or "add 2 numbers" in candidate
        or "sum two numbers" in candidate
        or ADD_TWO_NUMBERS_PATTERN.search(candidate)
    ):
        return "add_two_numbers"
    return ""


def simple_code_reply(topic, language):
    if topic != "add_two_numbers":
        return ""

    snippets = {
        "python": "```python\na = 10\nb = 20\nresult = a + b\nprint(result)\n```",
        "javascript": "```javascript\nconst a = 10;\nconst b = 20;\nconst result = a + b;\nconsole.log(result);\n```",
        "typescript": "```typescript\nconst a = 10;\nconst b = 20;\nconst result = a + b;\nconsole.log(result);\n```",
        "java": "```java\npublic class Main {\n    public static void main(String[] args) {\n        int a = 10;\n        int b = 20;\n        int result = a + b;\n        System.out.println(result);\n    }\n}\n```",
        "c++": "```cpp\n#include <iostream>\nusing namespace std;\n\nint main() {\n    int a = 10;\n    int b = 20;\n    int result = a + b;\n    cout << result << endl;\n    return 0;\n}\n```",
        "c": "```c\n#include <stdio.h>\n\nint main(void) {\n    int a = 10;\n    int b = 20;\n    int result = a + b;\n    printf(\"%d\\n\", result);\n    return 0;\n}\n```",
        "go": "```go\npackage main\n\nimport \"fmt\"\n\nfunc main() {\n    a := 10\n    b := 20\n    result := a + b\n    fmt.Println(result)\n}\n```",
        "rust": "```rust\nfn main() {\n    let a = 10;\n    let b = 20;\n    let result = a + b;\n    println!(\"{}\", result);\n}\n```",
    }
    return snippets.get(language, snippets["python"])


def direct_datetime_reply(latest_text):
    now = _response_now()
    lowered = str(latest_text or "").strip().lower()
    if YEAR_PATTERN.search(lowered):
        return f"The current year is {now.year}."
    match = DATE_TIME_PATTERN.search(lowered)
    if not match:
        return ""
    kind = (match.group(1) or "").lower()
    if kind == "time":
        return now.strftime("Right now it is %I:%M %p on %A, %d %B %Y.")
    if kind == "date":
        return now.strftime("Today is %A, %d %B %Y.")
    if kind == "day":
        return now.strftime("Today is %A.")
    return ""


def compact_text(text):
    return re.sub(r"\s+", " ", str(text or "").strip())


def is_low_quality_completion(user_text, completion):
    compact_completion = compact_text(completion)
    if not compact_completion:
        return True
    if re.search(r"[A-Z]{24,}", str(completion or "")) and " " not in compact_completion:
        return True
    if any(pattern.search(compact_completion) for pattern in LOW_QUALITY_PATTERNS):
        return True
    if any(pattern.search(compact_completion) for pattern in GENERIC_ASSISTANT_PATTERNS):
        return True
    if "code" in str(user_text or "").lower():
        has_code_markers = "```" in str(completion or "") or bool(
            re.search(r"\b(def|class|return|print|function|console\.log|public\s+class|int\s+main)\b", str(completion or ""))
        )
        if not has_code_markers and len(compact_completion.split()) > 18:
            return True
    return False


def detect_intent_type(text):
    normalized = str(text or "").strip()
    if not normalized:
        return "empty"
    if CASUAL_PATTERN.search(normalized):
        return "casual"
    if IDENTITY_PATTERN.search(normalized):
        return "identity"
    if DATE_TIME_PATTERN.search(normalized) or YEAR_PATTERN.search(normalized):
        return "datetime"
    if DEFINITION_PATTERN.search(normalized) or STANDALONE_DEFINITION_PATTERN.search(normalized):
        return "definition"
    if CODING_PATTERN.search(normalized):
        return "coding"
    if DEEP_PATTERN.search(normalized):
        return "planning"
    return "general"


def direct_reply_for_intent(intent_type, latest_text, messages=None):
    normalized = str(latest_text or "").strip().lower()
    previous_text = previous_user_text(messages or [])
    if intent_type == "casual":
        if normalized.startswith(("how are you", "how are u")):
            return "I am doing well and ready to help. What do you want to work on?"
        if normalized.startswith(("thanks", "thank you")):
            return "You are welcome. What do you want to work on next?"
        if normalized.startswith(("bye", "goodbye", "see you", "later")):
            return "Bye. If you need anything later, I will be here."
        return "Hi. How can I help today?"
    if intent_type == "identity":
        return "I am Energy AI, your local multi-model assistant. I stay light for simple prompts and go deeper for harder work."
    if intent_type == "datetime":
        return direct_datetime_reply(latest_text)
    if intent_type == "definition":
        topic = canonicalize_definition_topic(latest_text)
        return KNOWN_DEFINITIONS.get(topic, "")
    code_topic = simple_code_topic(latest_text, previous_text)
    if code_topic:
        language = detect_requested_language(latest_text, previous_text)
        return simple_code_reply(code_topic, language)
    return ""


def classify_with_own_router(text, router_model):
    tokens = tokenize_words(text)
    labels = router_model.get("labels") or ["fast", "deep"]
    best_label = "fast"
    best_score = float("-inf")

    for label in labels:
        score = float(router_model.get("priors", {}).get(label, 0))
        default_log_prob = float(router_model.get("default_log_prob", {}).get(label, -10))
        token_log_probs = router_model.get("token_log_probs", {}).get(label, {})
        for token in tokens:
            score += float(token_log_probs.get(token, default_log_prob))
        if score > best_score:
            best_score = score
            best_label = label

    if DEEP_PATTERN.search(text) or "\n" in text:
        return "deep"
    return best_label


def choose_route(messages, mode="auto", workspace_mode="general"):
    latest_text = latest_user_text(messages)
    intent_type = detect_intent_type(latest_text)
    latest_attachments = extract_message_attachments(extract_latest_user_message(messages) or {})
    normalized_workspace = normalize_workspace_mode(workspace_mode)

    if mode == "fast":
        return {
            "targetRole": "fast",
            "modelLabel": model_for("fast"),
            "reason": "manual low-energy mode",
            "energyMode": "low",
            "energyScore": "A",
        }
    if mode == "deep":
        return {
            "targetRole": "deep",
            "modelLabel": model_for("deep"),
            "reason": "manual high-energy mode",
            "energyMode": "high",
            "energyScore": "D",
        }
    if workspace_mode_requires_deep(normalized_workspace):
        return {
            "targetRole": "deep",
            "modelLabel": model_for("deep"),
            "reason": f"workspace mode: {workspace_mode_label(normalized_workspace)} -> high energy",
            "energyMode": "high",
            "energyScore": "D",
        }
    if latest_attachments:
        return {
            "targetRole": "deep",
            "modelLabel": model_for("deep"),
            "reason": "auto balance: attached file context -> high energy",
            "energyMode": "high",
            "energyScore": "D",
        }
    if intent_type in {"casual", "identity", "datetime", "definition"}:
        return {
            "targetRole": "fast",
            "modelLabel": model_for("fast"),
            "reason": "auto balance: casual/meta query -> low energy",
            "energyMode": "low",
            "energyScore": "A",
        }
    if simple_code_topic(latest_text, previous_user_text(messages)):
        return {
            "targetRole": "fast",
            "modelLabel": model_for("fast"),
            "reason": "auto balance: simple code task -> low energy",
            "energyMode": "low",
            "energyScore": "A",
        }
    if DEEP_PATTERN.search(latest_text) or CODING_PATTERN.search(latest_text):
        return {
            "targetRole": "deep",
            "modelLabel": model_for("deep"),
            "reason": f"auto balance: technical prompt ({intent_type}) -> high energy",
            "energyMode": "high",
            "energyScore": "D",
        }

    router_provider = provider_for("router")
    if router_provider == "own":
        router_model = load_own_artifact("router")
        target_role = classify_with_own_router(latest_text, router_model)
    else:
        target_role = "deep" if DEEP_PATTERN.search(latest_text) else "fast"

    if target_role == "deep":
        return {
            "targetRole": "deep",
            "modelLabel": model_for("deep"),
            "reason": "auto balance: router classified for high energy",
            "energyMode": "high",
            "energyScore": "D",
        }
    return {
        "targetRole": "fast",
        "modelLabel": model_for("fast"),
        "reason": "auto balance: router classified for low energy",
        "energyMode": "low",
        "energyScore": "A",
    }


def retrieve_top_matches(query_text, model, role, top_k=4):
    pairs = model.get("pairs") if isinstance(model.get("pairs"), list) else []
    retrieval_index = model.get("__retrievalIndex") if isinstance(model.get("__retrievalIndex"), dict) else {}
    domain_index = model.get("__domainIndex") if isinstance(model.get("__domainIndex"), dict) else {}
    language_index = model.get("__languageIndex") if isinstance(model.get("__languageIndex"), dict) else {}
    query_features = build_query_features(query_text)
    candidate_indexes = set()
    for token in set(query_features["filteredTokens"]):
        for index in retrieval_index.get(token, []):
            candidate_indexes.add(index)
    for domain in query_features["domains"]:
        for index in domain_index.get(domain, []):
            candidate_indexes.add(index)
    if query_features["language"]:
        for index in language_index.get(query_features["language"], []):
            candidate_indexes.add(index)

    candidate_pairs = [pairs[index] for index in candidate_indexes if 0 <= index < len(pairs)] if candidate_indexes else pairs
    scored = []
    for pair in candidate_pairs:
        score = score_match(query_features, pair, role)
        if score > 0:
            scored.append({"pair": pair, "score": score})

    scored.sort(key=lambda item: item["score"], reverse=True)
    return scored[:top_k]


def synthesize_deep_response(query_text, matches):
    if not matches:
        return ""
    top_pair = matches[0]["pair"]
    top_completion = compact_text(top_pair.get("completion", ""))
    if top_pair.get("_hasCode"):
        return ""
    if matches[0]["score"] >= 0.48 and ("\n" in str(top_pair.get("completion") or "") or len(top_completion) > 220):
        return str(top_pair.get("completion") or "").strip()

    notes = []
    seen = set()
    for item in matches[:3]:
        for sentence in completion_sentences(item["pair"].get("completion", ""), limit=3):
            key = sentence.lower()
            if key in seen:
                continue
            seen.add(key)
            notes.append(sentence)
            if len(notes) >= 4:
                break
        if len(notes) >= 4:
            break

    if not notes:
        return ""

    lines = [
        "1. Direct answer",
        f"- {notes[0]}",
    ]
    if len(notes) > 1:
        lines.extend(["", "2. Practical guidance"])
        lines.extend(f"- {sentence}" for sentence in notes[1:4])
    lines.extend(["", "3. Next step", f"- If you want, I can turn this into code or adapt it to your exact stack for: {query_text}."])
    return "\n".join(lines)


def fallback_response(user_text, role, workspace_mode):
    if role == "deep":
        return "\n".join(
            [
                "1. Understanding",
                f"You asked: {user_text or 'a follow-up question'}.",
                "",
                "2. Practical answer",
                "This Django copy is running with a lightweight local response engine, so I can keep the flow working and give structured guidance even when an exact trained match is not available.",
                "",
                "3. Next step",
                f"Reply with more specifics, attach the related files, or switch workspace mode if you want a {workspace_mode_label(workspace_mode).lower()} pass.",
            ]
        )
    return "I can help with that. Share a bit more detail or attach the relevant file, and I will respond more precisely."


def attachment_response(latest_message, workspace_mode):
    attachments = extract_message_attachments(latest_message or {})
    if not attachments:
        return ""

    attachment_names = ", ".join(attachment["name"] for attachment in attachments)
    return "\n".join(
        [
            f"I have the attached file context for {attachment_names}.",
            f"Workspace mode: {workspace_mode_label(workspace_mode)}.",
            "Tell me whether you want a review, bug fix, explanation, refactor, or test-focused pass, and I will ground the answer in those files.",
        ]
    )


def generate_from_own_model(role, user_text, workspace_mode):
    model = load_own_artifact(role)
    matches = retrieve_top_matches(user_text, model, role)
    threshold = 0.5 if role == "fast" else 0.22
    if matches and matches[0]["score"] >= threshold:
        completion = str(matches[0]["pair"].get("completion") or "").strip()
        if completion and not is_low_quality_completion(user_text, completion):
            if role == "deep":
                blended = synthesize_deep_response(user_text, matches)
                if blended:
                    return blended, model.get("name") or f"{model_for(role)}-own"
            return completion, model.get("name") or f"{model_for(role)}-own"
    if role == "deep":
        blended = synthesize_deep_response(user_text, matches)
        if blended:
            return blended, model.get("name") or f"{model_for(role)}-own"
    return fallback_response(user_text, role, workspace_mode), model.get("name") or f"{model_for(role)}-own"


def generate_text_for_role(role, user_text, workspace_mode):
    provider = provider_for(role)
    if provider == "own":
        return generate_from_own_model(role, user_text, workspace_mode)
    if provider == "mock":
        return fallback_response(user_text, role, workspace_mode), f"{model_for(role)}-mock"
    return fallback_response(user_text, role, workspace_mode), model_for(role)


def chunk_text(text, size=None):
    value = str(text or "")
    chunk_size = size or settings.CHAT_STREAM_CHUNK_CHARS
    if not value:
        return [""]
    return [value[index:index + chunk_size] for index in range(0, len(value), chunk_size)]


def build_chat_result(messages, mode="auto", workspace_mode="general"):
    normalized_messages = [normalize_message(message) for message in (messages or [])]
    latest_message = extract_latest_user_message(normalized_messages)
    latest_text = latest_user_text(normalized_messages)
    latest_attachments = extract_message_attachments(latest_message or {})
    effective_workspace_mode = normalize_workspace_mode(workspace_mode)
    if effective_workspace_mode == "general":
        effective_workspace_mode = infer_workspace_mode(
            text=latest_text,
            attachments=latest_attachments,
            messages=normalized_messages,
        )

    intent_type = detect_intent_type(latest_text)
    explicit_search = is_explicit_search_request(latest_text)
    search_profile = infer_search_profile(latest_text)
    technical_prompt = bool(
        latest_attachments
        or CODING_PATTERN.search(latest_text)
        or DEEP_PATTERN.search(latest_text)
        or workspace_mode_requires_deep(effective_workspace_mode)
    )
    allow_web_response = (
        explicit_search
        or search_profile in {"download", "shopping", "builder", "recommendation"}
        or (intent_type in {"definition", "general"} and not technical_prompt)
    )
    prefer_web_grounding = (
        intent_type == "definition"
        and not latest_attachments
        and allow_web_response
        and should_fetch_knowledge(latest_text, search_profile)
    )
    direct_reply = (
        direct_reply_for_intent(intent_type, latest_text, normalized_messages)
        if not latest_attachments and not explicit_search and not prefer_web_grounding
        else ""
    )

    if direct_reply:
        events = [
            {
                "type": "start",
                "model": "energy-instant",
                "routeReason": f"direct {intent_type} response",
                "role": "fast",
                "energyMode": "low",
                "workspaceMode": effective_workspace_mode,
                "sources": [],
            }
        ]
        for token in chunk_text(direct_reply):
            events.append({"type": "token", "token": token})
        events.append(
            {
                "type": "final",
                "model": "energy-instant",
                "routeReason": f"direct {intent_type} response",
                "role": "fast",
                "energyMode": "low",
                "energyScore": "A",
                "workspaceMode": effective_workspace_mode,
                "sources": [],
            }
        )
        return {
            "events": events,
            "text": direct_reply,
            "trainingPrompt": latest_text,
        }

    knowledge = {"contextText": "", "sources": []}
    if not latest_attachments and allow_web_response and should_fetch_knowledge(latest_text, search_profile):
        knowledge_query = build_knowledge_query(normalized_messages, search_profile)
        if knowledge_query:
            knowledge = fetch_knowledge_context(knowledge_query, search_profile)

    route = choose_route(normalized_messages, mode=mode, workspace_mode=effective_workspace_mode)
    generated_text = attachment_response(latest_message, effective_workspace_mode)
    route_reason = route["reason"]
    model_name = route["modelLabel"]
    if not generated_text:
        if not explicit_search:
            generated_text = coding_response_for_messages(normalized_messages)
            if generated_text:
                route_reason = f"{route_reason} | coding template"
        if not generated_text and allow_web_response:
            generated_text = render_knowledge_response(latest_text, search_profile, route["targetRole"], knowledge)
            if generated_text:
                route_reason = f"{route_reason} | web knowledge"
        if not generated_text:
            generated_text, model_name = generate_text_for_role(route["targetRole"], latest_text, effective_workspace_mode)

    events = [
        {
            "type": "start",
            "model": model_name,
            "routeReason": route_reason,
            "role": route["targetRole"],
            "energyMode": route["energyMode"],
            "workspaceMode": effective_workspace_mode,
            "sources": knowledge["sources"],
        }
    ]
    for token in chunk_text(generated_text):
        events.append({"type": "token", "token": token})
    events.append(
        {
            "type": "final",
            "model": model_name,
            "routeReason": route_reason,
            "role": route["targetRole"],
            "energyMode": route["energyMode"],
            "energyScore": route["energyScore"],
            "workspaceMode": effective_workspace_mode,
            "sources": knowledge["sources"],
        }
    )
    return {
        "events": events,
        "text": generated_text,
        "trainingPrompt": latest_text or ", ".join(attachment["name"] for attachment in latest_attachments),
    }
