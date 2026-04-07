import json
import re
import subprocess
import threading
import time
import xml.etree.ElementTree as ET
from html import unescape
from urllib.error import URLError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

from django.conf import settings


WHAT_IS_PATTERN = re.compile(r"^(?:(?:can\s+i\s+know|do\s+you\s+know|tell\s+me|can\s+you\s+tell\s+me|could\s+you\s+tell\s+me|please\s+tell\s+me)\s+)?(what|who)\s+is\s+(.+?)\??$", re.I)
CASUAL_CHAT_PATTERN = re.compile(r"^(hi|hello|hey|yo|hi there|hello there|good morning|good evening|good afternoon|how are you|how are u|thanks|thank you|ok|okay|cool|nice|good|bye|goodbye|see you|see ya|later)\b", re.I)
IDENTITY_PATTERN = re.compile(r"^(what(?:'s| is)\s+your\s+name|who\s+are\s+you|which\s+model\s+are\s+you|what\s+is\s+your\s+model\s+name|what\s+model\s+are\s+you)\??$", re.I)
DATE_TIME_PATTERN = re.compile(r"^(?:(?:can\s+i\s+know|tell\s+me|do\s+you\s+know)\s+)?(?:(?:what(?:'s| is)?|which)\s+)?(?:(today'?s?|current|now)\s+)?(date|time|day)(?:\s+(?:today|now|it\s+is|is\s+it))?\??$", re.I)
CODING_PATTERN = re.compile(r"\b(code|function|program|script|debug|bug|fix|refactor|algorithm|data structure|react|node|javascript|typescript|python|java|c\+\+|sql|api)\b", re.I)
EXPLICIT_SEARCH_PATTERN = re.compile(
    r"\b(search|look\s+up|lookup|find|web\s+search|search\s+online|show\s+(?:me\s+)?(?:sources?|resources?)|give(?:\s+me)?\s+(?:the\s+)?(?:answer|ans|sources?|resources?)|from\s+(?:wikipedia|wiki|web|internet)|in\s+(?:wikipedia|wiki|web|internet)|on\s+(?:wikipedia|wiki|web|internet)|wikipedia|wiki)\b",
    re.I,
)
WIKIPEDIA_PATTERN = re.compile(r"\b(?:wikipedia|wiki)\b", re.I)
DOWNLOAD_PATTERN = re.compile(r"\b(download|installer|installation|setup|apk|exe|dmg|zip|tar\.gz|github release|official link|get the link|download link)\b", re.I)
SHOPPING_PATTERN = re.compile(r"\b(buy|purchase|worth buying|best price|pricing|price|deal|budget|under\s+\$?\d+|recommend .* buy|which .* buy)\b", re.I)
BUILDER_PATTERN = re.compile(r"\b(ai builders?|website builders?|app builders?|landing page builders?|agent builders?|builder for my project|builder for project|no[-\s]?code|low[-\s]?code)\b", re.I)
RECOMMENDATION_PATTERN = re.compile(r"\b(best|top|recommend|suggest|alternatives?|options?)\b", re.I)
KNOWLEDGE_TRIGGER_PATTERN = re.compile(r"^(what|who|when|where|why|how)\b|\b(explain|define|overview|latest|history)\b", re.I)
DISCOVERY_TRIGGER_PATTERN = re.compile(r"\b(best|top|recommend|suggest|buy|purchase|download|builder|free|paid|pricing|price|official)\b", re.I)
FACTUAL_QUESTION_PATTERN = re.compile(r"^(what|who|when|where|why|how|which)\b.*\?$", re.I)

QUERY_ALIASES = {
    "ai": "artificial intelligence",
    "vscode": "visual studio code",
    "vs code": "visual studio code",
    "cn": "computer network",
    "dbms": "database management system",
    "os": "operating system",
    "oops": "object-oriented programming",
    "oop": "object-oriented programming",
    "ml": "machine learning",
    "dl": "deep learning",
    "nlp": "natural language processing",
    "cv": "computer vision",
    "iot": "internet of things",
    "api": "application programming interface",
    "ui": "user interface",
    "ux": "user experience",
    "computer networks": "computer network",
    "cpu": "central processing unit",
    "gpu": "graphics processing unit",
    "ram": "random access memory",
    "rom": "read-only memory",
    "dns": "domain name system",
    "tcp": "transmission control protocol",
    "udp": "user datagram protocol",
    "sql": "structured query language",
    "jwt": "json web token",
    "coa": "computer organization and architecture",
    "toc": "theory of computation",
    "se": "software engineering",
    "mac": "apple mac",
    "macbook": "apple macbook",
    "mac book": "apple macbook",
    "artificial inteligence": "artificial intelligence",
    "artificial intelegence": "artificial intelligence",
    "artifical intelligence": "artificial intelligence",
}

