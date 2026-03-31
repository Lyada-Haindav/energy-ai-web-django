const ENABLE_WEB_KNOWLEDGE = (process.env.ENABLE_WEB_KNOWLEDGE || "true").toLowerCase() !== "false";
const KNOWLEDGE_TIMEOUT_MS = Number(process.env.KNOWLEDGE_TIMEOUT_MS || 800);
const KNOWLEDGE_MAX_CHARS = Number(process.env.KNOWLEDGE_MAX_CHARS || 2600);
const SEARCH_RESULTS_PER_QUERY = Number(process.env.KNOWLEDGE_SEARCH_RESULTS || 2);
const KNOWLEDGE_CACHE_TTL_MS = Number(process.env.KNOWLEDGE_CACHE_TTL_MS || 5 * 60 * 1000);
const knowledgeCache = new Map();

const SKIP_PATTERNS = [
  /^\s*$/,
  /^(hi|hello|hey|yo)\b/i,
  /^(thanks|thank you)\b/i,
  /^(ok|okay|cool|nice)\b/i
];

const QUERY_ALIASES = {
  ai: "artificial intelligence",
  vscode: "visual studio code",
  "vs code": "visual studio code",
  cn: "computer network",
  dbms: "database management system",
  os: "operating system",
  oops: "object-oriented programming",
  oop: "object-oriented programming",
  ml: "machine learning",
  dl: "deep learning",
  nlp: "natural language processing",
  cv: "computer vision",
  iot: "internet of things",
  api: "application programming interface",
  ui: "user interface",
  ux: "user experience",
  cpu: "central processing unit",
  gpu: "graphics processing unit",
  ram: "random access memory",
  rom: "read-only memory",
  dns: "domain name system",
  tcp: "transmission control protocol",
  udp: "user datagram protocol",
  sql: "structured query language",
  jwt: "json web token",
  coa: "computer organization and architecture",
  toc: "theory of computation",
  se: "software engineering",
  mac: "apple mac",
  macbook: "apple macbook",
  "mac book": "apple macbook",
  "artificial inteligence": "artificial intelligence",
  "artificial intelegence": "artificial intelligence"
};

const CURATED_DOWNLOADS = [
  {
    keys: ["vscode", "vs code", "visual studio code"],
    title: "Visual Studio Code Download",
    text: "Official download page for Visual Studio Code on Windows, macOS, and Linux.",
    url: "https://code.visualstudio.com/Download",
    sourceKind: "catalog"
  },
  {
    keys: ["python", "python3"],
    title: "Python Downloads",
    text: "Official Python downloads for Windows, macOS, and other platforms.",
    url: "https://www.python.org/downloads/",
    sourceKind: "catalog"
  },
  {
    keys: ["node", "nodejs", "node.js"],
    title: "Node.js Downloads",
    text: "Official Node.js download page with LTS and current releases.",
    url: "https://nodejs.org/en/download",
    sourceKind: "catalog"
  },
  {
    keys: ["git"],
    title: "Git Downloads",
    text: "Official Git download page for major operating systems.",
    url: "https://git-scm.com/downloads",
    sourceKind: "catalog"
  },
  {
    keys: ["docker", "docker desktop"],
    title: "Docker Desktop",
    text: "Official Docker Desktop download page for local container development.",
    url: "https://www.docker.com/products/docker-desktop/",
    sourceKind: "catalog"
  },
  {
    keys: ["chrome", "google chrome"],
    title: "Google Chrome Download",
    text: "Official Google Chrome download page.",
    url: "https://www.google.com/chrome/",
    sourceKind: "catalog"
  },
  {
    keys: ["firefox", "mozilla firefox"],
    title: "Mozilla Firefox Download",
    text: "Official Firefox browser download page from Mozilla.",
    url: "https://www.mozilla.org/firefox/new/",
    sourceKind: "catalog"
  },
  {
    keys: ["postman"],
    title: "Postman Downloads",
    text: "Official Postman desktop and agent download page.",
    url: "https://www.postman.com/downloads/",
    sourceKind: "catalog"
  },
  {
    keys: ["intellij", "intellij idea"],
    title: "IntelliJ IDEA Download",
    text: "Official JetBrains download page for IntelliJ IDEA.",
    url: "https://www.jetbrains.com/idea/download/",
    sourceKind: "catalog"
  },
  {
    keys: ["android studio"],
    title: "Android Studio Download",
    text: "Official Android Studio download page from Android Developers.",
    url: "https://developer.android.com/studio",
    sourceKind: "catalog"
  }
];

