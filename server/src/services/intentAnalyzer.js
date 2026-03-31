const CASUAL_CHAT_PATTERN =
  /^(hi|hello|hey|yo|hi there|hello there|good morning|good evening|good afternoon|how are you|how are u|thanks|thank you|ok|okay|cool|nice|good|bye|goodbye|see you|see ya|later)\b/i;
const IDENTITY_PATTERN =
  /^(what(?:'s| is)\s+your\s+name|who\s+are\s+you|which\s+model\s+are\s+you|what\s+is\s+your\s+model\s+name|what\s+model\s+are\s+you)\??$/i;
const DATE_TIME_PATTERN =
  /^(?:(?:can\s+i\s+know|tell\s+me|do\s+you\s+know)\s+)?(?:(?:what(?:'s| is)?|which)\s+)?(?:(today'?s?|current|now)\s+)?(date|time|day)(?:\s+(?:today|now|it\s+is|is\s+it))?\??$/i;
const CODING_PATTERN =
  /\b(code|function|program|script|debug|bug|fix|refactor|algorithm|data structure|react|node|javascript|typescript|python|java|c\+\+|sql|api)\b/i;
const CONTEST_PATTERN =
  /\b(leetcode|codeforces|codechef|hackerrank|coding ninjas|contest|competitive programming|input format|output format|constraints?|subarray|substring|graph|tree|grid|matrix|intervals?|merge intervals|maximum subarray|kadane|course schedule|coin change|lis|longest increasing subsequence|dp|dynamic programming|greedy|shortest path|topological|union find|disjoint set|binary search on answer)\b|(?:n|m|k)\s*(?:<=|<)\s*\d+/i;
const DOWNLOAD_PATTERN =
  /\b(download|installer|installation|setup|apk|exe|dmg|zip|tar\.gz|github release|official link|get the link|download link)\b/i;
const SHOPPING_PATTERN =
  /\b(buy|purchase|worth buying|best price|pricing|price|deal|budget|under\s+\$?\d+|recommend .* buy|which .* buy)\b/i;
const BUILDER_PATTERN =
  /\b(ai builders?|website builders?|app builders?|landing page builders?|agent builders?|builder for my project|builder for project|no[-\s]?code|low[-\s]?code)\b/i;
const RECOMMENDATION_PATTERN = /\b(best|top|recommend|suggest|alternatives?|options?)\b/i;
const PLANNING_PATTERN =
  /\b(plan|roadmap|strategy|steps|mvp|milestones|launch|build|create|design|architecture|project)\b/i;
const COMPARISON_PATTERN = /\b(compare|comparison|difference|vs\b|versus|better|trade-?offs?|pros and cons)\b/i;
const DEFINITION_PATTERN =
  /^(?:(?:can\s+i\s+know|do\s+you\s+know|tell\s+me|can\s+you\s+tell\s+me|could\s+you\s+tell\s+me|please\s+tell\s+me)\s+)?(what|who)\s+is\b|^define\b|^meaning of\b/i;
const STANDALONE_DEFINITION_PATTERN =
  /^(ai|llm|rag|ml|dl|nlp|cv|iot|api|ui|ux|cpu|gpu|ram|rom|dns|tcp|udp|sql|jwt|dbms|os|oops?|oop|coa|toc|se|dsa|daa|pysd|mac|macbook|gf|chai)$/i;
const EXPLANATION_PATTERN = /\b(explain|overview|teach me|how does|how do|why does|why do)\b/i;
const TRANSLATION_PATTERN = /^translate\b/i;
const SUMMARY_PATTERN = /^(summari[sz]e|tl;dr)\b/i;
const CREATIVE_PATTERN = /\b(story|poem|lyrics?|caption|creative writing|roleplay)\b/i;
const DEPTH_PATTERN =
  /\b(in depth|deeply|detailed|step by step|advanced|trade-?offs?|architecture|production|scalable|research)\b/i;

export function normalizeUserText(text) {
  return normalizeNaturalLanguageText(text)
    .trim()
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/[^A-Za-z0-9]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(text) {
  return normalizeUserText(text).split(/\s+/).filter(Boolean).length;
}

function isMeaningfulContext(text) {
  const normalized = normalizeUserText(text);
  if (!normalized) {
    return false;
  }
  if (CASUAL_CHAT_PATTERN.test(normalized) || IDENTITY_PATTERN.test(normalized) || DATE_TIME_PATTERN.test(normalized)) {
    return false;
  }
  return wordCount(normalized) > 2;
}

function detectIntentType(text) {
  if (!text) {
    return "empty";
  }
  if (CASUAL_CHAT_PATTERN.test(text)) {
    return "casual";
  }
  if (IDENTITY_PATTERN.test(text)) {
    return "identity";
  }
  if (DATE_TIME_PATTERN.test(text)) {
    return "datetime";
  }
  if (DEFINITION_PATTERN.test(text) || STANDALONE_DEFINITION_PATTERN.test(text)) {
    return "definition";
  }
  if (DOWNLOAD_PATTERN.test(text)) {
    return "download";
  }
  if (BUILDER_PATTERN.test(text)) {
    return "builder";
  }
  if (SHOPPING_PATTERN.test(text)) {
    return "shopping";
  }
  if (CONTEST_PATTERN.test(text)) {
    return "contest";
  }
  if (TRANSLATION_PATTERN.test(text)) {
    return "translation";
  }
  if (SUMMARY_PATTERN.test(text)) {
    return "summary";
  }
  if (COMPARISON_PATTERN.test(text)) {
    return "comparison";
  }
  if (CODING_PATTERN.test(text)) {
    return "coding";
  }
  if (PLANNING_PATTERN.test(text)) {
    return "planning";
  }
  if (RECOMMENDATION_PATTERN.test(text)) {
    return "recommendation";
  }
  if (EXPLANATION_PATTERN.test(text)) {
    return "explanation";
  }
  if (CREATIVE_PATTERN.test(text)) {
    return "creative";
  }
  return "general";
}

function responseStyleFor(type, needsDepth) {
  if (type === "coding") {
    return "code";
  }
  if (type === "contest") {
    return "code";
  }
  if (type === "comparison") {
    return "comparison";
  }
  if (["shopping", "download", "builder", "recommendation"].includes(type)) {
    return "recommendation";
  }
  if (type === "planning") {
    return "plan";
  }
  if (type === "casual" || type === "identity" || type === "datetime") {
    return "chat";
  }
  return needsDepth ? "structured" : "direct";
}

function shouldFetchKnowledge(type, text) {
  if (!text || text.length < 8) {
    return false;
  }
  if (["casual", "identity", "datetime", "coding", "contest", "creative", "translation", "summary", "empty"].includes(type)) {
    return false;
  }
  return true;
}

function routeHintFor(type, needsDepth, words) {
  if (["casual", "identity", "datetime", "translation", "summary", "empty"].includes(type)) {
    return "fast";
  }
  if (["shopping", "download", "builder", "recommendation"].includes(type)) {
    return "deep";
  }
  if (type === "contest") {
    return "deep";
  }
  if (type === "comparison" || type === "planning") {
    return "deep";
  }
  if (type === "coding") {
    return needsDepth || words > 6 ? "deep" : "fast";
  }
  if (type === "definition") {
    return needsDepth ? "deep" : "fast";
  }
  if (type === "explanation" || type === "general") {
    return needsDepth || words > 22 ? "deep" : "fast";
  }
  return needsDepth ? "deep" : "fast";
}

function searchProfileFor(type) {
  if (type === "download") {
    return "download";
  }
  if (type === "shopping") {
    return "shopping";
  }
  if (type === "builder") {
    return "builder";
  }
  if (type === "recommendation") {
    return "recommendation";
  }
  return "reference";
}

export function analyzeUserIntent({ messages = [], mode = "auto", workspaceMode = "general" } = {}) {
  const userMessages = messages.filter((message) => message.role === "user");
  const latestRawText = userMessages[userMessages.length - 1]?.content || "";
  const previousRawText = userMessages[userMessages.length - 2]?.content || "";
  const normalizedText = normalizeUserText(latestRawText);
  const normalizedPreviousText = normalizeUserText(previousRawText);
  const normalizedWorkspaceMode = normalizeWorkspaceMode(workspaceMode);
  const words = wordCount(normalizedText);
  const type = detectIntentType(normalizedText);
  const needsDepth =
    workspaceModeRequiresDeep(normalizedWorkspaceMode) ||
    DEPTH_PATTERN.test(normalizedText) ||
    normalizedText.includes("\n") ||
    words > 50;

  return {
    mode,
    workspaceMode: normalizedWorkspaceMode,
    rawText: latestRawText,
    normalizedText,
    previousRawText,
    normalizedPreviousText,
    previousIsMeaningful: isMeaningfulContext(normalizedPreviousText),
    type,
    words,
    needsDepth,
    responseStyle: responseStyleFor(type, needsDepth),
    shouldFetchKnowledge: shouldFetchKnowledge(type, normalizedText),
    searchProfile: searchProfileFor(type),
    routeHint: routeHintFor(type, needsDepth, words),
    ignoreConversationContext: ["casual", "identity", "datetime", "empty"].includes(type)
  };
}
import { normalizeNaturalLanguageText } from "./textNormalization.js";
import { normalizeWorkspaceMode, workspaceModeRequiresDeep } from "./workspaceMode.js";