REFERENCE_FALLBACKS = {
    "artificial intelligence": "Artificial intelligence is the capability of computer systems to perform tasks that normally require human intelligence, such as learning, reasoning, problem-solving, and language understanding.",
    "computer network": "A computer network is a group of connected computers and devices that communicate and share data, resources, and services over wired or wireless links.",
    "machine learning": "Machine learning is a method where models learn patterns from data instead of relying only on fixed hand-written rules.",
    "deep learning": "Deep learning is a type of machine learning that uses multi-layer neural networks to model complex patterns.",
    "natural language processing": "Natural language processing is a field of AI focused on helping computers understand, analyze, and generate human language.",
    "application programming interface": "An application programming interface, or API, is a defined way for software systems to communicate and exchange data.",
    "database management system": "A database management system is software that stores, organizes, retrieves, and manages data efficiently.",
    "operating system": "An operating system is core system software that manages hardware, memory, files, and processes and provides services to applications.",
}

CURATED_DOWNLOADS = [
    {"keys": ["vscode", "vs code", "visual studio code"], "title": "Visual Studio Code Download", "text": "Official download page for Visual Studio Code on Windows, macOS, and Linux.", "url": "https://code.visualstudio.com/Download"},
    {"keys": ["python", "python3"], "title": "Python Downloads", "text": "Official Python downloads for Windows, macOS, and other platforms.", "url": "https://www.python.org/downloads/"},
    {"keys": ["node", "nodejs", "node.js"], "title": "Node.js Downloads", "text": "Official Node.js download page with LTS and current releases.", "url": "https://nodejs.org/en/download"},
    {"keys": ["git"], "title": "Git Downloads", "text": "Official Git download page for major operating systems.", "url": "https://git-scm.com/downloads"},
    {"keys": ["docker", "docker desktop"], "title": "Docker Desktop", "text": "Official Docker Desktop download page for local container development.", "url": "https://www.docker.com/products/docker-desktop/"},
    {"keys": ["chrome", "google chrome"], "title": "Google Chrome Download", "text": "Official Google Chrome download page.", "url": "https://www.google.com/chrome/"},
    {"keys": ["firefox", "mozilla firefox"], "title": "Mozilla Firefox Download", "text": "Official Firefox browser download page from Mozilla.", "url": "https://www.mozilla.org/firefox/new/"},
]

CURATED_AI_BUILDERS = [
    {"keys": ["website", "landing page", "site", "builder", "ai"], "title": "Framer AI", "text": "AI website builder with prompt-to-site workflows and a fast path for landing pages.", "url": "https://www.framer.com/ai/"},
    {"keys": ["website", "site", "builder", "ai"], "title": "Webflow AI Site Builder", "text": "Website builder with design control, CMS, and AI-assisted site generation.", "url": "https://webflow.com/ai-site-builder"},
    {"keys": ["app", "web app", "builder", "no-code", "project"], "title": "Bubble", "text": "No-code app builder for SaaS and internal tools with databases and custom logic.", "url": "https://bubble.io/"},
    {"keys": ["app", "mobile app", "flutter", "builder"], "title": "FlutterFlow AI Gen", "text": "Low-code mobile and web app builder with AI-assisted generation.", "url": "https://flutterflow.io/ai-gen"},
    {"keys": ["agent", "workflow", "open-source", "builder", "ai"], "title": "Dify", "text": "Open-source AI app and agent builder with workflow orchestration, prompts, and RAG.", "url": "https://dify.ai/"},
    {"keys": ["agent", "workflow", "open-source", "builder", "ai"], "title": "Flowise", "text": "Open-source visual builder for LLM apps and agents with self-hosted workflows.", "url": "https://flowiseai.com/"},
    {"keys": ["fullstack", "web app", "builder", "ai"], "title": "Bolt.new", "text": "AI-assisted full-stack app builder that can scaffold and iterate quickly in the browser.", "url": "https://bolt.new/"},
    {"keys": ["ui", "frontend", "builder", "ai"], "title": "v0", "text": "AI UI builder focused on generating React and frontend code quickly.", "url": "https://v0.dev/"},
]

