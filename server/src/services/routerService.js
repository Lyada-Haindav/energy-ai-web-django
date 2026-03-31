import { classifyRoute } from "./modelClient.js";
import { normalizeNaturalLanguageText } from "./textNormalization.js";
import { normalizeWorkspaceMode, workspaceModeLabel, workspaceModeRequiresDeep } from "./workspaceMode.js";

const ASSISTANT_META_PATTERN =
  /^(what(?:'s| is)\s+your\s+name|who\s+are\s+you|which\s+model\s+are\s+you|which\s+model\s+you\s+are|what\s+is\s+your\s+model\s+name|what\s+model\s+are\s+you)\??$/i;
const DATE_TIME_QUERY_PATTERN =
  /^(?:(?:can\s+i\s+know|tell\s+me|do\s+you\s+know)\s+)?(?:(?:what(?:'s| is)?|which)\s+)?(?:(today'?s?|current|now)\s+)?(date|time|day)(?:\s+(?:today|now|it\s+is|is\s+it))?\??$/i;
const CASUAL_CHAT_PATTERN =
  /^(hi|hello|hey|yo|hi there|hello there|good morning|good evening|good afternoon|how are you|how are u|thanks|thank you|ok|okay|cool|nice|bye|goodbye|see you|see ya|later)\b/i;
const CONTEST_PATTERN =
  /\b(leetcode|codeforces|codechef|hackerrank|coding ninjas|contest|competitive programming|input format|output format|constraints?|subarray|substring|graph|tree|grid|matrix|intervals?|merge intervals|maximum subarray|kadane|course schedule|coin change|lis|longest increasing subsequence|dp|dynamic programming|greedy|shortest path|topological|union find|disjoint set|binary search on answer)\b|(?:n|m|k)\s*(?:<=|<)\s*\d+/i;
const SIMPLE_CODE_TASK_PATTERN = /\b(code|function|program|script)\b/i;
const ADD_TWO_NUMBERS_PATTERN = /\badd(?:ing|ng)?\b.*\b(two|2|number|numbers|bumber|bumbers)\b/i;
const SHORT_CODE_FOLLOWUP_PATTERN = /^(code|show code|give code|send code)\b/i;
const TECHNICAL_DEEP_PATTERN =
  /\b(debug|bug|fix|refactor|optimi[sz]e|architecture|design|implement|build|create|deploy|database|schema|auth|authentication|api|backend|frontend|full[-\s]?stack|react|next\.?js|node|express|typescript|javascript|python|java|c\+\+|sql|docker|kubernetes|responsive|mobile|training|model|algorithm|binary search|complexity|graph|tree|recursion|dynamic programming|system design|performance)\b/i;
const TRIVIAL_CODE_PATTERN =
  /\b(hello world|reverse string|palindrome|factorial|fibonacci|prime number|swap two numbers|add two numbers)\b/i;
const ATTACHMENT_MARKER_PATTERN = /\[ATTACHED_FILES\][\s\S]*?\[\/ATTACHED_FILES\]/g;
const FILE_FOLLOWUP_PATTERN =
  /\b(file|attached|attachment|html|page|review|inspect|check|explain|structure|layout|improve|responsive|responsiveness|accessibility|code quality|bug|issue|fix)\b/i;

function normalizeInput(text) {
  return normalizeNaturalLanguageText(text)
    .trim()
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/[^A-Za-z0-9]+$/, "")
    .trim();
}

function stripAttachmentContext(text) {
  return String(text || "").replace(ATTACHMENT_MARKER_PATTERN, " ").replace(/\s+/g, " ").trim();
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
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
    /code/i,
    /project/i,
    /roadmap/i,
    /plan/i,
    /deeply/i,
    /in[-\s]?depth/i,
    /detailed/i
  ];

  return signals.some((regex) => regex.test(text));
}

function isFollowupPrompt(text) {
  return /^(can\s+you\s+)?(explain|eplain|elaborate|details?|more|continue|why|how)(\b.*)?$/i.test(text.trim());
}

function isContextFollowup(text) {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  if (words === 0) {
    return false;
  }
  return (
    isFollowupPrompt(trimmed) ||
    (words <= 9 &&
      /\b(more|simple|simpler|easy|easier|understand|understanding|undderstanding|clear|clearly|detail|detailed|example|examples|again|continue)\b/i.test(
        trimmed
      ))
  );
}

function wantsDepth(text) {
  return /\b(deep|deeply|in\s*depth|detailed|step\s*by\s*step)\b/i.test(text);
}

function isSimpleCodeTask(text, previousText = "") {
  const trimmed = text.trim();
  const words = countWords(trimmed);
  if (words === 0) {
    return false;
  }
  if (SHORT_CODE_FOLLOWUP_PATTERN.test(trimmed) && previousText.trim()) {
    return true;
  }
  if (ADD_TWO_NUMBERS_PATTERN.test(trimmed) && (SIMPLE_CODE_TASK_PATTERN.test(trimmed) || words <= 10)) {
    return true;
  }
  if (TECHNICAL_DEEP_PATTERN.test(trimmed) && !TRIVIAL_CODE_PATTERN.test(trimmed)) {
    return false;
  }
  return TRIVIAL_CODE_PATTERN.test(trimmed) || (words <= 5 && SIMPLE_CODE_TASK_PATTERN.test(trimmed));
}

function shouldForceDeepTechnicalRoute(text, previousText = "", intent = null) {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  if (intent?.type === "contest") {
    return true;
  }

  if (intent?.type === "coding") {
    if (intent.needsDepth || intent.previousIsMeaningful || intent.words > 6) {
      return true;
    }
    if (TECHNICAL_DEEP_PATTERN.test(trimmed)) {
      return true;
    }
  }

  if (TECHNICAL_DEEP_PATTERN.test(trimmed) && !isSimpleCodeTask(trimmed, previousText)) {
    return true;
  }

  return false;
}

function energyMeta(targetRole) {
  return targetRole === "deep"
    ? {
        energyMode: "high",
        energyScore: "D"
      }
    : {
        energyMode: "low",
        energyScore: "A"
      };
}

export async function chooseRoute({ messages, mode, intent = null, workspaceMode = "general" }) {
  const userMessages = messages.filter((m) => m.role === "user");
  const latestUser = userMessages[userMessages.length - 1];
  const previousUser = userMessages[userMessages.length - 2];
  const latestRawText = latestUser?.content || "";
  const previousRawText = previousUser?.content || "";
  const latestText = stripAttachmentContext(latestRawText);
  const previousText = stripAttachmentContext(previousRawText);
  const normalizedLatestText = normalizeInput(latestText);
  const hasLatestAttachmentContext = ATTACHMENT_MARKER_PATTERN.test(latestRawText);
  const recentAttachmentContext = userMessages.slice(-3).some((message) => ATTACHMENT_MARKER_PATTERN.test(message.content || ""));
  const effectiveWorkspaceMode = normalizeWorkspaceMode(workspaceMode || intent?.workspaceMode);

  if (mode === "fast") {
    return {
      targetRole: "fast",
      modelLabel: process.env.FAST_MODEL || "fast-model",
      reason: "manual low-energy mode",
      ...energyMeta("fast")
    };
  }

  if (mode === "deep") {
    return {
      targetRole: "deep",
      modelLabel: process.env.DEEP_MODEL || "deep-model",
      reason: "manual high-energy mode",
      ...energyMeta("deep")
    };
  }

  if (workspaceModeRequiresDeep(effectiveWorkspaceMode)) {
    return {
      targetRole: "deep",
      modelLabel: process.env.DEEP_MODEL || "deep-model",
      reason: `workspace mode: ${workspaceModeLabel(effectiveWorkspaceMode)} -> high energy`,
      ...energyMeta("deep")
    };
  }

  if (
    CASUAL_CHAT_PATTERN.test(normalizedLatestText) ||
    ASSISTANT_META_PATTERN.test(normalizedLatestText) ||
    DATE_TIME_QUERY_PATTERN.test(normalizedLatestText)
  ) {
    return {
      targetRole: "fast",
      modelLabel: process.env.FAST_MODEL || "fast-model",
      reason: "auto balance: casual/meta query -> low energy",
      ...energyMeta("fast")
    };
  }

  if (CONTEST_PATTERN.test(normalizedLatestText)) {
    return {
      targetRole: "deep",
      modelLabel: process.env.DEEP_MODEL || "deep-model",
      reason: "auto balance: contest/coding-problem prompt -> high energy",
      ...energyMeta("deep")
    };
  }

  if (hasLatestAttachmentContext) {
    return {
      targetRole: "deep",
      modelLabel: process.env.DEEP_MODEL || "deep-model",
      reason: "auto balance: attached file context -> high energy",
      ...energyMeta("deep")
    };
  }

  if (recentAttachmentContext && FILE_FOLLOWUP_PATTERN.test(latestText)) {
    return {
      targetRole: "deep",
      modelLabel: process.env.DEEP_MODEL || "deep-model",
      reason: "auto balance: attached file follow-up -> high energy",
      ...energyMeta("deep")
    };
  }

  if (isSimpleCodeTask(latestText, previousText)) {
    return {
      targetRole: "fast",
      modelLabel: process.env.FAST_MODEL || "fast-model",
      reason: "auto balance: simple code task -> low energy",
      ...energyMeta("fast")
    };
  }

  if (shouldForceDeepTechnicalRoute(latestText, previousText, intent)) {
    return {
      targetRole: "deep",
      modelLabel: process.env.DEEP_MODEL || "deep-model",
      reason: `auto balance: technical prompt (${intent?.type || "general"}) -> high energy`,
      ...energyMeta("deep")
    };
  }

  const wordCount = countWords(latestText);
  const intentRouteHint = intent?.routeHint || null;
  const followupNeedsDepth = isContextFollowup(latestText) && (wantsDepth(latestText) || hasDeepSignal(previousText));
  const deepSignal = hasDeepSignal(latestText) || followupNeedsDepth || wordCount > 120 || latestText.includes("\n");

  if (followupNeedsDepth) {
    return {
      targetRole: "deep",
      modelLabel: process.env.DEEP_MODEL || "deep-model",
      reason: "auto balance: follow-up requested deeper reasoning -> high energy",
      ...energyMeta("deep")
    };
  }

  if (intentRouteHint === "fast" && mode === "auto") {
    return {
      targetRole: "fast",
      modelLabel: process.env.FAST_MODEL || "fast-model",
      reason: `auto balance: intent=${intent?.type || "general"} -> low energy`,
      ...energyMeta("fast")
    };
  }

  if (intentRouteHint === "deep" && mode === "auto") {
    return {
      targetRole: "deep",
      modelLabel: process.env.DEEP_MODEL || "deep-model",
      reason: `auto balance: intent=${intent?.type || "general"} -> high energy`,
      ...energyMeta("deep")
    };
  }

  const heuristicRole = deepSignal ? "deep" : "fast";
  const heuristicReason = deepSignal
    ? `heuristic=deep (words=${wordCount})`
    : `heuristic=fast (words=${wordCount})`;

  try {
    const routerVote = await classifyRoute(latestText);
    const votedRole = routerVote?.targetRole;
    const targetRole = votedRole || heuristicRole;
    const reason = votedRole
      ? `auto balance: ${heuristicReason}, router=${votedRole} (${routerVote.model})`
      : `auto balance: ${heuristicReason}, router=fallback`;

    return {
      targetRole,
      modelLabel: targetRole === "deep" ? process.env.DEEP_MODEL || "deep-model" : process.env.FAST_MODEL || "fast-model",
      reason,
      ...energyMeta(targetRole)
    };
  } catch {
    return {
      targetRole: heuristicRole,
      modelLabel: heuristicRole === "deep" ? process.env.DEEP_MODEL || "deep-model" : process.env.FAST_MODEL || "fast-model",
      reason: `auto balance: ${heuristicReason}, router=error fallback`,
      ...energyMeta(heuristicRole)
    };
  }
}
