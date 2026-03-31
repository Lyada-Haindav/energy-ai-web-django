import { normalizeNaturalLanguageText } from "./textNormalization.js";

export const DEFAULT_WORKSPACE_MODE = "general";

const WORKSPACE_MODES = {
  general: {
    label: "Auto Detect",
    forceDeep: false,
    instructions: "Infer the best coding workflow from the user's prompt and attachments before answering."
  },
  coding: {
    label: "Coding",
    forceDeep: true,
    instructions: "Treat the request like a serious coding task. Prefer concrete implementation detail over generic advice."
  },
  "bug-fix": {
    label: "Bug Fix",
    forceDeep: true,
    instructions: "Prioritize root cause analysis, likely failure points, minimal safe fixes, and how to verify the fix."
  },
  "code-review": {
    label: "Code Review",
    forceDeep: true,
    instructions: "Review for bugs, regressions, risky patterns, missing tests, and maintainability problems. Findings first."
  },
  refactor: {
    label: "Refactor",
    forceDeep: true,
    instructions: "Focus on safer structure, reducing duplication, and preserving behavior while improving readability."
  },
  tests: {
    label: "Tests",
    forceDeep: true,
    instructions: "Focus on test strategy, edge cases, failure paths, and concrete unit or integration test coverage."
  },
  "explain-code": {
    label: "Explain Code",
    forceDeep: true,
    instructions: "Explain code step by step, including flow, inputs, outputs, side effects, and important tradeoffs."
  },
  "error-log": {
    label: "Error Log",
    forceDeep: true,
    instructions: "Analyze stack traces and logs, identify the probable root cause, and suggest the fastest verification path."
  },
  "api-contract": {
    label: "API Contract",
    forceDeep: true,
    instructions: "Focus on endpoints, request and response shape, auth boundaries, validation, and error handling."
  },
  a11y: {
    label: "A11y",
    forceDeep: true,
    instructions: "Focus on accessibility: semantics, landmarks, labels, focus handling, contrast, and keyboard navigation."
  },
  performance: {
    label: "Performance",
    forceDeep: true,
    instructions: "Focus on rendering cost, bundle size, network waste, repeated work, and practical performance wins."
  },
  security: {
    label: "Security",
    forceDeep: true,
    instructions: "Focus on auth, validation, secrets, trust boundaries, injection risk, session handling, and abuse protection."
  },
  "stack-detect": {
    label: "Stack Detect",
    forceDeep: true,
    instructions: "Infer the likely tech stack, architecture, and supporting tools from the attached files or code."
  },
  lint: {
    label: "Lint Hints",
    forceDeep: true,
    instructions: "Focus on formatting, consistency, naming, type safety, dead code, and idiomatic patterns."
  }
};

export function normalizeWorkspaceMode(value) {
  const key = String(value || DEFAULT_WORKSPACE_MODE).trim().toLowerCase();
  return WORKSPACE_MODES[key] ? key : DEFAULT_WORKSPACE_MODE;
}

export function workspaceModeConfig(value) {
  return WORKSPACE_MODES[normalizeWorkspaceMode(value)];
}

export function workspaceModeLabel(value) {
  return workspaceModeConfig(value).label;
}

export function workspaceModeRequiresDeep(value) {
  return workspaceModeConfig(value).forceDeep;
}

export function workspaceModeInstructions(value) {
  return workspaceModeConfig(value).instructions;
}

export function describeWorkspaceModes() {
  return Object.entries(WORKSPACE_MODES).map(([id, config]) => ({
    id,
    label: config.label,
    forceDeep: config.forceDeep
  }));
}