TRUSTED_HOST_WEIGHTS = {
    "wikipedia.org": 5,
    "britannica.com": 4,
    "python.org": 5,
    "nodejs.org": 5,
    "developer.mozilla.org": 5,
    "docs.djangoproject.com": 5,
    "microsoft.com": 4,
    "code.visualstudio.com": 5,
    "git-scm.com": 5,
    "docker.com": 5,
    "mozilla.org": 4,
}

_CACHE = {}
_CACHE_LOCK = threading.Lock()


def _bool_setting(name, default):
    value = getattr(settings, name, default)
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() not in {"0", "false", "no", "off"}


def _int_setting(name, default):
    try:
        return int(getattr(settings, name, default))
    except Exception:
        return default


def web_knowledge_enabled():
    return _bool_setting("ENABLE_WEB_KNOWLEDGE", True)


def knowledge_timeout_ms():
    return _int_setting("KNOWLEDGE_TIMEOUT_MS", 800)


def knowledge_max_chars():
    return _int_setting("KNOWLEDGE_MAX_CHARS", 2600)


def knowledge_search_results():
    return _int_setting("KNOWLEDGE_SEARCH_RESULTS", 2)


def knowledge_cache_ttl_ms():
    return _int_setting("KNOWLEDGE_CACHE_TTL_MS", 5 * 60 * 1000)


def normalize_query_text(query):
    return re.sub(r"\s+", " ", str(query or "").strip().strip("?.!,")).strip()


def is_explicit_search_request(text):
    return bool(EXPLICIT_SEARCH_PATTERN.search(normalize_query_text(text)))


def canonicalize_query(query):
    trimmed = normalize_query_text(query)
    if not trimmed:
        return ""
    match = WHAT_IS_PATTERN.match(trimmed)
    base = match.group(2).strip() if match else trimmed
    return QUERY_ALIASES.get(base.lower(), base)


def infer_search_profile(text):
    normalized = normalize_query_text(text).lower()
    if DOWNLOAD_PATTERN.search(normalized):
        return "download"
    if BUILDER_PATTERN.search(normalized):
        return "builder"
    if SHOPPING_PATTERN.search(normalized):
        return "shopping"
    if RECOMMENDATION_PATTERN.search(normalized):
        return "recommendation"
    return "reference"


def extract_search_topic(text, profile="reference"):
    normalized = normalize_query_text(text)
    if not normalized:
        return ""
    match = WHAT_IS_PATTERN.match(normalized)
    if match:
        return match.group(2).strip()

    cleaned = re.sub(
        r"\b(search|look\s+up|lookup|find|show|give|tell|me|the|answer|ans|sources?|resources?|from|in|on|wikipedia|wiki|web|internet|please|about|and)\b",
        " ",
        normalized,
        flags=re.I,
    )
    if profile == "download":
        cleaned = re.sub(r"\b(download|installer|installation|setup|official|link)\b", " ", cleaned, flags=re.I)
    cleaned = normalize_query_text(cleaned)
    if cleaned.lower() in {"it", "this", "that", "there", "here"}:
        return ""
    return cleaned


def should_fetch_knowledge(text, profile="reference"):
    trimmed = normalize_query_text(text)
    explicit_search = is_explicit_search_request(trimmed)
    if not web_knowledge_enabled() or not trimmed or (len(trimmed) < 8 and not explicit_search):
        return False
    if explicit_search:
        return True
    if CASUAL_CHAT_PATTERN.search(trimmed) or IDENTITY_PATTERN.search(trimmed) or DATE_TIME_PATTERN.search(trimmed):
        return False
    if CODING_PATTERN.search(trimmed):
        return False
    if profile in {"download", "shopping", "builder", "recommendation"}:
        return True
    if FACTUAL_QUESTION_PATTERN.search(trimmed):
        return True
    if KNOWLEDGE_TRIGGER_PATTERN.search(trimmed) or DISCOVERY_TRIGGER_PATTERN.search(trimmed):
        return True
    return bool(re.fullmatch(r"[A-Za-z][A-Za-z0-9+.#/\-&\s]{3,80}", trimmed) and len(trimmed.split()) <= 5)