const CURATED_AI_BUILDERS = [
  {
    keys: ["website", "landing page", "site", "builder", "ai"],
    title: "Framer AI",
    text: "AI website builder with prompt-to-site workflows, publishing, and a fast path for landing pages. Free starting tier with paid plans for production sites.",
    url: "https://www.framer.com/ai/",
    sourceKind: "catalog"
  },
  {
    keys: ["website", "site", "builder", "ai"],
    title: "Webflow AI Site Builder",
    text: "Website builder with design control, CMS, and AI-assisted site generation. Paid-focused for production projects.",
    url: "https://webflow.com/ai-site-builder",
    sourceKind: "catalog"
  },
  {
    keys: ["app", "web app", "builder", "no-code", "project"],
    title: "Bubble",
    text: "No-code app builder for SaaS and internal tools. Strong for product workflows, databases, and custom logic. Paid-focused with starter access.",
    url: "https://bubble.io/",
    sourceKind: "catalog"
  },
  {
    keys: ["app", "mobile app", "flutter", "builder"],
    title: "FlutterFlow AI Gen",
    text: "Low-code mobile and web app builder with AI-assisted generation. Good for Flutter-based apps. Free and paid plans.",
    url: "https://flutterflow.io/ai-gen",
    sourceKind: "catalog"
  },
  {
    keys: ["agent", "workflow", "open-source", "builder", "ai"],
    title: "Dify",
    text: "Open-source AI app and agent builder with workflow orchestration, prompts, RAG, and deployment options. Free self-hosted path plus cloud plans.",
    url: "https://dify.ai/",
    sourceKind: "catalog"
  },
  {
    keys: ["agent", "workflow", "open-source", "builder", "ai"],
    title: "Flowise",
    text: "Open-source visual builder for LLM apps and agents, especially useful for self-hosted workflows and integrations.",
    url: "https://flowiseai.com/",
    sourceKind: "catalog"
  },
  {
    keys: ["fullstack", "web app", "builder", "ai"],
    title: "Bolt.new",
    text: "AI-assisted full-stack app builder that can scaffold and iterate quickly in the browser. Paid credit model.",
    url: "https://bolt.new/",
    sourceKind: "catalog"
  },
  {
    keys: ["ui", "frontend", "builder", "ai"],
    title: "v0",
    text: "AI UI builder focused on generating React and frontend code quickly. Useful for product shells and interface iteration. Free and paid usage tiers.",
    url: "https://v0.dev/",
    sourceKind: "catalog"
  },
  {
    keys: ["app", "product", "builder", "ai"],
    title: "Lovable",
    text: "AI app builder for quickly turning prompts into product prototypes and MVPs. Paid-focused with fast iteration.",
    url: "https://lovable.dev/",
    sourceKind: "catalog"
  },
  {
    keys: ["internal tool", "portal", "builder", "ai"],
    title: "Softr",
    text: "No-code builder for portals, internal tools, and client apps, with AI-assisted setup and paid production plans.",
    url: "https://www.softr.io/",
    sourceKind: "catalog"
  }
];

function shouldSkip(query) {
  return SKIP_PATTERNS.some((pattern) => pattern.test(query.trim()));
}

