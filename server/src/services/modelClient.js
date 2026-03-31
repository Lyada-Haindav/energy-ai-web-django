import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { normalizeNaturalLanguageText } from "./textNormalization.js";
import { normalizeWorkspaceMode } from "./workspaceMode.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_MAX_TOKENS = Number(process.env.MAX_TOKENS || 700);
const DEFAULT_TEMPERATURE = Number(process.env.TEMPERATURE || 0.4);
const PYTHON_LOCAL_BASE_URL = process.env.PYTHON_LOCAL_BASE_URL || "http://127.0.0.1:9001";
const ROUTER_FAST_TOKEN = /\bfast\b/i;
const ROUTER_DEEP_TOKEN = /\bdeep\b/i;
const GREETING_PATTERN = /^(hi|hello|hey|good\s+morning|good\s+evening|yo)\b/i;
const HOW_ARE_YOU_PATTERN = /^how\s+are\s+(you|u)\??$/i;
const ACK_PATTERN = /^(good|great|nice|awesome|cool|fine|okay|ok|understood|got it|thanks|thank you)\b/i;
const FAREWELL_PATTERN = /^(bye|goodbye|see\s+you|see\s+ya|talk\s+to\s+you\s+later|catch\s+you\s+later|later)\b/i;
const CAPABILITY_PATTERN = /^(what\s+can\s+you\s+do|what\s+all\s+can\s+you\s+do|how\s+can\s+you\s+help|help|help\s+me)\??$/i;
const CODING_START_PATTERN = /^(get\s+coding(?:\s+now)?|let'?s\s+code|start\s+coding|coding\s+now|code\s+now)\??$/i;
const WHAT_IS_PATTERN =
  /^(?:(?:can\s+i\s+know|do\s+you\s+know|tell\s+me|can\s+you\s+tell\s+me|could\s+you\s+tell\s+me|please\s+tell\s+me)\s+)?what\s+is\s+(.+?)\??$/i;
const SHORT_AMBIGUOUS_WHAT_IS_PATTERN =
  /^(?:(?:can\s+i\s+know|do\s+you\s+know|tell\s+me|can\s+you\s+tell\s+me|could\s+you\s+tell\s+me|please\s+tell\s+me)\s+)?what\s+is\s+([a-z0-9-]{1,4})\??$/i;
const PROJECT_PATTERN = /\b(build|create|start|launch|make)\b.*\b(project|app|website|product|model|agent)\b|\bproject\b/i;
const GENERIC_FOLLOWUP_PATTERN = /^(can\s+you\s+)?(explain|eplain|elaborate|details?|more|continue|why|how)(\b.*)?$/i;
const AFFIRMATIVE_EXPLAIN_PATTERN =
  /^(yes|yeah|yep|sure|ok|okay)(?:\s+(please\s+)?)?(explain|elaborate|details?|more|continue|again|with\s+examples?|in\s+simple\s+words)\??$/i;
const REWRITE_FOLLOWUP_PATTERN = /^(make\s+it(?:\s+(simple|simpler|short|shorter|clear|clearer|easy|easier|better|detailed))?)\??$/i;
const CONTEXT_FOLLOWUP_PATTERN =
  /\b(more|simple|simpler|easy|easier|understand|understanding|undderstanding|clear|clearly|detail|detailed|example|examples|elaborate|expand|again|continue|shorter|better)\b/i;
const DEPTH_REQUEST_PATTERN = /\b(deep|deeply|in\s*depth|detailed|step\s*by\s*step)\b/i;
const DAA_TOPIC_PATTERN = /\b(daa|design and analysis of algorithms|algorithms?|time complexity|space complexity|big\s*o)\b/i;
const ASSISTANT_IDENTITY_PATTERN =
  /^(what(?:'s| is)\s+your\s+name|who\s+are\s+you|which\s+model\s+are\s+you|which\s+model\s+you\s+are|what\s+is\s+your\s+model\s+name|what\s+model\s+are\s+you)\??$/i;
const ASSISTANT_CREATION_PATTERN =
  /^(?:(?:can|could)\s+i\s+know\s+)?how\s+(?:are\s+you|were\s+you|you)\s+(?:made|built|created|trained)\??$/i;
const ABUSIVE_PATTERN = /\b(fuck\s*off|idiot|stupid|dumb|moron|shut\s*up|useless|shit|bullshit)\b/i;
const CODING_PATTERN =
  /\b(code|coding|program|programming|algorithm|data structure|debug|bug|compile|build|api|react|javascript|typescript|python|java|c\+\+|sql|node)\b/i;
const CONTEST_PROMPT_PATTERN =
  /\b(leetcode|codeforces|codechef|hackerrank|contest|competitive programming|input format|output format|constraints?|given an array|given a string|given a graph|given a tree|given a grid|subarray|substring|mod(?:ulo)?\s+1e9\+7|return the|find the|minimize|maximize|at most|at least)\b|(?:n|m|k)\s*(?:<=|<)\s*\d+/i;
const CODING_CAPABILITY_PATTERN = /\b(all coding|know .*coding|coding knowledge|help .*coding|good .*coding)\b/i;
const CODE_REQUEST_PATTERN =
  /\b(write|give|show|create|implement|build|generate)\b.*\b(code|function|program|script)\b|\b(code for|function for)\b|\b(add(?:ing|ng)?|sum)\b.*\b(two|2|number|numbers|bumber|bumbers)\b.*\b(code|function|program)\b/i;
const CODE_ONLY_PATTERN = /^(code|show code|give code|send code|c code|python code|java code|javascript code|typescript code)\b/i;
const LANGUAGE_ONLY_PATTERN =
  /^(?:(?:give|show|write|send)(?:\s+it)?\s+)?(?:in\s+)?(python|javascript|js|typescript|ts|java|c\+\+|cpp|c|go|golang|rust)\b/i;
const KNOWN_CODE_TASK_PATTERN =
  /\b(add(?:ing|ng)?|factorial|fibonacci|prime|palindrome|reverse|string|binary\s+search|two\s*sum|sort|sorting|pos tagging|part of speech)\b/i;
const FULL_CODE_PATTERN =
  /\b(full code|complete code|whole code|full program|complete program|with main|main function|int main|where is int main|whwere is int main)\b/i;
const FULL_CODE_PREFERENCE_PATTERN =
  /\b(always|every\s*time|each\s*time|from\s+now\s+on|whenever|try\s+to\s+give(?:\s+me)?\s+everytime)\b.*\b(full code|complete code|full program|with main)\b/i;
const GENERAL_CAPABILITY_PATTERN = /\b(know everything|know all|all topics|everything)\b/i;
const ATTACHMENT_MARKER_PATTERN = /\[ATTACHED_FILES\][\s\S]*?\[\/ATTACHED_FILES\]/g;
const WORKSPACE_MODE_PATTERN = /\[WORKSPACE_MODE\]\nmode=([a-z-]+)[\s\S]*?\[\/WORKSPACE_MODE\]/i;
const WEAK_ATTACHMENT_PROMPT_PATTERN = /^(?:\.+|check|see|look|look at this|see this|this|it|attached|attachment|analyze|review|explain|summari[sz]e|read this|inspect this)\b/i;
const DOWNLOAD_REQUEST_PATTERN =
  /\b(download|installer|installation|setup|apk|exe|dmg|zip|tar\.gz|download link|official link|get the link)\b/i;
const SHOPPING_REQUEST_PATTERN =
  /\b(buy|purchase|best price|pricing|price|deal|budget|under\s+\$?\d+|recommend .* buy|which .* buy|worth buying)\b/i;
const BUILDER_REQUEST_PATTERN =
  /\b(ai builders?|website builders?|app builders?|landing page builders?|agent builders?|builder for my project|builder for project|no[-\s]?code|low[-\s]?code)\b/i;
const RECOMMENDATION_REQUEST_PATTERN = /\b(best|top|recommend|suggest|alternatives?|options?)\b/i;
const DATE_QUERY_PATTERN =
  /^(?:(?:can\s+i\s+know|tell\s+me|do\s+you\s+know)\s+)?(?:(?:what(?:'s| is)?|which)\s+)?(?:(today'?s?|current|now)\s+)?(date|day)(?:\s+(?:today|now|it\s+is|is\s+it))?\??$/i;
const TIME_QUERY_PATTERN =
  /^(?:(?:can\s+i\s+know|tell\s+me|do\s+you\s+know)\s+)?(?:(?:what(?:'s| is)?|which)\s+)?(?:(current|now|right now)\s+)?time(?:\s+(?:now|it\s+is|is\s+it))?\??$/i;
const CONFIRMATION_PATTERN = /^(is\s+(it|that|this)\s+true|is\s+(that|this)\s+(right|correct)|right|correct|really|are\s+you\s+sure)\??$/i;
const ARITHMETIC_PREFIX_PATTERN = /^(?:what\s+is|calculate|compute|evaluate|solve)\s+(.+?)\??$/i;
const SAFE_ARITHMETIC_PATTERN = /^[0-9+\-*/%().\s]+$/;
const RESPONSE_TIMEZONE = process.env.APP_TIMEZONE || process.env.TZ || "Asia/Kolkata";
const ownArtifactCache = new Map();
const TERM_ALIASES = {
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
  "artificial intelegence": "artificial intelligence",
  "artifical intelligence": "artificial intelligence"
};

const STOPWORDS = new Set([
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
  "that"
]);

const KNOWN_DEFINITIONS = {
  ai: "AI is software that performs tasks requiring pattern recognition, language understanding, and decision support.",
  "artificial intelligence":
    "Artificial intelligence (AI) is the capability of computer systems to perform tasks that normally require human intelligence, such as learning, reasoning, problem-solving, and language understanding.",
  "machine learning": "Machine learning is a method where models learn patterns from data rather than relying only on hand-written rules.",
  "deep learning": "Deep learning is a type of machine learning that uses multi-layer neural networks to model complex patterns.",
  "natural language processing":
    "Natural language processing is a field of AI focused on helping computers understand, analyze, and generate human language.",
  "computer vision":
    "Computer vision is a field of AI that helps machines interpret and understand images and video.",
  "internet of things":
    "The Internet of Things (IoT) refers to physical devices connected to the internet that collect, share, and act on data.",
  "application programming interface":
    "An API, or application programming interface, is a defined way for software systems to communicate and exchange data.",
  "user interface": "A user interface is the part of a system that people interact with directly, such as screens, buttons, and menus.",
  "user experience": "User experience focuses on how usable, efficient, and satisfying a product feels to the person using it.",
  "central processing unit": "The CPU is the main processor in a computer that executes instructions and coordinates system operations.",
  "graphics processing unit":
    "The GPU is a processor specialized for parallel computation, especially graphics, video, and AI workloads.",
  "random access memory": "RAM is short-term memory that stores data and programs currently in use for fast access.",
  "read-only memory": "ROM is non-volatile memory that stores permanent instructions needed to start or operate hardware.",
  "domain name system":
    "The Domain Name System (DNS) translates domain names like example.com into IP addresses that computers use to connect.",
  "transmission control protocol":
    "TCP is a reliable transport protocol that delivers ordered data packets between systems on a network.",
  "user datagram protocol":
    "UDP is a lightweight transport protocol that sends data quickly without guaranteeing delivery or ordering.",
  "structured query language": "SQL is a language used to define, query, and manage data in relational databases.",
  "json web token": "A JWT is a compact signed token commonly used for authentication and securely carrying claims between systems.",
  "database management system":
    "A DBMS is software that stores, organizes, retrieves, and manages data in a structured and efficient way.",
  "operating system":
    "An operating system is core system software that manages hardware, memory, files, and processes, and provides services to applications.",
  "object-oriented programming":
    "Object-oriented programming is a programming style based on objects that combine data and behavior through classes, instances, inheritance, and encapsulation.",
  "computer organization and architecture":
    "Computer Organization and Architecture studies how computer hardware is structured, how components interact, and how instruction sets map to machine behavior.",
  "theory of computation":
    "Theory of Computation studies what problems can be solved by machines and how efficiently they can be solved using formal models.",
  "software engineering":
    "Software engineering is the disciplined process of designing, building, testing, deploying, and maintaining software systems.",
  "apple mac":
    "Mac usually means Apple's Macintosh computers. Depending on context, it can refer to MacBook laptops, iMac desktops, or the Mac platform in general.",
  "apple macbook":
    "MacBook is Apple's laptop line. It runs macOS and is sold mainly as MacBook Air and MacBook Pro.",
  llm: "An LLM is a large language model trained on text to understand and generate human-like language.",
  rag: "RAG combines retrieval and generation: the model fetches relevant documents first, then answers using that evidence.",
  transformer: "A transformer is a neural architecture that uses attention to model relationships between tokens efficiently.",
  pysd:
    "PySD is a Python library for running System Dynamics models. It translates models from formats such as Vensim or XMILE into Python so you can simulate, inspect, and analyze them programmatically.",
  english:
    "English is a language from the Indo-European family and is widely used for communication, education, business, and technology around the world.",
  "computer network":
    "A computer network is a group of connected computers and devices that communicate and share data, resources, and services over wired or wireless links.",
  daa: "DAA stands for Design and Analysis of Algorithms. It focuses on creating efficient algorithms and analyzing their time and space complexity.",
  dsa: "DSA stands for Data Structures and Algorithms. It combines data organization with algorithm design to solve problems efficiently.",
  "design and analysis of algorithms":
    "Design and Analysis of Algorithms is the study of building correct algorithms and evaluating their efficiency using time and space complexity.",
  gf: "GF usually means girlfriend in chat. In technical contexts, GF can also mean Galois Field in mathematics and cryptography.",
  chai: "Chai is a tea drink made with black tea, milk, sugar, and spices such as cardamom, ginger, and cinnamon.",
  sex: "Sex can refer to biological classification (such as male, female, or intersex). In another context, it refers to consensual sexual activity between adults.",
  fuck: "The word 'fuck' is a profanity in English. It is often used as an insult, exclamation, or intensifier in informal speech.",
  fucking:
    "The word 'fucking' is a profanity used for emphasis or anger in informal speech. In polite or professional settings, it is usually avoided."
};

const LOW_QUALITY_PATTERNS = [
  /\bayy\s+lmao\b/i,
  /\bgrumpy cat\b/i,
  /\bbefore we wrap up\b/i,
  /\binterviewer\b/i,
  /\bhost\b/i,
  /\bi\s+o\s+n?\s*\d+/i,
  /\bepisode\b/i,
  /\banal douching\b/i,
  /\bcoastal county-level city\b/i,
  /\bdomain\s+\d+\s+is\b/i,
  /\b\d+\s+year old man\b/i,
  /\bcartoon character\b/i
];

const GENERIC_ASSISTANT_META_PATTERNS = [
  /^i can cover many topics\b/i,
  /^i can help with coding, debugging, explanations, planning, writing\b/i,
  /^i can help with direct answers, explanations, coding questions, and quick problem solving\b/i,
  /^i can help with deep reasoning, coding, debugging, architecture, planning, and detailed analysis\b/i,
  /\bask (?:any|your) question\b/i,
  /\bgive me a task\b/i,
  /\btell me your next question\b/i,
  /\bsend the problem statement, language, and constraints\b/i
];

function normalizePatternText(text) {
  return String(text || "")
    .trim()
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/[^A-Za-z0-9]+$/, "")
    .trim();
}

function compactResponseText(text) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*\d+[).]\s*/gm, "")
    .replace(/^\s*[-*]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasDeepSignal(text) {
  const signals = [
    /analy[sz]e/i,
    /step by step/i,
    /architecture/i,
    /trade-?off/i,
    /optimi[sz]e/i,
    /debug/i,
    /research/i,
    /compare/i,
    /design/i,
    /train/i,
    /model/i,
    /code/i,
    /production/i,
    /scal/i,
    /project/i,
    /roadmap/i,
    /plan/i,
    /deeply/i,
    /in[-\s]?depth/i,
    /detailed/i
  ];
  return signals.some((regex) => regex.test(text)) || text.trim().split(/\s+/).length > 120 || text.includes("\n");
}

function providerFor(role) {
  if (role === "fast") {
    return process.env.FAST_PROVIDER || "mock";
  }
  if (role === "deep") {
    return process.env.DEEP_PROVIDER || "mock";
  }
  return process.env.ROUTER_PROVIDER || "mock";
}

function modelFor(role) {
  if (role === "fast") {
    return process.env.FAST_MODEL || "energy-low-v1";
  }
  if (role === "deep") {
    return process.env.DEEP_MODEL || "energy-high-v1";
  }
  return process.env.ROUTER_MODEL || "energy-router-v1";
}

export function describeModelStack() {
  return {
    fast: {
      provider: providerFor("fast"),
      model: modelFor("fast")
    },
    deep: {
      provider: providerFor("deep"),
      model: modelFor("deep")
    },
    router: {
      provider: providerFor("router"),
      model: modelFor("router")
    }
  };
}

function synthesizeMockResponse(prompt, role) {
  const question = extractLatestUserText(prompt);
  const normalized = normalizePatternText(question);

  if (role === "router") {
    return hasDeepSignal(question) ? "deep" : "fast";
  }

  if (GREETING_PATTERN.test(normalized)) {
    return "Hi. How can I help today?";
  }

  if (HOW_ARE_YOU_PATTERN.test(normalized)) {
    return "I am doing well. What do you want help with?";
  }

  if (FAREWELL_PATTERN.test(normalized)) {
    return "Bye. If you need anything later, I will be here.";
  }

  if (CAPABILITY_PATTERN.test(normalized)) {
    return role === "deep"
      ? "I can help with deep reasoning, coding, debugging, architecture, planning, and detailed analysis."
      : "I can help with direct answers, explanations, coding questions, and quick problem solving.";
  }
  return generateRuleBasedResponse(role, prompt, null, { sources: [] });
}

function ownModelsDir() {
  if (process.env.OWN_MODELS_DIR) {
    return path.resolve(process.env.OWN_MODELS_DIR);
  }
  return path.resolve(__dirname, "../../../training/checkpoints/own");
}

async function loadOwnArtifact(role) {
  const modelDir = ownModelsDir();
  const cacheKey = `${modelDir}:${role}`;

  if (ownArtifactCache.has(cacheKey)) {
    return ownArtifactCache.get(cacheKey);
  }

  const artifactPath = path.join(modelDir, `${role}.json`);
  let parsed;

  try {
    const raw = await fs.readFile(artifactPath, "utf-8");
    parsed = JSON.parse(raw);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }

    const compressedPath = path.join(modelDir, `${role}.json.gz`);
    const compressed = await fs.readFile(compressedPath);
    parsed = JSON.parse(gunzipSync(compressed).toString("utf-8"));
  }

  if (Array.isArray(parsed?.pairs) && !(parsed.__retrievalIndex instanceof Map)) {
    const retrievalIndex = new Map();

    parsed.pairs.forEach((pair, index) => {
      const promptTokens = Array.isArray(pair.prompt_tokens) ? pair.prompt_tokens : tokenizeWords(pair.prompt || "");
      const filteredTokens = [...new Set(filterTokens(promptTokens))];
      pair._promptTokens = filteredTokens;

      for (const token of filteredTokens) {
        const existing = retrievalIndex.get(token);
        if (existing) {
          existing.push(index);
        } else {
          retrievalIndex.set(token, [index]);
        }
      }
    });

    parsed.__retrievalIndex = retrievalIndex;
  }

  ownArtifactCache.set(cacheKey, parsed);
  return parsed;
}

export function clearOwnArtifactCache() {
  ownArtifactCache.clear();
}

export async function primeOwnArtifacts() {
  const roles = ["fast", "deep", "router"];
  const eligibleRoles = roles.filter((role) => providerFor(role) === "own");

  for (const role of eligibleRoles) {
    await loadOwnArtifact(role);
  }
}

function extractLatestUserText(prompt) {
  const userIndex = prompt.lastIndexOf("USER:");
  if (userIndex === -1) {
    return prompt.slice(-700).trim();
  }

  const fromUser = prompt.slice(userIndex + 5);
  const assistantIndex = fromUser.lastIndexOf("ASSISTANT:");
  const content = assistantIndex === -1 ? fromUser : fromUser.slice(0, assistantIndex);
  return content.trim();
}

function extractUserTurns(prompt) {
  const turns = [];
  const regex = /USER:\s*([\s\S]*?)(?=\n(?:USER|ASSISTANT):|$)/g;
  let match = regex.exec(prompt);

  while (match) {
    const content = match[1].trim();
    if (content) {
      turns.push(content);
    }
    match = regex.exec(prompt);
  }

  return turns;
}

function extractAssistantTurns(prompt) {
  const turns = [];
  const regex = /ASSISTANT:\s*([\s\S]*?)(?=\n(?:USER|ASSISTANT):|$)/g;
  let match = regex.exec(prompt);

  while (match) {
    const content = match[1].trim();
    if (content) {
      turns.push(content);
    }
    match = regex.exec(prompt);
  }

  return turns;
}

function extractKnowledgeContext(prompt) {
  const match = prompt.match(/\[KNOWLEDGE_CONTEXT\]\n([\s\S]*?)\n\[\/KNOWLEDGE_CONTEXT\]/);
  return match?.[1]?.trim() || "";
}

function extractWorkspaceMode(prompt) {
  const match = String(prompt || "").match(WORKSPACE_MODE_PATTERN);
  return normalizeWorkspaceMode(match?.[1] || "general");
}

function stripAttachmentContext(text) {
  return String(text || "").replace(ATTACHMENT_MARKER_PATTERN, "").replace(/\n{3,}/g, "\n\n").trim();
}

function extractAttachmentsFromText(text) {
  const source = String(text || "");
  const blocks = [];
  const regex =
    /\[FILE_(\d+)\]\nname=(.+?)\nlanguage=(.+?)\nsize=(.+?)\ntruncated=(yes|no)\ncontent:\n```([a-zA-Z0-9_+-]*)\n([\s\S]*?)\n```\n\[\/FILE_\1\]/g;
  let match = regex.exec(source);

  while (match) {
    blocks.push({
      id: match[1],
      name: match[2].trim(),
      language: (match[3] || match[6] || "text").trim(),
      size: Number(match[4]) || 0,
      truncated: match[5] === "yes",
      content: String(match[7] || "").trim()
    });
    match = regex.exec(source);
  }

  return blocks;
}

function attachmentDescriptor(attachment) {
  return `${attachment.name} (${attachment.language})`;
}

function shouldReuseRecentAttachments(currentText, previousPlainText = "") {
  const trimmed = String(currentText || "").trim();
  if (!trimmed) {
    return true;
  }

  if (isLowInformationPrompt(trimmed)) {
    return true;
  }

  if (isContextualFollowup(trimmed, previousPlainText)) {
    return true;
  }

  return /\b(this|attached|attachment|file|page|html|code|structure|review|debug|fix|bug|issue|improve|responsive|accessibility|explain|continue|again|more)\b/i.test(
    trimmed
  );
}

function summarizeHtmlAttachment(attachment) {
  const content = String(attachment.content || "");
  const lowered = content.toLowerCase();
  const notes = [];
  const issues = [];
  const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
  const sections = [
    /<header\b/i.test(content) ? "header" : "",
    /<nav\b/i.test(content) ? "nav" : "",
    /<main\b/i.test(content) ? "main" : "",
    /<section\b/i.test(content) ? "section" : "",
    /<footer\b/i.test(content) ? "footer" : ""
  ].filter(Boolean);

  if (titleMatch?.[1]) {
    notes.push(`Page title: ${titleMatch[1].trim()}.`);
  }
  if (sections.length > 0) {
    notes.push(`Main structure includes ${sections.join(", ")}.`);
  }
  if (/<form\b/i.test(content)) {
    notes.push("Contains a form flow.");
  }
  if (/<script\b/i.test(content)) {
    notes.push("Contains script tags.");
  }
  if (/<style\b/i.test(content) || /\sstyle=/.test(content)) {
    notes.push("Uses CSS styling in the file.");
  }

  if (!/<meta[^>]+name=["']viewport["']/i.test(lowered)) {
    issues.push("Missing viewport meta tag for mobile scaling.");
  }
  if (!/<html[^>]+\blang=/i.test(lowered)) {
    issues.push("Missing `lang` attribute on the `<html>` tag.");
  }

  const imagesWithoutAlt = [...content.matchAll(/<img\b(?![^>]*\balt=)[^>]*>/gi)].length;
  if (imagesWithoutAlt > 0) {
    issues.push(`${imagesWithoutAlt} image tag(s) do not include alt text.`);
  }

  const inlineStyleCount = [...content.matchAll(/\sstyle=/gi)].length;
  if (inlineStyleCount > 0) {
    issues.push(`${inlineStyleCount} inline style attribute(s) may make maintenance harder.`);
  }

  return {
    notes,
    issues
  };
}

function summarizeSourceAttachment(attachment) {
  const content = String(attachment.content || "");
  const lines = content.split("\n").filter(Boolean).length;
  const notes = [`Looks like a ${attachment.language} source file with about ${lines} non-empty lines.`];

  if (/^\s*import\b/m.test(content)) {
    notes.push("Includes imports.");
  }
  if (/^\s*export\b/m.test(content)) {
    notes.push("Exports code for reuse.");
  }
  if (/\bfunction\b|\=\>\s*[{(]/.test(content)) {
    notes.push("Contains function logic.");
  }
  if (/\bclass\b/.test(content)) {
    notes.push("Contains class-based structure.");
  }
  if (/<[A-Za-z][^>]*>/.test(content) && /return\s*\(/.test(content)) {
    notes.push("Looks related to UI markup or a component render path.");
  }

  return {
    notes,
    issues: []
  };
}

function summarizeAttachment(attachment) {
  if (attachment.language === "html") {
    return summarizeHtmlAttachment(attachment);
  }

  return summarizeSourceAttachment(attachment);
}

function attachmentActionPrompt(attachments, workspaceMode = "general") {
  const names = attachments.map((attachment) => `\`${attachment.name}\``).join(", ");
  const modeLine = workspaceMode !== "general" ? `Active workspace mode: \`${workspaceMode}\`.` : "";
  return [
    `I still have ${names} in context.`,
    modeLine,
    "",
    "Tell me what you want next:",
    "- `review this file for bugs and bad patterns`",
    "- `explain the structure of this file step by step`",
    "- `improve responsiveness, accessibility, or code quality here`",
    "- `rewrite this file with the improvements`"
  ].join("\n");
}

function attachmentStructureResponse(attachments) {
  const primary = attachments[0];
  if (!primary) {
    return "";
  }

  if (primary.language === "html") {
    const content = String(primary.content || "");
    const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
    const hasHead = /<head\b/i.test(content);
    const hasHeader = /<header\b/i.test(content);
    const hasNav = /<nav\b/i.test(content);
    const hasMain = /<main\b/i.test(content);
    const hasSection = /<section\b/i.test(content);
    const hasFooter = /<footer\b/i.test(content);
    const hasScript = /<script\b/i.test(content);

    return [
      `1) File role`,
      `- \`${primary.name}\` is the page shell for ${titleMatch?.[1]?.trim() || "this view"}.`,
      "",
      "2) Document setup",
      hasHead
        ? "- The `<head>` section sets page metadata and the tab title."
        : "- The file should ideally include a `<head>` section for metadata and title.",
      "",
      "3) Page layout",
      hasHeader ? "- `<header>` is the top brand/intro area." : "",
      hasNav ? "- `<nav>` holds navigation links or menu structure." : "",
      hasMain ? "- `<main>` contains the primary page content." : "",
      hasSection ? "- `<section>` breaks the main content into a focused block." : "",
      hasFooter ? "- `<footer>` closes the page with secondary information or links." : "",
      "",
      "4) Behavior layer",
      hasScript
        ? "- Script tags add interactive behavior after the layout is rendered."
        : "- There is no script layer here, so the page is mostly static markup.",
      "",
      "5) What to inspect next",
      "- Check whether the landmarks match the visual sections users actually see.",
      "- Verify mobile support, accessibility labels, and whether scripts depend on elements being present."
    ]
      .filter(Boolean)
      .join("\n");
  }

  const summary = summarizeAttachment(primary);
  return [
    "1) File role",
    `- \`${primary.name}\` is a ${primary.language} file.`,
    "",
    "2) High-level structure",
    ...summary.notes.map((note) => `- ${note}`),
    "",
    "3) What to inspect next",
    "- Trace the main entry points first.",
    "- Then inspect state/data flow, side effects, and output/render logic."
  ].join("\n");
}

function attachmentReviewResponse(attachments) {
  const primary = attachments[0];
  if (!primary) {
    return "";
  }

  const summary = summarizeAttachment(primary);
  const strengths = [];

  if (primary.language === "html") {
    const content = String(primary.content || "");
    if (/<header\b/i.test(content) || /<nav\b/i.test(content) || /<main\b/i.test(content) || /<footer\b/i.test(content)) {
      strengths.push("Uses semantic layout landmarks, which is a good base for accessibility and maintainability.");
    }
    if (/<title[^>]*>[^<]+<\/title>/i.test(content)) {
      strengths.push("Defines a page title.");
    }
    if (/<script\b/i.test(content)) {
      strengths.push("Already has a behavior layer, so interaction upgrades can be added without restructuring the whole page.");
    }
  } else {
    strengths.push(...summary.notes);
  }

  const issues = summary.issues.length > 0 ? summary.issues : ["No obvious structural issue jumped out from the attached excerpt, but a deeper file-by-file review would still be useful."];

  const fixes =
    primary.language === "html"
      ? [
          summary.issues.some((issue) => issue.includes("viewport"))
            ? "Add `<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">` in `<head>`."
            : "",
          summary.issues.some((issue) => issue.includes("`lang`"))
            ? "Add `lang=\"en\"` on the `<html>` tag."
            : "",
          summary.issues.some((issue) => issue.includes("alt text"))
            ? "Add meaningful `alt` text to informative images, and empty alt text only for decorative ones."
            : "",
          summary.issues.some((issue) => issue.includes("inline style"))
            ? "Move repeated inline styling into CSS classes for easier maintenance and responsiveness."
            : "",
          "Check that navigation items, buttons, and form controls have visible labels and keyboard focus styles."
        ].filter(Boolean)
      : ["Trace the main entry points, shared state, and any side effects before changing implementation details."];

  return [
    "1) Good parts",
    ...strengths.map((item) => `- ${item}`),
    "",
    "2) Review findings",
    ...issues.map((item) => `- ${item}`),
    "",
    "3) First fixes to make",
    ...fixes.map((item) => `- ${item}`)
  ].join("\n");
}

function attachmentImprovementResponse(attachments) {
  const primary = attachments[0];
  if (!primary) {
    return "";
  }

  if (primary.language === "html") {
    const summary = summarizeAttachment(primary);
    const suggestions = [
      "Add a responsive viewport meta tag so the layout scales correctly on phones.",
      "Use fluid widths, `max-width`, and stacked mobile breakpoints instead of fixed desktop-only spacing.",
      "Make navigation and major sections collapse cleanly on smaller screens.",
      "Add `lang` on `<html>` and meaningful `alt` text to images for accessibility.",
      "Ensure buttons, links, and any interactive elements have visible focus states and accessible labels.",
      "Move repeated presentational styles into reusable CSS classes if they are currently inline."
    ];

    return [
      "1) Responsiveness upgrades",
      "- Add `<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">` if it is missing.",
      "- Audit containers, grids, and navigation so they adapt to narrow screens without horizontal overflow.",
      "- Prefer flexible spacing and typography scaling for mobile.",
      "",
      "2) Accessibility upgrades",
      ...[
        summary.issues.some((issue) => issue.includes("`lang`")) ? "Add `lang=\"en\"` on `<html>`." : "Keep semantic landmarks and verify heading order.",
        summary.issues.some((issue) => issue.includes("alt text")) ? "Add alt text to images that communicate content." : "Verify interactive elements are keyboard reachable.",
        "Check color contrast and visible focus styling."
      ].map((item) => `- ${item}`),
      "",
      "3) Code quality upgrades",
      ...suggestions.slice(3).map((item) => `- ${item}`),
      "",
      "4) Best next step",
      "- Ask me `rewrite this file with the improvements` if you want concrete HTML/CSS changes."
    ].join("\n");
  }

  return [
    "1) Improve structure",
    "- Split large responsibilities into smaller focused units.",
    "- Name key functions/components by intent instead of implementation detail.",
    "",
    "2) Improve maintainability",
    "- Reduce duplicated logic.",
    "- Centralize shared constants and validation.",
    "",
    "3) Improve reliability",
    "- Add guards for bad input, loading states, and error handling.",
    "- Add lightweight tests around the main behavior before refactoring."
  ].join("\n");
}

function detectAttachmentStack(attachments) {
  const tags = new Set();
  const evidence = [];

  function add(tag, clue) {
    tags.add(tag);
    if (clue && evidence.length < 6) {
      evidence.push(clue);
    }
  }

  attachments.forEach((attachment) => {
    const name = String(attachment.name || "").toLowerCase();
    const content = String(attachment.content || "");

    if (attachment.language === "html" || name.endsWith(".html")) {
      add("HTML", `${attachment.name} is an HTML document.`);
    }
    if (attachment.language === "css" || name.endsWith(".css")) {
      add("CSS", `${attachment.name} adds stylesheet logic.`);
    }
    if (attachment.language === "javascript" || name.endsWith(".js") || name.endsWith(".mjs")) {
      add("JavaScript", `${attachment.name} is a JavaScript file.`);
    }
    if (attachment.language === "typescript" || name.endsWith(".ts") || name.endsWith(".tsx")) {
      add("TypeScript", `${attachment.name} is a TypeScript file.`);
    }
    if (attachment.language === "python" || name.endsWith(".py")) {
      add("Python", `${attachment.name} is a Python file.`);
    }
    if (name === "package.json") {
      add("Node.js", `${attachment.name} usually marks a Node-based project.`);
    }
    if (name.includes("vite.config")) {
      add("Vite", `${attachment.name} suggests a Vite setup.`);
    }
    if (name.includes("tailwind.config") || /\bclassName\s*=\s*["'][^"']*(?:px-|py-|mx-|my-|text-|bg-)/.test(content)) {
      add("Tailwind CSS", `${attachment.name} shows Tailwind-style utility usage.`);
    }
    if (/\buseState\b|\buseEffect\b|from\s+["']react["']|className=/.test(content) || /\.(jsx|tsx)$/i.test(name)) {
      add("React", `${attachment.name} contains React-style component hints.`);
    }
    if (/\bexpress\s*\(|\bapp\.use\s*\(|\brouter\./.test(content)) {
      add("Express", `${attachment.name} contains Express server patterns.`);
    }
    if (/\bmongo(db|ose)?\b/i.test(content)) {
      add("MongoDB", `${attachment.name} references MongoDB-related APIs.`);
    }
    if (/\bfetch\s*\(|axios|\/api\//i.test(content)) {
      add("HTTP API layer", `${attachment.name} contains network or API calls.`);
    }
  });

  return {
    tags: Array.from(tags),
    evidence
  };
}

function attachmentBugFixResponse(attachments) {
  const primary = attachments[0];
  const summary = primary ? summarizeAttachment(primary) : { issues: [], notes: [] };
  const likelyCauses =
    primary?.language === "html"
      ? [
          summary.issues.some((issue) => issue.includes("viewport")) ? "Mobile layout can break because viewport metadata is missing." : "",
          summary.issues.some((issue) => issue.includes("alt text")) ? "Accessibility issues are likely because images are missing descriptive alt text." : "",
          "Interactive elements may feel broken when focus states, labels, or event wiring are weak."
        ].filter(Boolean)
      : [
          "Check the first failing entry point, side effects, and assumptions about missing or undefined data.",
          "Verify whether shared state or async flow is producing stale or incomplete values."
        ];

  return [
    "1) Likely root causes",
    ...(likelyCauses.length > 0 ? likelyCauses : ["The attached excerpt does not expose a single obvious root cause yet."]).map((item) => `- ${item}`),
    "",
    "2) What to inspect first",
    "- Reproduce the failure with the smallest possible path.",
    "- Check the nearest inputs, event handlers, and state or DOM assumptions around the broken area.",
    "",
    "3) Fastest safe fix path",
    "- Patch the highest-confidence issue first.",
    "- Re-test the exact failure case and one nearby edge case before moving on."
  ].join("\n");
}

function attachmentTestsResponse(attachments) {
  const primary = attachments[0];
  const htmlLike = primary?.language === "html";
  const tests = htmlLike
    ? [
        "Render smoke test for the main landmarks and heading content.",
        "Responsive layout check around small mobile widths.",
        "Accessibility checks for alt text, heading order, and keyboard focus.",
        "Navigation or button interaction test for the main call to action."
      ]
    : [
        "Happy-path unit test for the primary function or component behavior.",
        "Edge-case test around empty, null, or malformed input.",
        "Failure-path test for async errors or invalid state.",
        "Regression test that locks in the current expected output."
      ];

  return [
    "1) Best test targets",
    ...tests.map((item) => `- ${item}`),
    "",
    "2) Test strategy",
    "- Start with one smoke test and one failure-path test.",
    "- Add focused edge cases only after the main flow is protected."
  ].join("\n");
}

function attachmentAccessibilityResponse(attachments) {
  const primary = attachments[0];
  const summary = primary ? summarizeAttachment(primary) : { issues: [] };
  const lines = [
    "1) Accessibility focus",
    "- Verify semantic landmarks, heading order, labels, and keyboard reachability.",
    "- Check visible focus states and contrast on interactive controls."
  ];

  if (summary.issues.some((issue) => issue.includes("alt text"))) {
    lines.push("- Add meaningful alt text to informative images.");
  }
  if (summary.issues.some((issue) => issue.includes("`lang`"))) {
    lines.push("- Add `lang` to the root HTML tag.");
  }

  lines.push("", "2) Best next fix", "- Start with missing semantics and focus styling before cosmetic cleanup.");
  return lines.join("\n");
}

function attachmentPerformanceResponse() {
  return [
    "1) Performance review",
    "- Look for unnecessary large media, repeated DOM work, and blocking scripts or styles.",
    "- Prefer smaller payloads, lazy behavior where possible, and stable layouts on first render.",
    "",
    "2) First wins",
    "- Compress heavy assets and avoid oversized images.",
    "- Remove duplicate work in render or event paths.",
    "- Keep layout and script initialization lightweight on mobile."
  ].join("\n");
}

function attachmentSecurityResponse() {
  return [
    "1) Security review focus",
    "- Validate all external input and trust boundaries.",
    "- Check auth assumptions, secret handling, and unsafe DOM or HTML injection paths.",
    "",
    "2) First checks",
    "- Make sure user-controlled data is escaped or sanitized before rendering.",
    "- Verify protected actions require the right auth and validation layers.",
    "- Check that tokens, API keys, and private values are never exposed in client code."
  ].join("\n");
}

function attachmentLintResponse() {
  return [
    "1) Lint and code-quality pass",
    "- Standardize naming, spacing, and repeated patterns.",
    "- Remove dead branches, unused values, and noisy inline styling.",
    "- Keep imports, exports, and component or function boundaries consistent.",
    "",
    "2) Best next fix",
    "- Clean the highest-noise patterns first so real bugs become easier to spot."
  ].join("\n");
}

function attachmentApiContractResponse() {
  return [
    "1) API contract review",
    "- Identify request shape, response shape, auth expectations, and validation rules.",
    "- Check error states, empty states, and versioning assumptions.",
    "",
    "2) Best next checks",
    "- Make sure clients and server agree on required fields and status codes.",
    "- Add explicit handling for invalid input, missing auth, and unexpected backend failures."
  ].join("\n");
}

function attachmentErrorLogResponse(attachments) {
  const primary = attachments[0];
  const content = String(primary?.content || "");
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 14);
  const interesting = lines.filter((line) => /(error|exception|failed|trace|warning)/i.test(line)).slice(0, 5);

  return [
    "1) Log highlights",
    ...(interesting.length > 0 ? interesting : lines.slice(0, 5)).map((line) => `- ${line}`),
    "",
    "2) Root-cause workflow",
    "- Start from the first real error, not the later cascade.",
    "- Match the failing function, file, or endpoint to the closest code path in the project.",
    "- Verify inputs, config, and environment assumptions around that point."
  ].join("\n");
}

function attachmentStackDetectResponse(attachments) {
  const detected = detectAttachmentStack(attachments);
  const tags = detected.tags.length > 0 ? detected.tags : ["No strong stack signal yet from the current files."];
  const nextFiles = ["package.json", "vite.config.*", "tailwind.config.*", "tsconfig.json", "server entrypoints", ".env example"];

  return [
    "1) Likely stack",
    ...tags.map((tag) => `- ${tag}`),
    "",
    "2) Evidence",
    ...(detected.evidence.length > 0 ? detected.evidence : ["- The current attachment set is too small for a stronger stack read."]),
    "",
    "3) Best next files to attach",
    ...nextFiles.map((file) => `- ${file}`)
  ].join("\n");
}

function attachmentModeResponse(workspaceMode, attachments) {
  switch (workspaceMode) {
    case "code-review":
      return attachmentReviewResponse(attachments);
    case "bug-fix":
      return attachmentBugFixResponse(attachments);
    case "refactor":
      return attachmentImprovementResponse(attachments);
    case "tests":
      return attachmentTestsResponse(attachments);
    case "explain-code":
      return attachmentStructureResponse(attachments);
    case "error-log":
      return attachmentErrorLogResponse(attachments);
    case "api-contract":
      return attachmentApiContractResponse(attachments);
    case "a11y":
      return attachmentAccessibilityResponse(attachments);
    case "performance":
      return attachmentPerformanceResponse(attachments);
    case "security":
      return attachmentSecurityResponse(attachments);
    case "stack-detect":
      return attachmentStackDetectResponse(attachments);
    case "lint":
      return attachmentLintResponse(attachments);
    default:
      return "";
  }
}

function workspaceModeKickoffResponse(workspaceMode) {
  if (!workspaceMode || workspaceMode === "general") {
    return "";
  }

  return [
    `Workspace mode active: ${titleCase(workspaceMode)}.`,
    "",
    "Send the code, file, repo context, or error details you want me to inspect.",
    "I will stay focused on that mode instead of giving a generic answer."
  ].join("\n");
}

function titleFromAttachmentName(name) {
  const base = String(name || "Page")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return base ? base.replace(/\b\w/g, (char) => char.toUpperCase()) : "Page";
}

function inferAltTextFromTag(tag) {
  const srcMatch = String(tag || "").match(/\bsrc=["']?([^"' >]+)["']?/i);
  if (!srcMatch?.[1]) {
    return "Content image";
  }

  const fileName = srcMatch[1].split("/").pop() || "";
  const normalized = fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
  if (!normalized) {
    return "Content image";
  }

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function ensureHtmlHead(documentText, title) {
  let updated = documentText;
  const changes = [];

  if (!/<head\b/i.test(updated)) {
    const headBlock = [
      "<head>",
      '  <meta charset="UTF-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      `  <title>${title}</title>`,
      "</head>"
    ].join("\n");

    if (/<html\b[^>]*>/i.test(updated)) {
      updated = updated.replace(/<html\b[^>]*>/i, (match) => `${match}\n${headBlock}`);
    } else {
      updated = `${headBlock}\n${updated}`;
    }

    changes.push("Created a `<head>` section with charset, viewport, and title.");
    return { updated, changes };
  }

  if (!/<meta\b[^>]*charset=/i.test(updated)) {
    updated = updated.replace(/<head\b[^>]*>/i, (match) => `${match}\n  <meta charset="UTF-8">`);
    changes.push("Added UTF-8 charset metadata.");
  }

  if (!/<meta\b[^>]*name=["']viewport["']/i.test(updated)) {
    updated = updated.replace(/<head\b[^>]*>/i, (match) => `${match}\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">`);
    changes.push("Added mobile viewport metadata.");
  }

  if (!/<title\b[^>]*>[\s\S]*?<\/title>/i.test(updated)) {
    updated = updated.replace(/<head\b[^>]*>/i, (match) => `${match}\n  <title>${title}</title>`);
    changes.push("Added a document title.");
  }

  return { updated, changes };
}

function addHtmlImprovementStyles(documentText) {
  const marker = "/* energy-ai responsive hardening */";
  if (documentText.includes(marker)) {
    return {
      updated: documentText,
      changes: []
    };
  }

  const styleBlock = [
    "<style>",
    `  ${marker}`,
    "  * { box-sizing: border-box; }",
    "  html { -webkit-text-size-adjust: 100%; }",
    "  body { margin: 0; }",
    "  img, svg, video { max-width: 100%; height: auto; display: block; }",
    "  a:focus-visible, button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible {",
    "    outline: 3px solid #7c3aed;",
    "    outline-offset: 2px;",
    "  }",
    "  @media (max-width: 768px) {",
    "    body { overflow-x: hidden; }",
    "    header, nav, main, section, footer {",
    "      width: 100%;",
    "      max-width: 100%;",
    "    }",
    "  }",
    "</style>"
  ].join("\n");

  if (/<\/head>/i.test(documentText)) {
    return {
      updated: documentText.replace(/<\/head>/i, `${styleBlock}\n</head>`),
      changes: ["Added a lightweight responsive and focus-visible CSS hardening block."]
    };
  }

  return {
    updated: `${styleBlock}\n${documentText}`,
    changes: ["Added a lightweight responsive and focus-visible CSS hardening block."]
  };
}

function rewriteHtmlAttachment(attachment) {
  let updated = String(attachment.content || "").trim();
  const changes = [];
  const title = titleFromAttachmentName(attachment.name);

  if (!/^<!doctype html>/i.test(updated)) {
    updated = `<!doctype html>\n${updated}`;
    changes.push("Added the HTML5 doctype.");
  }

  if (/<html\b/i.test(updated) && !/<html\b[^>]*\blang=/i.test(updated)) {
    updated = updated.replace(/<html\b([^>]*)>/i, '<html lang="en"$1>');
    changes.push("Added `lang=\"en\"` to the `<html>` tag.");
  }

  const headResult = ensureHtmlHead(updated, title);
  updated = headResult.updated;
  changes.push(...headResult.changes);

  const beforeAlt = updated;
  updated = updated.replace(/<img\b(?![^>]*\balt=)([^>]*)>/gi, (match, attrs) => `<img${attrs} alt="${inferAltTextFromTag(match)}">`);
  if (updated !== beforeAlt) {
    changes.push("Added fallback `alt` text to images that were missing it.");
  }

  const styleResult = addHtmlImprovementStyles(updated);
  updated = styleResult.updated;
  changes.push(...styleResult.changes);

  return {
    updated,
    changes: [...new Set(changes)]
  };
}

function attachmentRewriteResponse(attachments) {
  const primary = attachments[0];
  if (!primary) {
    return "";
  }

  if (primary.language === "html") {
    const rewritten = rewriteHtmlAttachment(primary);
    return [
      "1) Changes applied",
      ...rewritten.changes.map((item) => `- ${item}`),
      "",
      "2) Rewritten HTML",
      "```html",
      rewritten.updated,
      "```"
    ].join("\n");
  }

  return [
    `I can rewrite \`${primary.name}\`, but this first pass is optimized for HTML attachments.`,
    "Tell me whether you want a refactor, bug fix, cleanup, or performance pass for the file."
  ].join("\n");
}

function shouldUseAttachmentAnalysis(userText, context) {
  if (!Array.isArray(context.attachments) || context.attachments.length === 0) {
    return false;
  }

  const plainPrompt = String(context.plainUserText || "").trim();
  if (!plainPrompt) {
    return true;
  }

  if (isLowInformationPrompt(plainPrompt) || WEAK_ATTACHMENT_PROMPT_PATTERN.test(normalizePatternText(plainPrompt))) {
    return true;
  }

  const words = countWords(plainPrompt);
  return (
    words <= 10 &&
    /\b(review|analy[sz]e|explain|summari[sz]e|inspect|check|read|debug|fix|bug|issue|error|problem|improve|responsive|responsiveness|accessibility|quality|mobile|ui|rewrite|update|regenerate|better|stack|framework|technology|tech|test|tests|security|performance|lint|contract|log)\b/i.test(
      plainPrompt
    )
  );
}

function attachmentAnalysisResponse(userText, context) {
  const attachments = Array.isArray(context.attachments) ? context.attachments : [];
  if (attachments.length === 0) {
    return "";
  }

  const plainPrompt = String(context.plainUserText || "").trim();
  const normalizedPlainPrompt = normalizePatternText(plainPrompt);
  const workspaceMode = normalizeWorkspaceMode(context.workspaceMode);

  if ((!plainPrompt || ACK_PATTERN.test(normalizedPlainPrompt) || WEAK_ATTACHMENT_PROMPT_PATTERN.test(normalizedPlainPrompt)) && workspaceMode !== "general") {
    return attachmentModeResponse(workspaceMode, attachments) || attachmentActionPrompt(attachments, workspaceMode);
  }

  if (!plainPrompt || ACK_PATTERN.test(normalizedPlainPrompt)) {
    return attachmentActionPrompt(attachments, workspaceMode);
  }

  if (
    /\b(explain|walk me through|describe)\b/i.test(plainPrompt) &&
    /\b(structure|layout|flow|page|file)\b/i.test(plainPrompt)
  ) {
    return attachmentStructureResponse(attachments);
  }

  if (/\b(rewrite|regenerate|update|return|give)\b/i.test(plainPrompt) && /\b(file|html|page|improvement|improvements|fixed version|better version)\b/i.test(plainPrompt)) {
    return attachmentRewriteResponse(attachments);
  }

  if (/\b(review|inspect|check)\b/i.test(plainPrompt) && /\b(bug|bugs|bad pattern|bad patterns|issue|issues|problem|problems|quality)\b/i.test(plainPrompt)) {
    return attachmentReviewResponse(attachments);
  }

  if (/\b(improve|fix|make better|upgrade|optimi[sz]e)\b/i.test(plainPrompt) && /\b(responsive|responsiveness|accessibility|code quality|quality|mobile|ui)\b/i.test(plainPrompt)) {
    return attachmentImprovementResponse(attachments);
  }

  if (workspaceMode !== "general") {
    const modeResponse = attachmentModeResponse(workspaceMode, attachments);
    if (modeResponse) {
      return modeResponse;
    }
  }

  const lines = [
    "1) Attached files",
    ...attachments.map((attachment) => `- ${attachmentDescriptor(attachment)}`)
  ];

  const summaries = attachments.flatMap((attachment) => {
    const summary = summarizeAttachment(attachment);
    return summary.notes.map((note) => `- ${attachment.name}: ${note}`);
  });

  if (summaries.length > 0) {
    lines.push("", "2) Quick read", ...summaries);
  }

  const issues = attachments.flatMap((attachment) => {
    const summary = summarizeAttachment(attachment);
    return summary.issues.map((issue) => `- ${attachment.name}: ${issue}`);
  });

  if (issues.length > 0) {
    lines.push("", "3) Potential issues", ...issues);
  }

  lines.push(
    "",
    issues.length > 0 ? "4) Best next prompt" : "3) Best next prompt",
    "- `review this file for bugs and bad patterns`",
    "- `explain the structure of this file step by step`",
    "- `improve responsiveness, accessibility, or code quality here`",
    "- `rewrite this file with the improvements`"
  );

  return lines.join("\n");
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isGenericFollowup(text) {
  const trimmed = text.trim();
  return GENERIC_FOLLOWUP_PATTERN.test(trimmed) || AFFIRMATIVE_EXPLAIN_PATTERN.test(trimmed) || REWRITE_FOLLOWUP_PATTERN.test(trimmed);
}

function isTopicClarification(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.includes("?")) {
    return false;
  }
  const words = countWords(trimmed);
  if (words === 0 || words > 5) {
    return false;
  }
  if (GREETING_PATTERN.test(trimmed) || HOW_ARE_YOU_PATTERN.test(trimmed) || CAPABILITY_PATTERN.test(trimmed)) {
    return false;
  }
  if (CODING_PATTERN.test(trimmed) || DATE_QUERY_PATTERN.test(trimmed) || TIME_QUERY_PATTERN.test(trimmed)) {
    return false;
  }
  return /^[A-Za-z0-9+.#/\-&\s]+$/.test(trimmed);
}

function isDateQuestion(text) {
  return DATE_QUERY_PATTERN.test(normalizePatternText(text));
}

function isTimeQuestion(text) {
  return TIME_QUERY_PATTERN.test(normalizePatternText(text));
}

function formatCurrentDateResponse() {
  const now = new Date();
  const readable = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: RESPONSE_TIMEZONE
  }).format(now);
  const iso = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: RESPONSE_TIMEZONE
  }).format(now);

  return `Today is ${readable} (${iso}) in ${RESPONSE_TIMEZONE}.`;
}

function formatCurrentTimeResponse() {
  const now = new Date();
  const readable = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: RESPONSE_TIMEZONE
  }).format(now);
  const iso = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: RESPONSE_TIMEZONE
  }).format(now);

  return `Current time is ${readable} on ${iso} in ${RESPONSE_TIMEZONE}.`;
}

function extractArithmeticExpression(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return "";
  }

  const prefixed = trimmed.match(ARITHMETIC_PREFIX_PATTERN);
  const expression = (prefixed ? prefixed[1] : trimmed).trim();

  if (!SAFE_ARITHMETIC_PATTERN.test(expression) || !/[+\-*/%]/.test(expression)) {
    return "";
  }

  return expression;
}

function formatArithmeticNumber(value) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return Number(value.toFixed(8)).toString();
}

function evaluateArithmeticExpression(text) {
  const expression = extractArithmeticExpression(text);
  if (!expression) {
    return null;
  }

  try {
    const result = Function(`"use strict"; return (${expression});`)();
    if (typeof result !== "number" || !Number.isFinite(result)) {
      return null;
    }

    return {
      expression: expression.replace(/\s+/g, " "),
      result: formatArithmeticNumber(result)
    };
  } catch {
    return null;
  }
}

function arithmeticResponse(text, options = {}) {
  const evaluated = evaluateArithmeticExpression(text);
  if (!evaluated) {
    return "";
  }

  if (options.deep) {
    return [
      "1) Expression",
      `- ${evaluated.expression}`,
      "",
      "2) Result",
      `- ${evaluated.result}`
    ].join("\n");
  }

  return [
    "1) Expression",
    `- ${evaluated.expression}`,
    "2) Result",
    `- ${evaluated.result}`
  ].join("\n");
}

function isContextualFollowup(text, previousUserText) {
  if (!previousUserText || !text.trim()) {
    return false;
  }

  if (isGenericFollowup(text)) {
    return true;
  }

  const words = countWords(text);
  if (words <= 9 && CONTEXT_FOLLOWUP_PATTERN.test(text)) {
    return true;
  }
  if (words <= 5 && CODE_ONLY_PATTERN.test(text.trim())) {
    return true;
  }
  if (words <= 5 && LANGUAGE_ONLY_PATTERN.test(text.trim())) {
    return true;
  }
  if (SHORT_AMBIGUOUS_WHAT_IS_PATTERN.test(previousUserText.trim()) && isTopicClarification(text)) {
    return true;
  }
  return words <= 8 && FULL_CODE_PATTERN.test(text.trim());
}

function isShallowCodeFollowup(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    return false;
  }

  const words = countWords(trimmed);
  return (
    (words <= 5 && CODE_ONLY_PATTERN.test(trimmed)) ||
    LANGUAGE_ONLY_PATTERN.test(trimmed) ||
    (words <= 8 && FULL_CODE_PATTERN.test(trimmed))
  );
}

function isLowInformationPrompt(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    return true;
  }
  if (/^[0-9]+$/.test(trimmed)) {
    return true;
  }

  const words = countWords(trimmed);
  return words <= 2 && !WHAT_IS_PATTERN.test(trimmed) && !GREETING_PATTERN.test(trimmed) && !HOW_ARE_YOU_PATTERN.test(trimmed);
}

function wantsDepth(text) {
  return DEPTH_REQUEST_PATTERN.test(text);
}

function inferTopicFromText(text) {
  if (DAA_TOPIC_PATTERN.test(text)) {
    return "daa";
  }
  return "general";
}

function tokenizeWords(text) {
  return text.toLowerCase().match(/[a-z0-9']+/g) || [];
}

function tokenizeGeneratedText(text) {
  return text.toLowerCase().match(/[a-z0-9']+|[.,!?;:]/g) || [];
}

function filterTokens(tokens) {
  return tokens.filter((token) => !STOPWORDS.has(token));
}

function scoreRetrieval(queryTokens, candidateTokens) {
  const q = filterTokens(queryTokens);
  const c = filterTokens(candidateTokens);

  if (q.length === 0 || c.length === 0) {
    return 0;
  }

  const qSet = new Set(q);
  const cSet = new Set(c);
  let overlap = 0;

  for (const token of qSet) {
    if (cSet.has(token)) {
      overlap += 1;
    }
  }

  if (overlap === 0) {
    return 0;
  }

  if (qSet.size >= 3 && overlap < 2) {
    return 0;
  }

  const precision = overlap / cSet.size;
  const recall = overlap / qSet.size;
  const f1 = (2 * precision * recall) / Math.max(precision + recall, 1e-9);
  const coverage = overlap / Math.max(Math.min(qSet.size, 8), 1);

  return f1 * 0.8 + coverage * 0.2;
}

function chooseHighestCount(countMap) {
  let bestToken = null;
  let bestCount = -1;

  for (const [token, count] of Object.entries(countMap || {})) {
    if (count > bestCount) {
      bestToken = token;
      bestCount = count;
    }
  }

  return bestToken;
}

function detokenize(tokens) {
  let result = "";

  for (const token of tokens) {
    if (/^[.,!?;:]$/.test(token)) {
      result += token;
    } else {
      result += `${result ? " " : ""}${token}`;
    }
  }

  return result.trim();
}

function generateFromBigram(model, seedText, maxTokens) {
  const outputTokens = [];
  const seedTokens = tokenizeGeneratedText(seedText);
  let state = seedTokens[seedTokens.length - 1] || "<s>";
  let repeatedStateCount = 0;
  const seenTrigrams = new Set();

  for (let index = 0; index < maxTokens; index += 1) {
    const nextCounts = model.bigram?.[state] || model.bigram?.["<s>"] || model.unigram || {};
    const nextToken = chooseHighestCount(nextCounts);

    if (!nextToken || nextToken === "</s>") {
      break;
    }

    outputTokens.push(nextToken);
    const trigram = outputTokens.slice(-3).join(" ");
    if (trigram) {
      if (seenTrigrams.has(trigram)) {
        break;
      }
      seenTrigrams.add(trigram);
    }

    if (nextToken === state) {
      repeatedStateCount += 1;
      if (repeatedStateCount >= 3) {
        break;
      }
    } else {
      repeatedStateCount = 0;
    }

    state = nextToken;
  }

  return detokenize(outputTokens);
}

function buildDeepEnvelope(userText, responseText) {
  return String(responseText || "").trim();
}

function firstSentence(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  const segments = trimmed.split(/(?<=[.!?])\s+/);
  return segments[0] || trimmed;
}

function buildGenerationState(prompt, intent = null, knowledge = null) {
  const rawUserTurns = extractUserTurns(prompt);
  const userTurns = rawUserTurns.map((turn) => normalizeNaturalLanguageText(stripAttachmentContext(turn)));
  const assistantTurns = extractAssistantTurns(prompt);
  const latestRawUserText = rawUserTurns[rawUserTurns.length - 1] || extractLatestUserText(prompt);
  const plainUserText = normalizeNaturalLanguageText(stripAttachmentContext(latestRawUserText));
  let attachments = extractAttachmentsFromText(latestRawUserText);
  const workspaceMode = extractWorkspaceMode(prompt);

  if (attachments.length === 0) {
    for (let index = rawUserTurns.length - 2; index >= Math.max(0, rawUserTurns.length - 3); index -= 1) {
      const candidate = extractAttachmentsFromText(rawUserTurns[index]);
      if (candidate.length === 0) {
        continue;
      }
      if (shouldReuseRecentAttachments(plainUserText, userTurns[userTurns.length - 2] || "")) {
        attachments = candidate;
      }
      break;
    }
  }

  const synthesizedAttachmentQuery =
    attachments.length > 0 ? `analyze attached files ${attachments.map((attachment) => attachmentDescriptor(attachment)).join(", ")}` : "";
  const userText =
    attachments.length > 0 && isLowInformationPrompt(plainUserText)
      ? synthesizedAttachmentQuery
      : plainUserText || synthesizedAttachmentQuery || extractLatestUserText(prompt);
  const previousUserText = userTurns[userTurns.length - 2] || "";
  const secondPreviousUserText = userTurns[userTurns.length - 3] || "";
  const taskAnchorUserText = findTaskAnchorUserText(userTurns);
  const preferFullCode = hasPersistentFullCodePreference(userTurns);
  const previousAssistantText = assistantTurns[assistantTurns.length - 1] || "";
  const knowledgeContext = extractKnowledgeContext(prompt);
  const followup =
    isContextualFollowup(userText, previousUserText) || CONFIRMATION_PATTERN.test(normalizePatternText(userText));
  const retrievalSeed =
    followup && taskAnchorUserText && intent?.previousIsMeaningful !== false
      ? `${taskAnchorUserText} ${userText}`
      : followup && previousUserText && intent?.previousIsMeaningful !== false
        ? `${previousUserText} ${userText}`
        : userText;
  const queryTokens = tokenizeWords(retrievalSeed);

  return {
    userText,
    queryTokens,
    context: {
      previousUserText,
      secondPreviousUserText,
      previousAssistantText,
      taskAnchorUserText,
      preferFullCode,
      followup,
      attachments,
      workspaceMode,
      plainUserText,
      knowledgeContext,
      knowledgeSources: Array.isArray(knowledge?.sources) ? knowledge.sources : []
    }
  };
}

function hasRepetitivePhrase(text) {
  const tokens = tokenizeWords(text);
  if (tokens.length < 12) {
    return false;
  }

  const seen = new Set();
  for (let index = 0; index <= tokens.length - 4; index += 1) {
    const phrase = tokens.slice(index, index + 4).join(" ");
    if (seen.has(phrase)) {
      return true;
    }
    seen.add(phrase);
  }
  return false;
}

function isGenericAssistantMetaCompletion(text) {
  const normalized = compactResponseText(text);
  if (!normalized) {
    return false;
  }

  return GENERIC_ASSISTANT_META_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isLowQualityCompletion(text) {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length < 8) {
    return true;
  }

  if (isGenericAssistantMetaCompletion(normalized)) {
    return true;
  }

  if (LOW_QUALITY_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  if (/^(user|assistant)\s*:/i.test(normalized)) {
    return true;
  }

  if (hasRepetitivePhrase(normalized)) {
    return true;
  }

  return false;
}

function sanitizeCompletion(text, fallback) {
  return isLowQualityCompletion(text) ? fallback : text.trim();
}

function retrieveTopMatches(queryTokens, pairs, topK = 4) {
  const scored = [];
  const filteredQueryTokens = [...new Set(filterTokens(queryTokens))];
  const retrievalIndex = !Array.isArray(pairs) && pairs?.__retrievalIndex instanceof Map ? pairs.__retrievalIndex : null;
  const sourcePairs = Array.isArray(pairs) ? pairs : pairs?.pairs || [];
  const candidateIndexes = new Set();

  if (retrievalIndex && filteredQueryTokens.length > 0) {
    for (const token of filteredQueryTokens) {
      const indexes = retrievalIndex.get(token);
      if (!indexes) {
        continue;
      }
      for (const index of indexes) {
        candidateIndexes.add(index);
      }
    }
  }

  const candidatePairs =
    candidateIndexes.size > 0
      ? [...candidateIndexes].map((index) => sourcePairs[index]).filter(Boolean)
      : sourcePairs;

  for (const pair of candidatePairs) {
    const candidateTokens = Array.isArray(pair._promptTokens)
      ? pair._promptTokens
      : Array.isArray(pair.prompt_tokens)
        ? pair.prompt_tokens
        : tokenizeWords(pair.prompt || "");
    const score = scoreRetrieval(queryTokens, candidateTokens);

    if (score > 0) {
      scored.push({ pair, score });
    }
  }

  scored.sort((left, right) => right.score - left.score);
  return scored.slice(0, topK);
}

function normalizeTerm(term) {
  const normalized = term.replace(/[?!.]+$/g, "").trim().toLowerCase();
  return TERM_ALIASES[normalized] || normalized;
}

function firstKnowledgeSentence(knowledgeContext) {
  const firstLine = (knowledgeContext || "")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return "";
  }

  const cleanedLine = firstLine.replace(/^\[\d+\]\s*/, "");
  const colonIndex = cleanedLine.indexOf(":");
  const snippet = colonIndex >= 0 ? cleanedLine.slice(colonIndex + 1).trim() : cleanedLine;
  return firstSentence(snippet);
}

function knowledgeGroundedResponse(knowledgeContext) {
  const lines = (knowledgeContext || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return "";
  }

  const snippets = [];
  for (const line of lines.slice(0, 2)) {
    const cleanedLine = line.replace(/^\[\d+\]\s*/, "");
    const colonIndex = cleanedLine.indexOf(":");
    const snippet = colonIndex >= 0 ? cleanedLine.slice(colonIndex + 1).trim() : cleanedLine;
    const sentence = firstSentence(snippet);
    if (sentence && !isLowQualityCompletion(sentence)) {
      snippets.push(sentence);
    }
  }

  if (snippets.length === 0) {
    return "";
  }
  if (snippets.length === 1) {
    return snippets[0];
  }

  return `${snippets[0]}\n\nAlso: ${snippets[1]}`;
}

function sentenceCandidates(text) {
  return String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function uniqueKnowledgeSentences(entries, limit = 3) {
  const seen = new Set();
  const sentences = [];

  for (const entry of entries) {
    for (const sentence of sentenceCandidates(entry.text || entry.snippet || "")) {
      const normalized = sentence.toLowerCase();
      if (seen.has(normalized) || isLowQualityCompletion(sentence)) {
        continue;
      }

      seen.add(normalized);
      sentences.push(sentence);
      if (sentences.length >= limit) {
        return sentences;
      }
    }
  }

  return sentences;
}

function deepKnowledgeGroundedResponse(topic, knowledgeContext = "", knowledgeSources = []) {
  const entries = extractKnowledgeEntries(knowledgeContext, knowledgeSources);
  if (entries.length === 0) {
    return "";
  }

  const sentences = uniqueKnowledgeSentences(entries, 4);
  if (sentences.length === 0) {
    return "";
  }

  const label = String(topic || "").trim();
  const lead = sentences[0];
  const details = sentences.slice(1, 4);
  const sourceNotes = entries
    .slice(0, 2)
    .map((entry) => sourceDisplay(entry))
    .filter(Boolean);

  return [
    label ? `${label.trim()}:` : "",
    "",
    "1) Core idea",
    `- ${lead}`,
    "",
    details.length > 0 ? "2) Key details" : "",
    ...details.map((sentence) => `- ${sentence}`),
    "",
    sourceNotes.length > 0 ? "3) Grounding" : "",
    ...sourceNotes.map((note) => `- ${note}`)
  ]
    .filter(Boolean)
    .join("\n");
}

function fastKnowledgeGroundedResponse(topic, knowledgeContext = "", knowledgeSources = []) {
  const entries = extractKnowledgeEntries(knowledgeContext, knowledgeSources);
  if (entries.length === 0) {
    return "";
  }

  const lead = firstSentence(entries[0].text || entries[0].snippet || "").trim();
  if (!lead || isLowQualityCompletion(lead)) {
    return "";
  }

  const details = uniqueKnowledgeSentences(entries, 3).filter((sentence) => sentence !== lead).slice(0, 2);
  const sourceNotes = entries
    .slice(0, 2)
    .map((entry) => sourceDisplay(entry))
    .filter(Boolean);

  return [
    "1) Core answer",
    `- ${lead}`,
    details.length > 0 ? "" : null,
    details.length > 0 ? "2) Key points" : null,
    ...details.map((sentence) => `- ${sentence}`),
    sourceNotes.length > 0 ? "" : null,
    sourceNotes.length > 0 ? "3) Sources" : null,
    ...sourceNotes.map((note) => `- ${note}`)
  ]
    .filter(Boolean)
    .join("\n");
}

function extractKnowledgeEntries(knowledgeContext = "", knowledgeSources = []) {
  const lines = String(knowledgeContext || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .map((line, index) => {
      const source = knowledgeSources[index] || {};
      const cleanedLine = line.replace(/^\[\d+\]\s*/, "");
      let snippet = cleanedLine;

      if (source.title && cleanedLine.startsWith(`${source.title}:`)) {
        snippet = cleanedLine.slice(source.title.length + 1).trim();
      } else {
        const colonIndex = cleanedLine.indexOf(":");
        snippet = colonIndex >= 0 ? cleanedLine.slice(colonIndex + 1).trim() : cleanedLine;
      }

      snippet = snippet.replace(/\s*\[Source:\s*https?:\/\/[^\]]+\]\s*$/i, "").trim();

      return {
        title: source.title || cleanedLine.slice(0, cleanedLine.indexOf(":")).trim() || `Source ${index + 1}`,
        url: source.url || "",
        text: source.text || snippet,
        snippet
      };
    })
    .filter((entry) => entry.title || entry.snippet);
}

function sourceHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function sourceDisplay(entry) {
  const host = sourceHost(entry.url);
  return host ? `${entry.title} (${host})` : entry.title;
}

function knowledgeBullet(entry, options = {}) {
  const includeLink = options.includeLink !== false;
  const sentence = firstSentence(entry.text || entry.snippet || "").replace(/\s+/g, " ").trim();
  const lines = [`- ${sourceDisplay(entry)}${sentence ? `: ${sentence}` : ""}`];
  if (includeLink && entry.url) {
    lines.push(`  ${entry.url}`);
  }
  return lines.join("\n");
}

function officialOrTrustedDownload(entry) {
  const haystack = `${entry.title} ${entry.text} ${entry.url}`.toLowerCase();
  return /(official|download|release|releases|installer|setup|github|pypi|npm|microsoft|nodejs|python)/.test(haystack);
}

function searchFallbackResponse(userText, mode = "general") {
  if (mode === "download") {
    return `Tell me the exact app or tool you want to download, and I will look for the official download page and direct links.`;
  }
  if (mode === "builder") {
    return "Tell me what you want to build, and I will suggest strong AI builders with free and paid options.";
  }
  if (mode === "shopping") {
    return "Tell me what you want to buy and your budget, and I will look up strong options with source links.";
  }
  return `Tell me the exact item or tool you want, and I will search for strong references and source links.`;
}

function downloadResponse(userText, context) {
  const entries = extractKnowledgeEntries(context.knowledgeContext, context.knowledgeSources);
  if (entries.length === 0) {
    return searchFallbackResponse(userText, "download");
  }

  const prioritized = [...entries].sort((left, right) => Number(officialOrTrustedDownload(right)) - Number(officialOrTrustedDownload(left)));
  const lines = ["Here are the best download sources I found:"];

  for (const entry of prioritized.slice(0, 3)) {
    lines.push(knowledgeBullet(entry));
  }

  lines.push("");
  lines.push("Prefer the official site or a GitHub release link over third-party mirrors.");
  return lines.join("\n");
}

function shoppingResponse(userText, context) {
  const entries = extractKnowledgeEntries(context.knowledgeContext, context.knowledgeSources);
  if (entries.length === 0) {
    return searchFallbackResponse(userText, "shopping");
  }

  const lines = ["Here are strong references to compare before buying:"];
  for (const entry of entries.slice(0, 4)) {
    lines.push(knowledgeBullet(entry, { includeLink: false }));
  }
  lines.push("");
  lines.push("Use the source links below to compare price, specs, and reviews.");
  return lines.join("\n");
}

function classifyBuilderEntry(entry) {
  const haystack = `${entry.title} ${entry.text} ${entry.url}`.toLowerCase();
  if (/\b(free|open source|open-source|oss|github)\b/.test(haystack)) {
    return "free";
  }
  if (/\b(pricing|plans|paid|pro|enterprise|subscription)\b/.test(haystack)) {
    return "paid";
  }
  return "general";
}

function builderResponse(userText, context) {
  const entries = extractKnowledgeEntries(context.knowledgeContext, context.knowledgeSources);
  if (entries.length === 0) {
    return searchFallbackResponse(userText, "builder");
  }

  const free = [];
  const paid = [];
  const general = [];

  for (const entry of entries.slice(0, 5)) {
    const bucket = classifyBuilderEntry(entry);
    if (bucket === "free") {
      free.push(entry);
    } else if (bucket === "paid") {
      paid.push(entry);
    } else {
      general.push(entry);
    }
  }

  const lines = ["Here are strong AI builder options I found:"];

  if (free.length > 0) {
    lines.push("");
    lines.push("Free or open-source leaning:");
    for (const entry of free.slice(0, 2)) {
      lines.push(knowledgeBullet(entry, { includeLink: false }));
    }
  }

  if (paid.length > 0) {
    lines.push("");
    lines.push("Paid or pricing-led options:");
    for (const entry of paid.slice(0, 2)) {
      lines.push(knowledgeBullet(entry, { includeLink: false }));
    }
  }

  if (free.length === 0 && paid.length === 0) {
    lines.push("");
    for (const entry of general.slice(0, 4)) {
      lines.push(knowledgeBullet(entry, { includeLink: false }));
    }
  } else if (general.length > 0) {
    lines.push("");
    lines.push("Also worth checking:");
    for (const entry of general.slice(0, 2)) {
      lines.push(knowledgeBullet(entry, { includeLink: false }));
    }
  }

  lines.push("");
  lines.push("Use the source links below to open the builder pages, pricing, and comparisons.");
  return lines.join("\n");
}

function recommendationResponse(userText, context) {
  const entries = extractKnowledgeEntries(context.knowledgeContext, context.knowledgeSources);
  if (entries.length === 0) {
    return searchFallbackResponse(userText, "general");
  }

  const lines = ["Here are the strongest references I found:"];
  for (const entry of entries.slice(0, 4)) {
    lines.push(knowledgeBullet(entry, { includeLink: false }));
  }
  lines.push("");
  lines.push("Open the source links below if you want the official pages, pricing, or comparisons.");
  return lines.join("\n");
}

function definitionResponse(term, matches, knowledgeContext = "") {
  const normalized = normalizeTerm(term);

  if (KNOWN_DEFINITIONS[normalized]) {
    return KNOWN_DEFINITIONS[normalized];
  }

  const knowledgeSentence = firstKnowledgeSentence(knowledgeContext);
  if (knowledgeSentence && !isLowQualityCompletion(knowledgeSentence)) {
    return knowledgeSentence;
  }

  if (matches.length > 0 && matches[0].score >= 0.42) {
    const candidate = firstSentence(matches[0].pair.completion || "");
    if (!isLowQualityCompletion(candidate)) {
      return candidate;
    }
  }

  if (normalized.length <= 3) {
    return `${term.trim()} can have multiple meanings. Tell me the context (chat, math, coding, domain), and I will define it precisely.`;
  }

  return `${term.trim()} is a term or topic. If you want the exact meaning, tell me the context and I will explain it clearly.`;
}

function deepDefinitionResponse(term, matches, knowledgeContext = "", knowledgeSources = []) {
  const grounded = deepKnowledgeGroundedResponse(term, knowledgeContext, knowledgeSources);
  if (grounded) {
    return grounded;
  }

  const base = definitionResponse(term, matches, knowledgeContext);
  return [
    `${term.trim()}:`,
    "",
    "1) Definition",
    `- ${base}`,
    "",
    "2) Next depth",
    "- Ask for examples, working, history, or comparison if you want a deeper explanation."
  ].join("\n");
}

function shouldAnswerAsDirectDefinition(text, matches, knowledgeContext = "") {
  const trimmed = String(text || "").trim();
  if (WHAT_IS_PATTERN.test(trimmed)) {
    return false;
  }
  const normalized = normalizeTerm(text);
  if (!isTopicClarification(text)) {
    return false;
  }
  if (normalized.length <= 3 && !KNOWN_DEFINITIONS[normalized]) {
    return false;
  }
  return Boolean(
    KNOWN_DEFINITIONS[normalized] ||
      firstKnowledgeSentence(knowledgeContext) ||
      (matches.length > 0 && matches[0].score >= 0.42)
  );
}

function clarityFollowupResponse(previousUserText, matches, knowledgeContext = "") {
  const previousWhatIsMatch = previousUserText.trim().match(WHAT_IS_PATTERN);
  if (!previousWhatIsMatch) {
    return [
      "Sure. I will explain the previous topic more clearly.",
      "",
      `Previous topic: ${previousUserText.slice(0, 160)}`,
      "",
      "If you want, ask for: `beginner`, `intermediate`, `advanced`, or `with examples`."
    ].join("\n");
  }

  const topicTerm = previousWhatIsMatch[1].trim();
  const displayTerm = topicTerm.replace(/^./, (char) => char.toUpperCase());
  const normalized = normalizeTerm(topicTerm);

  if (normalized === "ai") {
    return [
      "AI in a more understandable way:",
      "- AI lets computers learn patterns from data and make useful predictions or responses.",
      "- Example: an email spam filter learns from old emails and predicts if a new one is spam.",
      "- In chatbots, AI reads your question, predicts good next words, and builds a response.",
      "",
      "If you want, I can explain AI types next: machine learning, deep learning, and generative AI."
    ].join("\n");
  }

  const base = definitionResponse(topicTerm, matches, knowledgeContext);
  return [
    `${displayTerm} in simpler words:`,
    `- ${base}`,
    "",
    `If you want, ask: \`Give one simple example of ${displayTerm}\`.`
  ].join("\n");
}

function confirmationFollowupResponse(context, matches, knowledgeContext = "") {
  const previousUserText = normalizePatternText(context.previousUserText);
  const previousAssistantText = compactResponseText(context.previousAssistantText);

  if (!previousUserText && !previousAssistantText) {
    return "Tell me which statement you want me to verify, and I will check it clearly.";
  }

  const previousWhatIsMatch = previousUserText.match(WHAT_IS_PATTERN);
  if (previousWhatIsMatch) {
    const topicTerm = previousWhatIsMatch[1].trim();
    return [
      "Yes, in general that is correct.",
      `A clearer version is: ${definitionResponse(topicTerm, matches, knowledgeContext)}`
    ].join(" ");
  }

  if (previousAssistantText) {
    return [
      "Yes, that was the intended meaning from the previous reply.",
      `In one line: ${firstSentence(previousAssistantText)}`
    ].join(" ");
  }

  return "Tell me which statement you want me to verify, and I will check it clearly.";
}

function followupAnchorUserText(context) {
  const previous = String(context.previousUserText || "").trim();
  const secondPrevious = String(context.secondPreviousUserText || "").trim();
  if (!previous) {
    return "";
  }
  const normalizedPrevious = normalizePatternText(previous);
  if ((isGenericFollowup(previous) || CONFIRMATION_PATTERN.test(normalizedPrevious) || REWRITE_FOLLOWUP_PATTERN.test(normalizedPrevious)) && secondPrevious) {
    return secondPrevious;
  }
  return previous;
}

function frustrationResponse() {
  return "Tell me exactly what is wrong, and I will fix it directly.";
}

function assistantIdentityResponse() {
  return [
    "I am Energy AI, your local multi-model assistant.",
    "I use `energy-low-own-v1` for low-energy replies and `energy-high-own-v1` for high-energy analysis."
  ].join(" ");
}

function assistantCreationResponse() {
  return [
    "I am built from a language-model stack, training data, alignment examples, and serving logic around the models.",
    "In this project, that includes local training data, routing between low-energy and high-energy models, and backend code that keeps conversation context and response rules consistent."
  ].join(" ");
}

function farewellResponse() {
  return "Bye. If you need anything later, I will be here.";
}

function lowInformationResponse() {
  return "I can help, but I need a bit more detail. For example: `Explain AI with a real example` or `Write a Python function for binary search`.";
}

function assistantCapabilityResponse() {
  return [
    "I can help with coding, debugging, explanations, planning, writing, and structured answers across many topics.",
    "If you want, give me a task and I will answer directly or go deeper when the problem needs more reasoning."
  ].join(" ");
}

function codingSupportResponse() {
  return [
    "I can generate coding logic based on your exact question.",
    "",
    "Supported major languages: Python, JavaScript, TypeScript, Java, C, C++, Go, Rust.",
    "I can also provide different logic styles (iterative, recursive, optimized) when requested.",
    "",
    "Prompt format that works best:",
    "1) Problem statement",
    "2) Language (or say: all languages)",
    "3) Constraints and input/output format",
    "4) Ask for style: iterative / recursive / optimized",
    "",
    "I can return working code, explanation, complexity, and test cases."
  ].join("\n");
}

function codingReadinessResponse() {
  return [
    "Ready.",
    "Send the problem statement, language, and constraints.",
    "I will return full runnable code by default."
  ].join(" ");
}

const DEFAULT_MULTI_LANGUAGES = ["python", "javascript", "typescript", "java", "c", "cpp", "go", "rust"];

function detectRequestedLanguages(text) {
  const lowered = text.toLowerCase();
  if (/\ball\s+languages?\b|\bevery\s+language\b/.test(lowered)) {
    return [...DEFAULT_MULTI_LANGUAGES];
  }

  const picked = [];
  if (/\bc\+\+|cpp\b/.test(lowered)) {
    picked.push("cpp");
  }
  if (/(^|\s)c(\s|$)|\bc code\b/.test(lowered)) {
    picked.push("c");
  }
  if (/\bpython\b/.test(lowered)) {
    picked.push("python");
  }
  if (/\bjavascript\b|\bjs\b/.test(lowered)) {
    picked.push("javascript");
  }
  if (/\btypescript\b|\bts\b/.test(lowered)) {
    picked.push("typescript");
  }
  if (/\bjava\b/.test(lowered)) {
    picked.push("java");
  }
  if (/\bgo(lang)?\b/.test(lowered)) {
    picked.push("go");
  }
  if (/\brust\b/.test(lowered)) {
    picked.push("rust");
  }

  if (picked.length === 0) {
    return ["python"];
  }

  return [...new Set(picked)];
}

function stripLanguageMentions(text) {
  return String(text || "")
    .replace(/\b(?:(?:give|show|write|send)(?:\s+it)?\s+)?(?:in\s+)?(python|javascript|js|typescript|ts|java|c\+\+|cpp|c|go|golang|rust)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasPersistentFullCodePreference(turns = []) {
  return turns.some((turn) => FULL_CODE_PREFERENCE_PATTERN.test(normalizePatternText(turn)));
}

function findTaskAnchorUserText(userTurns = []) {
  for (let index = userTurns.length - 2; index >= 0; index -= 1) {
    const turn = String(userTurns[index] || "").trim();
    if (!turn) {
      continue;
    }
    if (isShallowCodeFollowup(turn)) {
      continue;
    }
    if (
      detectCodingTask(turn).id !== "generic" ||
      CONTEST_PROMPT_PATTERN.test(turn) ||
      /\b(add|factorial|fibonacci|binary search|two sum|merge intervals|maximum subarray|subarray sum|substring)\b/i.test(turn)
    ) {
      return turn;
    }
  }

  return userTurns[userTurns.length - 2] || "";
}

function looksLikeContestProblem(text) {
  const normalized = normalizePatternText(text).toLowerCase();
  if (!normalized) {
    return false;
  }

  if (CONTEST_PROMPT_PATTERN.test(normalized)) {
    return true;
  }

  return (
    /\b(array|string|graph|tree|grid|matrix)\b/.test(normalized) &&
    /\b(find|return|count|min|max|shortest|longest)\b/.test(normalized) &&
    countWords(normalized) >= 10
  );
}

function detectCodingTask(userText) {
  const lowered = userText.toLowerCase();

  if (/\b(two\s*sum|pair\s+sum|target\s+sum)\b/.test(lowered)) {
    return {
      id: "two_sum",
      label: "Two Sum",
      complexity: "O(n) time, O(n) space",
      logic: [
        "Traverse array once and store visited values in a hash map.",
        "For each value x, check whether target - x already exists in map."
      ]
    };
  }

  if (/\bbinary\s+search\b/.test(lowered)) {
    return {
      id: "binary_search",
      label: "Binary Search",
      complexity: "O(log n) time, O(1) space",
      logic: [
        "Maintain low/high pointers on a sorted array.",
        "Compare mid element with target and shrink search half each step."
      ]
    };
  }

  if (/\bfactorial\b/.test(lowered)) {
    return {
      id: "factorial",
      label: "Factorial",
      complexity: "O(n) time, O(1) space (iterative)",
      logic: [
        "Multiply values from 2 to n.",
        "Return 1 for n = 0 or n = 1."
      ]
    };
  }

  if (/\bvowel\b|\bconsonant\b/.test(lowered)) {
    return {
      id: "vowel_check",
      label: "Vowel Check",
      complexity: "O(1) time, O(1) space",
      logic: [
        "Read one character and normalize it to lowercase.",
        "Compare it against a, e, i, o, u and report whether it is a vowel or consonant."
      ]
    };
  }

  if (/\bfibonacci|fibo\b/.test(lowered)) {
    return {
      id: "fibonacci",
      label: "Fibonacci",
      complexity: "O(n) time, O(1) space (iterative)",
      logic: [
        "Track previous two values and iterate to n.",
        "Avoid naive recursion for large n because it is exponential."
      ]
    };
  }

  if (/\bprime\b/.test(lowered)) {
    return {
      id: "prime_check",
      label: "Prime Check",
      complexity: "O(sqrt(n)) time, O(1) space",
      logic: [
        "Handle n <= 1 as not prime.",
        "Try dividing from 2 up to sqrt(n)."
      ]
    };
  }

  if (/\bpalindrome\b/.test(lowered)) {
    return {
      id: "palindrome",
      label: "Palindrome String Check",
      complexity: "O(n) time, O(1) extra space",
      logic: [
        "Use two pointers from both ends of the string.",
        "If any mismatch appears, it is not a palindrome."
      ]
    };
  }

  if ((/\breverse\b/.test(lowered) && /\bstring\b/.test(lowered)) || /\bstring\b.*\breverse\b/.test(lowered)) {
    return {
      id: "reverse_string",
      label: "Reverse String",
      complexity: "O(n) time, O(n) space (immutable strings)",
      logic: [
        "Traverse characters in reverse order.",
        "Build reversed output string."
      ]
    };
  }

  if (/\bsort|sorting|bubble sort|quick sort|merge sort\b/.test(lowered)) {
    return {
      id: "sort_array",
      label: "Sort Array",
      complexity: "O(n log n) average time (built-in sort)",
      logic: [
        "Use comparator-based sort.",
        "For interview constraints, replace with explicit merge/quick sort."
      ]
    };
  }

  if (/\badd(?:ing|ng)?\b.*\b(two|2|number|numbers|bumber|bumbers)\b|\bsum\b.*\b(two|2)\b.*\b(number|numbers)\b/.test(lowered)) {
    return {
      id: "add_two_numbers",
      label: "Add Two Numbers",
      complexity: "O(1) time, O(1) space",
      logic: [
        "Return the sum of two input values.",
        "Use numeric types that fit expected range."
      ]
    };
  }

  if (/\blongest\s+substring\b.*\bwithout\s+repeating\b|\bwithout\s+repeating\s+characters?\b/.test(lowered)) {
    return {
      id: "longest_substring_no_repeat",
      label: "Longest Substring Without Repeating Characters",
      complexity: "O(n) time, O(min(n, alphabet)) space",
      logic: [
        "Use a sliding window and remember the last seen index of each character.",
        "Move the left pointer only forward when a duplicate enters the window."
      ]
    };
  }

  if (/\b(maximum|max)\s+subarray\b|\bkadane\b/.test(lowered)) {
    return {
      id: "maximum_subarray",
      label: "Maximum Subarray",
      complexity: "O(n) time, O(1) space",
      logic: [
        "Use Kadane's algorithm to keep the best subarray ending at the current index.",
        "Track the global maximum while scanning once from left to right."
      ]
    };
  }

  if (/\bmerge\s+intervals?\b/.test(lowered)) {
    return {
      id: "merge_intervals",
      label: "Merge Intervals",
      complexity: "O(n log n) time, O(n) space",
      logic: [
        "Sort intervals by start time first.",
        "Merge with the last output interval while ranges overlap."
      ]
    };
  }

  if (/\bsubarray\s+sum\b.*\bk\b|\bsum\s+equals\s+k\b/.test(lowered)) {
    return {
      id: "subarray_sum_k",
      label: "Subarray Sum Equals K",
      complexity: "O(n) time, O(n) space",
      logic: [
        "Maintain prefix sums and count how many times each prefix has appeared.",
        "For each prefix sum s, add the count of prefix sum s - k."
      ]
    };
  }

  if (/\b(binary|binaray)\s+tree\b|\bbinary\s+search\s+tree\b|\bbst\b/.test(lowered)) {
    return {
      id: "binary_tree",
      label: "Binary Tree / BST Basics",
      complexity: "O(h) average insert/search for BST, where h is tree height",
      logic: [
        "Define a Node structure with value, left, and right child references.",
        "Insert values recursively based on BST ordering.",
        "Use inorder traversal to print sorted sequence."
      ]
    };
  }

  if (/\b(pos tagging|pos tag|part of speech|part-of-speech|tag parts of speech)\b/.test(lowered)) {
    return {
      id: "pos_tagging",
      label: "Part-of-Speech Tagging",
      complexity: "O(n) time for token stream (model-dependent constants)",
      logic: [
        "Tokenize sentence into words.",
        "Apply POS tagger model to assign grammatical tags."
      ]
    };
  }

  return {
    id: "generic",
    label: "Custom Coding Task",
    complexity: "Depends on problem constraints",
    logic: [
      "Define input/output contract clearly.",
      "Implement core logic, then validate edge cases."
    ]
  };
}

function detectCodingStyle(text, options = {}) {
  const lowered = text.toLowerCase();
  return {
    wantsRecursive: /\b(recursive|recursion)\b/.test(lowered),
    wantsIterative: /\b(iterative|loop based|without recursion)\b/.test(lowered),
    wantsDifferent: /\b(different logic|alternative|another way|optimized|other approach)\b/.test(lowered),
    wantsFullCode: FULL_CODE_PATTERN.test(lowered) || Boolean(options.preferFullCode)
  };
}

function supportedLanguagesForTask(taskId) {
  if (["longest_substring_no_repeat", "maximum_subarray", "merge_intervals", "subarray_sum_k"].includes(taskId)) {
    return ["python", "javascript", "typescript", "java", "cpp"];
  }
  return null;
}

function edgeCasesForTask(taskId) {
  const common = ["Empty input.", "Single-element input.", "Very large input near constraint limits."];

  if (taskId === "two_sum") {
    return ["Duplicate numbers.", "Negative values.", "No valid pair if the platform allows it."];
  }
  if (taskId === "binary_search") {
    return ["Target missing from the array.", "Array of length 1.", "Repeated values if first/last occurrence matters."];
  }
  if (taskId === "longest_substring_no_repeat") {
    return ["Empty string.", "All characters identical.", "Window reset when the repeated character is inside the current window."];
  }
  if (taskId === "maximum_subarray") {
    return ["All numbers negative.", "Single element array.", "Large positive/negative swings."];
  }
  if (taskId === "merge_intervals") {
    return ["Already sorted intervals.", "Fully nested intervals.", "Touching intervals if the platform treats them as overlapping."];
  }
  if (taskId === "subarray_sum_k") {
    return ["Negative numbers present, so sliding window is not safe.", "k = 0.", "Multiple equal prefix sums."];
  }
  if (taskId === "generic") {
    return ["Minimum-size input.", "Maximum-size input.", "Repeated values, boundary indices, and overflow risk."];
  }
  if (taskId === "vowel_check") {
    return ["Uppercase letters.", "Non-alphabetic characters.", "Whitespace or missing input."];
  }
  return common;
}

function snippetByLanguage(language, snippets) {
  return snippets[language] || snippets.python;
}

function indentCode(text, spaces = 2) {
  const pad = " ".repeat(spaces);
  return String(text || "")
    .split("\n")
    .map((line) => (line ? `${pad}${line}` : line))
    .join("\n");
}

function hasEntryPoint(language, snippet) {
  const source = String(snippet || "");

  if (language === "python") {
    return source.includes("if __name__ == \"__main__\":");
  }
  if (language === "java") {
    return /\bpublic\s+class\s+Main\b/.test(source) || /\bstatic\s+void\s+main\s*\(/.test(source);
  }
  if (language === "c" || language === "cpp") {
    return /\bmain\s*\(/.test(source);
  }
  if (language === "javascript" || language === "typescript") {
    return /\bfunction\s+main\s*\(/.test(source) || /\bconst\s+main\s*=\s*\(/.test(source);
  }
  if (language === "go") {
    return /\bfunc\s+main\s*\(/.test(source);
  }
  if (language === "rust") {
    return /\bfn\s+main\s*\(/.test(source);
  }

  return false;
}

function responseHasFullProgram(text) {
  const source = String(text || "");
  return (
    /public\s+class\s+Main/.test(source) ||
    /\bmain\s*\(/.test(source) ||
    /if __name__ == "__main__":/.test(source) ||
    /\bfunc\s+main\s*\(/.test(source) ||
    /\bfn\s+main\s*\(/.test(source)
  );
}

function applyFullProgramWrapper(taskId, language, snippet, style) {
  if (!style.wantsFullCode) {
    return snippet;
  }

  if (taskId === "palindrome" && language === "c") {
    return [
      "#include <stdio.h>",
      "#include <string.h>",
      "",
      "int is_palindrome(const char* s) {",
      "  int left = 0;",
      "  int right = (int)strlen(s) - 1;",
      "  while (left < right) {",
      "    if (s[left] != s[right]) return 0;",
      "    left++;",
      "    right--;",
      "  }",
      "  return 1;",
      "}",
      "",
      "int main(void) {",
      "  char s[512];",
      "  if (!fgets(s, sizeof(s), stdin)) return 0;",
      "  s[strcspn(s, \"\\n\")] = '\\0';",
      "  printf(\"%s\\n\", is_palindrome(s) ? \"Palindrome\" : \"Not Palindrome\");",
      "  return 0;",
      "}"
    ].join("\n");
  }

  if (taskId === "add_two_numbers" && language === "c") {
    return [
      "#include <stdio.h>",
      "",
      "int add(int a, int b) {",
      "  return a + b;",
      "}",
      "",
      "int main(void) {",
      "  int a, b;",
      "  if (scanf(\"%d %d\", &a, &b) != 2) return 0;",
      "  printf(\"%d\\n\", add(a, b));",
      "  return 0;",
      "}"
    ].join("\n");
  }

  if (taskId === "vowel_check" && language === "c") {
    return [
      "#include <ctype.h>",
      "#include <stdio.h>",
      "",
      "int is_vowel(char ch) {",
      "  ch = (char)tolower((unsigned char)ch);",
      "  return ch == 'a' || ch == 'e' || ch == 'i' || ch == 'o' || ch == 'u';",
      "}",
      "",
      "int main(void) {",
      "  char ch;",
      "  if (scanf(\" %c\", &ch) != 1) return 0;",
      "  if (!isalpha((unsigned char)ch)) {",
      "    printf(\"Not an alphabet\\n\");",
      "    return 0;",
      "  }",
      "  printf(\"%s\\n\", is_vowel(ch) ? \"Vowel\" : \"Consonant\");",
      "  return 0;",
      "}"
    ].join("\n");
  }

  if (taskId === "add_two_numbers" && language === "cpp") {
    return [
      "#include <bits/stdc++.h>",
      "using namespace std;",
      "",
      "int add(int a, int b) {",
      "  return a + b;",
      "}",
      "",
      "int main() {",
      "  ios::sync_with_stdio(false);",
      "  cin.tie(nullptr);",
      "  int a, b;",
      "  if (!(cin >> a >> b)) return 0;",
      "  cout << add(a, b) << '\\n';",
      "  return 0;",
      "}"
    ].join("\n");
  }

  if (taskId === "add_two_numbers" && language === "java") {
    return [
      "import java.util.*;",
      "",
      "public class Main {",
      "  public static int add(int a, int b) {",
      "    return a + b;",
      "  }",
      "",
      "  public static void main(String[] args) {",
      "    Scanner sc = new Scanner(System.in);",
      "    if (!sc.hasNextInt()) return;",
      "    int a = sc.nextInt();",
      "    if (!sc.hasNextInt()) return;",
      "    int b = sc.nextInt();",
      "    System.out.println(add(a, b));",
      "  }",
      "}"
    ].join("\n");
  }

  if (taskId === "add_two_numbers" && language === "javascript") {
    return [
      "const fs = require(\"fs\");",
      "",
      "function add(a, b) {",
      "  return a + b;",
      "}",
      "",
      "const data = fs.readFileSync(0, \"utf8\").trim().split(/\\s+/).map(Number);",
      "if (data.length < 2) process.exit(0);",
      "console.log(add(data[0], data[1]));"
    ].join("\n");
  }

  if (taskId === "add_two_numbers" && language === "typescript") {
    return [
      "import * as fs from \"fs\";",
      "",
      "function add(a: number, b: number): number {",
      "  return a + b;",
      "}",
      "",
      "const data = fs.readFileSync(0, \"utf8\").trim().split(/\\s+/).map(Number);",
      "if (data.length < 2) process.exit(0);",
      "console.log(add(data[0], data[1]));"
    ].join("\n");
  }

  if (taskId === "add_two_numbers" && language === "go") {
    return [
      "package main",
      "",
      "import \"fmt\"",
      "",
      "func add(a int, b int) int {",
      "  return a + b",
      "}",
      "",
      "func main() {",
      "  var a, b int",
      "  if _, err := fmt.Scan(&a, &b); err != nil {",
      "    return",
      "  }",
      "  fmt.Println(add(a, b))",
      "}"
    ].join("\n");
  }

  if (taskId === "add_two_numbers" && language === "rust") {
    return [
      "use std::io::{self, Read};",
      "",
      "fn add(a: i32, b: i32) -> i32 {",
      "    a + b",
      "}",
      "",
      "fn main() {",
      "    let mut input = String::new();",
      "    io::stdin().read_to_string(&mut input).ok();",
      "    let values: Vec<i32> = input",
      "        .split_whitespace()",
      "        .filter_map(|token| token.parse::<i32>().ok())",
      "        .collect();",
      "    if values.len() < 2 {",
      "        return;",
      "    }",
      "    println!(\"{}\", add(values[0], values[1]));",
      "}"
    ].join("\n");
  }

  if (taskId === "add_two_numbers" && language === "python") {
    return [
      "def add(a, b):",
      "    return a + b",
      "",
      "def main():",
      "    try:",
      "        a, b = map(int, input().split())",
      "    except ValueError:",
      "        return",
      "    print(add(a, b))",
      "",
      "if __name__ == \"__main__\":",
      "    main()"
    ].join("\n");
  }

  if (taskId === "palindrome" && language === "cpp") {
    return [
      "#include <bits/stdc++.h>",
      "using namespace std;",
      "",
      "bool isPalindrome(const string& s) {",
      "  int left = 0, right = (int)s.size() - 1;",
      "  while (left < right) {",
      "    if (s[left] != s[right]) return false;",
      "    left++;",
      "    right--;",
      "  }",
      "  return true;",
      "}",
      "",
      "int main() {",
      "  string s;",
      "  getline(cin, s);",
      "  cout << (isPalindrome(s) ? \"Palindrome\" : \"Not Palindrome\") << \"\\n\";",
      "  return 0;",
      "}"
    ].join("\n");
  }

  if (hasEntryPoint(language, snippet)) {
    return snippet;
  }

  if (language === "java") {
    return [
      "import java.io.*;",
      "import java.util.*;",
      "",
      "public class Main {",
      indentCode(snippet),
      "",
      "  public static void main(String[] args) throws Exception {",
      "    // Call the method above with your required input here.",
      "  }",
      "}"
    ].join("\n");
  }

  if (language === "c") {
    return [
      "#include <stdio.h>",
      "#include <stdlib.h>",
      "#include <string.h>",
      "",
      snippet,
      "",
      "int main(void) {",
      "  // Read input, call the function above, and print the result here.",
      "  return 0;",
      "}"
    ].join("\n");
  }

  if (language === "cpp") {
    return [
      "#include <bits/stdc++.h>",
      "using namespace std;",
      "",
      snippet,
      "",
      "int main() {",
      "  ios::sync_with_stdio(false);",
      "  cin.tie(nullptr);",
      "  // Read input, call the function above, and print the result here.",
      "  return 0;",
      "}"
    ].join("\n");
  }

  if (language === "javascript") {
    return [
      snippet,
      "",
      "function main() {",
      "  // Read input or call the function above here.",
      "}",
      "",
      "main();"
    ].join("\n");
  }

  if (language === "typescript") {
    return [
      snippet,
      "",
      "function main(): void {",
      "  // Read input or call the function above here.",
      "}",
      "",
      "main();"
    ].join("\n");
  }

  if (language === "go") {
    return [
      "package main",
      "",
      "import \"fmt\"",
      "",
      "var _ = fmt.Println",
      "",
      snippet,
      "",
      "func main() {",
      "  // Read input, call the function above, and print the result here.",
      "}"
    ].join("\n");
  }

  if (language === "rust") {
    return [
      snippet,
      "",
      "fn main() {",
      "    // Read input, call the function above, and print the result here.",
      "}"
    ].join("\n");
  }

  if (language === "python") {
    if (snippet.includes("if __name__ == \"__main__\":")) {
      return snippet;
    }
    return `${snippet}\n\nif __name__ == \"__main__\":\n    # example usage\n    pass`;
  }

  return snippet;
}

function buildTaskSnippet(taskId, language, style) {
  const wrap = (code) => applyFullProgramWrapper(taskId, language, code, style);

  if (taskId === "add_two_numbers") {
    return wrap(
      snippetByLanguage(language, {
      python: "def add(a, b):\n    return a + b",
      javascript: "function add(a, b) {\n  return a + b;\n}",
      typescript: "function add(a: number, b: number): number {\n  return a + b;\n}",
      java: "public static int add(int a, int b) {\n  return a + b;\n}",
      c: "int add(int a, int b) {\n  return a + b;\n}",
      cpp: "int add(int a, int b) {\n  return a + b;\n}",
      go: "func Add(a int, b int) int {\n  return a + b\n}",
      rust: "fn add(a: i32, b: i32) -> i32 {\n    a + b\n}"
    })
    );
  }

  if (taskId === "factorial") {
    const recursive = snippetByLanguage(language, {
      python: "def factorial(n):\n    if n < 0:\n        raise ValueError(\"n must be non-negative\")\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)",
      javascript: "function factorial(n) {\n  if (n < 0) throw new Error(\"n must be non-negative\");\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}",
      typescript: "function factorial(n: number): number {\n  if (n < 0) throw new Error(\"n must be non-negative\");\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}",
      java: "public static long factorial(int n) {\n  if (n < 0) throw new IllegalArgumentException(\"n must be non-negative\");\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}",
      c: "long long factorial(int n) {\n  if (n < 0) return -1;\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}",
      cpp: "long long factorial(int n) {\n  if (n < 0) return -1;\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}",
      go: "func Factorial(n int) int {\n  if n < 0 {\n    return -1\n  }\n  if n <= 1 {\n    return 1\n  }\n  return n * Factorial(n-1)\n}",
      rust: "fn factorial(n: i64) -> i64 {\n    if n < 0 { return -1; }\n    if n <= 1 { return 1; }\n    n * factorial(n - 1)\n}"
    });

    const iterative = snippetByLanguage(language, {
      python: "def factorial(n):\n    if n < 0:\n        raise ValueError(\"n must be non-negative\")\n    result = 1\n    for i in range(2, n + 1):\n        result *= i\n    return result",
      javascript: "function factorial(n) {\n  if (n < 0) throw new Error(\"n must be non-negative\");\n  let result = 1;\n  for (let i = 2; i <= n; i += 1) result *= i;\n  return result;\n}",
      typescript: "function factorial(n: number): number {\n  if (n < 0) throw new Error(\"n must be non-negative\");\n  let result = 1;\n  for (let i = 2; i <= n; i += 1) result *= i;\n  return result;\n}",
      java: "public static long factorial(int n) {\n  if (n < 0) throw new IllegalArgumentException(\"n must be non-negative\");\n  long result = 1;\n  for (int i = 2; i <= n; i++) result *= i;\n  return result;\n}",
      c: "long long factorial(int n) {\n  if (n < 0) return -1;\n  long long result = 1;\n  for (int i = 2; i <= n; i++) result *= i;\n  return result;\n}",
      cpp: "long long factorial(int n) {\n  if (n < 0) return -1;\n  long long result = 1;\n  for (int i = 2; i <= n; i++) result *= i;\n  return result;\n}",
      go: "func Factorial(n int) int {\n  if n < 0 {\n    return -1\n  }\n  result := 1\n  for i := 2; i <= n; i++ {\n    result *= i\n  }\n  return result\n}",
      rust: "fn factorial(n: i64) -> i64 {\n    if n < 0 { return -1; }\n    let mut result = 1;\n    for i in 2..=n {\n        result *= i;\n    }\n    result\n}"
    });

    if (style.wantsRecursive) {
      return wrap(recursive);
    }
    return wrap(iterative);
  }

  if (taskId === "vowel_check") {
    return wrap(
      snippetByLanguage(language, {
      python: "def is_vowel(ch):\n    return ch.lower() in {'a', 'e', 'i', 'o', 'u'}",
      javascript: "function isVowel(ch) {\n  return \"aeiou\".includes(ch.toLowerCase());\n}",
      typescript: "function isVowel(ch: string): boolean {\n  return \"aeiou\".includes(ch.toLowerCase());\n}",
      java: "public static boolean isVowel(char ch) {\n  ch = Character.toLowerCase(ch);\n  return ch == 'a' || ch == 'e' || ch == 'i' || ch == 'o' || ch == 'u';\n}",
      c: "int is_vowel(char ch) {\n  ch = (char)tolower((unsigned char)ch);\n  return ch == 'a' || ch == 'e' || ch == 'i' || ch == 'o' || ch == 'u';\n}",
      cpp: "bool isVowel(char ch) {\n  ch = (char)tolower(static_cast<unsigned char>(ch));\n  return ch == 'a' || ch == 'e' || ch == 'i' || ch == 'o' || ch == 'u';\n}",
      go: "func IsVowel(ch byte) bool {\n  switch ch | 32 {\n  case 'a', 'e', 'i', 'o', 'u':\n    return true\n  default:\n    return false\n  }\n}",
      rust: "fn is_vowel(ch: char) -> bool {\n    matches!(ch.to_ascii_lowercase(), 'a' | 'e' | 'i' | 'o' | 'u')\n}"
    })
    );
  }

  if (taskId === "fibonacci") {
    const iterative = snippetByLanguage(language, {
      python: "def fibonacci(n):\n    if n < 0:\n        raise ValueError(\"n must be non-negative\")\n    if n <= 1:\n        return n\n    a, b = 0, 1\n    for _ in range(2, n + 1):\n        a, b = b, a + b\n    return b",
      javascript: "function fibonacci(n) {\n  if (n < 0) throw new Error(\"n must be non-negative\");\n  if (n <= 1) return n;\n  let a = 0, b = 1;\n  for (let i = 2; i <= n; i += 1) {\n    [a, b] = [b, a + b];\n  }\n  return b;\n}",
      typescript: "function fibonacci(n: number): number {\n  if (n < 0) throw new Error(\"n must be non-negative\");\n  if (n <= 1) return n;\n  let a = 0, b = 1;\n  for (let i = 2; i <= n; i += 1) {\n    [a, b] = [b, a + b];\n  }\n  return b;\n}",
      java: "public static long fibonacci(int n) {\n  if (n < 0) throw new IllegalArgumentException(\"n must be non-negative\");\n  if (n <= 1) return n;\n  long a = 0, b = 1;\n  for (int i = 2; i <= n; i++) {\n    long next = a + b;\n    a = b;\n    b = next;\n  }\n  return b;\n}",
      c: "long long fibonacci(int n) {\n  if (n < 0) return -1;\n  if (n <= 1) return n;\n  long long a = 0, b = 1;\n  for (int i = 2; i <= n; i++) {\n    long long next = a + b;\n    a = b;\n    b = next;\n  }\n  return b;\n}",
      cpp: "long long fibonacci(int n) {\n  if (n < 0) return -1;\n  if (n <= 1) return n;\n  long long a = 0, b = 1;\n  for (int i = 2; i <= n; i++) {\n    long long next = a + b;\n    a = b;\n    b = next;\n  }\n  return b;\n}",
      go: "func Fibonacci(n int) int {\n  if n < 0 {\n    return -1\n  }\n  if n <= 1 {\n    return n\n  }\n  a, b := 0, 1\n  for i := 2; i <= n; i++ {\n    a, b = b, a+b\n  }\n  return b\n}",
      rust: "fn fibonacci(n: i64) -> i64 {\n    if n < 0 { return -1; }\n    if n <= 1 { return n; }\n    let (mut a, mut b) = (0, 1);\n    for _ in 2..=n {\n        let next = a + b;\n        a = b;\n        b = next;\n    }\n    b\n}"
    });

    const recursiveMemo = snippetByLanguage(language, {
      python: "from functools import lru_cache\n\n@lru_cache(maxsize=None)\ndef fibonacci(n):\n    if n < 0:\n        raise ValueError(\"n must be non-negative\")\n    if n <= 1:\n        return n\n    return fibonacci(n - 1) + fibonacci(n - 2)",
      javascript: "function fibonacci(n, memo = {}) {\n  if (n < 0) throw new Error(\"n must be non-negative\");\n  if (n <= 1) return n;\n  if (memo[n] !== undefined) return memo[n];\n  memo[n] = fibonacci(n - 1, memo) + fibonacci(n - 2, memo);\n  return memo[n];\n}",
      typescript: "function fibonacci(n: number, memo: Record<number, number> = {}): number {\n  if (n < 0) throw new Error(\"n must be non-negative\");\n  if (n <= 1) return n;\n  if (memo[n] !== undefined) return memo[n];\n  memo[n] = fibonacci(n - 1, memo) + fibonacci(n - 2, memo);\n  return memo[n];\n}",
      java: "public static long fibonacci(int n, Map<Integer, Long> memo) {\n  if (n < 0) throw new IllegalArgumentException(\"n must be non-negative\");\n  if (n <= 1) return n;\n  if (memo.containsKey(n)) return memo.get(n);\n  long value = fibonacci(n - 1, memo) + fibonacci(n - 2, memo);\n  memo.put(n, value);\n  return value;\n}",
      c: "/* Recursive fibonacci is expensive without memoization.\n   Use iterative version for C in practice. */\nlong long fibonacci(int n) {\n  if (n < 0) return -1;\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}",
      cpp: "long long fibonacci(int n, unordered_map<int, long long>& memo) {\n  if (n < 0) return -1;\n  if (n <= 1) return n;\n  if (memo.count(n)) return memo[n];\n  return memo[n] = fibonacci(n - 1, memo) + fibonacci(n - 2, memo);\n}",
      go: "func Fibonacci(n int, memo map[int]int) int {\n  if n < 0 {\n    return -1\n  }\n  if n <= 1 {\n    return n\n  }\n  if v, ok := memo[n]; ok {\n    return v\n  }\n  memo[n] = Fibonacci(n-1, memo) + Fibonacci(n-2, memo)\n  return memo[n]\n}",
      rust: "fn fibonacci(n: i64, memo: &mut std::collections::HashMap<i64, i64>) -> i64 {\n    if n < 0 { return -1; }\n    if n <= 1 { return n; }\n    if let Some(v) = memo.get(&n) { return *v; }\n    let v = fibonacci(n - 1, memo) + fibonacci(n - 2, memo);\n    memo.insert(n, v);\n    v\n}"
    });

    if (style.wantsRecursive) {
      return wrap(recursiveMemo);
    }
    return wrap(iterative);
  }

  if (taskId === "prime_check") {
    return wrap(
      snippetByLanguage(language, {
      python: "def is_prime(n):\n    if n <= 1:\n        return False\n    i = 2\n    while i * i <= n:\n        if n % i == 0:\n            return False\n        i += 1\n    return True",
      javascript: "function isPrime(n) {\n  if (n <= 1) return false;\n  for (let i = 2; i * i <= n; i += 1) {\n    if (n % i === 0) return false;\n  }\n  return true;\n}",
      typescript: "function isPrime(n: number): boolean {\n  if (n <= 1) return false;\n  for (let i = 2; i * i <= n; i += 1) {\n    if (n % i === 0) return false;\n  }\n  return true;\n}",
      java: "public static boolean isPrime(int n) {\n  if (n <= 1) return false;\n  for (int i = 2; i * i <= n; i++) {\n    if (n % i == 0) return false;\n  }\n  return true;\n}",
      c: "int is_prime(int n) {\n  if (n <= 1) return 0;\n  for (int i = 2; i * i <= n; i++) {\n    if (n % i == 0) return 0;\n  }\n  return 1;\n}",
      cpp: "bool isPrime(int n) {\n  if (n <= 1) return false;\n  for (int i = 2; i * i <= n; i++) {\n    if (n % i == 0) return false;\n  }\n  return true;\n}",
      go: "func IsPrime(n int) bool {\n  if n <= 1 {\n    return false\n  }\n  for i := 2; i*i <= n; i++ {\n    if n%i == 0 {\n      return false\n    }\n  }\n  return true\n}",
      rust: "fn is_prime(n: i64) -> bool {\n    if n <= 1 { return false; }\n    let mut i = 2;\n    while i * i <= n {\n        if n % i == 0 { return false; }\n        i += 1;\n    }\n    true\n}"
    })
    );
  }

  if (taskId === "palindrome") {
    return wrap(
      snippetByLanguage(language, {
      python: "def is_palindrome(s):\n    left, right = 0, len(s) - 1\n    while left < right:\n        if s[left] != s[right]:\n            return False\n        left += 1\n        right -= 1\n    return True",
      javascript: "function isPalindrome(s) {\n  let left = 0;\n  let right = s.length - 1;\n  while (left < right) {\n    if (s[left] !== s[right]) return false;\n    left += 1;\n    right -= 1;\n  }\n  return true;\n}",
      typescript: "function isPalindrome(s: string): boolean {\n  let left = 0;\n  let right = s.length - 1;\n  while (left < right) {\n    if (s[left] !== s[right]) return false;\n    left += 1;\n    right -= 1;\n  }\n  return true;\n}",
      java: "public static boolean isPalindrome(String s) {\n  int left = 0, right = s.length() - 1;\n  while (left < right) {\n    if (s.charAt(left) != s.charAt(right)) return false;\n    left++;\n    right--;\n  }\n  return true;\n}",
      c: "int is_palindrome(const char* s) {\n  int left = 0;\n  int right = (int)strlen(s) - 1;\n  while (left < right) {\n    if (s[left] != s[right]) return 0;\n    left++;\n    right--;\n  }\n  return 1;\n}",
      cpp: "bool isPalindrome(const string& s) {\n  int left = 0;\n  int right = (int)s.size() - 1;\n  while (left < right) {\n    if (s[left] != s[right]) return false;\n    left++;\n    right--;\n  }\n  return true;\n}",
      go: "func IsPalindrome(s string) bool {\n  left, right := 0, len(s)-1\n  for left < right {\n    if s[left] != s[right] {\n      return false\n    }\n    left++\n    right--\n  }\n  return true\n}",
      rust: "fn is_palindrome(s: &str) -> bool {\n    let bytes = s.as_bytes();\n    let (mut left, mut right) = (0usize, bytes.len().saturating_sub(1));\n    while left < right {\n        if bytes[left] != bytes[right] { return false; }\n        left += 1;\n        right = right.saturating_sub(1);\n    }\n    true\n}"
    })
    );
  }

  if (taskId === "reverse_string") {
    return wrap(
      snippetByLanguage(language, {
      python: "def reverse_string(s):\n    return s[::-1]",
      javascript: "function reverseString(s) {\n  return s.split(\"\").reverse().join(\"\");\n}",
      typescript: "function reverseString(s: string): string {\n  return s.split(\"\").reverse().join(\"\");\n}",
      java: "public static String reverseString(String s) {\n  return new StringBuilder(s).reverse().toString();\n}",
      c: "void reverse_string(char* s) {\n  int left = 0;\n  int right = (int)strlen(s) - 1;\n  while (left < right) {\n    char tmp = s[left];\n    s[left] = s[right];\n    s[right] = tmp;\n    left++;\n    right--;\n  }\n}",
      cpp: "string reverseString(string s) {\n  reverse(s.begin(), s.end());\n  return s;\n}",
      go: "func ReverseString(s string) string {\n  runes := []rune(s)\n  for left, right := 0, len(runes)-1; left < right; left, right = left+1, right-1 {\n    runes[left], runes[right] = runes[right], runes[left]\n  }\n  return string(runes)\n}",
      rust: "fn reverse_string(s: &str) -> String {\n    s.chars().rev().collect()\n}"
    })
    );
  }

  if (taskId === "binary_search") {
    return wrap(
      snippetByLanguage(language, {
      python: "def binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if arr[mid] == target:\n            return mid\n        if arr[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1",
      javascript: "function binarySearch(arr, target) {\n  let left = 0;\n  let right = arr.length - 1;\n  while (left <= right) {\n    const mid = Math.floor((left + right) / 2);\n    if (arr[mid] === target) return mid;\n    if (arr[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}",
      typescript: "function binarySearch(arr: number[], target: number): number {\n  let left = 0;\n  let right = arr.length - 1;\n  while (left <= right) {\n    const mid = Math.floor((left + right) / 2);\n    if (arr[mid] === target) return mid;\n    if (arr[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}",
      java: "public static int binarySearch(int[] arr, int target) {\n  int left = 0, right = arr.length - 1;\n  while (left <= right) {\n    int mid = left + (right - left) / 2;\n    if (arr[mid] == target) return mid;\n    if (arr[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}",
      c: "int binary_search(int arr[], int n, int target) {\n  int left = 0, right = n - 1;\n  while (left <= right) {\n    int mid = left + (right - left) / 2;\n    if (arr[mid] == target) return mid;\n    if (arr[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}",
      cpp: "int binarySearch(const vector<int>& arr, int target) {\n  int left = 0, right = (int)arr.size() - 1;\n  while (left <= right) {\n    int mid = left + (right - left) / 2;\n    if (arr[mid] == target) return mid;\n    if (arr[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}",
      go: "func BinarySearch(arr []int, target int) int {\n  left, right := 0, len(arr)-1\n  for left <= right {\n    mid := left + (right-left)/2\n    if arr[mid] == target {\n      return mid\n    }\n    if arr[mid] < target {\n      left = mid + 1\n    } else {\n      right = mid - 1\n    }\n  }\n  return -1\n}",
      rust: "fn binary_search(arr: &[i32], target: i32) -> i32 {\n    let (mut left, mut right) = (0i32, arr.len() as i32 - 1);\n    while left <= right {\n        let mid = left + (right - left) / 2;\n        let value = arr[mid as usize];\n        if value == target { return mid; }\n        if value < target { left = mid + 1; }\n        else { right = mid - 1; }\n    }\n    -1\n}"
    })
    );
  }

  if (taskId === "sort_array") {
    return wrap(
      snippetByLanguage(language, {
      python: "def sort_array(arr):\n    return sorted(arr)",
      javascript: "function sortArray(arr) {\n  return [...arr].sort((a, b) => a - b);\n}",
      typescript: "function sortArray(arr: number[]): number[] {\n  return [...arr].sort((a, b) => a - b);\n}",
      java: "public static int[] sortArray(int[] arr) {\n  int[] copy = Arrays.copyOf(arr, arr.length);\n  Arrays.sort(copy);\n  return copy;\n}",
      c: "void sort_array(int arr[], int n) {\n  for (int i = 0; i < n - 1; i++) {\n    for (int j = 0; j < n - i - 1; j++) {\n      if (arr[j] > arr[j + 1]) {\n        int tmp = arr[j];\n        arr[j] = arr[j + 1];\n        arr[j + 1] = tmp;\n      }\n    }\n  }\n}",
      cpp: "vector<int> sortArray(vector<int> arr) {\n  sort(arr.begin(), arr.end());\n  return arr;\n}",
      go: "func SortArray(arr []int) []int {\n  out := append([]int{}, arr...)\n  sort.Ints(out)\n  return out\n}",
      rust: "fn sort_array(mut arr: Vec<i32>) -> Vec<i32> {\n    arr.sort();\n    arr\n}"
    })
    );
  }

  if (taskId === "two_sum") {
    return wrap(
      snippetByLanguage(language, {
      python: "def two_sum(nums, target):\n    seen = {}\n    for i, x in enumerate(nums):\n        need = target - x\n        if need in seen:\n            return [seen[need], i]\n        seen[x] = i\n    return []",
      javascript: "function twoSum(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i += 1) {\n    const need = target - nums[i];\n    if (seen.has(need)) return [seen.get(need), i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}",
      typescript: "function twoSum(nums: number[], target: number): number[] {\n  const seen = new Map<number, number>();\n  for (let i = 0; i < nums.length; i += 1) {\n    const need = target - nums[i];\n    if (seen.has(need)) return [seen.get(need) as number, i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}",
      java: "public static int[] twoSum(int[] nums, int target) {\n  Map<Integer, Integer> seen = new HashMap<>();\n  for (int i = 0; i < nums.length; i++) {\n    int need = target - nums[i];\n    if (seen.containsKey(need)) return new int[]{seen.get(need), i};\n    seen.put(nums[i], i);\n  }\n  return new int[]{};\n}",
      c: "/* Return indices through output pointers i1 and i2; return 1 if found else 0 */\nint two_sum(int nums[], int n, int target, int* i1, int* i2) {\n  for (int i = 0; i < n; i++) {\n    for (int j = i + 1; j < n; j++) {\n      if (nums[i] + nums[j] == target) {\n        *i1 = i;\n        *i2 = j;\n        return 1;\n      }\n    }\n  }\n  return 0;\n}",
      cpp: "vector<int> twoSum(vector<int>& nums, int target) {\n  unordered_map<int, int> seen;\n  for (int i = 0; i < (int)nums.size(); i++) {\n    int need = target - nums[i];\n    if (seen.count(need)) return {seen[need], i};\n    seen[nums[i]] = i;\n  }\n  return {};\n}",
      go: "func TwoSum(nums []int, target int) []int {\n  seen := map[int]int{}\n  for i, x := range nums {\n    need := target - x\n    if j, ok := seen[need]; ok {\n      return []int{j, i}\n    }\n    seen[x] = i\n  }\n  return []int{}\n}",
      rust: "fn two_sum(nums: &[i32], target: i32) -> Vec<usize> {\n    let mut seen = std::collections::HashMap::new();\n    for (i, &x) in nums.iter().enumerate() {\n      let need = target - x;\n      if let Some(&j) = seen.get(&need) {\n        return vec![j, i];\n      }\n      seen.insert(x, i);\n    }\n    vec![]\n}"
    })
    );
  }

  if (taskId === "longest_substring_no_repeat") {
    return wrap(
      snippetByLanguage(language, {
        python:
          "def length_of_longest_substring(s):\n    last = {}\n    left = 0\n    best = 0\n    for right, ch in enumerate(s):\n        if ch in last and last[ch] >= left:\n            left = last[ch] + 1\n        last[ch] = right\n        best = max(best, right - left + 1)\n    return best",
        javascript:
          "function lengthOfLongestSubstring(s) {\n  const last = new Map();\n  let left = 0;\n  let best = 0;\n  for (let right = 0; right < s.length; right += 1) {\n    const ch = s[right];\n    if (last.has(ch) && last.get(ch) >= left) {\n      left = last.get(ch) + 1;\n    }\n    last.set(ch, right);\n    best = Math.max(best, right - left + 1);\n  }\n  return best;\n}",
        typescript:
          "function lengthOfLongestSubstring(s: string): number {\n  const last = new Map<string, number>();\n  let left = 0;\n  let best = 0;\n  for (let right = 0; right < s.length; right += 1) {\n    const ch = s[right];\n    if (last.has(ch) && (last.get(ch) as number) >= left) {\n      left = (last.get(ch) as number) + 1;\n    }\n    last.set(ch, right);\n    best = Math.max(best, right - left + 1);\n  }\n  return best;\n}",
        java:
          "public static int lengthOfLongestSubstring(String s) {\n  Map<Character, Integer> last = new HashMap<>();\n  int left = 0;\n  int best = 0;\n  for (int right = 0; right < s.length(); right++) {\n    char ch = s.charAt(right);\n    if (last.containsKey(ch) && last.get(ch) >= left) {\n      left = last.get(ch) + 1;\n    }\n    last.put(ch, right);\n    best = Math.max(best, right - left + 1);\n  }\n  return best;\n}",
        cpp:
          "int lengthOfLongestSubstring(const string& s) {\n  unordered_map<char, int> last;\n  int left = 0;\n  int best = 0;\n  for (int right = 0; right < (int)s.size(); right++) {\n    char ch = s[right];\n    if (last.count(ch) && last[ch] >= left) {\n      left = last[ch] + 1;\n    }\n    last[ch] = right;\n    best = max(best, right - left + 1);\n  }\n  return best;\n}"
      })
    );
  }

  if (taskId === "maximum_subarray") {
    return wrap(
      snippetByLanguage(language, {
        python:
          "def max_subarray(nums):\n    best = nums[0]\n    current = nums[0]\n    for x in nums[1:]:\n        current = max(x, current + x)\n        best = max(best, current)\n    return best",
        javascript:
          "function maxSubArray(nums) {\n  let best = nums[0];\n  let current = nums[0];\n  for (let i = 1; i < nums.length; i += 1) {\n    current = Math.max(nums[i], current + nums[i]);\n    best = Math.max(best, current);\n  }\n  return best;\n}",
        typescript:
          "function maxSubArray(nums: number[]): number {\n  let best = nums[0];\n  let current = nums[0];\n  for (let i = 1; i < nums.length; i += 1) {\n    current = Math.max(nums[i], current + nums[i]);\n    best = Math.max(best, current);\n  }\n  return best;\n}",
        java:
          "public static int maxSubArray(int[] nums) {\n  int best = nums[0];\n  int current = nums[0];\n  for (int i = 1; i < nums.length; i++) {\n    current = Math.max(nums[i], current + nums[i]);\n    best = Math.max(best, current);\n  }\n  return best;\n}",
        cpp:
          "int maxSubArray(vector<int>& nums) {\n  int best = nums[0];\n  int current = nums[0];\n  for (int i = 1; i < (int)nums.size(); i++) {\n    current = max(nums[i], current + nums[i]);\n    best = max(best, current);\n  }\n  return best;\n}"
      })
    );
  }

  if (taskId === "merge_intervals") {
    return wrap(
      snippetByLanguage(language, {
        python:
          "def merge(intervals):\n    intervals.sort()\n    merged = []\n    for start, end in intervals:\n        if not merged or merged[-1][1] < start:\n            merged.append([start, end])\n        else:\n            merged[-1][1] = max(merged[-1][1], end)\n    return merged",
        javascript:
          "function merge(intervals) {\n  intervals.sort((a, b) => a[0] - b[0]);\n  const merged = [];\n  for (const [start, end] of intervals) {\n    if (merged.length === 0 || merged[merged.length - 1][1] < start) {\n      merged.push([start, end]);\n    } else {\n      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], end);\n    }\n  }\n  return merged;\n}",
        typescript:
          "function merge(intervals: number[][]): number[][] {\n  intervals.sort((a, b) => a[0] - b[0]);\n  const merged: number[][] = [];\n  for (const [start, end] of intervals) {\n    if (merged.length === 0 || merged[merged.length - 1][1] < start) {\n      merged.push([start, end]);\n    } else {\n      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], end);\n    }\n  }\n  return merged;\n}",
        java:
          "public static int[][] merge(int[][] intervals) {\n  Arrays.sort(intervals, Comparator.comparingInt(a -> a[0]));\n  List<int[]> merged = new ArrayList<>();\n  for (int[] interval : intervals) {\n    if (merged.isEmpty() || merged.get(merged.size() - 1)[1] < interval[0]) {\n      merged.add(new int[]{interval[0], interval[1]});\n    } else {\n      merged.get(merged.size() - 1)[1] = Math.max(merged.get(merged.size() - 1)[1], interval[1]);\n    }\n  }\n  return merged.toArray(new int[merged.size()][]);\n}",
        cpp:
          "vector<vector<int>> merge(vector<vector<int>>& intervals) {\n  sort(intervals.begin(), intervals.end());\n  vector<vector<int>> merged;\n  for (const auto& interval : intervals) {\n    if (merged.empty() || merged.back()[1] < interval[0]) {\n      merged.push_back(interval);\n    } else {\n      merged.back()[1] = max(merged.back()[1], interval[1]);\n    }\n  }\n  return merged;\n}"
      })
    );
  }

  if (taskId === "subarray_sum_k") {
    return wrap(
      snippetByLanguage(language, {
        python:
          "def subarray_sum(nums, k):\n    count = 0\n    prefix = 0\n    seen = {0: 1}\n    for x in nums:\n        prefix += x\n        count += seen.get(prefix - k, 0)\n        seen[prefix] = seen.get(prefix, 0) + 1\n    return count",
        javascript:
          "function subarraySum(nums, k) {\n  let count = 0;\n  let prefix = 0;\n  const seen = new Map([[0, 1]]);\n  for (const x of nums) {\n    prefix += x;\n    count += seen.get(prefix - k) || 0;\n    seen.set(prefix, (seen.get(prefix) || 0) + 1);\n  }\n  return count;\n}",
        typescript:
          "function subarraySum(nums: number[], k: number): number {\n  let count = 0;\n  let prefix = 0;\n  const seen = new Map<number, number>([[0, 1]]);\n  for (const x of nums) {\n    prefix += x;\n    count += seen.get(prefix - k) || 0;\n    seen.set(prefix, (seen.get(prefix) || 0) + 1);\n  }\n  return count;\n}",
        java:
          "public static int subarraySum(int[] nums, int k) {\n  Map<Integer, Integer> seen = new HashMap<>();\n  seen.put(0, 1);\n  int count = 0;\n  int prefix = 0;\n  for (int x : nums) {\n    prefix += x;\n    count += seen.getOrDefault(prefix - k, 0);\n    seen.put(prefix, seen.getOrDefault(prefix, 0) + 1);\n  }\n  return count;\n}",
        cpp:
          "int subarraySum(vector<int>& nums, int k) {\n  unordered_map<int, int> seen;\n  seen[0] = 1;\n  int count = 0;\n  int prefix = 0;\n  for (int x : nums) {\n    prefix += x;\n    count += seen[prefix - k];\n    seen[prefix] += 1;\n  }\n  return count;\n}"
      })
    );
  }

  if (taskId === "binary_tree") {
    return wrap(
      snippetByLanguage(language, {
        python:
          "class Node:\n    def __init__(self, value):\n        self.value = value\n        self.left = None\n        self.right = None\n\n\ndef insert(root, value):\n    if root is None:\n        return Node(value)\n    if value < root.value:\n        root.left = insert(root.left, value)\n    else:\n        root.right = insert(root.right, value)\n    return root\n\n\ndef inorder(root):\n    if root is None:\n        return\n    inorder(root.left)\n    print(root.value, end=' ')\n    inorder(root.right)\n",
        javascript:
          "class Node {\n  constructor(value) {\n    this.value = value;\n    this.left = null;\n    this.right = null;\n  }\n}\n\nfunction insert(root, value) {\n  if (!root) return new Node(value);\n  if (value < root.value) root.left = insert(root.left, value);\n  else root.right = insert(root.right, value);\n  return root;\n}\n\nfunction inorder(root, out = []) {\n  if (!root) return out;\n  inorder(root.left, out);\n  out.push(root.value);\n  inorder(root.right, out);\n  return out;\n}\n",
        typescript:
          "class Node {\n  value: number;\n  left: Node | null = null;\n  right: Node | null = null;\n\n  constructor(value: number) {\n    this.value = value;\n  }\n}\n\nfunction insert(root: Node | null, value: number): Node {\n  if (!root) return new Node(value);\n  if (value < root.value) root.left = insert(root.left, value);\n  else root.right = insert(root.right, value);\n  return root;\n}\n\nfunction inorder(root: Node | null, out: number[] = []): number[] {\n  if (!root) return out;\n  inorder(root.left, out);\n  out.push(root.value);\n  inorder(root.right, out);\n  return out;\n}\n",
        java:
          "public class Main {\n  static class Node {\n    int value;\n    Node left, right;\n    Node(int value) { this.value = value; }\n  }\n\n  static Node insert(Node root, int value) {\n    if (root == null) return new Node(value);\n    if (value < root.value) root.left = insert(root.left, value);\n    else root.right = insert(root.right, value);\n    return root;\n  }\n\n  static void inorder(Node root) {\n    if (root == null) return;\n    inorder(root.left);\n    System.out.print(root.value + \" \");\n    inorder(root.right);\n  }\n\n  public static void main(String[] args) {\n    int[] values = {5, 3, 7, 2, 4, 6, 8};\n    Node root = null;\n    for (int v : values) root = insert(root, v);\n    inorder(root);\n  }\n}\n",
        c:
          "#include <stdio.h>\n#include <stdlib.h>\n\ntypedef struct Node {\n  int value;\n  struct Node* left;\n  struct Node* right;\n} Node;\n\nNode* create_node(int value) {\n  Node* node = (Node*)malloc(sizeof(Node));\n  node->value = value;\n  node->left = NULL;\n  node->right = NULL;\n  return node;\n}\n\nNode* insert(Node* root, int value) {\n  if (root == NULL) return create_node(value);\n  if (value < root->value) root->left = insert(root->left, value);\n  else root->right = insert(root->right, value);\n  return root;\n}\n\nvoid inorder(Node* root) {\n  if (root == NULL) return;\n  inorder(root->left);\n  printf(\"%d \", root->value);\n  inorder(root->right);\n}\n\nint main(void) {\n  int values[] = {5, 3, 7, 2, 4, 6, 8};\n  int n = sizeof(values) / sizeof(values[0]);\n  Node* root = NULL;\n\n  for (int i = 0; i < n; i++) {\n    root = insert(root, values[i]);\n  }\n\n  inorder(root);\n  printf(\"\\n\");\n  return 0;\n}\n",
        cpp:
          "#include <bits/stdc++.h>\nusing namespace std;\n\nstruct Node {\n  int value;\n  Node* left;\n  Node* right;\n  explicit Node(int value) : value(value), left(nullptr), right(nullptr) {}\n};\n\nNode* insert(Node* root, int value) {\n  if (!root) return new Node(value);\n  if (value < root->value) root->left = insert(root->left, value);\n  else root->right = insert(root->right, value);\n  return root;\n}\n\nvoid inorder(Node* root) {\n  if (!root) return;\n  inorder(root->left);\n  cout << root->value << \" \";\n  inorder(root->right);\n}\n",
        go:
          "package main\n\nimport \"fmt\"\n\ntype Node struct {\n  Value int\n  Left  *Node\n  Right *Node\n}\n\nfunc Insert(root *Node, value int) *Node {\n  if root == nil {\n    return &Node{Value: value}\n  }\n  if value < root.Value {\n    root.Left = Insert(root.Left, value)\n  } else {\n    root.Right = Insert(root.Right, value)\n  }\n  return root\n}\n\nfunc Inorder(root *Node) {\n  if root == nil {\n    return\n  }\n  Inorder(root.Left)\n  fmt.Printf(\"%d \", root.Value)\n  Inorder(root.Right)\n}\n",
        rust:
          "#[derive(Debug)]\nstruct Node {\n    value: i32,\n    left: Option<Box<Node>>,\n    right: Option<Box<Node>>,\n}\n\nfn insert(root: &mut Option<Box<Node>>, value: i32) {\n    match root {\n        None => {\n            *root = Some(Box::new(Node { value, left: None, right: None }));\n        }\n        Some(node) => {\n            if value < node.value {\n                insert(&mut node.left, value);\n            } else {\n                insert(&mut node.right, value);\n            }\n        }\n    }\n}\n\nfn inorder(root: &Option<Box<Node>>) {\n    if let Some(node) = root {\n        inorder(&node.left);\n        print!(\"{} \", node.value);\n        inorder(&node.right);\n    }\n}\n"
      })
    );
  }

  if (taskId === "pos_tagging") {
    return wrap(
      snippetByLanguage(language, {
        python:
          "import nltk\nfrom nltk import word_tokenize, pos_tag\n\n# Run once:\n# nltk.download('punkt')\n# nltk.download('averaged_perceptron_tagger')\n\ndef pos_tag_sentence(sentence: str):\n    tokens = word_tokenize(sentence)\n    return pos_tag(tokens)\n\nif __name__ == \"__main__\":\n    text = input().strip()\n    print(pos_tag_sentence(text))",
        javascript:
          "/* JavaScript usually uses external NLP libs/services for POS tagging.\n   Example below uses compromise for basic tags. */\nconst nlp = require('compromise');\n\nfunction posTagSentence(sentence) {\n  return nlp(sentence).terms().json();\n}",
        typescript:
          "/* TypeScript POS tagging generally relies on NLP libraries.\n   Install a library and map term tags to your output schema. */\nfunction posTagSentence(sentence: string) {\n  return sentence;\n}",
        java:
          "/* Java POS tagging is commonly done with Stanford CoreNLP or OpenNLP.\n   Configure the pipeline and run POS annotation on tokens. */",
        c:
          "/* C typically calls an external NLP model/service for POS tagging.\n   Core POS tagging models are not usually implemented from scratch in C for app code. */",
        cpp:
          "/* C++ POS tagging usually integrates external NLP libraries or ONNX models. */",
        go:
          "/* Go POS tagging generally uses external NLP services or ML model bindings. */",
        rust:
          "/* Rust POS tagging usually integrates external NLP crates/models. */"
      })
    );
  }

  return wrap(
    snippetByLanguage(language, {
    python: "def solve(input_data):\n    # TODO: implement based on exact problem statement\n    return input_data",
    javascript: "function solve(input) {\n  // TODO: implement based on exact problem statement\n  return input;\n}",
    typescript: "function solve(input: unknown): unknown {\n  // TODO: implement based on exact problem statement\n  return input;\n}",
    java: "public static String solve(String input) {\n  // TODO: implement based on exact problem statement\n  return input;\n}",
    c: "int solve(int input) {\n  // TODO: implement based on exact problem statement\n  return input;\n}",
    cpp: "int solve(int input) {\n  // TODO: implement based on exact problem statement\n  return input;\n}",
    go: "func Solve(input int) int {\n  // TODO: implement based on exact problem statement\n  return input\n}",
    rust: "fn solve(input: i32) -> i32 {\n    // TODO: implement based on exact problem statement\n    input\n}"
  })
  );
}

function buildAlternativeSnippet(taskId, language, style) {
  if (taskId === "factorial") {
    return buildTaskSnippet(taskId, language, {
      wantsRecursive: !style.wantsRecursive,
      wantsIterative: !style.wantsIterative,
      wantsDifferent: false
    });
  }

  if (taskId === "fibonacci") {
    return buildTaskSnippet(taskId, language, {
      wantsRecursive: !style.wantsRecursive,
      wantsIterative: !style.wantsIterative,
      wantsDifferent: false
    });
  }

  return "";
}

function inferContestTechnique(problemText) {
  const lowered = String(problemText || "").toLowerCase();

  if (/\bsubarray\b.*\bsum\b/.test(lowered)) {
    return {
      label: "prefix sums with a hash map",
      complexity: "O(n) time when the target relation can be tracked from prefix state",
      steps: [
        "Define the running state for each prefix.",
        "Store the frequency or earliest index of previously seen prefix states.",
        "Update the answer using the difference between current state and target condition."
      ]
    };
  }

  if (/\bsubstring\b|\bwindow\b/.test(lowered)) {
    return {
      label: "sliding window",
      complexity: "O(n) time if the window only moves forward",
      steps: [
        "Maintain a left and right pointer.",
        "Track the condition that makes the current window valid or invalid.",
        "Expand or shrink the window while updating the best answer."
      ]
    };
  }

  if (/\bshortest path\b|\bdijkstra\b|\bweighted graph\b/.test(lowered)) {
    return {
      label: "graph shortest path",
      complexity: "O((n + m) log n) with adjacency lists and a priority queue",
      steps: [
        "Build the graph from the input format.",
        "Initialize distances and push the source into a min-heap.",
        "Relax edges and ignore stale heap entries."
      ]
    };
  }

  if (/\bprerequisite\b|\bcourse schedule\b|\btopological\b|\bdag\b/.test(lowered)) {
    return {
      label: "topological ordering on a directed graph",
      complexity: "O(n + m) time",
      steps: [
        "Build adjacency lists and indegree counts.",
        "Push all zero-indegree nodes into a queue.",
        "Pop nodes, relax outgoing edges, and verify all nodes are processed."
      ]
    };
  }

  if (/\bgraph\b|\btree\b|\bgrid\b|\bmaze\b/.test(lowered)) {
    return {
      label: "graph traversal",
      complexity: "Usually O(n + m) for graph traversal or O(rows * cols) for grids",
      steps: [
        "Model states and neighbors carefully.",
        "Choose BFS for shortest paths in unweighted graphs and DFS for reachability or structure.",
        "Track visited state to avoid repeated work."
      ]
    };
  }

  if (/\bdp\b|\bdynamic programming\b|\bcoin change\b|\bknapsack\b|\blis\b/.test(lowered)) {
    return {
      label: "dynamic programming",
      complexity: "Depends on state count and transition cost",
      steps: [
        "Define the DP state precisely.",
        "Write the recurrence and base cases before coding.",
        "Compress memory only after the recurrence is correct."
      ]
    };
  }

  return {
    label: "constraint-driven algorithm selection",
    complexity: "Choose the best target from the input limits, usually O(n), O(n log n), or O(n + m)",
    steps: [
      "Read the constraints first and reject any brute-force plan that exceeds them.",
      "Identify the dominant structure: array/string, graph/tree, interval set, or DP state.",
      "Pick the simplest algorithm that satisfies the limits and preserves correctness."
    ]
  };
}

function buildGenericContestTemplate(language) {
  if (language === "python") {
    return [
      "def solve():",
      "    import sys",
      "    data = sys.stdin.read().strip().split()",
      "    if not data:",
      "        return",
      "    # parse input",
      "    # implement the chosen algorithm",
      "    answer = 0",
      "    print(answer)",
      "",
      "if __name__ == \"__main__\":",
      "    solve()"
    ].join("\n");
  }

  if (language === "javascript") {
    return [
      "function solve(input) {",
      "  const data = input.trim().split(/\\s+/);",
      "  if (data.length === 0 || data[0] === \"\") return \"\";",
      "  // parse input",
      "  // implement the chosen algorithm",
      "  const answer = 0;",
      "  return String(answer);",
      "}",
      "",
      "const fs = require(\"fs\");",
      "const input = fs.readFileSync(0, \"utf8\");",
      "const out = solve(input);",
      "if (out.length) process.stdout.write(out + \"\\n\");"
    ].join("\n");
  }

  if (language === "typescript") {
    return [
      "function solve(input: string): string {",
      "  const data = input.trim().split(/\\s+/);",
      "  if (data.length === 0 || data[0] === \"\") return \"\";",
      "  // parse input",
      "  // implement the chosen algorithm",
      "  const answer = 0;",
      "  return String(answer);",
      "}",
      "",
      "import * as fs from \"fs\";",
      "const input = fs.readFileSync(0, \"utf8\");",
      "const out = solve(input);",
      "if (out.length) process.stdout.write(out + \"\\n\");"
    ].join("\n");
  }

  if (language === "java") {
    return [
      "import java.io.*;",
      "import java.util.*;",
      "",
      "public class Main {",
      "  static void solve(FastScanner fs) throws Exception {",
      "    // parse input",
      "    // implement the chosen algorithm",
      "    int answer = 0;",
      "    System.out.println(answer);",
      "  }",
      "",
      "  public static void main(String[] args) throws Exception {",
      "    FastScanner fs = new FastScanner(System.in);",
      "    solve(fs);",
      "  }",
      "",
      "  static class FastScanner {",
      "    private final InputStream in;",
      "    private final byte[] buffer = new byte[1 << 16];",
      "    private int ptr = 0, len = 0;",
      "    FastScanner(InputStream is) { in = is; }",
      "    private int read() throws IOException {",
      "      if (ptr >= len) { len = in.read(buffer); ptr = 0; }",
      "      return len <= 0 ? -1 : buffer[ptr++];",
      "    }",
      "    int nextInt() throws IOException {",
      "      int c;",
      "      do c = read(); while (c <= ' ');",
      "      int sign = 1;",
      "      if (c == '-') { sign = -1; c = read(); }",
      "      int value = 0;",
      "      while (c > ' ') { value = value * 10 + (c - '0'); c = read(); }",
      "      return value * sign;",
      "    }",
      "  }",
      "}"
    ].join("\n");
  }

  if (language === "c") {
    return [
      "#include <stdio.h>",
      "",
      "int main(void) {",
      "  // parse input",
      "  // implement the chosen algorithm",
      "  int answer = 0;",
      "  printf(\"%d\\n\", answer);",
      "  return 0;",
      "}"
    ].join("\n");
  }

  if (language === "cpp") {
    return [
      "#include <bits/stdc++.h>",
      "using namespace std;",
      "",
      "int main() {",
      "  ios::sync_with_stdio(false);",
      "  cin.tie(nullptr);",
      "",
      "  // parse input",
      "  // implement the chosen algorithm",
      "  int answer = 0;",
      "  cout << answer << '\\n';",
      "  return 0;",
      "}"
    ].join("\n");
  }

  if (language === "go") {
    return [
      "package main",
      "",
      "import (",
      "  \"bufio\"",
      "  \"fmt\"",
      "  \"os\"",
      ")",
      "",
      "func main() {",
      "  in := bufio.NewReader(os.Stdin)",
      "  _ = in",
      "  // parse input",
      "  // implement the chosen algorithm",
      "  answer := 0",
      "  fmt.Println(answer)",
      "}"
    ].join("\n");
  }

  return [
    "fn solve() {",
    "    // parse input",
    "    // implement the chosen algorithm",
    "    let answer = 0;",
    "    println!(\"{}\", answer);",
    "}",
    "",
    "fn main() {",
    "    solve();",
    "}"
  ].join("\n");
}

function genericContestResponse(problemText, options = {}) {
  const selectedLanguages = options.selectedLanguages?.length ? options.selectedLanguages : ["python"];
  const languageNote = options.languageNote || "";
  const inference = inferContestTechnique(problemText);
  const codeSections = selectedLanguages.map(
    (language) => `\`\`\`${language}\n${buildGenericContestTemplate(language)}\n\`\`\``
  );

  return [
    "1) Contest read",
    `- Likely technique: ${inference.label}.`,
    `- Complexity target: ${inference.complexity}.`,
    languageNote,
    "",
    "2) Plan",
    ...inference.steps.map((item) => `- ${item}`),
    "",
    "3) Edge cases",
    "- Minimum-size input.",
    "- Repeated values, boundary indices, and empty structures when the statement allows them.",
    "- Large constraints that rule out quadratic solutions.",
    "",
    "4) Submission skeleton",
    ...codeSections,
    "",
    "5) Next",
    "- Paste the exact statement, input/output format, and constraints, and I will turn this into a final accepted solution."
  ]
    .filter(Boolean)
    .join("\n");
}

function codingImplementationResponse(userText, options = {}) {
  const latestText = options.latestText || userText;
  const previousText = options.previousText || "";
  const secondPreviousText = options.secondPreviousText || "";
  const previousAssistantText = options.previousAssistantText || "";
  const taskAnchorText = options.taskAnchorText || "";
  const preferFullCode = Boolean(options.preferFullCode);

  const latestTrimmed = latestText.trim();
  const latestLanguageOnly = LANGUAGE_ONLY_PATTERN.test(latestTrimmed);
  const latestCodeOnly = isShallowCodeFollowup(latestTrimmed) && !latestLanguageOnly;

  const previousIsLanguageOnly = LANGUAGE_ONLY_PATTERN.test(previousText.trim());
  const languageSource = latestLanguageOnly
    ? latestText
    : latestCodeOnly && previousIsLanguageOnly
      ? previousText
      : userText;
  const languages = detectRequestedLanguages(languageSource);

  const previousMeaningfulText =
    isShallowCodeFollowup(previousText) && secondPreviousText ? secondPreviousText : previousText;

  let taskSource = userText;
  if (latestLanguageOnly && taskAnchorText) {
    taskSource = stripLanguageMentions(taskAnchorText);
  } else if (latestLanguageOnly && previousMeaningfulText) {
    taskSource = stripLanguageMentions(previousMeaningfulText);
  } else if (latestCodeOnly && taskAnchorText) {
    taskSource = taskAnchorText;
  } else if (latestCodeOnly && previousMeaningfulText) {
    taskSource = previousMeaningfulText;
  }

  const task = detectCodingTask(taskSource);
  const autoFullCode = latestLanguageOnly || latestCodeOnly || task.id !== "generic";
  const inheritFullCodeFromPreviousAnswer =
    (latestLanguageOnly || latestCodeOnly) && responseHasFullProgram(previousAssistantText);
  const style = detectCodingStyle(`${taskSource} ${latestText}`.trim(), {
    preferFullCode: preferFullCode || inheritFullCodeFromPreviousAnswer || autoFullCode
  });
  const contestPrompt = looksLikeContestProblem(taskSource);
  const wantsAllLanguages = /\ball\s+languages?\b|\bevery\s+language\b/i.test(languageSource);
  const picked = wantsAllLanguages ? [...DEFAULT_MULTI_LANGUAGES] : languages;
  const maxLanguages = wantsAllLanguages ? DEFAULT_MULTI_LANGUAGES.length : Math.min(picked.length, 3);
  let selectedLanguages = picked.slice(0, maxLanguages);
  let languageNote = "";

  const supportedLanguages = supportedLanguagesForTask(task.id);
  if (supportedLanguages) {
    const kept = selectedLanguages.filter((language) => supportedLanguages.includes(language));
    if (kept.length !== selectedLanguages.length) {
      selectedLanguages = kept.length > 0 ? kept : ["python"];
      languageNote = `- Advanced template for ${task.label} is currently available in ${supportedLanguages.join(", ")}. Returning ${selectedLanguages.join(", ")}.`;
    }
  }

  if (task.id === "generic" && contestPrompt) {
    return genericContestResponse(taskSource, { selectedLanguages, languageNote });
  }

  const edgeCases = edgeCasesForTask(task.id);

  const codeSections = [];
  for (const language of selectedLanguages) {
    const snippet = buildTaskSnippet(task.id, language, style);
    codeSections.push(`\`\`\`${language}\n${snippet}\n\`\`\``);

    if (style.wantsDifferent && selectedLanguages.length === 1) {
      const alternative = buildAlternativeSnippet(task.id, language, style);
      if (alternative && alternative !== snippet) {
        codeSections.push(`Alternative logic:\n\`\`\`${language}\n${alternative}\n\`\`\``);
      }
    }
  }

  return [
    "1) Problem",
    `- Task: ${task.label}.`,
    `- Language${selectedLanguages.length > 1 ? "s" : ""}: ${selectedLanguages.join(", ")}.`,
    languageNote,
    "",
    "2) Approach",
    ...task.logic.map((item) => `- ${item}`),
    style.wantsDifferent ? "- Included alternative logic when applicable." : "",
    "",
    "3) Complexity",
    `- ${task.complexity}`,
    "",
    "4) Edge cases",
    ...edgeCases.map((item) => `- ${item}`),
    "",
    "5) Code",
    ...codeSections,
    "",
    "6) Next",
    contestPrompt
      ? "- If you share the exact statement and constraints, I will refine this into a final contest submission."
      : "- Share constraints and exact I/O format, and I will provide a production-ready final solution."
  ]
    .filter(Boolean)
    .join("\n");
}

function codingImplementationResponseWithTests(userText) {
  const base = codingImplementationResponse(userText);
  return [
    base,
    "",
    "6) Test hints",
    "- Include edge cases: empty input, min/max values, duplicates, and invalid input."
  ].join("\n");
}

function codeIntentText(userText, context) {
  const trimmed = String(userText || "").trim();
  const hasFreshTask =
    detectCodingTask(trimmed).id !== "generic" ||
    /\b(vowel|consonant|alphabet|palindrome|factorial|fibonacci|prime|reverse|string|search|sort|sum|tree|graph)\b/i.test(trimmed);

  if (hasFreshTask) {
    return trimmed;
  }

  if (context.followup && context.taskAnchorUserText) {
    return `${context.taskAnchorUserText} ${userText}`.trim();
  }
  if (context.followup && context.previousUserText) {
    let anchor = context.previousUserText;
    if (isShallowCodeFollowup(anchor) && context.secondPreviousUserText) {
      anchor = `${context.secondPreviousUserText} ${anchor}`.trim();
    }
    return `${anchor} ${userText}`.trim();
  }
  return userText;
}

function projectPlanResponse(userText, detailed = false) {
  const title = detailed ? "Project blueprint" : "Great. Let's build it.";
  const plan = detailed
    ? [
        "1) Problem + users: define who this project serves and the exact pain point.",
        "2) MVP scope: list 3 must-have features and 3 out-of-scope items.",
        "3) Tech design: choose stack, data model, API contracts, and deployment target.",
        "4) Build sequence: implement auth/data/core flow first, then analytics and polish.",
        "5) Quality gate: tests, monitoring, error handling, and release checklist."
      ]
    : [
        "1) Define user + problem in one sentence.",
        "2) Pick 3 MVP features.",
        "3) Choose stack and architecture.",
        "4) Build core flow first, then polish.",
        "5) Add testing + monitoring before launch."
      ];

  return [title, ...plan, "", `Reply with your idea in one line, and I will convert it into an exact execution plan. (${userText.slice(0, 90)})`].join("\n");
}

function deepDaaResponse() {
  return [
    "DAA (Design and Analysis of Algorithms) - Deep Explanation",
    "",
    "1) What DAA is",
    "- DAA focuses on designing correct algorithms and measuring efficiency.",
    "- Two primary costs are time complexity and space complexity.",
    "",
    "2) Why it matters",
    "- Efficient algorithms scale better as input size grows.",
    "- A correct but slow algorithm can fail in real systems under load.",
    "",
    "3) Core analysis tools",
    "- Asymptotic notations: O (upper bound), Theta (tight bound), Omega (lower bound).",
    "- Recurrence relations for divide-and-conquer algorithms.",
    "- Amortized analysis for operations over sequences.",
    "",
    "4) Common design paradigms",
    "- Divide and Conquer: merge sort, quick sort.",
    "- Dynamic Programming: knapsack, LIS, matrix chain multiplication.",
    "- Greedy: activity selection, Huffman coding.",
    "- Graph algorithms: Dijkstra, BFS/DFS, minimum spanning tree.",
    "",
    "5) Example comparison",
    "- Bubble sort: O(n^2) time, O(1) space.",
    "- Merge sort: O(n log n) time, O(n) space.",
    "- For large n, O(n log n) is usually far more practical than O(n^2).",
    "",
    "6) Study sequence",
    "- Start with complexity basics and recurrences.",
    "- Learn sorting/searching thoroughly.",
    "- Practice DP, greedy, and graph problems with proof of correctness."
  ].join("\n");
}

function structuredGeneralFallback(userText) {
  return [
    "I can explain this properly.",
    "",
    "1) Understanding",
    `Topic: ${userText.slice(0, 120)}`,
    "",
    "2) Core explanation",
    "- I will define the concept, show how it works, and mention key tradeoffs.",
    "",
    "3) Practical angle",
    "- I can add examples, complexity, implementation steps, and common mistakes.",
    "",
    "Reply with: `beginner`, `intermediate`, or `advanced` and I will tailor depth."
  ].join("\n");
}

function hasStructuredLayout(text) {
  return /(^|\n)\s*(\d+[).]|[-*])\s+/m.test(text) || text.includes("\n\n");
}

function ensureStructuredAnswer(text) {
  const clean = (text || "").trim();
  if (!clean) {
    return clean;
  }
  if (hasStructuredLayout(clean) || clean.length < 170) {
    return clean;
  }

  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length < 2) {
    return clean;
  }

  return ["1) Core answer", ...sentences.slice(0, 3).map((item) => `- ${item}`)].join("\n");
}

function composeFastResponse(userText, matches, ownModel, context, intent = null) {
  const scopedContext = intent?.ignoreConversationContext
    ? { ...context, previousUserText: "", secondPreviousUserText: "", previousAssistantText: "", followup: false }
    : context;
  const normalizedText = normalizePatternText(userText);
  const anchorUserText = followupAnchorUserText(scopedContext);
  const combinedTopicText = `${anchorUserText} ${userText}`.trim();
  const topic = inferTopicFromText(combinedTopicText);
  const codeText = codeIntentText(userText, scopedContext);
  const detectedTask = detectCodingTask(codeText);
  const contestPrompt = looksLikeContestProblem(codeText);
  const followupCodeOnly =
    scopedContext.previousUserText &&
    isShallowCodeFollowup(userText.trim());
  const downloadRequest = intent?.type === "download" || DOWNLOAD_REQUEST_PATTERN.test(userText);
  const shoppingRequest = intent?.type === "shopping" || SHOPPING_REQUEST_PATTERN.test(userText);
  const builderRequest = intent?.type === "builder" || BUILDER_REQUEST_PATTERN.test(userText);
  const recommendationRequest =
    intent?.type === "recommendation" ||
    (RECOMMENDATION_REQUEST_PATTERN.test(userText) && scopedContext.knowledgeSources?.length > 0);
  const codeRequest =
    contestPrompt ||
    detectedTask.id !== "generic" ||
    CODE_REQUEST_PATTERN.test(codeText) ||
    (/\b(code|function|program|script)\b/i.test(codeText) && KNOWN_CODE_TASK_PATTERN.test(codeText)) ||
    followupCodeOnly;

  if (GREETING_PATTERN.test(normalizedText)) {
    return "Hi. How can I help today?";
  }

  if (HOW_ARE_YOU_PATTERN.test(normalizedText)) {
    return "I am doing well. What do you want to work on next?";
  }

  if (FAREWELL_PATTERN.test(normalizedText)) {
    return farewellResponse();
  }

  if (ACK_PATTERN.test(normalizedText)) {
    return "Great. Tell me your next question, and I will give a clear structured answer.";
  }

  if (CAPABILITY_PATTERN.test(normalizedText)) {
    return assistantCapabilityResponse();
  }

  if (CODING_START_PATTERN.test(normalizedText)) {
    return codingReadinessResponse();
  }

  if (ASSISTANT_IDENTITY_PATTERN.test(normalizedText)) {
    return assistantIdentityResponse();
  }

  if (ASSISTANT_CREATION_PATTERN.test(normalizedText)) {
    return assistantCreationResponse();
  }

  if (CONFIRMATION_PATTERN.test(normalizedText)) {
    return confirmationFollowupResponse(scopedContext, matches, scopedContext.knowledgeContext);
  }

  if (ABUSIVE_PATTERN.test(userText)) {
    return frustrationResponse();
  }

  if (isDateQuestion(userText)) {
    return formatCurrentDateResponse();
  }

  if (isTimeQuestion(userText)) {
    return formatCurrentTimeResponse();
  }

  const arithmetic = arithmeticResponse(userText);
  if (arithmetic) {
    return arithmetic;
  }

  if (downloadRequest) {
    return downloadResponse(userText, scopedContext);
  }

  if (builderRequest) {
    return builderResponse(userText, scopedContext);
  }

  if (shoppingRequest) {
    return shoppingResponse(userText, scopedContext);
  }

  if (recommendationRequest) {
    return recommendationResponse(userText, scopedContext);
  }

  if (scopedContext.followup && SHORT_AMBIGUOUS_WHAT_IS_PATTERN.test(anchorUserText || "") && isTopicClarification(userText)) {
    return definitionResponse(userText, matches, scopedContext.knowledgeContext);
  }

  if (shouldUseAttachmentAnalysis(userText, scopedContext)) {
    return attachmentAnalysisResponse(userText, scopedContext);
  }

  if (scopedContext.workspaceMode !== "general" && isLowInformationPrompt(userText)) {
    return workspaceModeKickoffResponse(scopedContext.workspaceMode);
  }

  if (codeRequest) {
    return codingImplementationResponse(codeText, {
      latestText: userText,
      previousText: scopedContext.previousUserText,
      secondPreviousText: scopedContext.secondPreviousUserText,
      previousAssistantText: scopedContext.previousAssistantText,
      taskAnchorText: scopedContext.taskAnchorUserText,
      preferFullCode: scopedContext.preferFullCode
    });
  }

  if (CODING_CAPABILITY_PATTERN.test(userText) || (CODING_PATTERN.test(userText) && countWords(userText) <= 7)) {
    return codingSupportResponse();
  }

  if (GENERAL_CAPABILITY_PATTERN.test(userText) && countWords(userText) <= 8) {
    return "I can cover many topics, especially coding and technical work. I will answer directly, use external context when available, and say clearly when something is uncertain.";
  }

  if (scopedContext.followup && !scopedContext.previousUserText) {
    return [
      "I can explain deeply.",
      "",
      "Please mention the exact topic.",
      "Example: `Explain DAA deeply` or `Explain React state deeply`."
    ].join("\n");
  }

  if (scopedContext.followup && wantsDepth(userText) && anchorUserText) {
    return [
      "Sure. I will explain this deeply.",
      "",
      "1) Concept",
      "2) How it works",
      "3) Complexity and tradeoffs",
      "4) Practical example",
      "",
      `Previous topic detected: ${anchorUserText.slice(0, 120)}`
    ].join("\n");
  }

  if (scopedContext.followup && anchorUserText) {
    return clarityFollowupResponse(anchorUserText, matches, scopedContext.knowledgeContext);
  }

  if (shouldAnswerAsDirectDefinition(userText, matches, scopedContext.knowledgeContext)) {
    return definitionResponse(userText, matches, scopedContext.knowledgeContext);
  }

  if (isLowInformationPrompt(userText)) {
    return lowInformationResponse();
  }

  const grounded = fastKnowledgeGroundedResponse(
    userText,
    scopedContext.knowledgeContext,
    scopedContext.knowledgeSources
  ) || knowledgeGroundedResponse(scopedContext.knowledgeContext);
  const whatIsMatch = normalizedText.match(WHAT_IS_PATTERN);
  if (grounded && whatIsMatch) {
    return grounded;
  }

  if (whatIsMatch) {
    return definitionResponse(whatIsMatch[1], matches, scopedContext.knowledgeContext);
  }

  if (grounded && ["definition", "explanation", "general", "comparison"].includes(intent?.type || "")) {
    return grounded;
  }

  if (PROJECT_PATTERN.test(userText)) {
    return projectPlanResponse(userText, false);
  }

  if (scopedContext.followup && topic === "daa") {
    return deepDaaResponse();
  }

  if (grounded && (matches.length === 0 || matches[0].score < 0.2)) {
    return grounded;
  }

  if (matches.length > 0 && matches[0].score >= 0.32) {
    return ensureStructuredAnswer(
      sanitizeCompletion(
        matches[0].pair.completion || "",
        structuredGeneralFallback(userText)
      )
    );
  }

  if (matches.length > 1 && matches[0].score >= 0.2) {
    const scoreGap = matches[0].score - matches[1].score;
    if (scoreGap >= 0.08) {
      return ensureStructuredAnswer(
        sanitizeCompletion(
          matches[0].pair.completion || "",
          structuredGeneralFallback(userText)
        )
      );
    }
  }

  return structuredGeneralFallback(userText);
}

function composeDeepResponse(userText, matches, ownModel, context, intent = null) {
  const scopedContext = intent?.ignoreConversationContext
    ? { ...context, previousUserText: "", secondPreviousUserText: "", previousAssistantText: "", followup: false }
    : context;
  const normalizedText = normalizePatternText(userText);
  const anchorUserText = followupAnchorUserText(scopedContext);
  const combinedTopicText = `${anchorUserText} ${userText}`.trim();
  const topic = inferTopicFromText(combinedTopicText);
  const codeText = codeIntentText(userText, scopedContext);
  const detectedTask = detectCodingTask(codeText);
  const contestPrompt = looksLikeContestProblem(codeText);
  const followupCodeOnly =
    scopedContext.previousUserText &&
    isShallowCodeFollowup(userText.trim());
  const downloadRequest = intent?.type === "download" || DOWNLOAD_REQUEST_PATTERN.test(userText);
  const shoppingRequest = intent?.type === "shopping" || SHOPPING_REQUEST_PATTERN.test(userText);
  const builderRequest = intent?.type === "builder" || BUILDER_REQUEST_PATTERN.test(userText);
  const recommendationRequest =
    intent?.type === "recommendation" ||
    (RECOMMENDATION_REQUEST_PATTERN.test(userText) && scopedContext.knowledgeSources?.length > 0);
  const codeRequest =
    contestPrompt ||
    detectedTask.id !== "generic" ||
    CODE_REQUEST_PATTERN.test(codeText) ||
    (/\b(code|function|program|script)\b/i.test(codeText) && KNOWN_CODE_TASK_PATTERN.test(codeText)) ||
    followupCodeOnly;

  if (GREETING_PATTERN.test(normalizedText)) {
    return "Hi. How can I help today?";
  }

  if (HOW_ARE_YOU_PATTERN.test(normalizedText)) {
    return "I am doing well. What do you want to work on next?";
  }

  if (FAREWELL_PATTERN.test(normalizedText)) {
    return farewellResponse();
  }

  if (ACK_PATTERN.test(normalizedText)) {
    return "Great. Tell me your next question, and I will give a clear structured answer.";
  }

  if (CAPABILITY_PATTERN.test(normalizedText)) {
    return assistantCapabilityResponse();
  }

  if (CODING_START_PATTERN.test(normalizedText)) {
    return buildDeepEnvelope(userText, codingReadinessResponse());
  }

  if (ASSISTANT_IDENTITY_PATTERN.test(normalizedText)) {
    return assistantIdentityResponse();
  }

  if (ASSISTANT_CREATION_PATTERN.test(normalizedText)) {
    return buildDeepEnvelope(userText, assistantCreationResponse());
  }

  if (CONFIRMATION_PATTERN.test(normalizedText)) {
    return confirmationFollowupResponse(scopedContext, matches, scopedContext.knowledgeContext);
  }

  if (ABUSIVE_PATTERN.test(userText)) {
    return buildDeepEnvelope(
      userText,
      frustrationResponse()
    );
  }

  if (isDateQuestion(userText)) {
    return buildDeepEnvelope(userText, formatCurrentDateResponse());
  }

  if (isTimeQuestion(userText)) {
    return buildDeepEnvelope(userText, formatCurrentTimeResponse());
  }

  const arithmetic = arithmeticResponse(userText, { deep: true });
  if (arithmetic) {
    return buildDeepEnvelope(userText, arithmetic);
  }

  if (downloadRequest) {
    return buildDeepEnvelope(userText, downloadResponse(userText, scopedContext));
  }

  if (builderRequest) {
    return buildDeepEnvelope(userText, builderResponse(userText, scopedContext));
  }

  if (shoppingRequest) {
    return buildDeepEnvelope(userText, shoppingResponse(userText, scopedContext));
  }

  if (recommendationRequest) {
    return buildDeepEnvelope(userText, recommendationResponse(userText, scopedContext));
  }

  if (scopedContext.followup && SHORT_AMBIGUOUS_WHAT_IS_PATTERN.test(anchorUserText || "") && isTopicClarification(userText)) {
    return buildDeepEnvelope(
      userText,
      deepDefinitionResponse(userText, matches, scopedContext.knowledgeContext, scopedContext.knowledgeSources)
    );
  }

  if (shouldUseAttachmentAnalysis(userText, scopedContext)) {
    return buildDeepEnvelope(userText, attachmentAnalysisResponse(userText, scopedContext));
  }

  if (scopedContext.workspaceMode !== "general" && isLowInformationPrompt(userText)) {
    return buildDeepEnvelope(userText, workspaceModeKickoffResponse(scopedContext.workspaceMode));
  }

  if (codeRequest) {
    return codingImplementationResponse(codeText, {
      latestText: userText,
      previousText: scopedContext.previousUserText,
      secondPreviousText: scopedContext.secondPreviousUserText,
      previousAssistantText: scopedContext.previousAssistantText,
      taskAnchorText: scopedContext.taskAnchorUserText,
      preferFullCode: scopedContext.preferFullCode
    });
  }

  if (CODING_CAPABILITY_PATTERN.test(userText) || (CODING_PATTERN.test(userText) && countWords(userText) <= 7)) {
    return buildDeepEnvelope(userText, codingSupportResponse());
  }

  if (GENERAL_CAPABILITY_PATTERN.test(userText) && countWords(userText) <= 8) {
    return buildDeepEnvelope(
      userText,
      "I can cover many topics, especially coding and technical work. I will answer directly, use external context when available, and say clearly when something is uncertain."
    );
  }

  if (scopedContext.followup && !anchorUserText) {
    return buildDeepEnvelope(
      userText,
      [
        "I can explain this deeply, but I need the topic.",
        "",
        "Reply in this format:",
        "- `Explain <topic> deeply`",
        "- `Explain <topic> with examples and complexity`"
      ].join("\n")
    );
  }

  if (scopedContext.followup && anchorUserText) {
    return buildDeepEnvelope(
      userText,
      clarityFollowupResponse(anchorUserText, matches, scopedContext.knowledgeContext)
    );
  }

  if (shouldAnswerAsDirectDefinition(userText, matches, scopedContext.knowledgeContext)) {
    return buildDeepEnvelope(
      userText,
      deepDefinitionResponse(userText, matches, scopedContext.knowledgeContext, scopedContext.knowledgeSources)
    );
  }

  if (isLowInformationPrompt(userText)) {
    return buildDeepEnvelope(userText, lowInformationResponse());
  }

  const whatIsMatch = normalizedText.match(WHAT_IS_PATTERN);
  if (whatIsMatch) {
    return buildDeepEnvelope(
      userText,
      deepDefinitionResponse(whatIsMatch[1], matches, scopedContext.knowledgeContext, scopedContext.knowledgeSources)
    );
  }

  if (PROJECT_PATTERN.test(userText)) {
    return buildDeepEnvelope(userText, projectPlanResponse(userText, true));
  }

  if (topic === "daa" && (wantsDepth(userText) || scopedContext.followup || DAA_TOPIC_PATTERN.test(userText))) {
    return buildDeepEnvelope(userText, deepDaaResponse());
  }

  const grounded = knowledgeGroundedResponse(scopedContext.knowledgeContext);
  if (grounded && ["definition", "explanation", "general", "comparison"].includes(intent?.type || "")) {
    return buildDeepEnvelope(
      userText,
      deepKnowledgeGroundedResponse(userText, scopedContext.knowledgeContext, scopedContext.knowledgeSources) || grounded
    );
  }

  if (grounded && (matches.length === 0 || matches[0].score < 0.16)) {
    return buildDeepEnvelope(
      userText,
      deepKnowledgeGroundedResponse(userText, scopedContext.knowledgeContext, scopedContext.knowledgeSources) || grounded
    );
  }

  if (matches.length > 0 && matches[0].score >= 0.16) {
    return buildDeepEnvelope(
      userText,
      sanitizeCompletion(
        matches[0].pair.completion || "",
        "Break the topic into definition, key ideas, complexity/tradeoffs, and practical examples."
      )
    );
  }

  if (matches.length > 1) {
    const insights = [];

    for (const item of matches.slice(0, 3)) {
      const sentence = firstSentence(item.pair.completion || "");
      if (sentence && !insights.includes(sentence)) {
        insights.push(sentence);
      }
    }

    if (insights.length > 0) {
      return buildDeepEnvelope(
        userText,
        [
          "Recommended approach:",
          ...insights.map((insight) => `- ${insight}`)
        ].join("\n")
      );
    }
  }

  return buildDeepEnvelope(userText, structuredGeneralFallback(userText));
}

function generateFromOwnModel(role, prompt, ownModel, intent = null, knowledge = null) {
  const { userText, queryTokens, context } = buildGenerationState(prompt, intent, knowledge);
  const matches = retrieveTopMatches(queryTokens, ownModel, role === "deep" ? 4 : 3);

  if (role === "deep") {
    return composeDeepResponse(userText, matches, ownModel, context, intent);
  }

  return composeFastResponse(userText, matches, ownModel, context, intent);
}

function generateRuleBasedResponse(role, prompt, intent = null, knowledge = null) {
  const { userText, context } = buildGenerationState(prompt, intent, knowledge);
  const matches = [];

  if (role === "deep") {
    return composeDeepResponse(userText, matches, null, context, intent);
  }

  return composeFastResponse(userText, matches, null, context, intent);
}

function parseRouterDecision(text) {
  if (ROUTER_DEEP_TOKEN.test(text)) {
    return "deep";
  }
  if (ROUTER_FAST_TOKEN.test(text)) {
    return "fast";
  }
  return null;
}

function classifyWithOwnRouter(prompt, routerModel) {
  const latestText = extractLatestUserText(prompt);
  const tokens = tokenizeWords(latestText);
  const labels = routerModel.labels || ["fast", "deep"];
  const heuristicDeep = hasDeepSignal(latestText);

  let bestLabel = "fast";
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const label of labels) {
    let score = Number(routerModel.priors?.[label] ?? 0);
    const defaultLogProb = Number(routerModel.default_log_prob?.[label] ?? -10);
    const tokenLogProb = routerModel.token_log_probs?.[label] || {};

    for (const token of tokens) {
      score += Number(tokenLogProb[token] ?? defaultLogProb);
    }

    if (score > bestScore) {
      bestScore = score;
      bestLabel = label;
    }
  }

  if (heuristicDeep) {
    return "deep";
  }

  return bestLabel;
}

async function callOllama(model, prompt) {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        num_predict: DEFAULT_MAX_TOKENS,
        temperature: DEFAULT_TEMPERATURE
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.response || "";
}

async function callOpenAICompatible(model, prompt) {
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: DEFAULT_TEMPERATURE,
      max_tokens: DEFAULT_MAX_TOKENS
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI compatible request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callPythonLocalGenerate(role, model, prompt) {
  const response = await fetch(`${PYTHON_LOCAL_BASE_URL}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      role,
      model,
      prompt,
      max_new_tokens: DEFAULT_MAX_TOKENS,
      temperature: DEFAULT_TEMPERATURE
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Python local generate failed with status ${response.status}: ${details}`);
  }

  const data = await response.json();
  return {
    text: data.text || "",
    model: data.model || model
  };
}

async function callPythonLocalRouter(model, prompt) {
  const response = await fetch(`${PYTHON_LOCAL_BASE_URL}/classify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      prompt
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Python local classify failed with status ${response.status}: ${details}`);
  }

  const data = await response.json();
  return {
    targetRole: data.targetRole || null,
    model: data.model || model
  };
}

async function callProvider(provider, model, prompt) {
  if (provider === "ollama") {
    return callOllama(model, prompt);
  }
  if (provider === "openai") {
    return callOpenAICompatible(model, prompt);
  }
  throw new Error(`Unsupported provider: ${provider}`);
}

export async function generateTextForRole({ role, prompt, intent = null, knowledge = null }) {
  const provider = providerFor(role);
  const model = modelFor(role);

  if (provider === "mock") {
    return {
      text: generateRuleBasedResponse(role, prompt, intent, knowledge),
      model: `${model}-mock`
    };
  }

  if (provider === "own") {
    const ownModel = await loadOwnArtifact(role);
    return {
      text: generateFromOwnModel(role, prompt, ownModel, intent, knowledge),
      model: ownModel.name || `${model}-own`
    };
  }

  if (provider === "python_local") {
    return callPythonLocalGenerate(role, model, prompt);
  }

  const text = await callProvider(provider, model, prompt);
  return { text, model };
}

export async function classifyRoute(prompt) {
  const provider = providerFor("router");
  const model = modelFor("router");

  if (provider === "mock") {
    const decision = synthesizeMockResponse(prompt, "router");
    return {
      targetRole: parseRouterDecision(decision),
      model: `${model}-mock`
    };
  }

  if (provider === "own") {
    const routerModel = await loadOwnArtifact("router");
    return {
      targetRole: classifyWithOwnRouter(prompt, routerModel),
      model: routerModel.name || `${model}-own`
    };
  }

  if (provider === "python_local") {
    return callPythonLocalRouter(model, prompt);
  }

  const routerPrompt = [
    "You are the routing model for Energy AI.",
    "Classify the user request as FAST or DEEP.",
    "FAST means low-energy mode for short direct answers.",
    "DEEP means high-energy mode for code, analysis, planning, or multi-step reasoning.",
    "Reply with one word only: FAST or DEEP.",
    "",
    prompt
  ].join("\n");

  const text = await callProvider(provider, model, routerPrompt);
  return {
    targetRole: parseRouterDecision(text),
    model
  };
}