def build_knowledge_query(messages, profile="reference"):
    user_messages = [str(message.get("content") or "").strip() for message in (messages or []) if message.get("role") == "user"]
    latest = user_messages[-1] if user_messages else ""
    if not latest:
        return ""
    latest_topic = extract_search_topic(latest, profile)
    if latest_topic:
        return latest_topic
    if is_explicit_search_request(latest):
        for previous in reversed(user_messages[:-1]):
            if is_explicit_search_request(previous):
                continue
            previous_topic = extract_search_topic(previous, profile)
            if previous_topic:
                return previous_topic
    return latest


def simplify_search_topic(query, profile):
    canonical = canonicalize_query(query)
    if not canonical:
        return ""
    simplified = canonical
    if profile == "download":
        download_match = re.search(r"\bdownload\s+(.+)$", simplified, re.I)
        if download_match:
            simplified = download_match.group(1).strip()
    simplified = re.sub(r"\b(can|could|would|please|tell|show|find|search|look\s+for|i|me|my|want|need|know|what|which|who|is|are|the|a|an)\b", " ", simplified, flags=re.I)
    if profile == "download":
        simplified = re.sub(r"\b(download|installer|installation|setup|official link|get the link|download link)\b", " ", simplified, flags=re.I)
    if profile == "shopping":
        simplified = re.sub(r"\b(buy|purchase|worth buying|recommend|suggest|should)\b", " ", simplified, flags=re.I)
    if profile == "builder":
        simplified = re.sub(r"\b(best|top|recommend|suggest|for my project|for project)\b", " ", simplified, flags=re.I)
    if profile == "recommendation":
        simplified = re.sub(r"\b(best|top|recommend|suggest|options|alternatives)\b", " ", simplified, flags=re.I)
    simplified = normalize_query_text(simplified)
    return QUERY_ALIASES.get(simplified.lower(), simplified or canonical)


def build_search_queries(query, profile):
    topic = simplify_search_topic(query, profile)
    if not topic:
        return []
    variants = [topic]
    if profile == "download":
        variants = [f"{topic} official download", f"{topic} github release", topic]
    elif profile == "shopping":
        variants = [f"{topic} best price buy", f"{topic} reviews", f"{topic} compare pricing"]
    elif profile == "builder":
        builder_topic = topic if re.search(r"\bbuilders?\b", topic, re.I) else f"{topic} AI builders"
        variants = [f"{builder_topic} free paid", f"{builder_topic} pricing", f"{builder_topic} official"]
    elif profile == "recommendation":
        variants = [f"{topic} best options", f"{topic} compare pricing", topic]
    return list(dict.fromkeys(item.strip() for item in variants if item.strip()))[:3]


def _curl_fetch(url):
    timeout_seconds = max(0.3, knowledge_timeout_ms() / 1000)
    result = subprocess.run(
        ["curl", "-LfsS", "--max-time", f"{timeout_seconds:.2f}", url],
        capture_output=True,
        text=True,
        check=False,
    )
    return result.stdout if result.returncode == 0 else ""


def _urllib_fetch(url):
    request = Request(url, headers={"User-Agent": "Energy-AI-Django/1.0"})
    with urlopen(request, timeout=max(1.0, knowledge_timeout_ms() / 1000)) as response:
        return response.read().decode("utf-8", errors="replace")


def fetch_text_with_timeout(url):
    for fetcher in (_curl_fetch, _urllib_fetch):
        try:
            text = fetcher(url)
            if text:
                return text
        except Exception:
            continue
    return ""


def fetch_json_with_timeout(url):
    text = fetch_text_with_timeout(url)
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        return None


def fetch_wikipedia_snippet(query):
    search_url = (
        "https://en.wikipedia.org/w/api.php"
        f"?action=opensearch&search={quote(query)}&limit=1&namespace=0&format=json&origin=*"
    )
    search_data = fetch_json_with_timeout(search_url)
    first_title = (((search_data or [None, []])[1] or [None])[0]) if isinstance(search_data, list) else None
    if not first_title:
        return None
    summary_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(first_title)}"
    summary_data = fetch_json_with_timeout(summary_url) or {}
    extract = str(summary_data.get("extract") or "").strip()
    if not extract:
        return None
    page_url = (((summary_data.get("content_urls") or {}).get("desktop") or {}).get("page")) or f"https://en.wikipedia.org/wiki/{quote(first_title)}"
    return {"title": f"Wikipedia: {first_title}", "text": extract, "url": page_url, "sourceKind": "reference"}