function normalizeQueryText(query) {
  return String(query || "")
    .trim()
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/[^A-Za-z0-9]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizeQuery(query) {
  const trimmed = normalizeQueryText(query);
  if (!trimmed) {
    return "";
  }

  const definitionMatch = trimmed.match(/^(?:what|who)\s+is\s+(.+?)\??$/i) || trimmed.match(/^define\s+(.+?)\??$/i);
  const base = definitionMatch ? definitionMatch[1].trim() : trimmed;
  const normalized = base.toLowerCase();
  return QUERY_ALIASES[normalized] || base;
}

function simplifySearchTopic(query, profile) {
  const canonical = canonicalizeQuery(query);
  if (!canonical) {
    return "";
  }

  let simplified = canonical;

  if (profile === "download") {
    const match = simplified.match(/\bdownload\s+(.+)$/i);
    if (match) {
      simplified = match[1].trim();
    }
  }

  simplified = simplified
    .replace(/\b(can|could|would|please|tell|show|find|search|look\s+for|i|me|my|want|need|know)\b/gi, " ")
    .replace(/\b(what|which|who|is|are|the|a|an)\b/gi, " ");

  if (profile === "download") {
    simplified = simplified.replace(/\b(download|installer|installation|setup|official link|get the link|download link)\b/gi, " ");
  }

  if (profile === "shopping") {
    simplified = simplified.replace(/\b(buy|purchase|worth buying|recommend|suggest|should)\b/gi, " ");
  }

  if (profile === "builder") {
    simplified = simplified.replace(/\b(best|top|recommend|suggest)\b/gi, " ");
    simplified = simplified.replace(/\bfor my project\b/gi, " ");
    simplified = simplified.replace(/\bfor project\b/gi, " ");
  }

  if (profile === "recommendation") {
    simplified = simplified.replace(/\b(best|top|recommend|suggest|options|alternatives)\b/gi, " ");
  }

  simplified = simplified.replace(/\s+/g, " ").trim();
  const normalized = simplified.toLowerCase();
  return QUERY_ALIASES[normalized] || simplified || canonical;
}

function searchProfileFromIntent(intent = null) {
  return intent?.searchProfile || "reference";
}

function cacheKeyFor(profile, query) {
  return `${profile}:${normalizeQueryText(query).toLowerCase()}`;
}

function readKnowledgeCache(profile, query) {
  const key = cacheKeyFor(profile, query);
  const cached = knowledgeCache.get(key);
  if (!cached) {
    return null;
  }
  if (cached.expiresAt <= Date.now()) {
    knowledgeCache.delete(key);
    return null;
  }
  return cached.value;
}

function writeKnowledgeCache(profile, query, value) {
  knowledgeCache.set(cacheKeyFor(profile, query), {
    value,
    expiresAt: Date.now() + KNOWLEDGE_CACHE_TTL_MS
  });
  return value;
}

function scoreCatalogEntry(entry, query, profile = "reference") {
  const normalizedQuery = simplifySearchTopic(query, profile).toLowerCase();
  const haystack = `${entry.title} ${entry.text} ${entry.keys.join(" ")}`.toLowerCase();
  let score = 0;

  for (const key of entry.keys) {
    if (normalizedQuery.includes(key.toLowerCase())) {
      score += 3;
    }
  }

  for (const token of normalizedQuery.split(/\s+/).filter(Boolean)) {
    if (token.length >= 3 && haystack.includes(token)) {
      score += 1;
    }
  }

  return score;
}

function curatedMatches(query, catalog, profile = "reference") {
  return catalog
    .map((entry) => ({ entry, score: scoreCatalogEntry(entry, query, profile) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.entry);
}

function buildSearchQueries(query, profile) {
  const topic = simplifySearchTopic(query, profile);
  if (!topic) {
    return [];
  }

  const variants = [topic];

  if (profile === "download") {
    variants.unshift(`${topic} official download`);
    variants.push(`${topic} github release`);
  } else if (profile === "shopping") {
    variants.unshift(`${topic} best price buy`);
    variants.push(`${topic} reviews`);
    variants.push(`${topic} compare pricing`);
  } else if (profile === "builder") {
    const builderTopic = /\bbuilders?\b/i.test(topic) ? topic : `${topic} AI builders`;
    variants.unshift(`${builderTopic} free paid`);
    variants.push(`${builderTopic} pricing`);
    variants.push(`${builderTopic} official`);
  } else if (profile === "recommendation") {
    variants.unshift(`${topic} best options`);
    variants.push(`${topic} compare pricing`);
  }

  return [...new Set(variants.map((item) => item.trim()).filter(Boolean))].slice(0, 3);
}

async function fetchTextWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), KNOWLEDGE_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJsonWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), KNOWLEDGE_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripTags(text) {
  return decodeEntities(String(text || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function fetchWikipediaSnippet(query) {
  const searchUrl =
    "https://en.wikipedia.org/w/api.php" +
    `?action=opensearch&search=${encodeURIComponent(query)}` +
    "&limit=1&namespace=0&format=json&origin=*";

  const searchData = await fetchJsonWithTimeout(searchUrl);
  const firstTitle = searchData?.[1]?.[0];
  if (!firstTitle) {
    return null;
  }

  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstTitle)}`;
  const summaryData = await fetchJsonWithTimeout(summaryUrl);
  const extract = summaryData?.extract?.trim();
  const pageUrl = summaryData?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(firstTitle)}`;

  if (!extract) {
    return null;
  }

  return {
    title: `Wikipedia: ${firstTitle}`,
    text: extract,
    url: pageUrl,
    sourceKind: "reference"
  };
}

function firstDuckDuckGoRelatedText(relatedTopics) {
  for (const item of relatedTopics || []) {
    if (item?.Text) {
      return item.Text;
    }
    if (Array.isArray(item?.Topics)) {
      const nested = firstDuckDuckGoRelatedText(item.Topics);
      if (nested) {
        return nested;
      }
    }
  }
  return "";
}

async function fetchDuckDuckGoSnippet(query) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
  const data = await fetchJsonWithTimeout(url);
  if (!data) {
    return null;
  }

  const abstract = (data.AbstractText || "").trim();
  const related = firstDuckDuckGoRelatedText(data.RelatedTopics).trim();
  const text = abstract || related;
  if (!text) {
    return null;
  }

  return {
    title: "DuckDuckGo",
    text,
    url: data.AbstractURL || "https://duckduckgo.com/",
    sourceKind: "reference"
  };
}

function parseBingItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match = itemRegex.exec(xml);

  while (match) {
    const block = match[1];
    const title = decodeEntities(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "").trim();
    const link = decodeEntities(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "").trim();
    const description = stripTags(block.match(/<description>([\s\S]*?)<\/description>/)?.[1] || "");

    if (title && link && description) {
      items.push({
        title,
        text: description,
        url: normalizeUrl(link),
        sourceKind: "search"
      });
    }

    match = itemRegex.exec(xml);
  }

  return items;
}