const MODE_PATTERNS = [
  { id: "code-review", pattern: /\b(code review|review this|review the|check this(?: code| file)?|audit|inspect|bad patterns?|smells?|regression|find risks?|find issues?|find bugs?)\b/i },
  { id: "performance", pattern: /\b(performance|slow|latency|optimi[sz]e|faster|rendering|bundle size|memory leak|laggy|janky|clunky)\b/i },
  { id: "a11y", pattern: /\b(accessibility|accessible|a11y|keyboard navigation|screen reader|contrast|focus state)\b/i },
  { id: "bug-fix", pattern: /\b(bug|bugs|fix|not working|broken|issue|issues|why .* not|not available|not visible|not showing|not loading|not opening|error|errors|failing|failure|wont work|won't work|cant|can't|isnt|isn't)\b/i },
  { id: "tests", pattern: /\b(test|tests|test case|test cases|unit test|integration test|coverage)\b/i },
  { id: "refactor", pattern: /\b(refactor|cleanup|clean up|restructure|make cleaner|simplify the code|make it neat|make this neat|compact this)\b/i },
  { id: "explain-code", pattern: /\b(explain this code|explain the code|walk me through|step by step|how this works|what does this do|break this down|structure of this file)\b/i },
  { id: "error-log", pattern: /\b(stack trace|traceback|error log|logs|exception|stderr|console error)\b/i },
  { id: "api-contract", pattern: /\b(api contract|request body|response body|endpoint|schema|status code|swagger|openapi)\b/i },
  { id: "security", pattern: /\b(security|secure|vulnerability|auth review|xss|csrf|injection|token leak|permission)\b/i },
  { id: "stack-detect", pattern: /\b(tech stack|stack detect|which framework|what framework|what stack|what technology|detect stack)\b/i },
  { id: "lint", pattern: /\b(lint|eslint|prettier|format this|style issue|naming issue|clean formatting)\b/i },
  { id: "coding", pattern: /\b(code|coding|implement|write a function|build this|create this|debug this|react|node|typescript|javascript|python|java|c\+\+|api)\b/i }
];

const STACK_TRACE_PATTERN = /\b(?:at\s+[A-Za-z0-9_$./<>]+\s+\(|traceback|exception|error:)\b/i;
const LOG_FILE_PATTERN = /\.(log|out|err|txt)$/i;
const CODE_FILE_PATTERN = /\.(c|cc|cpp|cs|css|go|h|hpp|html|java|js|json|jsx|kt|md|php|py|rb|rs|sh|sql|swift|ts|tsx|vue|xml|yaml|yml)$/i;
const VAGUE_FOLLOWUP_PATTERN = /^(do it|fix it|review it|explain it|improve it|make it better|continue|next|again|here|this one|that one|same file|go on|carry on|keep going|okay|ok|yes|yeah|yep|sure|kk|alr|alright)$/i;

function recentUserTexts(messages = []) {
  return messages
    .filter((message) => message?.role === "user")
    .map((message) => String(message?.content || "").trim())
    .filter(Boolean)
    .slice(-3)
    .reverse();
}

export function inferWorkspaceMode({ text = "", attachments = [], messages = [] } = {}) {
  const normalizedText = normalizeNaturalLanguageText(text);
  const recentTexts = recentUserTexts(messages);
  const previousMeaningfulText = recentTexts.find((entry) => entry !== normalizedText) || "";
  const combinedText = [normalizedText, previousMeaningfulText].filter(Boolean).join(" ").trim();
  const activeText = VAGUE_FOLLOWUP_PATTERN.test(normalizedText) ? combinedText : normalizedText || previousMeaningfulText;
  const recentAttachments = Array.isArray(messages)
    ? messages
        .filter((message) => message?.role === "user")
        .slice(-3)
        .flatMap((message) => Array.isArray(message?.meta?.attachments) ? message.meta.attachments : [])
    : [];
  const allAttachments = [...attachments, ...recentAttachments];

  if (allAttachments.some((attachment) => LOG_FILE_PATTERN.test(String(attachment.name || "")) || STACK_TRACE_PATTERN.test(String(attachment.content || "")))) {
    return "error-log";
  }

  for (const entry of MODE_PATTERNS) {
    if (entry.pattern.test(activeText)) {
      return entry.id;
    }
  }

  if (allAttachments.some((attachment) => CODE_FILE_PATTERN.test(String(attachment.name || "")))) {
    return "coding";
  }

  return DEFAULT_WORKSPACE_MODE;
}