def _first_duckduckgo_related_text(items):
    for item in items or []:
        if item.get("Text"):
            return str(item.get("Text") or "")
        nested = item.get("Topics")
        if isinstance(nested, list):
            text = _first_duckduckgo_related_text(nested)
            if text:
                return text
    return ""


def fetch_duckduckgo_snippet(query):
    data = fetch_json_with_timeout(f"https://api.duckduckgo.com/?q={quote(query)}&format=json&no_redirect=1&no_html=1") or {}
    text = str(data.get("AbstractText") or "").strip() or _first_duckduckgo_related_text(data.get("RelatedTopics")).strip()
    if not text:
        return None
    url = str(data.get("AbstractURL") or "https://duckduckgo.com/")
    lowered_url = url.lower()
    if "disambiguation" in lowered_url:
        return None
    if text.endswith("..."):
        return None
    return {"title": "DuckDuckGo", "text": text, "url": url, "sourceKind": "reference"}


def fetch_bing_web_results(query, limit=None):
    xml = fetch_text_with_timeout(f"https://www.bing.com/search?format=rss&cc=us&setlang=en-US&q={quote(query)}")
    if not xml:
        return []
    try:
        root = ET.fromstring(xml)
    except Exception:
        return []
    results = []
    for item in root.findall(".//item")[: limit or knowledge_search_results()]:
        title = unescape(str(item.findtext("title") or "").strip())
        link = unescape(str(item.findtext("link") or "").strip())
        description = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", unescape(str(item.findtext("description") or "")))).strip()
        if title and link and description:
            results.append({"title": title, "text": description, "url": link, "sourceKind": "search"})
    return results


def _cache_key(profile, query):
    return f"{profile}:{normalize_query_text(query).lower()}"


def read_knowledge_cache(profile, query):
    key = _cache_key(profile, query)
    with _CACHE_LOCK:
        cached = _CACHE.get(key)
        if not cached:
            return None
        if cached["expiresAt"] <= time.time() * 1000:
            _CACHE.pop(key, None)
            return None
        return cached["value"]


def write_knowledge_cache(profile, query, value):
    key = _cache_key(profile, query)
    with _CACHE_LOCK:
        _CACHE[key] = {"value": value, "expiresAt": time.time() * 1000 + knowledge_cache_ttl_ms()}
    return value


def _score_catalog_entry(entry, query, profile):
    normalized_query = simplify_search_topic(query, profile).lower()
    haystack = f"{entry['title']} {entry['text']} {' '.join(entry['keys'])}".lower()
    score = 0
    for key in entry["keys"]:
        if key.lower() in normalized_query:
            score += 3
    for token in normalized_query.split():
        if len(token) >= 3 and token in haystack:
            score += 1
    return score


def curated_matches(query, catalog, profile):
    ranked = sorted(
        ({"entry": entry, "score": _score_catalog_entry(entry, query, profile)} for entry in catalog),
        key=lambda item: item["score"],
        reverse=True,
    )
    return [item["entry"] for item in ranked if item["score"] > 0]


def _hostname(url):
    try:
        return urlparse(url).hostname.replace("www.", "")
    except Exception:
        return ""


def _display_topic(topic):
    parts = re.split(r"[\s_-]+", str(topic or "").strip())
    normalized_parts = []
    for part in parts:
        if not part:
            continue
        normalized_parts.append(part.upper() if part.lower() in {"api", "ai", "sql", "cpu", "gpu", "ram", "rom", "dns", "tcp", "udp"} else part.capitalize())
    return " ".join(normalized_parts)


def local_reference_fallback(query):
    topic = simplify_search_topic(query, "reference") or canonicalize_query(query)
    canonical = QUERY_ALIASES.get(str(topic or "").lower(), str(topic or ""))
    fallback_text = REFERENCE_FALLBACKS.get(str(canonical or "").lower())
    if not fallback_text:
        return None
    display_topic = _display_topic(canonical)
    return {
        "title": f"Wikipedia: {display_topic}",
        "text": fallback_text,
        "url": f"https://en.wikipedia.org/wiki/{quote(display_topic.replace(' ', '_'))}",
        "sourceKind": "reference",
    }