async function fetchBingWebResults(query, limit = SEARCH_RESULTS_PER_QUERY) {
  const url = `https://www.bing.com/search?format=rss&cc=us&setlang=en-US&q=${encodeURIComponent(query)}`;
  const xml = await fetchTextWithTimeout(url);
  if (!xml) {
    return [];
  }

  return parseBingItems(xml).slice(0, limit);
}

function scoreSnippet(snippet, profile, queryTokens) {
  const haystack = `${snippet.title} ${snippet.text} ${snippet.url}`.toLowerCase();
  const host = hostname(snippet.url);
  let score = 0;

  for (const token of queryTokens) {
    if (token.length >= 3 && haystack.includes(token)) {
      score += 1;
    }
  }

  if (profile === "reference") {
    if (host.endsWith("wikipedia.org")) {
      score += 4;
    }
    if (snippet.sourceKind === "reference") {
      score += 2;
    }
  }

  if (profile === "download") {
    if (snippet.sourceKind === "catalog") {
      score += 5;
    }
    if (/\b(download|install|installer|setup|release|releases|official)\b/i.test(haystack)) {
      score += 4;
    }
    if (/(github\.com|npmjs\.com|pypi\.org|python\.org|nodejs\.org|microsoft\.com|mozilla\.org|apple\.com|google\.com)/.test(host)) {
      score += 3;
    }
    if (/(stackoverflow\.com|reddit\.com|softonic|filehippo|uptodown|cnet)/.test(host)) {
      score -= 3;
    }
  }

  if (profile === "shopping") {
    if (/\b(buy|price|pricing|deal|review|reviews|compare|comparison)\b/i.test(haystack)) {
      score += 3;
    }
    if (/(amazon|flipkart|bestbuy|walmart|apple|samsung|microsoft|lenovo|dell|hp)/.test(host)) {
      score += 2;
    }
    if (host.endsWith("wikipedia.org")) {
      score -= 4;
    }
  }

  if (profile === "builder") {
    if (/\b(builder|ai|website|app|agent|automation|no-code|low-code|pricing|free|open source)\b/i.test(haystack)) {
      score += 3;
    }
    if (/(framer|bubble|webflow|replit|vercel|github|lovable|flutterflow|bolt|softr)/.test(host + haystack)) {
      score += 2;
    }
  }

  if (profile === "recommendation") {
    if (/\b(best|top|recommend|reviews|compare|comparison|pricing|features)\b/i.test(haystack)) {
      score += 2;
    }
  }

  return score;
}

function dedupeSnippets(snippets) {
  const deduped = [];
  const seen = new Set();

  for (const snippet of snippets) {
    const fingerprint = normalizeUrl(snippet.url || "") || `${snippet.title}|${snippet.text.slice(0, 120)}`;
    if (!fingerprint || seen.has(fingerprint)) {
      continue;
    }
    seen.add(fingerprint);
    deduped.push(snippet);
  }

  return deduped;
}

function rankSnippets(snippets, profile, query) {
  const queryTokens = simplifySearchTopic(query, profile)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  return [...snippets].sort((left, right) => {
    const scoreDiff = scoreSnippet(right, profile, queryTokens) - scoreSnippet(left, profile, queryTokens);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return left.title.localeCompare(right.title);
  });
}

function compactContext(snippets, profile) {
  const lines = [];
  let used = 0;
  const includeUrl = profile !== "reference";

  for (const snippet of snippets) {
    const cleaned = snippet.text.replace(/\s+/g, " ").trim();
    if (!cleaned) {
      continue;
    }

    const line = includeUrl
      ? `[${lines.length + 1}] ${snippet.title}: ${cleaned} [Source: ${snippet.url}]`
      : `[${lines.length + 1}] ${snippet.title}: ${cleaned}`;

    if (used + line.length > KNOWLEDGE_MAX_CHARS) {
      break;
    }

    lines.push(line);
    used += line.length;
  }

  return lines.join("\n");
}

export async function fetchKnowledgeContext(query, options = {}) {
  if (!ENABLE_WEB_KNOWLEDGE || shouldSkip(query)) {
    return { contextText: "", sources: [] };
  }

  const profile = searchProfileFromIntent(options.intent);
  const topicQuery = simplifySearchTopic(query, profile);
  const searchQueries = buildSearchQueries(query, profile);
  if (searchQueries.length === 0) {
    return { contextText: "", sources: [] };
  }

  const cached = readKnowledgeCache(profile, topicQuery || searchQueries[0]);
  if (cached) {
    return cached;
  }

  let rawSnippets = [];

  if (profile === "builder") {
    const curated = curatedMatches(query, CURATED_AI_BUILDERS, profile);
    rawSnippets = curated.slice(0, 5);
  } else if (profile === "reference") {
    const primaryQuery = searchQueries[0];
    const [wiki, duck] = await Promise.all([
      fetchWikipediaSnippet(primaryQuery),
      fetchDuckDuckGoSnippet(primaryQuery)
    ]);

    rawSnippets = [wiki, duck].filter(Boolean);
    if (rawSnippets.length === 0) {
      const web = await fetchBingWebResults(primaryQuery, 2);
      rawSnippets = web.filter(Boolean);
    }
  } else {
    const curated = profile === "download" ? curatedMatches(query, CURATED_DOWNLOADS, profile) : [];
    if (profile === "download" && curated.length > 0) {
      rawSnippets = curated.slice(0, 1);
    } else {
      const resultGroups = await Promise.all(searchQueries.map((searchQuery) => fetchBingWebResults(searchQuery, SEARCH_RESULTS_PER_QUERY)));
      rawSnippets = [...curated, ...resultGroups.flat().filter(Boolean)];
    }
  }

  if (rawSnippets.length === 0) {
    return { contextText: "", sources: [] };
  }

  const ranked = rankSnippets(dedupeSnippets(rawSnippets), profile, topicQuery || searchQueries[0]);
  const limited = ranked.slice(0, profile === "reference" ? 4 : 5);

  return writeKnowledgeCache(profile, topicQuery || searchQueries[0], {
    contextText: compactContext(limited, profile),
    sources: limited.map((snippet) => ({ title: snippet.title, url: snippet.url, text: snippet.text }))
  });
}