def _score_snippet(snippet, profile, query_tokens):
    haystack = f"{snippet.get('title', '')} {snippet.get('text', '')} {snippet.get('url', '')}".lower()
    host = _hostname(snippet.get("url", ""))
    score = sum(1 for token in query_tokens if len(token) >= 3 and token in haystack)
    score += TRUSTED_HOST_WEIGHTS.get(host, 0)
    if profile == "reference":
        if host.endswith("wikipedia.org"):
            score += 4
        if snippet.get("sourceKind") == "reference":
            score += 2
    elif profile == "download":
        if re.search(r"\b(download|install|installer|setup|release|releases|official)\b", haystack):
            score += 4
    elif profile == "shopping":
        if re.search(r"\b(buy|price|pricing|deal|review|reviews|compare|comparison)\b", haystack):
            score += 3
    elif profile == "builder":
        if re.search(r"\b(builder|ai|website|app|agent|automation|no-code|low-code|pricing|free|open source)\b", haystack):
            score += 3
    return score


def dedupe_snippets(snippets):
    seen = set()
    deduped = []
    for snippet in snippets:
        fingerprint = snippet.get("url") or f"{snippet.get('title')}|{str(snippet.get('text') or '')[:120]}"
        if not fingerprint or fingerprint in seen:
            continue
        seen.add(fingerprint)
        deduped.append(snippet)
    return deduped


def rank_snippets(snippets, profile, query):
    query_tokens = simplify_search_topic(query, profile).lower().split()
    return sorted(snippets, key=lambda item: (_score_snippet(item, profile, query_tokens), item.get("title", "")), reverse=True)


def compact_context(snippets, profile):
    lines = []
    used = 0
    include_url = profile != "reference"
    for index, snippet in enumerate(snippets, start=1):
        cleaned = re.sub(r"\s+", " ", str(snippet.get("text") or "")).strip()
        if not cleaned:
            continue
        line = f"[{index}] {snippet.get('title')}: {cleaned}"
        if include_url and snippet.get("url"):
            line += f" [Source: {snippet['url']}]"
        if used + len(line) > knowledge_max_chars():
            break
        lines.append(line)
        used += len(line)
    return "\n".join(lines)


def fetch_knowledge_context(query, profile="reference"):
    if not should_fetch_knowledge(query, profile):
        return {"contextText": "", "sources": []}
    topic_query = simplify_search_topic(query, profile)
    search_queries = build_search_queries(query, profile)
    if not search_queries:
        return {"contextText": "", "sources": []}
    cached = read_knowledge_cache(profile, topic_query or search_queries[0])
    if cached:
        return cached
    raw_snippets = []
    if profile == "builder":
        raw_snippets = curated_matches(query, CURATED_AI_BUILDERS, profile)[:5]
    elif profile == "reference":
        primary_query = search_queries[0]
        wikipedia_only = bool(WIKIPEDIA_PATTERN.search(str(query or "")))
        raw_snippets = [fetch_wikipedia_snippet(primary_query)]
        if not wikipedia_only:
            raw_snippets.append(fetch_duckduckgo_snippet(primary_query))
        raw_snippets = [item for item in raw_snippets if item]
        if not wikipedia_only:
            raw_snippets.extend(fetch_bing_web_results(primary_query, 2))
        if not raw_snippets:
            fallback = local_reference_fallback(primary_query)
            if fallback:
                raw_snippets = [fallback]
    else:
        curated = curated_matches(query, CURATED_DOWNLOADS, profile) if profile == "download" else []
        if profile == "download" and curated:
            raw_snippets = curated[:1]
        else:
            for search_query in search_queries:
                raw_snippets.extend(fetch_bing_web_results(search_query, knowledge_search_results()))
            raw_snippets = curated + raw_snippets
    if not raw_snippets:
        return {"contextText": "", "sources": []}
    ranked = rank_snippets(dedupe_snippets(raw_snippets), profile, topic_query or search_queries[0])
    limited = ranked[: 4 if profile == "reference" else 5]
    return write_knowledge_cache(
        profile,
        topic_query or search_queries[0],
        {
            "contextText": compact_context(limited, profile),
            "sources": [{"title": item.get("title", ""), "url": item.get("url", ""), "text": item.get("text", "")} for item in limited],
        },
    )


def extract_knowledge_entries(context_text="", sources=None):
    source_list = sources or []
    lines = [line.strip() for line in str(context_text or "").splitlines() if line.strip()]
    entries = []
    for index, line in enumerate(lines):
        source = source_list[index] if index < len(source_list) else {}
        cleaned = re.sub(r"^\[\d+\]\s*", "", line)
        snippet = cleaned
        if source.get("title") and cleaned.startswith(f"{source['title']}:"):
            snippet = cleaned[len(source["title"]) + 1 :].strip()
        elif ":" in cleaned:
            snippet = cleaned.split(":", 1)[1].strip()
        snippet = re.sub(r"\s*\[Source:\s*https?://[^\]]+\]\s*$", "", snippet, flags=re.I).strip()
        entries.append(
            {
                "title": source.get("title") or (cleaned.split(":", 1)[0].strip() if ":" in cleaned else f"Source {index + 1}"),
                "url": source.get("url") or "",
                "text": source.get("text") or snippet,
            }
        )
    if not entries and source_list:
        for source in source_list:
            entries.append({"title": source.get("title") or "Source", "url": source.get("url") or "", "text": source.get("text") or ""})
    return entries


def _first_sentence(text):
    trimmed = str(text or "").strip()
    if not trimmed:
        return ""
    return re.split(r"(?<=[.!?])\s+", trimmed)[0].strip()


def _source_display(entry):
    host = _hostname(entry.get("url", ""))
    return f"{entry.get('title')} ({host})" if host else entry.get("title", "Source")


def _unique_sentences(entries, limit=3):
    sentences = []
    seen = set()
    for entry in entries:
        for sentence in re.split(r"(?<=[.!?])\s+", str(entry.get("text") or "").strip()):
            cleaned = sentence.strip()
            if not cleaned:
                continue
            key = cleaned.lower()
            if key in seen:
                continue
            seen.add(key)
            sentences.append(cleaned)
            if len(sentences) >= limit:
                return sentences
    return sentences


def _fast_reference_response(topic, entries):
    lead = _first_sentence(entries[0].get("text") if entries else "")
    if not lead:
        return ""
    details = [sentence for sentence in _unique_sentences(entries, 3) if sentence != lead][:2]
    parts = ["Web answer", f"- {lead}"]
    if details:
        parts.extend(["", "Useful details"])
        parts.extend(f"- {sentence}" for sentence in details)
    if entries[:2]:
        parts.extend(["", "Sources"])
        parts.extend(f"- {_source_display(entry)}" for entry in entries[:2])
    return "\n".join(parts)


def _deep_reference_response(topic, entries):
    sentences = _unique_sentences(entries, 4)
    if not sentences:
        return ""
    details = sentences[1:4]
    source_notes = [_source_display(entry) for entry in entries[:2]]
    parts = []
    if topic:
        parts.extend([f"Web brief on {topic}", ""])
    parts.extend(["1. Direct answer", f"- {sentences[0]}"])
    if details:
        parts.extend(["", "2. Why it matters", *[f"- {sentence}" for sentence in details]])
    if source_notes:
        parts.extend(["", "3. Sources", *[f"- {note}" for note in source_notes]])
    return "\n".join(parts)


def _list_response(prefix, entries, suffix):
    if not entries:
        return ""
    lines = ["Web picks", prefix]
    for entry in entries[:4]:
        sentence = _first_sentence(entry.get("text") or "")
        lines.append(f"- {_source_display(entry)}: {sentence or entry.get('title')}")
    if suffix:
        lines.extend(["", suffix])
    return "\n".join(lines)


def render_knowledge_response(query, profile, role, knowledge):
    entries = extract_knowledge_entries(knowledge.get("contextText", ""), knowledge.get("sources", []))
    if not entries:
        return ""
    topic = simplify_search_topic(query, profile) or canonicalize_query(query)
    if profile == "download":
        return _list_response("Here are the strongest download sources I found:", entries, "Use the source links below and prefer official pages over mirrors.")
    if profile == "shopping":
        return _list_response("Here are strong references to compare before buying:", entries, "Open the source links below to compare price, specs, and reviews.")
    if profile == "builder":
        return _list_response("Here are strong AI builder options I found:", entries, "Use the source links below to open the builder pages, pricing, and comparisons.")
    if profile == "recommendation":
        return _list_response("Here are the strongest references I found:", entries, "Open the source links below if you want the official pages, pricing, or comparisons.")
    if role == "deep":
        return _deep_reference_response(topic, entries)
    return _fast_reference_response(topic, entries)
